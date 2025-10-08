export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"

import { getUserByIdFromDb } from "@/lib/database"
import { logger } from "@/lib/logger"
import { verifyToken } from "@/lib/security"
import { summarizeTeacherAssignments } from "@/lib/teacher-assignment"

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

export async function GET(request: NextRequest) {
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
      logger.warn("Rejected teacher context request due to invalid token", { error: error instanceof Error ? error.message : error })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = normalizeIdentifier(decoded?.userId)
    if (!userId) {
      logger.warn("Rejected teacher context request because token had no user id")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = normalizeRole(decoded?.role)
    if (role !== "teacher") {
      logger.warn("Rejected teacher context request for non-teacher role", { userId, role })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const teacherRecord = await getUserByIdFromDb(userId)
    if (!teacherRecord || normalizeRole(teacherRecord.role) !== "teacher") {
      logger.warn("Teacher context lookup failed for missing teacher record", { userId })
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
    }

    const { classes: normalizedClasses, subjects: normalizedSubjects } = summarizeTeacherAssignments(teacherRecord)

    if (normalizedClasses.length === 0) {
      logger.warn("Teacher context resolved without any class assignments", { teacherId: teacherRecord.id })
    } else {
      logger.info("Teacher context resolved", {
        teacherId: teacherRecord.id,
        classCount: normalizedClasses.length,
        subjectCount: normalizedSubjects.length,
      })
    }

    return NextResponse.json({
      teacher: {
        id: teacherRecord.id,
        name: teacherRecord.name,
        email: teacherRecord.email,
      },
      classes: normalizedClasses,
      subjects: normalizedSubjects,
    })
  } catch (error) {
    logger.error("Teacher context endpoint failed", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
