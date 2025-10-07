import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  softDeleteFeePaymentRecord,
  updateFeePaymentRecordById,
  type UpdateFeePaymentPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger"

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
    return NextResponse.json({ error: "Invalid collection identifier" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as Partial<UpdateFeePaymentPayload>
    const updates: UpdateFeePaymentPayload = {}

    if (body.studentName !== undefined) {
      updates.studentName = normalizeString(body.studentName)
    }

    if (body.amount !== undefined) {
      updates.amount = Number(body.amount)
    }

    if (body.feeType !== undefined) {
      updates.feeType = normalizeString(body.feeType)
    }

    if (body.paymentMethod !== undefined) {
      updates.paymentMethod = normalizeString(body.paymentMethod)
    }

    if (body.paymentDate !== undefined) {
      updates.paymentDate = body.paymentDate
    }

    if (body.term !== undefined) {
      updates.term = normalizeString(body.term)
    }

    if (body.receiptNumber !== undefined) {
      updates.receiptNumber = body.receiptNumber
    }

    if (body.classId !== undefined) {
      updates.classId = body.classId
    }

    if (body.className !== undefined) {
      updates.className = body.className
    }

    if (body.studentId !== undefined) {
      updates.studentId = body.studentId
    }

    if (body.paymentReference !== undefined) {
      updates.paymentReference = body.paymentReference
    }

    const record = await updateFeePaymentRecordById(id, updates, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    if (!record) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    return NextResponse.json({ collection: record })
  } catch (error) {
    logger.warn("Failed to update financial collection", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to update collection"
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
    return NextResponse.json({ error: "Invalid collection identifier" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as { reason?: string } | null
    const reason = normalizeString(body?.reason)

    if (!reason) {
      return NextResponse.json({ error: "A reason is required to delete a collection" }, { status: 400 })
    }

    const record = await softDeleteFeePaymentRecord(id, reason, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    if (!record) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    return NextResponse.json({ collection: record })
  } catch (error) {
    logger.warn("Failed to delete financial collection", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to delete collection"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
