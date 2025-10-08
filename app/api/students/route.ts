import { type NextRequest, NextResponse } from "next/server"

import {
  createStudentRecord,
  deleteStudentRecord,
  listStudentRecords,
  getStudentRecordById,
  updateStudentRecord,
  createUserRecord,
  deleteUserRecord,
  getAllClassesFromDb,
  getUserByEmail,
  getUserByIdFromDb,
  getUsersByRoleFromDb,
  type ClassRecord,
  type StoredUser,
  type StudentRecord,
  updateUserRecord,
} from "@/lib/database"
import { hashPassword, sanitizeInput, verifyToken } from "@/lib/security"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const normalizeRole = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const normalizeClassToken = (value: unknown): string => {
  const normalized = normalizeString(value)
  return normalized ? normalized.toLowerCase() : ""
}

const normalizeStatusValue = (value: unknown): "active" | "inactive" | "" => {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === "inactive") {
    return "inactive"
  }

  if (normalized === "active") {
    return "active"
  }

  return ""
}

interface TeacherScopeContext {
  tokens: Set<string>
  classes: Array<{ id: string; name: string }>
}

async function resolveTeacherScope(teacher: StoredUser): Promise<TeacherScopeContext> {
  const classes = await getAllClassesFromDb()
  const classById = new Map(classes.map((cls) => [normalizeClassToken(cls.id), cls]))
  const classByName = new Map(classes.map((cls) => [normalizeClassToken(cls.name), cls]))

  const tokens = new Set<string>()
  const summaries: Array<{ id: string; name: string }> = []
  const seenSummaryKeys = new Set<string>()

  const registerClassRecord = (record: ClassRecord | null, fallbackId?: string, fallbackName?: string) => {
    const resolvedId = normalizeString(record?.id ?? fallbackId ?? "")
    const resolvedName = normalizeString(record?.name ?? fallbackName ?? "")
    const normalizedId = normalizeClassToken(resolvedId)
    const normalizedName = normalizeClassToken(resolvedName)

    if (normalizedId) {
      tokens.add(normalizedId)
    }

    if (normalizedName) {
      tokens.add(normalizedName)
    }

    const summaryId = resolvedId || resolvedName || `class_${summaries.length + 1}`
    const summaryName = resolvedName || resolvedId || `Class ${summaries.length + 1}`
    const summaryKey = `${summaryId.toLowerCase()}::${summaryName.toLowerCase()}`

    if (!seenSummaryKeys.has(summaryKey)) {
      summaries.push({ id: summaryId, name: summaryName })
      seenSummaryKeys.add(summaryKey)
    }
  }

  const registerClassId = (candidate: unknown) => {
    const identifier = normalizeString(candidate)
    if (!identifier) {
      return
    }

    const record = classById.get(normalizeClassToken(identifier)) ?? null
    registerClassRecord(record, identifier, record?.name)
  }

  const registerClassName = (candidate: unknown) => {
    const name = normalizeString(candidate)
    if (!name) {
      return
    }

    const record = classByName.get(normalizeClassToken(name)) ?? null
    registerClassRecord(record, record?.id, name)
  }

  const assignments = Array.isArray(teacher.teachingAssignments) ? teacher.teachingAssignments : []
  for (const assignment of assignments) {
    const rawId = normalizeString((assignment as { classId?: unknown }).classId)
    const rawName = normalizeString((assignment as { className?: unknown }).className)

    if (rawId) {
      const record = classById.get(normalizeClassToken(rawId)) ?? null
      registerClassRecord(record, rawId, record?.name ?? rawName)
      continue
    }

    if (rawName) {
      const record = classByName.get(normalizeClassToken(rawName)) ?? null
      registerClassRecord(record, record?.id, rawName)
    }
  }

  const teachingClassIds = Array.isArray(teacher.teachingClassIds) ? teacher.teachingClassIds : []
  for (const identifier of teachingClassIds) {
    registerClassId(identifier)
  }

  const metadata = (teacher.metadata ?? {}) as Record<string, unknown>
  const metadataAssignedIds = Array.isArray(metadata.assignedClassIds) ? metadata.assignedClassIds : []
  for (const identifier of metadataAssignedIds) {
    registerClassId(identifier)
  }

  const metadataAssignedNames = Array.isArray(metadata.assignedClassNames) ? metadata.assignedClassNames : []
  for (const name of metadataAssignedNames) {
    registerClassName(name)
  }

  registerClassId(teacher.classId)
  registerClassName((teacher as { className?: unknown }).className)
  registerClassName(metadata.assignedClassName)

  return { tokens, classes: summaries }
}

interface RequestContextResolution {
  role: string
  user: StoredUser | null
  tokenProvided: boolean
}

