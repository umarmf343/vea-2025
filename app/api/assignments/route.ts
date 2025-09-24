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
    const {
      title,
      description,
      subject,
      classId,
      className,
      teacherId,
      teacherName,
      dueDate,
      maximumScore,
      status,
      type,
      attachmentName,
      attachmentSize,
      attachmentType,
      attachmentData,
    } = body

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
        className,
        teacherId,
        teacherName,
        dueDate,
        status: typeof status === "string" ? status : "sent",
        maximumScore,
        resourceName: attachmentName ?? null,
        resourceSize:
          typeof attachmentSize === "number"
            ? attachmentSize
            : attachmentSize
              ? Number(attachmentSize)
              : null,
        resourceType: attachmentType ?? null,
        resourceUrl: typeof attachmentData === "string" ? attachmentData : null,
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : body.id
    if (!assignmentId || typeof assignmentId !== "string") {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
    }

    const updates = body.updates
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Valid updates payload is required" }, { status: 400 })
    }

    const updatedAssignment = await dbManager.updateAssignment(assignmentId, updates)

    return NextResponse.json({
      assignment: updatedAssignment,
      message: "Assignment updated successfully",
    })
  } catch (error) {
    console.error("Failed to update assignment:", error)
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let assignmentId = searchParams.get("assignmentId")

    if (!assignmentId) {
      try {
        const body = await request.json()
        assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : typeof body?.id === "string" ? body.id : null
      } catch (error) {
        assignmentId = null
      }
    }

    if (!assignmentId) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
    }

    const deleted = await dbManager.deleteAssignment(assignmentId)

    if (!deleted) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Assignment deleted successfully" })
  } catch (error) {
    console.error("Failed to delete assignment:", error)
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 })
  }
}
