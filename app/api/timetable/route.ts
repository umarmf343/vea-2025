import { type NextRequest, NextResponse } from "next/server"

import {
  createTimetableSlot,
  deleteTimetableSlot,
  getTimetableSlots,
  updateTimetableSlot,
} from "@/lib/database"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

interface TimetableSlotResponse {
  id: string
  day: string
  time: string
  subject: string
  teacher: string
  location?: string | null
  className: string
}

function to24Hour(time: string): string {
  const trimmed = time.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)

  if (!match) {
    return trimmed
  }

  let hour = Number(match[1])
  const minute = match[2]
  const meridiem = match[3]?.toUpperCase()

  if (meridiem === "PM" && hour !== 12) {
    hour += 12
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0
  }

  return `${hour.toString().padStart(2, "0")}:${minute}`
}

function to12Hour(time: string): string {
  const [hourPart, minutePart = "00"] = time.split(":")
  let hour = Number(hourPart)
  const minute = minutePart.padStart(2, "0")
  const meridiem = hour >= 12 ? "PM" : "AM"
  hour = hour % 12 || 12
  return `${hour}:${minute} ${meridiem}`
}

function parseTimeRange(range: string): { start: string; end: string } {
  if (typeof range !== "string" || range.trim().length === 0) {
    return { start: "08:00", end: "09:00" }
  }

  const [rawStart, rawEnd] = range.split("-").map((value) => value.trim())
  return {
    start: to24Hour(rawStart ?? "08:00"),
    end: to24Hour(rawEnd ?? "09:00"),
  }
}

function formatTimeRange(start: string, end: string): string {
  return `${to12Hour(start)} - ${to12Hour(end)}`
}

function mapSlotToResponse(slot: {
  id: string
  className: string
  day: string
  startTime: string
  endTime: string
  subject: string
  teacher: string
  location?: string | null
}): TimetableSlotResponse {
  return {
    id: slot.id,
    className: slot.className,
    day: slot.day,
    subject: slot.subject,
    teacher: slot.teacher,
    location: slot.location ?? null,
    time: formatTimeRange(slot.startTime, slot.endTime),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const className = searchParams.get("className") ?? undefined

    const slots = await getTimetableSlots({ className: className ?? undefined })
    const timetable = slots.map(mapSlotToResponse)

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

    const { start, end } = parseTimeRange(String(slot.time ?? ""))

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

    return NextResponse.json({ slot: mapSlotToResponse(created) }, { status: 201 })
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
      const { start, end } = parseTimeRange(updates.time)
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

    return NextResponse.json({ slot: mapSlotToResponse(slot) })
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
