export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { createClassRecord, deleteClassRecord, getAllClassesFromDb, updateClassRecord } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export async function GET() {
  try {
    const classes = await getAllClassesFromDb()
    return NextResponse.json({ classes })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, level, capacity, classTeacherId, subjects } = body

    if (!name || !level) {
      return NextResponse.json({ error: "Class name and level are required" }, { status: 400 })
    }

    const newClass = await createClassRecord({
      name: sanitizeInput(name),
      level: sanitizeInput(level),
      capacity: typeof capacity === "number" ? capacity : undefined,
      classTeacherId: classTeacherId ? String(classTeacherId) : null,
      status: "active",
      subjects: Array.isArray(subjects) ? subjects.map((subject: string) => sanitizeInput(subject)) : undefined,
    })

    return NextResponse.json({
      class: newClass,
      message: "Class created successfully",
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, classTeacherId, subjects, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 })
    }

    const sanitizedUpdate: Record<string, any> = {}

    Object.entries(updateData).forEach(([key, value]) => {
      if (typeof value === "string") {
        sanitizedUpdate[key] = sanitizeInput(value)
      } else {
        sanitizedUpdate[key] = value
      }
    })

    if (classTeacherId !== undefined) {
      sanitizedUpdate.classTeacherId = classTeacherId ? String(classTeacherId) : null
    }

    if (subjects !== undefined) {
      sanitizedUpdate.subjects = Array.isArray(subjects)
        ? subjects.map((subject: string) => sanitizeInput(subject))
        : undefined
    }

    const updatedClass = await updateClassRecord(id, sanitizedUpdate)

    if (!updatedClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    return NextResponse.json({
      class: updatedClass,
      message: "Class updated successfully",
    })
  } catch (error) {
    console.error("Failed to update class:", error)
    return NextResponse.json({ error: "Failed to update class" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 })
    }

    const deleted = await deleteClassRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete class:", error)
    return NextResponse.json({ error: "Failed to delete class" }, { status: 500 })
  }
}
