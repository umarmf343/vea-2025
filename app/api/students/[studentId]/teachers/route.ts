export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"

import {
  getAllClassesFromDb,
  getStudentRecordById,
  getUserByIdFromDb,
  getUsersByRoleFromDb,
  type ClassRecord,
  type StoredUser,
} from "@/lib/database"
import { normalizeSubjectList } from "@/lib/subject-utils"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const normalizeToken = (value: unknown): string => {
  const normalized = normalizeString(value)
  return normalized ? normalized.replace(/\s+/g, "").toLowerCase() : ""
}

const buildClassTokens = (record: ClassRecord): string[] => {
  const tokens = new Set<string>()
  tokens.add(normalizeToken(record.id))
  tokens.add(normalizeToken(record.name))
  return Array.from(tokens).filter((token) => token.length > 0)
}

const collectTeacherClassTokens = (teacher: StoredUser): string[] => {
  const tokens = new Set<string>()

  const assignments = Array.isArray(teacher.teachingAssignments)
    ? teacher.teachingAssignments
    : []

  assignments.forEach((assignment) => {
    tokens.add(normalizeToken((assignment as { classId?: unknown }).classId))
    tokens.add(normalizeToken((assignment as { className?: unknown }).className))
  })

  const metadata = (teacher.metadata ?? {}) as Record<string, unknown>
  const metadataClassIds = Array.isArray(metadata.assignedClassIds) ? metadata.assignedClassIds : []
  const metadataClassNames = Array.isArray(metadata.assignedClassNames) ? metadata.assignedClassNames : []

  metadataClassIds.forEach((identifier) => tokens.add(normalizeToken(identifier)))
  metadataClassNames.forEach((name) => tokens.add(normalizeToken(name)))

  tokens.add(normalizeToken((teacher as { classId?: unknown }).classId))
  tokens.add(normalizeToken((teacher as { className?: unknown }).className))

  return Array.from(tokens).filter((token) => token.length > 0)
}

const resolveTeacherName = (teacher: StoredUser | null): string => {
  if (!teacher) {
    return ""
  }

  const candidates = [teacher.name, (teacher.metadata as { fullName?: unknown })?.fullName, teacher.email]

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized) {
      return normalized
    }
  }

  return "Teacher"
}

const determineClassRecord = (
  classes: ClassRecord[],
  studentClassCandidates: string[],
): ClassRecord | null => {
  const normalizedTokens = studentClassCandidates
    .map((candidate) => normalizeToken(candidate))
    .filter((token) => token.length > 0)

  if (normalizedTokens.length === 0) {
    return null
  }

  for (const token of normalizedTokens) {
    const match = classes.find((entry) => buildClassTokens(entry).includes(token))
    if (match) {
      return match
    }
  }

  return null
}

const resolveSubjectTeachers = (
  teachers: StoredUser[],
  classTokens: Set<string>,
  subjects: string[],
) => {
  const normalizedSubjects = subjects
    .map((subject) => normalizeString(subject))
    .filter((subject) => subject.length > 0)

  const subjectTeacherMap = new Map<string, StoredUser | null>()

  normalizedSubjects.forEach((subject) => {
    const normalizedSubject = subject.toLowerCase()
    let assigned: StoredUser | null = null

    for (const teacher of teachers) {
      const teacherSubjects = Array.isArray(teacher.subjects) ? teacher.subjects : []
      const normalizedTeacherSubjects = teacherSubjects
        .map((entry) => normalizeString(entry).toLowerCase())
        .filter((entry) => entry.length > 0)

      const teachesSubject = normalizedTeacherSubjects.includes(normalizedSubject)
      if (!teachesSubject) {
        continue
      }

      const tokens = collectTeacherClassTokens(teacher)
      const intersects = tokens.some((token) => classTokens.has(token))

      if (intersects) {
        assigned = teacher
        break
      }

      if (!assigned) {
        assigned = teacher
      }
    }

    subjectTeacherMap.set(normalizedSubject, assigned)
  })

  return normalizedSubjects.map((subject) => {
    const normalizedSubject = subject.toLowerCase()
    const teacher = subjectTeacherMap.get(normalizedSubject) ?? null
    return {
      subject,
      teacherId: teacher?.id ?? null,
      teacherName: teacher ? resolveTeacherName(teacher) : null,
      teacherEmail: teacher ? normalizeString(teacher.email) || null : null,
    }
  })
}

export async function GET(
  request: NextRequest,
  context: { params: { studentId?: string } },
) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = normalizeString(context.params?.studentId ?? "")
    const fallbackClassName = normalizeString(searchParams.get("className"))

    if (!studentId && !fallbackClassName) {
      return NextResponse.json(
        { error: "Student identifier or class hint is required" },
        { status: 400 },
      )
    }

    const studentRecord = studentId ? await getStudentRecordById(studentId) : null
    const classes = await getAllClassesFromDb()

    const studentClassCandidates = [
      studentRecord?.class,
      studentRecord?.section,
      fallbackClassName,
      (studentRecord?.metadata as { assignedClassName?: unknown })?.assignedClassName,
    ].map((value) => normalizeString(value))

    const classRecord = determineClassRecord(classes, studentClassCandidates)
    const subjectsSource = classRecord?.subjects ?? studentRecord?.subjects ?? []
    const normalizedSubjects = normalizeSubjectList(subjectsSource)

    const teachers = await getUsersByRoleFromDb("teacher")
    const classTokens = classRecord ? new Set(buildClassTokens(classRecord)) : new Set<string>()

    if (classRecord) {
      classTokens.add(normalizeToken(classRecord.name))
      classTokens.add(normalizeToken(classRecord.id))
    }

    const classTeachers = [] as Array<{
      teacherId: string | null
      teacherName: string
      role: string
      teacherEmail: string | null
    }>

    if (classRecord?.classTeacherId) {
      const directTeacher =
        teachers.find((teacher) => teacher.id === classRecord.classTeacherId) ??
        (await getUserByIdFromDb(classRecord.classTeacherId))

      if (directTeacher) {
        classTeachers.push({
          teacherId: directTeacher.id,
          teacherName: resolveTeacherName(directTeacher),
          role: "Class Teacher",
          teacherEmail: normalizeString(directTeacher.email) || null,
        })
      }
    }

    if (classTeachers.length === 0 && classTokens.size > 0) {
      const supportingTeachers = teachers.filter((teacher) => {
        const teacherTokens = collectTeacherClassTokens(teacher)
        return teacherTokens.some((token) => classTokens.has(token))
      })

      supportingTeachers.forEach((teacher) => {
        classTeachers.push({
          teacherId: teacher.id,
          teacherName: resolveTeacherName(teacher),
          role: "Subject Teacher",
          teacherEmail: normalizeString(teacher.email) || null,
        })
      })
    }

    const subjectTeachers = resolveSubjectTeachers(teachers, classTokens, normalizedSubjects)

    return NextResponse.json({
      class: classRecord ? { id: classRecord.id, name: classRecord.name } : null,
      classTeachers,
      subjectTeachers,
      message:
        normalizedSubjects.length === 0
          ? "No subjects are currently linked to this class."
          : classTeachers.length === 0 && subjectTeachers.every((entry) => !entry.teacherName)
            ? "No teachers have been linked to this class yet."
            : undefined,
    })
  } catch (error) {
    console.error("Failed to resolve student teacher assignments", error)
    return NextResponse.json(
      { error: "Unable to load teacher assignments for the student" },
      { status: 500 },
    )
  }
}

