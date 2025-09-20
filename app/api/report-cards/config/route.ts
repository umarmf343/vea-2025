import { type NextRequest, NextResponse } from "next/server"

import { getReportCardConfigColumns, updateReportCardConfigColumns } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const columns = await getReportCardConfigColumns()
    return NextResponse.json({ columns })
  } catch (error) {
    console.error("Failed to fetch report card configuration:", error)
    return NextResponse.json({ error: "Failed to fetch report card configuration" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!Array.isArray(body.columns)) {
      return NextResponse.json({ error: "Columns array is required" }, { status: 400 })
    }

    const normalized = body.columns.map((column: any, index: number) => ({
      id: typeof column.id === "string" ? column.id : undefined,
      name: sanitizeInput(String(column.name ?? `Column ${index + 1}`)),
      type: sanitizeInput(String(column.type ?? "custom")),
      maxScore: Number(column.maxScore ?? 0),
      weight: Number(column.weight ?? 0),
      isRequired: Boolean(column.isRequired ?? false),
      order: typeof column.order === "number" ? column.order : index + 1,
    }))

    const columns = await updateReportCardConfigColumns(normalized)

    return NextResponse.json({ columns, message: "Report card configuration updated successfully" })
  } catch (error) {
    console.error("Failed to update report card configuration:", error)
    return NextResponse.json({ error: "Failed to update report card configuration" }, { status: 500 })
  }
}
