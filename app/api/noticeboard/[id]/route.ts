import { type NextRequest, NextResponse } from "next/server"

import { deleteNoticeRecord, updateNoticeRecord } from "@/lib/database"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json()
    const id = params.id

    if (!id) {
      return NextResponse.json({ error: "Notice ID is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof body?.title === "string") {
      updates.title = body.title
    }

    if (typeof body?.content === "string") {
      updates.content = body.content
    }

    if (typeof body?.category === "string") {
      updates.category = body.category
    }

    if (Array.isArray(body?.targetAudience)) {
      updates.targetAudience = body.targetAudience
    }

    if (typeof body?.authorName === "string") {
      updates.authorName = body.authorName
    }

    if (typeof body?.authorRole === "string") {
      updates.authorRole = body.authorRole
    }

    if (typeof body?.isPinned === "boolean") {
      updates.isPinned = body.isPinned
    }

    const notice = await updateNoticeRecord(id, updates)
    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 })
    }

    return NextResponse.json({
      notice: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        category: notice.category,
        targetAudience: notice.targetAudience,
        author: notice.authorName,
        authorRole: notice.authorRole,
        date: notice.createdAt,
        isPinned: notice.isPinned,
      },
    })
  } catch (error) {
    logger.error("Failed to update notice", { error })
    return NextResponse.json({ error: "Failed to update notice" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: "Notice ID is required" }, { status: 400 })
    }

    const deleted = await deleteNoticeRecord(id)
    if (!deleted) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Failed to delete notice", { error })
    return NextResponse.json({ error: "Failed to delete notice" }, { status: 500 })
  }
}
