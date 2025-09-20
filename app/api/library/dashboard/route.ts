import { NextResponse } from "next/server"

import { getLibraryDashboardSnapshot } from "@/lib/database"

export const runtime = "nodejs"

export async function GET() {
  try {
    const snapshot = await getLibraryDashboardSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Failed to load library dashboard:", error)
    return NextResponse.json({ error: "Failed to load library dashboard" }, { status: 500 })
  }
}
