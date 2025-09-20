import { type NextRequest, NextResponse } from "next/server"
import { dbConnector } from "@/lib/database-server"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const { studentId } = params

    const reportData = await dbConnector.query("SELECT * FROM report_cards WHERE student_id = ?", [studentId])

    return NextResponse.json(reportData[0] || null)
  } catch (error) {
    console.error("Error fetching report card:", error)
    return NextResponse.json({ error: "Failed to fetch report card" }, { status: 500 })
  }
}
