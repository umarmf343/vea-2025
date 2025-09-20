import { type NextRequest, NextResponse } from "next/server"

import {
  approveLibraryRequest,
  rejectLibraryRequest,
  updateLibraryRequestRecord,
} from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

const allowedStatuses = new Set(["pending", "approved", "rejected"])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
    }

    const body = await request.json()
    const statusInput = typeof body.status === "string" ? sanitizeInput(body.status).toLowerCase() : ""

    if (!allowedStatuses.has(statusInput)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const librarianId =
      typeof body.librarianId === "string" && body.librarianId.trim().length > 0
        ? sanitizeInput(body.librarianId)
        : undefined

    const notes = typeof body.notes === "string" ? sanitizeInput(body.notes) : undefined

    if (statusInput === "approved") {
      if (!librarianId) {
        return NextResponse.json({ error: "Librarian ID is required to approve a request" }, { status: 400 })
      }

      const dueDate = typeof body.dueDate === "string" ? body.dueDate : undefined
      const result = await approveLibraryRequest(id, { librarianId, dueDate, notes })

      if (!result) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 })
      }

      return NextResponse.json({
        request: result.request,
        borrowRecord: result.borrowRecord,
        message: "Request approved",
      })
    }

    if (statusInput === "rejected") {
      if (!librarianId) {
        return NextResponse.json({ error: "Librarian ID is required to reject a request" }, { status: 400 })
      }

      const updated = await rejectLibraryRequest(id, librarianId, notes)

      if (!updated) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 })
      }

      return NextResponse.json({ request: updated, message: "Request rejected" })
    }

    const updated = await updateLibraryRequestRecord(id, {
      status: "pending",
      notes: notes ?? null,
    })

    if (!updated) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    return NextResponse.json({ request: updated, message: "Request updated" })
  } catch (error) {
    console.error("Failed to update library request:", error)
    const message = error instanceof Error ? error.message : "Failed to update library request"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
