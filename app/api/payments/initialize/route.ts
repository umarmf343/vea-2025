import { type NextRequest, NextResponse } from "next/server"
import { recordPaymentInitialization } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_your_secret_key_here"

function sanitizeMetadataInput(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {}
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue
    }

    sanitized[key] = typeof value === "string" ? sanitizeInput(value) : value
  }

  return sanitized
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email : ""
    const rawAmount = Number(body.amount)

    if (!email || Number.isNaN(rawAmount) || rawAmount <= 0) {
      return NextResponse.json(
        { status: false, message: "Valid email and amount are required" },
        { status: 400 },
      )
    }

    const amountInKobo = Math.round(rawAmount)
    const amountInNaira = amountInKobo / 100
    const sanitizedEmail = sanitizeInput(email)
    const sanitizedMetadata = sanitizeMetadataInput(body.metadata)
    const sanitizedStudentId =
      typeof body.studentId === "string" || typeof body.studentId === "number"
        ? sanitizeInput(String(body.studentId))
        : null
    const normalizedPaymentType =
      typeof body.paymentType === "string" && body.paymentType.trim().length > 0
        ? sanitizeInput(body.paymentType)
        : typeof sanitizedMetadata.payment_type === "string"
          ? sanitizeInput(String(sanitizedMetadata.payment_type))
          : "general"

    if (sanitizedStudentId) {
      sanitizedMetadata.student_id = sanitizedStudentId
      sanitizedMetadata.studentId = sanitizedStudentId
    }

    sanitizedMetadata.payment_type = normalizedPaymentType

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: sanitizedEmail,
        amount: amountInKobo,
        metadata: sanitizedMetadata,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/callback`,
      }),
    })

    const data = await response.json()

    if (data.status) {
      try {
        await recordPaymentInitialization({
          reference: data.data?.reference ?? data.data?.access_code ?? `paystack_${Date.now()}`,
          amount: amountInNaira,
          studentId: sanitizedStudentId,
          paymentType: normalizedPaymentType,
          email: sanitizedEmail,
          status: "pending",
          paystackReference: data.data?.reference ?? null,
          metadata: sanitizedMetadata,
        })
      } catch (dbError) {
        console.error("Failed to record payment initialization:", dbError)
      }

      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        { status: false, message: data.message || "Payment initialization failed" },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Payment initialization error:", error)
    return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 })
  }
}
