import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  buildFinancialAnalyticsSnapshot,
  recordFinancialAccessLog,
  type FinancialAnalyticsQueryOptions,
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
    const startDate = normalizeString(searchParams.get("startDate")) || undefined
    const endDate = normalizeString(searchParams.get("endDate")) || undefined
    const classFilter = normalizeString(searchParams.get("class")) || undefined

    const options: FinancialAnalyticsQueryOptions = { term, startDate, endDate, classFilter }
    const snapshot = await buildFinancialAnalyticsSnapshot(options)

    if (context.role === "super_admin") {
      try {
        await recordFinancialAccessLog({
          userId: context.userId,
          userRole: context.role,
          userName: context.name || context.user?.name || "Super Admin",
          action: "analytics:view",
          filters: options,
        })
      } catch (logError) {
        logger.warn("Failed to write financial access log", {
          error: logError instanceof Error ? logError.message : logError,
        })
      }
    }

    return NextResponse.json({ analytics: snapshot })
  } catch (error) {
    logger.error("Failed to compute financial analytics", { error })
    return NextResponse.json({ error: "Unable to generate analytics" }, { status: 500 })
  }
}
