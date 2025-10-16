import { type NextRequest, NextResponse } from "next/server"

import {
  createTimetableSlot,
  deleteTimetableSlot,
  getTimetableSlots,
  updateTimetableSlot,
} from "@/lib/database"
import { logger } from "@/lib/logger.server"
import {
  mapTimetableRecordToResponse,
  normaliseTimeRangeLabel,
  parseTimeRangeLabel,
} from "@/lib/timetable"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const className = searchParams.get("className") ?? undefined

    const slots = await getTimetableSlots({ className: className ?? undefined })
    const timetable = slots.map(mapTimetableRecordToResponse)

    return NextResponse.json({ timetable })
  } catch (error) {
    logger.error("Failed to fetch timetable", { error })
    return NextResponse.json({ error: "Failed to fetch timetable" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const className = typeof body?.className === "string" ? body.className.trim() : ""
    const slot = body?.slot

    if (!className || !slot) {
      return NextResponse.json({ error: "Class name and slot are required" }, { status: 400 })
    }

    const timeInput = typeof slot.time === "string" ? slot.time : ""
    const { start, end } = parseTimeRangeLabel(normaliseTimeRangeLabel(timeInput))

    const created = await createTimetableSlot({
      id: slot.id,
      className,
      day: String(slot.day ?? "Monday"),
      startTime: start,
      endTime: end,
      subject: String(slot.subject ?? ""),
      teacher: String(slot.teacher ?? ""),
      location: typeof slot.location === "string" ? slot.location : null,
    })

    return NextResponse.json({ slot: mapTimetableRecordToResponse(created) }, { status: 201 })
  } catch (error) {
    logger.error("Failed to create timetable slot", { error })
    return NextResponse.json({ error: "Failed to create timetable slot" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const slotId = typeof body?.slotId === "string" ? body.slotId : undefined
    const updates = body?.updates ?? body

    if (!slotId) {
      return NextResponse.json({ error: "Slot ID is required" }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {}

    if (typeof updates.day === "string") {
      updatePayload.day = updates.day
    }

    if (typeof updates.subject === "string") {
      updatePayload.subject = updates.subject
    }

    if (typeof updates.teacher === "string") {
      updatePayload.teacher = updates.teacher
    }

    if (typeof updates.location === "string" || updates.location === null) {
      updatePayload.location = updates.location
    }

    if (typeof updates.time === "string") {
      const { start, end } = parseTimeRangeLabel(normaliseTimeRangeLabel(updates.time))
      updatePayload.startTime = start
      updatePayload.endTime = end
    } else {
      if (typeof updates.startTime === "string") {
        updatePayload.startTime = updates.startTime
      }
      if (typeof updates.endTime === "string") {
        updatePayload.endTime = updates.endTime
      }
    }

    const slot = await updateTimetableSlot(slotId, updatePayload)
    if (!slot) {
      return NextResponse.json({ error: "Timetable slot not found" }, { status: 404 })
    }

    return NextResponse.json({ slot: mapTimetableRecordToResponse(slot) })
  } catch (error) {
    logger.error("Failed to update timetable slot", { error })
    return NextResponse.json({ error: "Failed to update timetable slot" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slotId = searchParams.get("slotId") ?? undefined

    if (!slotId) {
      return NextResponse.json({ error: "Slot ID is required" }, { status: 400 })
    }

    const removed = await deleteTimetableSlot(slotId)
    if (!removed) {
      return NextResponse.json({ error: "Timetable slot not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Failed to delete timetable slot", { error })
    return NextResponse.json({ error: "Failed to delete timetable slot" }, { status: 500 })
  }
}
