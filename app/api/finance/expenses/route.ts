import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createExpenseRecord,
  listExpenseRecords,
  recordFinancialAccessLog,
  type CreateExpensePayload,
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
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = normalizeString(searchParams.get("category")) || undefined
    const startDate = normalizeString(searchParams.get("startDate")) || undefined
    const endDate = normalizeString(searchParams.get("endDate")) || undefined
    const includeDeleted = parseBoolean(searchParams.get("includeDeleted"))

    const expenses = await listExpenseRecords({ category, startDate, endDate, includeDeleted })

    if (context.role === "super_admin") {
      try {
        await recordFinancialAccessLog({
          userId: context.userId,
          userRole: context.role,
          userName: context.name || context.user?.name || "Super Admin",
          action: "expenses:view",
          filters: { category, startDate, endDate, includeDeleted },
        })
      } catch (logError) {
        logger.warn("Failed to write financial access log", {
          error: logError instanceof Error ? logError.message : logError,
        })
      }
    }

    if (expenses.length === 0) {
      return NextResponse.json({ expenses: [], message: "No financial records found." })
    }

    return NextResponse.json({ expenses })
  } catch (error) {
    logger.error("Failed to load expenses", { error })
    return NextResponse.json({ error: "Unable to load expenses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateExpensePayload>

    const payload: CreateExpensePayload = {
      category: body.category ?? "Miscellaneous",
      amount: Number(body.amount ?? 0),
      expenseDate: body.expenseDate ?? new Date().toISOString(),
      description: normalizeString(body.description),
      receiptReference: body.receiptReference ?? null,
      approvedBy: normalizeString(body.approvedBy),
      documentUrl: body.documentUrl ?? null,
    }

    const record = await createExpenseRecord(payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    return NextResponse.json({ expense: record }, { status: 201 })
  } catch (error) {
    logger.warn("Failed to create expense", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to create expense"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
