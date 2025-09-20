export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const classId = searchParams.get("classId")

    let grades = []

    if (studentId) {
      grades = await dbManager.getStudentGrades(studentId)
    } else if (classId) {
      grades = await dbManager.getClassGrades(classId)
    } else {
      grades = await dbManager.getAllGrades()
    }

    return NextResponse.json({ grades })
  } catch (error) {
    console.error("Failed to fetch grades:", error)
    return NextResponse.json({ error: "Failed to fetch grades" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, subject, firstCA, secondCA, assignment, exam, remarks, teacherId } = body

    // Calculate totals and grade
    const caTotal = (firstCA || 0) + (secondCA || 0) + (assignment || 0)
    const total = caTotal + (exam || 0)

    let grade = "F"
    if (total >= 75) grade = "A"
    else if (total >= 60) grade = "B"
    else if (total >= 50) grade = "C"
    else if (total >= 40) grade = "D"
    else if (total >= 30) grade = "E"

    const gradeData = {
      studentId,
      subject,
      firstCA,
      secondCA,
      assignment,
      caTotal,
      exam,
      total,
      grade,
      remarks,
      teacherId,
      updatedAt: new Date().toISOString(),
    }

    const savedGrade = await dbManager.saveGrade(gradeData)

    return NextResponse.json({ grade: savedGrade, message: "Grade saved successfully" })
  } catch (error) {
    console.error("Failed to save grade:", error)
    return NextResponse.json({ error: "Failed to save grade" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    // Recalculate totals if assessment scores are updated
    if (updateData.firstCA !== undefined || updateData.secondCA !== undefined || updateData.assignment !== undefined) {
      const caTotal = (updateData.firstCA || 0) + (updateData.secondCA || 0) + (updateData.assignment || 0)
      updateData.caTotal = caTotal

      if (updateData.exam !== undefined) {
        updateData.total = caTotal + updateData.exam

        let grade = "F"
        if (updateData.total >= 75) grade = "A"
        else if (updateData.total >= 60) grade = "B"
        else if (updateData.total >= 50) grade = "C"
        else if (updateData.total >= 40) grade = "D"
        else if (updateData.total >= 30) grade = "E"

        updateData.grade = grade
      }
    }

    updateData.updatedAt = new Date().toISOString()

    const updatedGrade = await dbManager.updateGrade(id, updateData)

    return NextResponse.json({ message: "Grade updated successfully", data: updatedGrade })
  } catch (error) {
    console.error("Failed to update grade:", error)
    return NextResponse.json({ error: "Failed to update grade" }, { status: 500 })
  }
}
