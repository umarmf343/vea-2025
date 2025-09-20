import { type NextRequest, NextResponse } from "next/server"

import { listFeeStructures, upsertFeeStructure } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const feeStructure = await listFeeStructures()
    return NextResponse.json({ feeStructure })
  } catch (error) {
    console.error("Failed to fetch fee structure:", error)
    return NextResponse.json({ error: "Failed to load fee structure" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.className || typeof body.className !== "string") {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 })
    }

    const toNumber = (value: unknown, field: string) => {
      const parsed = Number(value)
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`${field} must be a valid non-negative number`)
      }
      return parsed
    }

    const feeRecord = await upsertFeeStructure({
      className: sanitizeInput(body.className),
      tuition: toNumber(body.tuition, "Tuition"),
      development: toNumber(body.development, "Development"),
      exam: toNumber(body.exam, "Exam"),
      sports: toNumber(body.sports, "Sports"),
      library: toNumber(body.library, "Library"),
    })

    return NextResponse.json({
      fee: feeRecord,
      message: "Fee structure saved successfully",
    })
  } catch (error) {
    console.error("Failed to update fee structure:", error)
    const message = error instanceof Error ? error.message : "Failed to update fee structure"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
