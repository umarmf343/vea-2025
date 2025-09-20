import { type NextRequest, NextResponse } from "next/server"

import { markBorrowRecordAsReturned } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: "Borrow record ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "return"

    if (action !== "return") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }

    const librarianId =
      typeof body.librarianId === "string" && body.librarianId.trim().length > 0
        ? sanitizeInput(body.librarianId)
        : undefined

    const updated = await markBorrowRecordAsReturned(id, librarianId)

    if (!updated) {
      return NextResponse.json({ error: "Borrow record not found" }, { status: 404 })
    }

    return NextResponse.json({ record: updated, message: "Book marked as returned" })
  } catch (error) {
    console.error("Failed to update borrowed book record:", error)
    const message = error instanceof Error ? error.message : "Failed to update borrowed record"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
