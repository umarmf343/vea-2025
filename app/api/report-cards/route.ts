import { type NextRequest, NextResponse } from "next/server"

import {
  deleteReportCardRecord,
  listReportCards,
  upsertReportCardRecord,
  type UpsertReportCardPayload,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId") ?? undefined
    const className = searchParams.get("className") ?? undefined
    const term = searchParams.get("term") ?? undefined
    const session = searchParams.get("session") ?? undefined

    const reportCards = await listReportCards({ studentId, className, term, session })
    return NextResponse.json({ reportCards })
  } catch (error) {
    console.error("Failed to fetch report cards:", error)
    return NextResponse.json({ error: "Failed to fetch report cards" }, { status: 500 })
  }
}

function sanitizeReportPayload(payload: any): UpsertReportCardPayload {
  return {
    id: typeof payload.id === "string" ? payload.id : undefined,
    studentId: sanitizeInput(String(payload.studentId ?? "")),
    studentName: sanitizeInput(String(payload.studentName ?? "")),
    className: sanitizeInput(String(payload.className ?? "")),
    term: sanitizeInput(String(payload.term ?? "")),
    session: sanitizeInput(String(payload.session ?? "")),
    classTeacherRemark:
      typeof payload.classTeacherRemark === "string" ? sanitizeInput(payload.classTeacherRemark) : undefined,
    headTeacherRemark:
      typeof payload.headTeacherRemark === "string" ? sanitizeInput(payload.headTeacherRemark) : undefined,
    subjects: Array.isArray(payload.subjects)
      ? payload.subjects.map((subject: any) => ({
          name: sanitizeInput(String(subject.name ?? "")),
          ca1: Number(subject.ca1 ?? 0),
          ca2: Number(subject.ca2 ?? 0),
          assignment: Number(subject.assignment ?? 0),
          exam: Number(subject.exam ?? 0),
          total: typeof subject.total === "number" ? subject.total : undefined,
          grade: typeof subject.grade === "string" ? sanitizeInput(subject.grade) : undefined,
          remark: typeof subject.remark === "string" ? sanitizeInput(subject.remark) : undefined,
        }))
      : [],
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = sanitizeReportPayload(body)

    if (!payload.studentId || !payload.studentName || !payload.className || !payload.term || !payload.session) {
      return NextResponse.json({ error: "Missing required report card fields" }, { status: 400 })
    }

    const created = await upsertReportCardRecord({ ...payload, id: undefined })
    return NextResponse.json({ reportCard: created, message: "Report card created successfully" })
  } catch (error) {
    console.error("Failed to create report card:", error)
    return NextResponse.json({ error: "Failed to create report card" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = sanitizeReportPayload(body)

    if (!payload.id) {
      return NextResponse.json({ error: "Report card ID is required" }, { status: 400 })
    }

    const updated = await upsertReportCardRecord(payload)
    return NextResponse.json({ reportCard: updated, message: "Report card updated successfully" })
  } catch (error) {
    console.error("Failed to update report card:", error)
    return NextResponse.json({ error: "Failed to update report card" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Report card ID is required" }, { status: 400 })
    }

    const deleted = await deleteReportCardRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "Report card not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete report card:", error)
    return NextResponse.json({ error: "Failed to delete report card" }, { status: 500 })
  }
}
