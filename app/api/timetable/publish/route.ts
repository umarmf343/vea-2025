import { NextResponse, type NextRequest } from "next/server"

import { getTimetableSlots } from "@/lib/database"
import { logger } from "@/lib/logger.server"
import { publishNotification } from "@/lib/realtime-hub"
import { mapTimetableRecordToResponse } from "@/lib/timetable"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { className?: unknown }
    const className = typeof body.className === "string" ? body.className.trim() : ""

    if (!className) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 })
    }

    const slots = await getTimetableSlots({ className })
    const timetable = slots.map(mapTimetableRecordToResponse)

    publishNotification({
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `notification_${Date.now()}`,
      title: `Timetable updated for ${className}`,
      body: "The class timetable has been refreshed. Please review the latest schedule.",
      category: "timetable",
      createdAt: new Date().toISOString(),
      targetUserIds: [],
      targetRoles: ["student", "teacher", "parent"],
      meta: {
        className,
        timetable,
      },
    })

    return NextResponse.json({ success: true, timetable })
  } catch (error) {
    logger.error("Failed to publish timetable update", { error })
    return NextResponse.json({ error: "Failed to publish timetable update" }, { status: 500 })
  }
}
