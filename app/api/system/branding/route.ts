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

    const rawLogo =
      typeof body.logoUrl === "string"
        ? body.logoUrl
        : typeof body.logo === "string"
          ? body.logo
          : typeof body.schoolLogo === "string"
            ? body.schoolLogo
            : null
    const rawSignature =
      typeof body.signatureUrl === "string"
        ? body.signatureUrl
        : typeof body.signature === "string"
          ? body.signature
          : typeof body.headmasterSignature === "string"
            ? body.headmasterSignature
            : null
    const headmasterName =
      typeof body.headmasterName === "string"
        ? body.headmasterName
        : typeof body.principalName === "string"
          ? body.principalName
          : undefined

    const updated = await updateBrandingSettings({
      schoolName: typeof body.schoolName === "string" ? sanitizeInput(body.schoolName) : undefined,
      schoolAddress: typeof body.schoolAddress === "string" ? sanitizeInput(body.schoolAddress) : undefined,
      educationZone: typeof body.educationZone === "string" ? sanitizeInput(body.educationZone) : undefined,
      councilArea: typeof body.councilArea === "string" ? sanitizeInput(body.councilArea) : undefined,
      contactPhone: typeof body.contactPhone === "string" ? sanitizeInput(body.contactPhone) : undefined,
      contactEmail: typeof body.contactEmail === "string" ? sanitizeInput(body.contactEmail) : undefined,
      headmasterName: typeof headmasterName === "string" ? sanitizeInput(headmasterName) : undefined,
      defaultRemark: typeof body.defaultRemark === "string" ? sanitizeInput(body.defaultRemark) : undefined,
      logoUrl: typeof rawLogo === "string" ? rawLogo : null,
      signatureUrl: typeof rawSignature === "string" ? rawSignature : null,
    })

    return NextResponse.json({ branding: updated, message: "Branding updated successfully" })
  } catch (error) {
    console.error("Failed to update branding settings:", error)
    return NextResponse.json({ error: "Failed to update branding settings" }, { status: 500 })
  }
}
