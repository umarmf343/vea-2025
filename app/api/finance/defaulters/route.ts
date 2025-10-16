import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  computeFinancialDefaulters,
  recordFinancialAccessLog,
  type FinancialAnalyticsQueryOptions,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { logger } from "@/lib/logger.server"

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
    const classFilter = normalizeString(searchParams.get("class")) || undefined

    const options: FinancialAnalyticsQueryOptions = { term, classFilter }
    const defaulters = await computeFinancialDefaulters(options)

    if (context.role === "super_admin") {
      try {
        await recordFinancialAccessLog({
          userId: context.userId,
          userRole: context.role,
          userName: context.name || context.user?.name || "Super Admin",
          action: "defaulters:view",
          filters: options,
        })
      } catch (logError) {
        logger.warn("Failed to write financial access log", {
          error: logError instanceof Error ? logError.message : logError,
        })
      }
    }

    return NextResponse.json({ defaulters })
  } catch (error) {
    logger.error("Failed to load defaulters", { error })
    return NextResponse.json({ error: "Unable to load defaulters" }, { status: 500 })
  }
}
