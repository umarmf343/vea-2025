import { type NextRequest, NextResponse } from "next/server"

import {
  createStudentRecord,
  deleteStudentRecord,
  listStudentRecords,
  updateStudentRecord,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classFilter = searchParams.get("class")
    const statusFilter = searchParams.get("status")

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

    const deleted = await deleteStudentRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete student:", error)
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 })
  }
}
