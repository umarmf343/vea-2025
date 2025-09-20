import { type NextRequest, NextResponse } from "next/server"
import { marksSchema } from "@/lib/validation-schemas"
import { verifyToken, hasPermission } from "@/lib/security"
import { saveStudentMarks, getStudentMarks } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)

    // Check permissions
    if (!hasPermission(decoded.role, ["Teacher", "Admin", "Super Admin"])) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Validate marks data
    const validatedData = marksSchema.parse(body)

    // Calculate totals and grade
    const caTotal = validatedData.ca1 + validatedData.ca2 + validatedData.assignment
    const grandTotal = caTotal + validatedData.exam
    const percentage = (grandTotal / 100) * 100

    let grade = "F"
    if (percentage >= 75) grade = "A"
    else if (percentage >= 60) grade = "B"
    else if (percentage >= 50) grade = "C"
    else if (percentage >= 40) grade = "D"
    else if (percentage >= 30) grade = "E"

    const marksData = {
      ...validatedData,
      caTotal,
      grandTotal,
      percentage,
      grade,
      teacherId: decoded.userId,
      updatedAt: new Date().toISOString(),
    }

    // Save to database
    await saveStudentMarks(marksData)

    return NextResponse.json({
      message: "Marks saved successfully",
      data: marksData,
    })
  } catch (error) {
    console.error("Marks save error:", error)
    if (error instanceof Error && error.message.toLowerCase().includes("invalid")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save marks" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const term = searchParams.get("term")
    const session = searchParams.get("session")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Check permissions - users can only view their own data or if they have admin rights
    if (decoded.role === "Student" && decoded.userId !== studentId) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    if (decoded.role === "Parent") {
      // Verify parent has access to this student
      // Implementation would check parent-student relationship
    }

    const marks = await getStudentMarks(studentId, term, session)

    return NextResponse.json({
      data: marks,
    })
  } catch (error) {
    console.error("Marks fetch error:", error)
    if (error instanceof Error && error.message.toLowerCase().includes("invalid")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to fetch marks" }, { status: 500 })
  }
}
