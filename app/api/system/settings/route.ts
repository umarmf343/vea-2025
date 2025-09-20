import { type NextRequest, NextResponse } from "next/server"

import { getSystemSettingsRecord, updateSystemSettingsRecord } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getSystemSettingsRecord()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Failed to fetch system settings:", error)
    return NextResponse.json({ error: "Failed to fetch system settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const updated = await updateSystemSettingsRecord({
      academicYear: typeof body.academicYear === "string" ? sanitizeInput(body.academicYear) : undefined,
      currentTerm: typeof body.currentTerm === "string" ? sanitizeInput(body.currentTerm) : undefined,
      registrationEnabled:
        typeof body.registrationEnabled === "boolean" ? body.registrationEnabled : undefined,
      reportCardDeadline:
        typeof body.reportCardDeadline === "string" && body.reportCardDeadline.length > 0
          ? body.reportCardDeadline
          : null,
    })

    return NextResponse.json({ settings: updated, message: "System settings updated successfully" })
  } catch (error) {
    console.error("Failed to update system settings:", error)
    return NextResponse.json({ error: "Failed to update system settings" }, { status: 500 })
  }
}
