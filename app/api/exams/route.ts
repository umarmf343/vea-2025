import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const status = searchParams.get("status") as any
    const classId = searchParams.get("classId") ?? undefined
    const className = searchParams.get("className") ?? undefined
    const session = searchParams.get("session") ?? undefined
    const term = searchParams.get("term") ?? undefined
    const scope = searchParams.get("scope")

    if (examId && scope === "results") {
      const results = await dbManager.getExamResults(examId)
      return NextResponse.json({ results })
    }

    const exams = await dbManager.getExamSchedules({ status: status || undefined, classId, className, session, term })

    if (examId) {
      const exam = exams.find((item) => item.id === examId)
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }
      return NextResponse.json({ exam })
    }

    return NextResponse.json({ exams })
  } catch (error) {
    console.error("Failed to fetch exams", error)
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body?.examId && Array.isArray(body?.results)) {
      const results = await dbManager.saveExamResults(body.examId, body.results, {
        autoPublish: body.publish === true,
      })
      return NextResponse.json({ results })
    }

    const required = ["subject", "classId", "examDate", "startTime", "endTime", "term", "session"] as const
    const missing = required.filter((key) => !body?.[key])

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 },
      )
    }

    const exam = await dbManager.createExamSchedule({
      subject: body.subject,
      classId: body.classId,
      className: body.className,
      examDate: body.examDate,
      startTime: body.startTime,
      endTime: body.endTime,
      venue: body.venue ?? null,
      invigilator: body.invigilator ?? null,
      notes: body.notes ?? null,
      term: body.term,
      session: body.session,
      createdBy: body.createdBy ?? null,
    })

    return NextResponse.json({ exam }, { status: 201 })
  } catch (error) {
    console.error("Failed to create exam schedule", error)
    return NextResponse.json({ error: "Failed to create exam schedule" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const examId = body?.examId

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    if (body?.action === "publish") {
      const results = await dbManager.publishExamResults(examId)
      return NextResponse.json({ results })
    }

    const updates = body?.updates ?? body
    const exam = await dbManager.updateExamSchedule(examId, updates)
    return NextResponse.json({ exam })
  } catch (error) {
    console.error("Failed to update exam schedule", error)
    return NextResponse.json({ error: "Failed to update exam schedule" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const removed = await dbManager.deleteExamSchedule(examId)
    if (!removed) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete exam", error)
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 })
  }
}
