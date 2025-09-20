import { type NextRequest, NextResponse } from "next/server"

import { getBrandingSettings, updateBrandingSettings } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const branding = await getBrandingSettings()
    return NextResponse.json({ branding })
  } catch (error) {
    console.error("Failed to fetch branding settings:", error)
    return NextResponse.json({ error: "Failed to fetch branding settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const updated = await updateBrandingSettings({
      schoolName: typeof body.schoolName === "string" ? sanitizeInput(body.schoolName) : undefined,
      schoolAddress: typeof body.schoolAddress === "string" ? sanitizeInput(body.schoolAddress) : undefined,
      headmasterName: typeof body.headmasterName === "string" ? sanitizeInput(body.headmasterName) : undefined,
      defaultRemark: typeof body.defaultRemark === "string" ? sanitizeInput(body.defaultRemark) : undefined,
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : null,
      signatureUrl: typeof body.signatureUrl === "string" ? body.signatureUrl : null,
    })

    return NextResponse.json({ branding: updated, message: "Branding updated successfully" })
  } catch (error) {
    console.error("Failed to update branding settings:", error)
    return NextResponse.json({ error: "Failed to update branding settings" }, { status: 500 })
  }
}
