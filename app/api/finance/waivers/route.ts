import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createFeeWaiverRecord,
  listFeeWaiverRecords,
  recordFinancialAccessLog,
  type CreateFeeWaiverPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

export async function GET(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const term = normalizeString(searchParams.get("term")) || undefined
    const studentId = normalizeString(searchParams.get("studentId")) || undefined
    const includeDeleted = normalizeString(searchParams.get("includeDeleted"))
      .toLowerCase()
      .startsWith("t")

    const waivers = await listFeeWaiverRecords({ term, studentId, includeDeleted })

    if (context.role === "super_admin") {
      try {
        await recordFinancialAccessLog({
          userId: context.userId,
          userRole: context.role,
          userName: context.name || context.user?.name || "Super Admin",
          action: "waivers:view",
          filters: { term, studentId, includeDeleted },
        })
      } catch (logError) {
        logger.warn("Failed to write financial access log", {
          error: logError instanceof Error ? logError.message : logError,
        })
      }
    }

    return NextResponse.json({ waivers })
  } catch (error) {
    logger.error("Failed to load waivers", { error })
    return NextResponse.json({ error: "Unable to load waivers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateFeeWaiverPayload>

    const payload: CreateFeeWaiverPayload = {
      studentId: body.studentId ?? null,
      studentName: normalizeString(body.studentName),
      classId: body.classId ?? null,
      className: body.className ?? null,
      term: normalizeString(body.term),
      amount: Number(body.amount ?? 0),
      reason: normalizeString(body.reason),
      notes: body.notes ?? null,
    }

    const record = await createFeeWaiverRecord(payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
    })

    return NextResponse.json({ waiver: record }, { status: 201 })
  } catch (error) {
    logger.warn("Failed to create fee waiver", {
      error: error instanceof Error ? error.message : error,
    })
    const message = error instanceof Error ? error.message : "Unable to create waiver"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
