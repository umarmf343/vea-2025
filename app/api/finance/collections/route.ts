import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createFeePaymentRecord,
  listFeePaymentRecords,
  recordFinancialAccessLog,
  type CreateFeePaymentPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger"

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
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const term = normalizeString(searchParams.get("term")) || undefined
    const startDate = normalizeString(searchParams.get("startDate")) || undefined
    const endDate = normalizeString(searchParams.get("endDate")) || undefined
    const includeDeleted = parseBoolean(searchParams.get("includeDeleted"))

    const collections = await listFeePaymentRecords({ term, startDate, endDate, includeDeleted })

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

    return NextResponse.json({ collection: record }, { status: 201 })
  } catch (error) {
    logger.warn("Failed to create financial collection", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to create collection"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