async function resolveRequestContext(
  request: NextRequest,
): Promise<{ context: RequestContextResolution; errorResponse?: NextResponse }> {
  const authHeader = request.headers.get("authorization")

  if (!authHeader) {
    return { context: { role: "", user: null, tokenProvided: false } }
  }

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      context: { role: "", user: null, tokenProvided: true },
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return {
      context: { role: "", user: null, tokenProvided: true },
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  try {
    const decoded = verifyToken(token)
    const userId = normalizeString((decoded as { userId?: unknown }).userId)
    const roleFromToken = normalizeRole((decoded as { role?: unknown }).role)

    if (!userId) {
      return {
        context: { role: roleFromToken, user: null, tokenProvided: true },
        errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }
    }

    const user = await getUserByIdFromDb(userId)
    if (!user) {
      logger.warn("Rejected student list request for missing user", { userId })
      return {
        context: { role: roleFromToken, user: null, tokenProvided: true },
        errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }
    }

    return { context: { role: normalizeRole(user.role), user, tokenProvided: true } }
  } catch (error) {
    logger.warn("Rejected student list request due to invalid token", {
      error: error instanceof Error ? error.message : error,
    })
    return {
      context: { role: "", user: null, tokenProvided: true },
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
}

function normalizePaymentStatus(status: unknown): "paid" | "pending" | "overdue" {
  if (typeof status !== "string") {
    return "pending"
  }

  const normalized = sanitizeInput(status).toLowerCase()

  if (normalized === "paid" || normalized === "overdue") {
    return normalized
  }

  return "pending"
}

async function resolveClassIdFromName(className: string): Promise<string | null> {
  if (!className) {
    return null
  }

  try {
    const classes = await getAllClassesFromDb()
    const normalized = className.trim().toLowerCase()
    const match = classes.find((entry: ClassRecord) => entry.name.trim().toLowerCase() === normalized)
    return match ? match.id : null
  } catch (error) {
    logger.warn("Unable to resolve class ID for student", { error })
    return null
  }
}

function buildStudentMetadata(student: StudentRecord): Record<string, string> {
  const metadata: Record<string, string> = {}

  if (student.class) {
    metadata.className = sanitizeInput(student.class)
  }

  if (student.section) {
    metadata.classSection = sanitizeInput(student.section)
  }

  if (student.admissionNumber) {
    metadata.admissionNumber = sanitizeInput(student.admissionNumber)
  }

  if (student.parentName) {
    metadata.parentName = sanitizeInput(student.parentName)
  }

  if (student.parentEmail) {
    metadata.parentEmail = sanitizeInput(student.parentEmail)
  }

  if (student.phone) {
    metadata.phone = sanitizeInput(student.phone)
  }

  if (student.guardianPhone) {
    metadata.guardianPhone = sanitizeInput(student.guardianPhone)
  }

  if (student.address) {
    metadata.address = sanitizeInput(student.address)
  }

  if (student.passportUrl) {
    metadata.passportUrl = sanitizeInput(student.passportUrl)
  } else if (student.photoUrl) {
    metadata.photoUrl = sanitizeInput(student.photoUrl)
  }

  return metadata
}

async function findExistingStudentUser(student: StudentRecord): Promise<StoredUser | null> {
  if (student.email) {
    const byEmail = await getUserByEmail(student.email)
    if (byEmail) {
      return byEmail
    }
  }

  const studentUsers = await getUsersByRoleFromDb("student")
  return (
    studentUsers.find(
      (user) => Array.isArray(user.studentIds) && user.studentIds.some((id) => id === student.id),
    ) ?? null
  )
}

function generateDefaultStudentPassword(student: StudentRecord): string {
  const numericPortion = student.admissionNumber.replace(/\D/g, "") || student.id.replace(/\D/g, "")
  const suffix = numericPortion.slice(-4).padStart(4, "0")
  return `VeA@${suffix}`
}

async function syncStudentUserRecord(student: StudentRecord): Promise<void> {
  const email = sanitizeInput(student.email ?? "").toLowerCase()

  if (!email) {
    return
  }

  const metadata = buildStudentMetadata(student)
  const classId = await resolveClassIdFromName(student.class)
  const status = student.status === "inactive" ? "inactive" : "active"
  const isActive = status === "active"

  const existing = await findExistingStudentUser(student)

  if (existing) {
    const mergedMetadata = { ...(existing.metadata ?? {}), ...metadata }

    await updateUserRecord(existing.id, {
      name: student.name,
      email,
      role: "student",
      classId: classId ?? existing.classId ?? null,
      studentIds: [student.id],
      metadata: mergedMetadata,
      status,
      isActive,
    })
    return
  }

  const passwordHash = await hashPassword(generateDefaultStudentPassword(student))

  await createUserRecord({
    name: student.name,
    email,
    role: "student",
    passwordHash,
    classId: classId ?? undefined,
    studentIds: [student.id],
    metadata,
    isActive,
    status,
  })
}

async function removeStudentUser(studentId: string, email?: string | null): Promise<void> {
  const normalizedEmail = typeof email === "string" ? sanitizeInput(email).toLowerCase() : null

  if (normalizedEmail) {
    const existing = await getUserByEmail(normalizedEmail)
    if (existing && existing.role === "student") {
      await deleteUserRecord(existing.id)
      return
    }
  }

  const studentUsers = await getUsersByRoleFromDb("student")
  const linked = studentUsers.find(
    (user) => Array.isArray(user.studentIds) && user.studentIds.some((id) => id === studentId),
  )

  if (linked) {
    await deleteUserRecord(linked.id)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = normalizeString(searchParams.get("id"))
    const classFilter = searchParams.get("class")
    const statusFilter = searchParams.get("status")

    const { context, errorResponse } = await resolveRequestContext(request)
    if (errorResponse) {
      return errorResponse
    }

    const normalizedRole = context.role
    const normalizedStatusFilter = normalizeStatusValue(statusFilter)

    if (normalizedRole === "teacher") {
      const teacher = context.user

      if (!teacher) {
        logger.warn("Teacher student request rejected due to missing user context")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const scope = await resolveTeacherScope(teacher)

      if (scope.classes.length === 0) {
        logger.info("Teacher has no class assignments; returning empty student list", { teacherId: teacher.id })
        return NextResponse.json({
          students: [],
          scope: { classes: scope.classes },
          message: "You are not assigned to any students. Contact your administrator.",
        })
      }

      const normalizedClassFilter = normalizeClassToken(classFilter)
      if (classFilter && normalizedClassFilter && !scope.tokens.has(normalizedClassFilter)) {
        logger.warn("Teacher attempted to filter students by unauthorized class", {
          teacherId: teacher.id,
          requestedClass: classFilter,
        })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (normalizedStatusFilter && normalizedStatusFilter !== "active") {
        logger.warn("Teacher attempted to filter students by unsupported status", {
          teacherId: teacher.id,
          status: statusFilter,
        })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (studentId) {
        const record = await getStudentRecordById(studentId)

        if (!record || record.isReal === false || normalizeStatusValue(record.status) !== "active") {
          return NextResponse.json({ students: [], scope: { classes: scope.classes } })
        }

        const normalizedStudentToken = normalizeClassToken(record.class)
        if (!scope.tokens.has(normalizedStudentToken)) {
          logger.warn("Teacher attempted to access student outside scope", {
            teacherId: teacher.id,
            studentId,
          })
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        return NextResponse.json({
          students: [{ ...record, status: "active" }],
          scope: { classes: scope.classes },
        })
      }

      let students = await listStudentRecords()
      students = students.filter((student) => {
        const normalizedStudentToken = normalizeClassToken(student.class)
        const studentStatus = normalizeStatusValue(student.status)
        return student.isReal !== false && studentStatus === "active" && scope.tokens.has(normalizedStudentToken)
      })

      if (normalizedClassFilter) {
        students = students.filter((student) => normalizeClassToken(student.class) === normalizedClassFilter)
      }

      return NextResponse.json({
        students,
        scope: { classes: scope.classes },
        message: students.length === 0 ? "No students found for your assigned classes yet." : undefined,
      })
    }

    if (studentId) {
      const record = await getStudentRecordById(studentId)
      if (!record) {
        return NextResponse.json({ students: [] })
      }

      if (normalizedRole !== "super_admin" && record.isReal === false) {
        return NextResponse.json({ students: [] })
      }

      return NextResponse.json({ students: [record] })
    }

    let students = await listStudentRecords()

    if (normalizedRole !== "super_admin") {
      students = students.filter((student) => student.isReal !== false)
    }

    if (classFilter) {
      const normalizedClass = normalizeClassToken(classFilter)
      if (normalizedClass) {
        students = students.filter((student) => normalizeClassToken(student.class) === normalizedClass)
      }
    }

    if (normalizedStatusFilter) {
      students = students.filter((student) => normalizeStatusValue(student.status) === normalizedStatusFilter)
    }

    return NextResponse.json({ students })
  } catch (error) {
    logger.error("Failed to fetch students", { error })
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const passportUrl =
      typeof body.passportUrl === "string" && body.passportUrl.trim().length > 0
        ? sanitizeInput(body.passportUrl)
        : typeof body.photoUrl === "string" && body.photoUrl.trim().length > 0
          ? sanitizeInput(body.photoUrl)
          : null

    const record = await createStudentRecord({
      name: sanitizeInput(body.name),
      email: sanitizeInput(body.email),
      class: sanitizeInput(body.class),
      section: sanitizeInput(body.section),
      admissionNumber: sanitizeInput(body.admissionNumber),
      parentName: sanitizeInput(body.parentName),
      parentEmail: sanitizeInput(body.parentEmail),
      paymentStatus: normalizePaymentStatus(body.paymentStatus),
      status:
        typeof body.status === "string" && sanitizeInput(body.status).toLowerCase() === "inactive"
          ? "inactive"
          : "active",
      dateOfBirth: String(body.dateOfBirth ?? ""),
      address: sanitizeInput(body.address ?? ""),
      phone: sanitizeInput(body.phone ?? ""),
      guardianPhone: sanitizeInput(body.guardianPhone ?? ""),
      bloodGroup: sanitizeInput(body.bloodGroup ?? ""),
      admissionDate: String(body.admissionDate ?? ""),
      subjects: Array.isArray(body.subjects) ? body.subjects.map((subject: string) => sanitizeInput(subject)) : [],
      attendance:
        body.attendance && typeof body.attendance === "object"
          ? {
              present: Number(body.attendance.present ?? 0),
              total: Number(body.attendance.total ?? 0),
            }
          : { present: 0, total: 0 },
      grades: Array.isArray(body.grades)
        ? body.grades.map((grade: any) => ({
            subject: sanitizeInput(String(grade.subject ?? "")),
            ca1: Number(grade.ca1 ?? 0),
            ca2: Number(grade.ca2 ?? 0),
            exam: Number(grade.exam ?? 0),
            total: Number(grade.total ?? 0),
            grade: sanitizeInput(String(grade.grade ?? "")),
          }))
        : [],
      passportUrl,
      photoUrl: passportUrl,
      isReal: true,
    })

    try {
      await syncStudentUserRecord(record)
    } catch (error) {
      logger.error("Failed to synchronise student user account", { error })
      try {
        await deleteStudentRecord(record.id)
      } catch (cleanupError) {
        logger.error("Failed to rollback student creation after user sync failure", { cleanupError })
      }
      throw error instanceof Error ? error : new Error("Unable to create student user")
    }

    return NextResponse.json({ student: record, message: "Student created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Failed to create student:", error)
    const message = error instanceof Error ? error.message : "Failed to create student"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const previousRecord = await getStudentRecordById(body.id)

    const updates: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(body)) {
      if (key === "id" || value === undefined) {
        continue
      }

      if (key === "passportUrl" || key === "photoUrl") {
        if (typeof value === "string" && value.trim().length > 0) {
          const sanitized = sanitizeInput(value)
          updates.passportUrl = sanitized
          updates.photoUrl = sanitized
        } else if (value === null) {
          updates.passportUrl = null
          updates.photoUrl = null
        }
        continue
      }

      if (key === "subjects" && Array.isArray(value)) {
        updates.subjects = value.map((subject) => sanitizeInput(String(subject)))
      } else if (key === "grades" && Array.isArray(value)) {
        updates.grades = value.map((grade: any) => ({
          subject: sanitizeInput(String(grade.subject ?? "")),
          ca1: Number(grade.ca1 ?? 0),
          ca2: Number(grade.ca2 ?? 0),
          exam: Number(grade.exam ?? 0),
          total: Number(grade.total ?? 0),
          grade: sanitizeInput(String(grade.grade ?? "")),
        }))
      } else if (key === "attendance" && value && typeof value === "object") {
        updates.attendance = {
          present: Number((value as any).present ?? 0),
          total: Number((value as any).total ?? 0),
        }
      } else if (key === "paymentStatus") {
        updates.paymentStatus = normalizePaymentStatus(value)
      } else if (key === "status") {
        updates.status = sanitizeInput(String(value)).toLowerCase() === "inactive" ? "inactive" : "active"
      } else if (typeof value === "string") {
        updates[key] = sanitizeInput(value)
      } else {
        updates[key] = value
      }
    }

    const updated = await updateStudentRecord(body.id, updates)

    if (!updated) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    try {
      await syncStudentUserRecord(updated)
    } catch (error) {
      logger.error("Failed to synchronise student user during update", { error })

      if (previousRecord) {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...previousPayload } = previousRecord
        try {
          await updateStudentRecord(previousRecord.id, previousPayload)
        } catch (rollbackError) {
          logger.error("Failed to rollback student update after user sync failure", { rollbackError })
        }
      }

      throw error instanceof Error ? error : new Error("Unable to update student user")
    }

    return NextResponse.json({ student: updated, message: "Student updated successfully" })
  } catch (error) {
    console.error("Failed to update student:", error)
    const message = error instanceof Error ? error.message : "Failed to update student"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const existing = await getStudentRecordById(id)
    const deleted = await deleteStudentRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    try {
      await removeStudentUser(id, existing?.email)
    } catch (error) {
      logger.error("Failed to remove linked student user during deletion", { error })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete student:", error)
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 })
  }
}
