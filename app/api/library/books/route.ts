import { type NextRequest, NextResponse } from "next/server"

import { createLibraryBookRecord, listLibraryBooks } from "@/lib/database"
import { sanitizeInput } from "@/lib/security"

export const runtime = "nodejs"

export async function GET() {
  try {
    const books = await listLibraryBooks()
    return NextResponse.json({ books })
  } catch (error) {
    console.error("Failed to fetch library books:", error)
    return NextResponse.json({ error: "Failed to fetch library books" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requiredFields = ["title", "author", "isbn", "category", "copies"]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    const copies = Number(body.copies)
    const available = body.available !== undefined ? Number(body.available) : undefined

    if (!Number.isFinite(copies) || copies < 0) {
      return NextResponse.json({ error: "Copies must be a positive number" }, { status: 400 })
    }

    if (available !== undefined && (!Number.isFinite(available) || available < 0)) {
      return NextResponse.json({ error: "Available copies must be a positive number" }, { status: 400 })
    }

    const book = await createLibraryBookRecord({
      title: sanitizeInput(String(body.title)),
      author: sanitizeInput(String(body.author)),
      isbn: sanitizeInput(String(body.isbn)),
      category: sanitizeInput(String(body.category)),
      copies,
      available,
      addedBy: typeof body.addedBy === "string" ? sanitizeInput(body.addedBy) : null,
      addedDate: typeof body.addedDate === "string" ? body.addedDate : undefined,
      updatedBy: typeof body.updatedBy === "string" ? sanitizeInput(body.updatedBy) : undefined,
    })

    return NextResponse.json({ book, message: "Book added successfully" }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add book"
    console.error("Failed to add library book:", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
