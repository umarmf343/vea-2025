import { type NextRequest, NextResponse } from "next/server"

import { getReportCardLayoutConfig, updateReportCardLayoutConfig } from "@/lib/database"
import { applyLayoutDefaults } from "@/lib/report-card-layout-config"
import { logger } from "@/lib/logger.server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const layout = await getReportCardLayoutConfig()
    return NextResponse.json({ layout })
  } catch (error) {
    logger.error("Failed to fetch report card layout configuration", { error })
    return NextResponse.json({ error: "Failed to fetch report card layout configuration" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const layoutPayload = body?.layout ?? body

    if (!layoutPayload || typeof layoutPayload !== "object") {
      return NextResponse.json({ error: "Layout configuration payload is required" }, { status: 400 })
    }

    const normalizedPayload = applyLayoutDefaults(layoutPayload)
    const layout = await updateReportCardLayoutConfig(normalizedPayload)

    return NextResponse.json({ layout, message: "Report card layout updated successfully" })
  } catch (error) {
    logger.error("Failed to update report card layout configuration", { error })
    return NextResponse.json({ error: "Failed to update report card layout configuration" }, { status: 500 })
  }
}
