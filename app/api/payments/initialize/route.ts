import { type NextRequest, NextResponse } from "next/server"

import {
  type EventFeeConfigurationRecord,
  getActiveSchoolFeeConfigurationForClass,
  getEventFeeConfigurationById,
  getSchoolFeeConfigurationById,
  getStudentRecordById,
  recordPaymentInitialization,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"
import { ensurePartnerSplitConfiguration, getPaystackSecretKey } from "@/lib/paystack"

export const runtime = "nodejs"

const PAYSTACK_SECRET_KEY = getPaystackSecretKey()

const TERM_LABEL_MAP: Record<string, string> = {
  "first": "First Term",
  "first term": "First Term",
  "1st term": "First Term",
  "second": "Second Term",
  "second term": "Second Term",
  "2nd term": "Second Term",
  "third": "Third Term",
  "third term": "Third Term",
  "3rd term": "Third Term",
}

const canonicalTermKeyLocal = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ")

const canonicalClassKeyLocal = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\b([a-z])$/i, "").trim()

function resolveTermLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "First Term"
  }

  const normalized = value.trim().toLowerCase()
  return TERM_LABEL_MAP[normalized] ?? value.trim()
}

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

    if (!email) {
      return NextResponse.json(
        { status: false, message: "Valid email is required" },
        { status: 400 },
      )
    }

    const sanitizedEmail = sanitizeInput(email)
    const sanitizedMetadata = sanitizeMetadataInput(body.metadata)
    const requestedTerm = resolveTermLabel(
      body.term ??
        body.termKey ??
        sanitizedMetadata.term ??
        sanitizedMetadata.term_label ??
        sanitizedMetadata.termName,
    )
    const requestedSession =
      typeof body.session === "string"
        ? sanitizeInput(body.session)
        : typeof sanitizedMetadata.session === "string"
          ? sanitizeInput(String(sanitizedMetadata.session))
          : undefined
    if (requestedSession) {
      sanitizedMetadata.session = requestedSession
    }
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

    let resolvedClassName =
      typeof body.className === "string"
        ? sanitizeInput(body.className)
        : typeof sanitizedMetadata.class_name === "string"
          ? sanitizeInput(String(sanitizedMetadata.class_name))
          : typeof sanitizedMetadata.className === "string"
            ? sanitizeInput(String(sanitizedMetadata.className))
            : null

    const studentRecord = sanitizedStudentId ? await getStudentRecordById(sanitizedStudentId) : null
    if (studentRecord?.class && studentRecord.class.trim().length > 0) {
      resolvedClassName = sanitizeInput(studentRecord.class)
    }

    if (!resolvedClassName) {
      return NextResponse.json(
        { status: false, message: "Student class information is required for payment" },
        { status: 400 },
      )
    }

    sanitizedMetadata.term = requestedTerm
    ensureMetadataAlias(sanitizedMetadata, "className", resolvedClassName)

    sanitizedMetadata.payment_type = normalizedPaymentType

    const classKey = canonicalClassKeyLocal(resolvedClassName)
    const isEventOnlyPayment = normalizedPaymentType === "event_fee"

    const requestedSchoolFeeId =
      typeof body.schoolFeeId === "string"
        ? sanitizeInput(body.schoolFeeId)
        : typeof sanitizedMetadata.school_fee_configuration_id === "string"
          ? sanitizeInput(String(sanitizedMetadata.school_fee_configuration_id))
          : null

    let schoolFeeConfig =
      requestedSchoolFeeId && requestedSchoolFeeId.length > 0
        ? await getSchoolFeeConfigurationById(requestedSchoolFeeId)
        : null

    if (
      schoolFeeConfig &&
      (!schoolFeeConfig.isActive ||
        canonicalTermKeyLocal(schoolFeeConfig.term) !== canonicalTermKeyLocal(requestedTerm) ||
        canonicalClassKeyLocal(schoolFeeConfig.className) !== classKey)
    ) {
      schoolFeeConfig = null
    }

    if (!schoolFeeConfig && !isEventOnlyPayment) {
      schoolFeeConfig = await getActiveSchoolFeeConfigurationForClass(resolvedClassName, requestedTerm)
    }

    if (!schoolFeeConfig && !isEventOnlyPayment) {
      return NextResponse.json(
        {
          status: false,
          message: "No active school fee configuration found for this class and term.",
        },
        { status: 400 },
      )
    }

    const eventFeeSelectionsRaw = Array.isArray(body.eventFeeIds)
      ? body.eventFeeIds
      : Array.isArray(body.eventFees)
        ? body.eventFees
        : Array.isArray(sanitizedMetadata.event_fee_ids)
          ? sanitizedMetadata.event_fee_ids
          : []

    const selectedEventFeeIds = Array.from(
      new Set(
        eventFeeSelectionsRaw
          .map((value) => (typeof value === "string" || typeof value === "number" ? sanitizeInput(String(value)) : ""))
          .filter((value) => value.length > 0),
      ),
    )

    const eventFeeRecords: EventFeeConfigurationRecord[] = []
    let eventFeesTotal = 0

    for (const eventId of selectedEventFeeIds) {
      const eventRecord = await getEventFeeConfigurationById(eventId)
      if (!eventRecord || !eventRecord.isActive) {
        return NextResponse.json(
          { status: false, message: "One or more selected event fees are no longer available." },
          { status: 400 },
        )
      }

      if (
        eventRecord.applicableClassKeys.length > 0 &&
        !eventRecord.applicableClassKeys.some((key) => key === classKey)
      ) {
        return NextResponse.json(
          { status: false, message: "Selected event fee is not available for this class." },
          { status: 400 },
        )
      }

      eventFeeRecords.push(eventRecord)
      eventFeesTotal = Number((eventFeesTotal + Number(eventRecord.amount)).toFixed(2))
    }

    if (isEventOnlyPayment && eventFeeRecords.length === 0) {
      return NextResponse.json(
        { status: false, message: "Select at least one event fee to proceed." },
        { status: 400 },
      )
    }

    const schoolFeeAmount = schoolFeeConfig ? Number(schoolFeeConfig.amount) : 0
    const totalAmountInNaira = Number((schoolFeeAmount + eventFeesTotal).toFixed(2))
    const amountInKobo = Math.round(totalAmountInNaira * 100)

    if (!Number.isFinite(amountInKobo) || amountInKobo <= 0) {
      return NextResponse.json(
        { status: false, message: "Unable to determine payable amount for this transaction." },
        { status: 400 },
      )
    }

    if (
      body.amount !== undefined &&
      Number.isFinite(Number(body.amount)) &&
      Math.round(Number(body.amount)) !== amountInKobo
    ) {
      return NextResponse.json(
        { status: false, message: "Payment amount mismatch. Please refresh and try again." },
        { status: 400 },
      )
    }

    const amountInNaira = amountInKobo / 100

    const feeSnapshot = {
      schoolFee: schoolFeeConfig
        ? {
            id: schoolFeeConfig.id,
            className: schoolFeeConfig.className,
            term: schoolFeeConfig.term,
            amount: schoolFeeConfig.amount,
            version: schoolFeeConfig.version,
          }
        : null,
      eventFees: eventFeeRecords.map((entry) => ({
        id: entry.id,
        name: entry.name,
        amount: entry.amount,
        dueDate: entry.dueDate ?? null,
      })),
      total: totalAmountInNaira,
    }

    if (schoolFeeConfig) {
      sanitizedMetadata.school_fee_configuration_id = schoolFeeConfig.id
      sanitizedMetadata.schoolFeeConfigurationId = schoolFeeConfig.id
      sanitizedMetadata.school_fee_amount = Number(schoolFeeConfig.amount)
    }
    sanitizedMetadata.event_fee_total = eventFeesTotal
    sanitizedMetadata.total_due = totalAmountInNaira
    sanitizedMetadata.event_fee_ids = eventFeeRecords.map((entry) => entry.id)
    sanitizedMetadata.fee_snapshot = feeSnapshot

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
