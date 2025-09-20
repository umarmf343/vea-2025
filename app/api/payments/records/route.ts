import { NextResponse } from "next/server"

import { listPaymentInitializations } from "@/lib/database"

export const runtime = "nodejs"

export async function GET() {
  try {
    const payments = await listPaymentInitializations()
    return NextResponse.json({ payments })
  } catch (error) {
    console.error("Failed to fetch payments:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}
