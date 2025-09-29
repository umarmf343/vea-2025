export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get("teacherId")
    const studentId = searchParams.get("studentId")
    const classId = searchParams.get("classId")
    const assignmentId = searchParams.get("assignmentId")

    const assignments = await dbManager.getAssignments({
      teacherId: teacherId || undefined,
      studentId: studentId || undefined,
      classId: classId || undefined,
      assignmentId: assignmentId || undefined,
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
      action,
      type,
      attachmentName,
      attachmentSize,
      attachmentType,
      attachmentData,
      assignedStudentIds,
    } = body

    if (type === "submission") {
      const { assignmentId, studentId, files, comment, submittedAt, status: submissionStatus } = body

      const submission = await dbManager.createAssignmentSubmission({
        assignmentId,
        studentId,
        files: files || [],
        comment: typeof comment === "string" ? comment : typeof body?.submittedComment === "string" ? body.submittedComment : null,
        submittedAt: typeof submittedAt === "string" ? submittedAt : undefined,
        status: typeof submissionStatus === "string" ? submissionStatus : "submitted",
      })

      return NextResponse.json({
        submission,
        message: "Assignment submitted successfully",
      })
    } else {
      const normalizedAction = typeof action === "string" ? action.trim().toLowerCase() : ""
      const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : ""
      const resolvedStatus = (() => {
        if (normalizedStatus === "draft" || normalizedStatus === "sent") {
          return normalizedStatus
        }

        if (normalizedAction === "draft" || normalizedAction === "save") {
          return "draft"
        }

        if (normalizedAction === "sent" || normalizedAction === "send") {
          return "sent"
        }

        return "sent"
      })()

      const newAssignment = await dbManager.createAssignment({
        title,
        description,
        subject,
        classId,
        className,
        teacherId,
        teacherName,
        dueDate,
        status: resolvedStatus,
        maximumScore,
        assignedStudentIds: Array.isArray(assignedStudentIds) ? assignedStudentIds : undefined,
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
