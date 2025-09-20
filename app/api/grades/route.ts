export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  createGradeRecord,
  getAllGradesFromDb,
  getGradesForClassFromDb,
  getGradesForStudentFromDb,
  updateGradeRecord,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const classId = searchParams.get("classId")

    if (studentId) {
      const grades = await getGradesForStudentFromDb(studentId)
      return NextResponse.json({ grades })
    }

    if (classId) {
      const grades = await getGradesForClassFromDb(classId)
      return NextResponse.json({ grades })
    }

    const grades = await getAllGradesFromDb()
    return NextResponse.json({ grades })
  } catch (error) {
    console.error("Failed to fetch grades:", error)
    return NextResponse.json({ error: "Failed to fetch grades" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, subject, firstCA, secondCA, assignment, exam, term, session, teacherRemarks, classId } = body

    if (!studentId || !subject) {
      return NextResponse.json({ error: "Student ID and subject are required" }, { status: 400 })
    }

    const savedGrade = await createGradeRecord({
      studentId: String(studentId),
      subject: sanitizeInput(subject),
      firstCA: Number(firstCA || 0),
      secondCA: Number(secondCA || 0),
      assignment: Number(assignment || 0),
      exam: Number(exam || 0),
      term: term ? sanitizeInput(term) : "",
      session: session ? sanitizeInput(session) : "",
      teacherRemarks: teacherRemarks ? sanitizeInput(teacherRemarks) : undefined,
      classId: classId ? String(classId) : null,
    })

    return NextResponse.json({ grade: savedGrade, message: "Grade saved successfully" })
  } catch (error) {
    console.error("Failed to save grade:", error)
    return NextResponse.json({ error: "Failed to save grade" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, classId, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Grade ID is required" }, { status: 400 })
    }

    const sanitizedUpdate: Record<string, any> = {}

    Object.entries(updateData).forEach(([key, value]) => {
      if (typeof value === "string") {
        sanitizedUpdate[key] = sanitizeInput(value)
      } else {
        sanitizedUpdate[key] = value
      }
    })

    const numericKeys = ["firstCA", "secondCA", "assignment", "exam", "total"]
    numericKeys.forEach((key) => {
      if (sanitizedUpdate[key] !== undefined) {
        const numericValue = Number(sanitizedUpdate[key])
        sanitizedUpdate[key] = Number.isFinite(numericValue) ? numericValue : 0
      }
    })

    if (classId !== undefined) {
      sanitizedUpdate.classId = classId ? String(classId) : null
    }

    const updatedGrade = await updateGradeRecord(id, sanitizedUpdate)

    if (!updatedGrade) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Grade updated successfully", data: updatedGrade })
  } catch (error) {
    console.error("Failed to update grade:", error)
    return NextResponse.json({ error: "Failed to update grade" }, { status: 500 })
  }
}
