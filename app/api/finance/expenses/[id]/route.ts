import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  softDeleteExpenseRecord,
  updateExpenseRecordById,
  type UpdateExpensePayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger.server"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = normalizeString(params.id)
  if (!id) {
    return NextResponse.json({ error: "Invalid expense identifier" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as Partial<UpdateExpensePayload>
    const updates: UpdateExpensePayload = {}

    if (body.category !== undefined) {
      updates.category = body.category
    }

    if (body.amount !== undefined) {
      updates.amount = Number(body.amount)
    }

    if (body.expenseDate !== undefined) {
      updates.expenseDate = body.expenseDate
    }

    if (body.description !== undefined) {
      updates.description = normalizeString(body.description)
    }

    if (body.approvedBy !== undefined) {
      updates.approvedBy = normalizeString(body.approvedBy)
    }

    if (body.receiptReference !== undefined) {
      updates.receiptReference = body.receiptReference
    }

    if (body.documentUrl !== undefined) {
      updates.documentUrl = body.documentUrl
    }

    const record = await updateExpenseRecordById(id, updates, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    if (!record) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    return NextResponse.json({ expense: record })
  } catch (error) {
    logger.warn("Failed to update expense", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to update expense"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = normalizeString(params.id)
  if (!id) {
    return NextResponse.json({ error: "Invalid expense identifier" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as { reason?: string } | null
    const reason = normalizeString(body?.reason)

    if (!reason) {
      return NextResponse.json({ error: "A reason is required to delete an expense" }, { status: 400 })
    }

    const record = await softDeleteExpenseRecord(id, reason, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    if (!record) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    return NextResponse.json({ expense: record })
  } catch (error) {
    logger.warn("Failed to delete expense", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to delete expense"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
