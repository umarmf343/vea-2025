import { type NextRequest, NextResponse } from "next/server"

import { recordPaymentInitialization } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"
import {
  ensurePartnerSplitConfiguration,
  getPaystackSecretKey,
  REVENUE_PARTNER_DETAILS,
} from "@/lib/paystack"

export const runtime = "nodejs"

const PAYSTACK_SECRET_KEY = getPaystackSecretKey()

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

const normaliseString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }

  const cleaned = sanitizeInput(value)
  return cleaned.length > 0 ? cleaned : null
}

const ensureMetadataAlias = (
  metadata: Record<string, unknown>,
  key: string,
  value: string | null,
) => {
  if (!value) {
    return
  }

  const snakeKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
  metadata[key] = value
  metadata[snakeKey] = value
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
    const studentName =
      normaliseString(sanitizedMetadata.student_name) ?? normaliseString(sanitizedMetadata.studentName)
    const parentName =
      normaliseString(sanitizedMetadata.parent_name) ?? normaliseString(sanitizedMetadata.parentName)
    const parentEmail =
      normaliseString(sanitizedMetadata.parent_email) ?? normaliseString(sanitizedMetadata.parentEmail)
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

    ensureMetadataAlias(sanitizedMetadata, "studentName", studentName)
    ensureMetadataAlias(sanitizedMetadata, "parentName", parentName)
    ensureMetadataAlias(
      sanitizedMetadata,
      "parentEmail",
      parentEmail ? parentEmail.toLowerCase() : parentEmail,
    )

    sanitizedMetadata.payment_type = normalizedPaymentType

    let splitConfiguration
    try {
      splitConfiguration = await ensurePartnerSplitConfiguration()
    } catch (splitError) {
      console.error("Failed to prepare Paystack split configuration:", splitError)
      const message =
        splitError instanceof Error && splitError.message
          ? splitError.message
          : "Unable to prepare payment split configuration"
      return NextResponse.json({ status: false, message }, { status: 500 })
    }

    sanitizedMetadata.revenue_share = {
      beneficiary: REVENUE_PARTNER_DETAILS.accountName,
      account_number: REVENUE_PARTNER_DETAILS.accountNumber,
      bank: REVENUE_PARTNER_DETAILS.bankName,
      percentage: REVENUE_PARTNER_DETAILS.splitPercentage,
      split_code: splitConfiguration.splitCode,
      subaccount_code: splitConfiguration.subaccountCode,
    }

    const initializePayload: Record<string, unknown> = {
      email: sanitizedEmail,
      amount: amountInKobo,
      metadata: sanitizedMetadata,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/callback`,
      split_code: splitConfiguration.splitCode,
    }

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initializePayload),
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
