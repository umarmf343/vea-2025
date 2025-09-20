import { type NextRequest, NextResponse } from "next/server"

import { createOrUpdateReceipt, listReceipts } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const receipts = await listReceipts()
    return NextResponse.json({ receipts })
  } catch (error) {
    console.error("Failed to fetch receipts:", error)
    return NextResponse.json({ error: "Failed to load receipts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.paymentId || typeof body.paymentId !== "string") {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    if (!body.studentName || typeof body.studentName !== "string") {
      return NextResponse.json({ error: "Student name is required" }, { status: 400 })
    }

    const amount = Number(body.amount)
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Amount must be a valid non-negative number" }, { status: 400 })
    }

    const receipt = await createOrUpdateReceipt({
      paymentId: sanitizeInput(body.paymentId),
      studentName: sanitizeInput(body.studentName),
      amount,
      reference: typeof body.reference === "string" ? sanitizeInput(body.reference) : undefined,
      issuedBy: typeof body.issuedBy === "string" ? sanitizeInput(body.issuedBy) : undefined,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined,
      receiptNumber: typeof body.receiptNumber === "string" ? sanitizeInput(body.receiptNumber) : undefined,
      dateIssued:
        typeof body.dateIssued === "string" && !Number.isNaN(Date.parse(body.dateIssued))
          ? body.dateIssued
          : undefined,
    })

    return NextResponse.json({
      receipt,
      message: "Receipt generated successfully",
    })
  } catch (error) {
    console.error("Failed to generate receipt:", error)
    const message = error instanceof Error ? error.message : "Failed to generate receipt"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
