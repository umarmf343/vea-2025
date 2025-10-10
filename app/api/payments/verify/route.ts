import { randomUUID } from "node:crypto"

import { type NextRequest, NextResponse } from "next/server"

import {
  createOrUpdateReceipt,
  createFeePaymentRecord,
  findPaymentByReference,
  recordPaymentInitialization,
  updatePaymentRecord,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"
import {
  DEVELOPER_REVENUE_SHARE_PERCENTAGE,
  ensurePartnerSplitConfiguration,
  getPaystackSecretKey,
} from "@/lib/paystack"
import { publishNotification } from "@/lib/realtime-hub"
import { recordDeveloperSplit } from "@/lib/developer-audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

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

function resolveParentName(metadata: Record<string, unknown>): string | null {
  const candidates = [
    metadata.parent_name,
    metadata.parentName,
    metadata.guardian_name,
    metadata.guardianName,
    metadata.customer_name,
    metadata.customerName,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeInput(candidate)
    }
  }

  return null
}

function resolveParentEmail(metadata: Record<string, unknown>): string | null {
  const candidates = [
    metadata.parent_email,
    metadata.parentEmail,
    metadata.guardian_email,
    metadata.guardianEmail,
    metadata.customer_email,
    metadata.customerEmail,
    metadata.email,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeInput(candidate).toLowerCase()
    }
  }

  return null
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
      const totalAmountKobo = Number(gatewayData.amount)
      const amountInNaira = totalAmountKobo / 100
      const paystackReference =
        typeof gatewayData.reference === "string" && gatewayData.reference.trim().length > 0
          ? sanitizeInput(gatewayData.reference)
          : sanitizedReference
      const metadata = sanitizeMetadataInput(gatewayData.metadata)
      const developerShareKobo = Math.round((totalAmountKobo * DEVELOPER_REVENUE_SHARE_PERCENTAGE) / 100)
      const schoolNetKobo = Math.max(totalAmountKobo - developerShareKobo, 0)
      const schoolNetAmount = Number((schoolNetKobo / 100).toFixed(2))
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
      metadata.totalPaid = amountInNaira
      metadata.total_paid = amountInNaira
      metadata.schoolFeePaid = true
      metadata.school_fee_paid = true

      let studentName = resolveStudentName(metadata)
      const parentName = resolveParentName(metadata)
      let parentEmail = resolveParentEmail(metadata)

      metadata.studentName = studentName
      metadata.student_name = studentName

      if (parentName) {
        metadata.parentName = parentName
        metadata.parent_name = parentName
      }

      const customerEmail =
        gatewayData.customer && typeof gatewayData.customer.email === "string"
          ? sanitizeInput(gatewayData.customer.email)
          : ""

      if (!parentEmail && customerEmail) {
        parentEmail = customerEmail.toLowerCase()
      }

      if (parentEmail) {
        metadata.parentEmail = parentEmail
        metadata.parent_email = parentEmail
      }

      let paymentRecord = await findPaymentByReference(paystackReference)

      if (!paymentRecord && paystackReference !== sanitizedReference) {
        paymentRecord = await findPaymentByReference(sanitizedReference)
      }

      let ledgerPaymentId: string | null = null
      if (paymentRecord?.metadata && typeof paymentRecord.metadata === "object") {
        const existingMeta = paymentRecord.metadata as Record<string, unknown>
        ledgerPaymentId =
          typeof existingMeta.ledgerPaymentId === "string"
            ? existingMeta.ledgerPaymentId
            : typeof existingMeta.ledger_payment_id === "string"
              ? existingMeta.ledger_payment_id
              : null
      }

      const classNameValue =
        typeof metadata.className === "string"
          ? metadata.className
          : typeof metadata.class_name === "string"
            ? metadata.class_name
            : null
      const classIdValue =
        typeof metadata.classId === "string"
          ? metadata.classId
          : typeof metadata.class_id === "string"
            ? metadata.class_id
            : null
      const schoolFeeConfigId =
        typeof metadata.school_fee_configuration_id === "string"
          ? metadata.school_fee_configuration_id
          : typeof metadata.schoolFeeConfigurationId === "string"
            ? metadata.schoolFeeConfigurationId
            : null
      const eventFeeIds = Array.isArray(metadata.event_fee_ids)
        ? metadata.event_fee_ids
            .map((value) =>
              typeof value === "string" || typeof value === "number" ? String(value) : "",
            )
            .filter((value) => value.length > 0)
        : []

      const ledgerContext = { userId: "system_paystack", userName: "Automated Paystack Settlement" }

      if (!ledgerPaymentId) {
        try {
          const ledgerRecord = await createFeePaymentRecord(
            {
              studentId: studentId ?? null,
              studentName,
              classId: classIdValue ?? null,
              className: classNameValue ?? null,
              feeType: paymentType.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()),
              amount: schoolNetAmount,
              paymentDate:
                typeof gatewayData.paid_at === "string"
                  ? new Date(gatewayData.paid_at).toISOString()
                  : nowIso,
              paymentMethod: channel,
              paymentReference: paystackReference,
              term: typeof metadata.term === "string" ? metadata.term : "Unspecified",
              schoolFeeConfigId,
              eventFeeIds,
            },
            ledgerContext,
          )

          ledgerPaymentId = ledgerRecord.id
          metadata.ledgerPaymentId = ledgerRecord.id
          metadata.ledger_payment_id = ledgerRecord.id
        } catch (ledgerError) {
          console.error("Failed to record settlement in ledger:", ledgerError)
        }
      } else {
        metadata.ledgerPaymentId = ledgerPaymentId
        metadata.ledger_payment_id = ledgerPaymentId
      }

      try {
        const splitConfiguration = await ensurePartnerSplitConfiguration()
        recordDeveloperSplit({
          reference: paystackReference,
          grossAmountKobo: totalAmountKobo,
          developerShareKobo,
          schoolNetAmountKobo: schoolNetKobo,
          splitCode: splitConfiguration.splitCode,
          subaccountCode: splitConfiguration.subaccountCode,
          recordedAt: nowIso,
        })
      } catch (auditError) {
        console.error("Internal audit log failure:", auditError)
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

      studentName = resolveStudentName(metadata)
      metadata.studentName = studentName
      metadata.student_name = studentName
      const finalParentName = resolveParentName(metadata) ?? parentName
      const finalParentEmail = resolveParentEmail(metadata) ?? parentEmail

      if (finalParentName) {
        metadata.parentName = finalParentName
        metadata.parent_name = finalParentName
      }

      if (finalParentEmail) {
        metadata.parentEmail = finalParentEmail
        metadata.parent_email = finalParentEmail
      }
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

      try {
        publishNotification({
          id: randomUUID(),
          title: finalParentName ? `Payment received from ${finalParentName}` : "Payment verified",
          body: `${studentName} • ₦${amountInNaira.toLocaleString()} (${paymentType})`,
          category: "payment",
          createdAt: nowIso,
          targetUserIds: [],
          targetRoles: ["admin", "super_admin", "accountant"],
          actionUrl: "/?tab=payments",
          meta: {
            paymentId: paymentRecord.id,
            studentId,
            parentName: finalParentName,
            parentEmail: finalParentEmail,
            amount: amountInNaira,
            paymentType,
            reference: paystackReference,
          },
        })
      } catch (notificationError) {
        console.error("Failed to broadcast payment notification:", notificationError)
      }

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
