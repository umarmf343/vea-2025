import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { softDeleteFeeWaiverRecord } from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = normalizeString(params.id)
  if (!id) {
    return NextResponse.json({ error: "Invalid waiver identifier" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as { reason?: string } | null
    const reason = normalizeString(body?.reason)

    if (!reason) {
      return NextResponse.json({ error: "A reason is required to delete a waiver" }, { status: 400 })
    }

    const record = await softDeleteFeeWaiverRecord(id, reason, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    if (!record) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 })
    }

    return NextResponse.json({ waiver: record })
  } catch (error) {
    logger.warn("Failed to delete waiver", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to delete waiver"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
