export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get("teacherId")
    const studentId = searchParams.get("studentId")
    const classId = searchParams.get("classId")

    const assignments = await dbManager.getAssignments({
      teacherId: teacherId || undefined,
      studentId: studentId || undefined,
      classId: classId || undefined,
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error("Failed to fetch assignments:", error)
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, subject, classId, teacherId, dueDate, type } = body

    if (type === "submission") {
      const { assignmentId, studentId, files } = body

      const submission = await dbManager.createAssignmentSubmission({
        assignmentId,
        studentId,
        files: files || [],
        status: "submitted",
      })

      return NextResponse.json({
        submission,
        message: "Assignment submitted successfully",
      })
    } else {
      const newAssignment = await dbManager.createAssignment({
        title,
        description,
        subject,
        classId,
        teacherId,
        dueDate,
        status: "active",
      })

      return NextResponse.json({
        assignment: newAssignment,
        message: "Assignment created successfully",
      })
    }
  } catch (error) {
    console.error("Failed to process assignment:", error)
    return NextResponse.json({ error: "Failed to process assignment" }, { status: 500 })
  }
}
