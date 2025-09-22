import { type NextRequest, NextResponse } from "next/server"

import { listFeeStructures, listStudentRecords, recordFeeStructureDelivery } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const feeId = typeof body.feeId === "string" ? sanitizeInput(body.feeId) : ""
    const className = typeof body.className === "string" ? sanitizeInput(body.className) : ""
    const parentEmail = typeof body.parentEmail === "string" ? sanitizeInput(body.parentEmail) : ""
    const parentName = typeof body.parentName === "string" ? sanitizeInput(body.parentName) : ""
    const studentName = typeof body.studentName === "string" ? sanitizeInput(body.studentName) : ""
    const sentBy = typeof body.sentBy === "string" ? sanitizeInput(body.sentBy) : ""

    if (!feeId || !className || !parentEmail || !parentName || !studentName || !sentBy) {
      return NextResponse.json({ error: "Incomplete payload" }, { status: 400 })
    }

    const feeStructures = await listFeeStructures()
    const fee = feeStructures.find(
      (entry) => entry.id === feeId || entry.className.toLowerCase() === className.toLowerCase(),
    )

    if (!fee) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 })
    }

    const students = await listStudentRecords()
    const matchingStudent = students.find(
      (student) =>
        student.class.toLowerCase() === className.toLowerCase() &&
        student.parentEmail.toLowerCase() === parentEmail.toLowerCase(),
    )

    if (!matchingStudent) {
      return NextResponse.json({ error: "Parent is not linked to the specified class" }, { status: 400 })
    }

    const delivery = await recordFeeStructureDelivery({
      feeId: fee.id,
      className: fee.className,
      parentEmail,
      parentName,
      studentName: matchingStudent.name ?? studentName,
      sentBy,
      breakdown: {
        tuition: fee.tuition,
        development: fee.development,
        exam: fee.exam,
        sports: fee.sports,
        library: fee.library,
        total: fee.total,
      },
      message: typeof body.message === "string" ? sanitizeInput(body.message) : undefined,
    })

    return NextResponse.json({ delivery, message: "Fee structure sent successfully" })
  } catch (error) {
    console.error("Failed to send fee structure:", error)
    const message = error instanceof Error ? error.message : "Failed to send fee structure"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
