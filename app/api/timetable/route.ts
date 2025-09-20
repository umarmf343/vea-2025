import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const className = searchParams.get("className") ?? ""
    const timetable = await dbManager.getTimetable(className)
    return NextResponse.json({ timetable })
  } catch (error) {
    console.error("Failed to fetch timetable", error)
    return NextResponse.json({ error: "Failed to fetch timetable" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const className = body?.className

    if (!className || !body?.slot) {
      return NextResponse.json({ error: "Class name and slot are required" }, { status: 400 })
    }

    const slot = await dbManager.addTimetableSlot(className, body.slot)
    return NextResponse.json({ slot }, { status: 201 })
  } catch (error) {
    console.error("Failed to create timetable slot", error)
    return NextResponse.json({ error: "Failed to create timetable slot" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const className = body?.className
    const slotId = body?.slotId

    if (!className || !slotId) {
      return NextResponse.json({ error: "Class name and slot ID are required" }, { status: 400 })
    }

    const slot = await dbManager.updateTimetableSlot(className, slotId, body.updates ?? body)
    if (!slot) {
      return NextResponse.json({ error: "Timetable slot not found" }, { status: 404 })
    }

    return NextResponse.json({ slot })
  } catch (error) {
    console.error("Failed to update timetable slot", error)
    return NextResponse.json({ error: "Failed to update timetable slot" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const className = searchParams.get("className")
    const slotId = searchParams.get("slotId")

    if (!className || !slotId) {
      return NextResponse.json({ error: "Class name and slot ID are required" }, { status: 400 })
    }

    const removed = await dbManager.deleteTimetableSlot(className, slotId)
    if (!removed) {
      return NextResponse.json({ error: "Timetable slot not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete timetable slot", error)
    return NextResponse.json({ error: "Failed to delete timetable slot" }, { status: 500 })
  }
}
