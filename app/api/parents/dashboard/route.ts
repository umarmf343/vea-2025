import { type NextRequest, NextResponse } from "next/server"

import { getParentDashboardSnapshot } from "@/lib/database"
import { logger } from "@/lib/logger.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const term = searchParams.get("term")
    const session = searchParams.get("session")

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 })
    }

    const snapshot = await getParentDashboardSnapshot(studentId, { term, session })

    if (!snapshot) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ snapshot })
  } catch (error) {
    logger.error("Failed to load parent dashboard snapshot", { error })
    return NextResponse.json({ error: "Failed to load parent dashboard" }, { status: 500 })
  }
}
