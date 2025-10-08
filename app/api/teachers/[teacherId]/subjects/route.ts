export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"

import { getUserByIdFromDb } from "@/lib/database"
import { summarizeTeacherAssignments } from "@/lib/teacher-assignment"
import { logger } from "@/lib/logger"
import { verifyToken } from "@/lib/security"

const normalizeRole = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

const normalizeIdentifier = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const isPrivilegedRole = (role: string) => role === "super_admin" || role === "admin"

export async function GET(
  request: NextRequest,
  context: { params: { teacherId?: string } },
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    let decoded: any
    try {
      decoded = verifyToken(token)
    } catch (error) {
      logger.warn("Rejected teacher subject lookup due to invalid token", {
        error: error instanceof Error ? error.message : error,
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requesterId = normalizeIdentifier(decoded?.userId)
    const requesterRole = normalizeRole(decoded?.role)
    if (!requesterId || !requesterRole) {
      logger.warn("Rejected teacher subject lookup because token payload was incomplete")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requestedTeacherId = normalizeIdentifier(context.params?.teacherId)
    if (!requestedTeacherId) {
      return NextResponse.json({ error: "Teacher identifier is required" }, { status: 400 })
    }

    if (requesterRole === "teacher" && requesterId !== requestedTeacherId) {
      logger.warn("Teacher attempted to access another teacher's subject assignments", {
        requesterId,
        requestedTeacherId,
      })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (requesterRole !== "teacher" && !isPrivilegedRole(requesterRole)) {
      logger.warn("Rejected teacher subject lookup for unsupported role", {
        requesterId,
        role: requesterRole,
      })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const teacherRecord = await getUserByIdFromDb(requestedTeacherId)
    if (!teacherRecord || normalizeRole(teacherRecord.role) !== "teacher") {
      logger.warn("Teacher subject lookup failed because teacher record was not found", {
        requestedTeacherId,
      })
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
    }

    const { classes, subjects, subjectAssignments } = await summarizeTeacherAssignments(teacherRecord)

    logger.info("Teacher subject assignments resolved", {
      teacherId: teacherRecord.id,
      subjectCount: subjectAssignments.length,
      classCount: classes.length,
    })

    return NextResponse.json({
      teacher: {
        id: teacherRecord.id,
        name: teacherRecord.name,
        email: teacherRecord.email,
      },
      subjects,
      classes,
      subjectAssignments,
      message:
        subjects.length === 0
          ? "No subjects have been assigned to this teacher yet. Please contact the administrator."
          : undefined,
    })
  } catch (error) {
    logger.error("Failed to resolve teacher subject assignments", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
