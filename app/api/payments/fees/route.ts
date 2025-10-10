import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  getActiveSchoolFeeConfigurationForClass,
  getStudentRecordById,
  listActiveEventFeesForClass,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

const resolveTermLabel = (value: string | null): string => {
  if (!value) {
    return "First Term"
  }

  const normalized = value.trim().toLowerCase()
  return TERM_LABEL_MAP[normalized] ?? value.trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const providedClassName = searchParams.get("className")
    const requestedTerm = resolveTermLabel(searchParams.get("term") ?? searchParams.get("termKey"))
    const session = searchParams.get("session")
    const scope = (searchParams.get("scope") ?? "").trim().toLowerCase()
    const eventOnly = scope === "event" || scope === "events" || scope === "event_only"

    let className: string | null = providedClassName ? sanitizeInput(providedClassName) : null

    if (studentId) {
      const student = await getStudentRecordById(studentId)
      if (student?.class && student.class.trim().length > 0) {
        className = sanitizeInput(student.class)
      }
    }

    if (!className) {
      return NextResponse.json(
        { error: "Class information is required to determine fees" },
        { status: 400 },
      )
    }

    const schoolFee = await getActiveSchoolFeeConfigurationForClass(className, requestedTerm)
    if (!schoolFee && !eventOnly) {
      return NextResponse.json(
        { error: "No active school fee configuration for the specified class and term" },
        { status: 404 },
      )
    }

    const eventFees = await listActiveEventFeesForClass(className)
    const eventPaymentTitle =
      eventFees.length === 1 ? eventFees[0]?.name ?? null : eventFees.length > 0 ? "Event Fees" : null

    return NextResponse.json({
      className,
      term: requestedTerm,
      session: session ? sanitizeInput(session) : null,
      schoolFee: schoolFee
        ? {
            id: schoolFee.id,
            amount: schoolFee.amount,
            className: schoolFee.className,
            term: schoolFee.term,
            version: schoolFee.version,
            notes: schoolFee.notes ?? null,
            effectiveDate: schoolFee.effectiveDate,
          }
        : null,
      eventFees: eventFees.map((event) => ({
        id: event.id,
        name: event.name,
        description: event.description ?? null,
        amount: event.amount,
        dueDate: event.dueDate ?? null,
        applicableClasses: event.applicableClasses,
      })),
      eventPaymentTitle,
    })
  } catch (error) {
    console.error("Failed to load fee configuration for payment:", error)
    return NextResponse.json({ error: "Unable to load fee configuration" }, { status: 500 })
  }
}
