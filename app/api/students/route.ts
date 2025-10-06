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
  getUsersByRoleFromDb,
  type ClassRecord,
  type StoredUser,
  type StudentRecord,
  updateUserRecord,
} from "@/lib/database"
import { hashPassword, sanitizeInput } from "@/lib/security"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

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
    const studentId = searchParams.get("id")
    const classFilter = searchParams.get("class")
    const statusFilter = searchParams.get("status")

    if (studentId) {
      const record = await getStudentRecordById(studentId)
      return NextResponse.json({ students: record ? [record] : [] })
    }

    let students = await listStudentRecords()

    if (classFilter) {
      const normalizedClass = sanitizeInput(classFilter).toLowerCase()
      students = students.filter((student) => student.class.toLowerCase() === normalizedClass)
    }

    if (statusFilter) {
      const normalizedStatus = sanitizeInput(statusFilter).toLowerCase()
      students = students.filter((student) => student.status.toLowerCase() === normalizedStatus)
    }

    return NextResponse.json({ students })
  } catch (error) {
    console.error("Failed to fetch students:", error)
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

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
      photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : null,
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
