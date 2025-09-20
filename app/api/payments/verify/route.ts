import { type NextRequest, NextResponse } from "next/server"

import {
  createOrUpdateReceipt,
  findPaymentByReference,
  recordPaymentInitialization,
  updatePaymentRecord,
} from "@/lib/database"
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

function resolveStudentName(metadata: Record<string, unknown>): string {
  const fromSnake = metadata.student_name
  const fromCamel = metadata.studentName

  if (typeof fromSnake === "string" && fromSnake.trim().length > 0) {
    return fromSnake
  }

  if (typeof fromCamel === "string" && fromCamel.trim().length > 0) {
    return sanitizeInput(fromCamel)
  }

  return "Student"
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get("reference")

    if (!reference) {
      return NextResponse.json({ status: false, message: "Payment reference is required" }, { status: 400 })
    }

    const sanitizedReference = sanitizeInput(reference)

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    if (data.status && data.data.status === "success") {
      const gatewayData = data.data
      const amountInNaira = Number(gatewayData.amount) / 100
      const paystackReference =
        typeof gatewayData.reference === "string" && gatewayData.reference.trim().length > 0
          ? sanitizeInput(gatewayData.reference)
          : sanitizedReference
      const metadata = sanitizeMetadataInput(gatewayData.metadata)
      const studentIdRaw =
        typeof metadata.student_id === "string"
          ? metadata.student_id
          : typeof metadata.studentId === "string"
            ? sanitizeInput(String(metadata.studentId))
            : null
      const studentId = studentIdRaw && studentIdRaw.trim().length > 0 ? sanitizeInput(studentIdRaw) : null
      const paymentType =
        typeof metadata.payment_type === "string" && metadata.payment_type.trim().length > 0
          ? sanitizeInput(metadata.payment_type)
          : "general"
      const nowIso = new Date().toISOString()
      const channel =
        typeof gatewayData.channel === "string" && gatewayData.channel.trim().length > 0
          ? sanitizeInput(gatewayData.channel)
          : "online"

      if (studentId) {
        metadata.student_id = studentId
        metadata.studentId = studentId
      } else {
        delete metadata.student_id
        delete metadata.studentId
      }
      metadata.payment_type = paymentType
      metadata.payment_channel = channel
      metadata.accessGranted = true
      metadata.accessGrantedAt = nowIso
      metadata.verifiedAt = nowIso
      metadata.lastPaystackReference = paystackReference

      const customerEmail =
        gatewayData.customer && typeof gatewayData.customer.email === "string"
          ? sanitizeInput(gatewayData.customer.email)
          : ""

      let paymentRecord = await findPaymentByReference(paystackReference)

      if (!paymentRecord && paystackReference !== sanitizedReference) {
        paymentRecord = await findPaymentByReference(sanitizedReference)
      }

      if (!paymentRecord) {
        paymentRecord = await recordPaymentInitialization({
          reference: paystackReference,
          amount: amountInNaira,
          studentId,
          paymentType,
          email: customerEmail || "payments@vea-portal.local",
          status: "completed",
          paystackReference,
          metadata,
        })
      } else {
        const updated = await updatePaymentRecord(paymentRecord.id, {
          status: "completed",
          amount: amountInNaira,
          studentId: studentId ?? paymentRecord.studentId ?? null,
          paymentType,
          email: customerEmail || paymentRecord.email,
          reference: paystackReference,
          paystackReference,
          metadata,
        })

        if (updated) {
          paymentRecord = updated
        }
      }

      const studentName = resolveStudentName(metadata)
      const receipt = await createOrUpdateReceipt({
        paymentId: paymentRecord.id,
        studentName,
        amount: amountInNaira,
        reference: paystackReference,
        issuedBy: "Automated Verification",
        metadata: {
          paymentType,
          term: typeof metadata.term === "string" ? metadata.term : undefined,
          session: typeof metadata.session === "string" ? metadata.session : undefined,
          verifiedAt: nowIso,
          channel,
        },
      })

      return NextResponse.json({
        status: true,
        message: "Payment verified successfully",
        data: {
          reference: paystackReference,
          amount: amountInNaira,
          customer: gatewayData.customer,
          metadata,
          paid_at: gatewayData.paid_at,
          payment: paymentRecord,
          receipt,
        },
      })
    }

    try {
      const existing = await findPaymentByReference(sanitizedReference)
      if (existing) {
        await updatePaymentRecord(existing.id, {
          status: "failed",
          metadata: { lastVerificationAttempt: new Date().toISOString() },
        })
      }
    } catch (updateError) {
      console.error("Failed to update payment status after verification failure:", updateError)
    }

    return NextResponse.json({ status: false, message: "Payment verification failed" }, { status: 400 })
  } catch (error) {
    console.error("Payment verification error:", error)
    return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 })
  }
}
