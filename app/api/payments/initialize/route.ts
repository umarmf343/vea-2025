import { type NextRequest, NextResponse } from "next/server"
import { recordPaymentInitialization } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_your_secret_key_here"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, amount, metadata, studentId, paymentType } = body

    if (!email || !amount) {
      return NextResponse.json({ status: false, message: "Email and amount are required" }, { status: 400 })
    }

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount,
        metadata,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/callback`,
      }),
    })

    const data = await response.json()

    if (data.status) {
      try {
        await recordPaymentInitialization({
          reference: data.data?.reference ?? data.data?.access_code ?? `paystack_${Date.now()}`,
          amount: Number(amount),
          studentId: studentId ? String(studentId) : null,
          paymentType: paymentType ? sanitizeInput(paymentType) : "general",
          email: sanitizeInput(email),
          status: "pending",
          paystackReference: data.data?.reference ?? null,
          metadata: metadata ?? undefined,
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
