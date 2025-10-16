import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createFeePaymentRecord,
  listFeePaymentRecords,
  listStudentRecords,
  recordFinancialAccessLog,
  type CreateFeePaymentPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger.server"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

const parseBoolean = (value: string | null): boolean => {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export async function GET(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin", "parent"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const term = normalizeString(searchParams.get("term")) || undefined
    const startDate = normalizeString(searchParams.get("startDate")) || undefined
    const endDate = normalizeString(searchParams.get("endDate")) || undefined
    const includeDeleted = parseBoolean(searchParams.get("includeDeleted"))

    let collections = await listFeePaymentRecords({ term, startDate, endDate, includeDeleted })

    if (context.role === "parent") {
      const rawStudentIds = Array.isArray(context.user?.studentIds)
        ? (context.user?.studentIds as Array<unknown>)
        : []
      const studentIds = rawStudentIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0)
      const normalizedIds = new Set(studentIds)
      const normalizedNames = new Set<string>()

      const metadata = (context.user?.metadata ?? {}) as Record<string, unknown>
      const linkedName = typeof metadata.linkedStudentName === "string" ? metadata.linkedStudentName.trim() : ""
      if (linkedName) {
        normalizedNames.add(linkedName.toLowerCase())
      }

      if (normalizedIds.size > 0) {
        try {
          const students = await listStudentRecords()
          students
            .filter((student) => normalizedIds.has(student.id))
            .forEach((student) => {
              if (student.name) {
                normalizedNames.add(student.name.trim().toLowerCase())
              }
              if (student.admissionNumber) {
                normalizedNames.add(student.admissionNumber.trim().toLowerCase())
              }
            })
        } catch (lookupError) {
          logger.warn("Unable to enrich parent collections filter with student registry", {
            error: lookupError instanceof Error ? lookupError.message : lookupError,
          })
        }
      }

      if (normalizedIds.size > 0 || normalizedNames.size > 0) {
        collections = collections.filter((record) => {
          const recordId = typeof record.studentId === "string" ? record.studentId.trim() : ""
          const recordName = typeof record.studentName === "string" ? record.studentName.trim().toLowerCase() : ""

          if (recordId && normalizedIds.has(recordId)) {
            return true
          }

          if (recordName && normalizedNames.has(recordName)) {
            return true
          }

          return false
        })
      } else {
        collections = []
      }
    }

    if (context.role === "super_admin") {
      try {
        await recordFinancialAccessLog({
          userId: context.userId,
          userRole: context.role,
          userName: context.name || context.user?.name || "Super Admin",
          action: "collections:view",
          filters: { term, startDate, endDate, includeDeleted },
        })
      } catch (logError) {
        logger.warn("Failed to write financial access log", {
          error: logError instanceof Error ? logError.message : logError,
        })
      }
    }

    if (collections.length === 0) {
      return NextResponse.json({ collections: [], message: "No financial records found." })
    }

    return NextResponse.json({ collections })
  } catch (error) {
    logger.error("Failed to fetch financial collections", { error })
    return NextResponse.json({ error: "Unable to load financial collections" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateFeePaymentPayload & { paymentReference?: string }>

    const payload: CreateFeePaymentPayload = {
      studentId: body.studentId ?? null,
      studentName: normalizeString(body.studentName),
      classId: body.classId ?? null,
      className: body.className ?? null,
      feeType: normalizeString(body.feeType) || "General",
      amount: Number(body.amount ?? 0),
      paymentDate: body.paymentDate ?? new Date().toISOString(),
      paymentMethod: normalizeString(body.paymentMethod),
      receiptNumber: body.receiptNumber ?? null,
      paymentReference: body.paymentReference ?? null,
      term: normalizeString(body.term),
    }

    const record = await createFeePaymentRecord(payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    const auditFilters: Record<string, unknown> = {
      studentId: payload.studentId ?? undefined,
      studentName: payload.studentName,
      classId: payload.classId ?? undefined,
      className: payload.className ?? undefined,
      term: payload.term,
      paymentMethod: payload.paymentMethod,
      amount: payload.amount,
      receiptNumber: record.receiptNumber,
    }

    Object.keys(auditFilters).forEach((key) => {
      const value = auditFilters[key]
      if (value === undefined || value === null || value === "") {
        delete auditFilters[key]
      }
    })

    try {
      await recordFinancialAccessLog({
        userId: context.userId,
        userRole: context.role,
        userName: context.name || context.user?.name || "Accountant",
        action: "collections:create",
        filters: auditFilters,
      })
    } catch (logError) {
      logger.warn("Failed to record financial access log for collection creation", {
        error: logError instanceof Error ? logError.message : logError,
      })
    }

    return NextResponse.json({ collection: record }, { status: 201 })
  } catch (error) {
    logger.warn("Failed to create financial collection", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to create collection"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
