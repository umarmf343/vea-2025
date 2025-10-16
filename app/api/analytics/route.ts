import { type NextRequest, NextResponse } from "next/server"

import {
  getAcademicAnalytics,
  listAnalyticsReports,
  saveAnalyticsReport,
  type CreateAnalyticsReportPayload,
  type AnalyticsReportRecord,
} from "@/lib/database"
import { logger } from "@/lib/logger.server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get("term") ?? "current"
    const classFilter = searchParams.get("class") ?? searchParams.get("className") ?? "all"
    const includeReports = searchParams.get("includeReports") === "true"

    const analytics = await getAcademicAnalytics(term, classFilter)
    let reports: Array<{
      id: string
      term: string
      className: string
      generatedAt: string
      payload: Record<string, unknown>
    }> | undefined

    if (includeReports) {
      const storedReports = await listAnalyticsReports()
      reports = storedReports.map((report: AnalyticsReportRecord) => ({
        id: report.id,
        term: report.term,
        className: report.className,
        generatedAt: report.generatedAt,
        payload: report.payload,
      }))
    }

    return NextResponse.json({ analytics, reports })
  } catch (error) {
    logger.error("Failed to load academic analytics", { error })
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const reportPayload = body?.payload ?? body?.data
    const payload: CreateAnalyticsReportPayload = {
      term: String(body?.term ?? "all"),
      className: String(body?.class ?? body?.className ?? "all"),
      generatedAt: typeof body?.generatedAt === "string" ? body.generatedAt : new Date().toISOString(),
      payload:
        reportPayload && typeof reportPayload === "object"
          ? (reportPayload as Record<string, unknown>)
          : {},
    }

    const report = await saveAnalyticsReport(payload)
    return NextResponse.json({ report })
  } catch (error) {
    logger.error("Failed to save analytics report", { error })
    return NextResponse.json({ error: "Failed to save analytics report" }, { status: 500 })
  }
}
