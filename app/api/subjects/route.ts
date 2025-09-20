import { type NextRequest, NextResponse } from "next/server"

import {
  createSubjectRecord,
  deleteSubjectRecord,
  listSubjectRecords,
  updateSubjectRecord,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const subjects = await listSubjectRecords()
    return NextResponse.json({ subjects })
  } catch (error) {
    console.error("Failed to fetch subjects:", error)
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || !body.code) {
      return NextResponse.json({ error: "Subject name and code are required" }, { status: 400 })
    }

    const subject = await createSubjectRecord({
      name: sanitizeInput(body.name),
      code: sanitizeInput(body.code),
      description: typeof body.description === "string" ? sanitizeInput(body.description) : null,
      classes: Array.isArray(body.classes) ? body.classes.map((className: string) => sanitizeInput(className)) : [],
      teachers: Array.isArray(body.teachers) ? body.teachers.map((teacher: string) => sanitizeInput(teacher)) : [],
    })

    return NextResponse.json({ subject, message: "Subject created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Failed to create subject:", error)
    const message = error instanceof Error ? error.message : "Failed to create subject"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: "Subject ID is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      updates.name = sanitizeInput(String(body.name))
    }

    if (body.code !== undefined) {
      updates.code = sanitizeInput(String(body.code))
    }

    if (body.description !== undefined) {
      updates.description = body.description === null ? null : sanitizeInput(String(body.description))
    }

    if (body.classes !== undefined) {
      updates.classes = Array.isArray(body.classes)
        ? body.classes.map((className: string) => sanitizeInput(className))
        : []
    }

    if (body.teachers !== undefined) {
      updates.teachers = Array.isArray(body.teachers)
        ? body.teachers.map((teacher: string) => sanitizeInput(teacher))
        : []
    }

    const updated = await updateSubjectRecord(body.id, updates)

    if (!updated) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 })
    }

    return NextResponse.json({ subject: updated, message: "Subject updated successfully" })
  } catch (error) {
    console.error("Failed to update subject:", error)
    const message = error instanceof Error ? error.message : "Failed to update subject"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Subject ID is required" }, { status: 400 })
    }

    const deleted = await deleteSubjectRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete subject:", error)
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 })
  }
}
