import { type NextRequest, NextResponse } from "next/server"

import { listPaymentInitializations, updatePaymentRecord } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

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

function normalizePaymentStatus(status: unknown): "pending" | "completed" | "failed" {
  if (typeof status !== "string") {
    return "pending"
  }

  const normalized = sanitizeInput(status).toLowerCase()

  if (normalized === "completed" || normalized === "failed") {
    return normalized
  }

  return "pending"
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    const metadata: Record<string, unknown> = {}

    if (typeof body.accessGranted === "boolean") {
      metadata.accessGranted = body.accessGranted
      metadata.accessGrantedAt = body.accessGranted ? new Date().toISOString() : null
    }

    if (typeof body.studentName === "string") {
      metadata.studentName = sanitizeInput(body.studentName)
    }

    if (typeof body.parentName === "string") {
      metadata.parentName = sanitizeInput(body.parentName)
    }

    if (typeof body.method === "string") {
      metadata.method = sanitizeInput(body.method)
    }

    if (body.metadata && typeof body.metadata === "object") {
      Object.assign(metadata, body.metadata)
    }

    const updated = await updatePaymentRecord(body.id, {
      status: body.status ? normalizePaymentStatus(body.status) : undefined,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      studentId: body.studentId ? String(body.studentId) : undefined,
      paymentType: body.paymentType ? sanitizeInput(body.paymentType) : undefined,
      email: body.email ? sanitizeInput(body.email) : undefined,
      reference: body.reference ? sanitizeInput(body.reference) : undefined,
      metadata,
    })

    if (!updated) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    return NextResponse.json({ payment: updated, message: "Payment updated successfully" })
  } catch (error) {
    console.error("Failed to update payment:", error)
    const message = error instanceof Error ? error.message : "Failed to update payment"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
