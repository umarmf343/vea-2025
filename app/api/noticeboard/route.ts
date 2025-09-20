import { type NextRequest, NextResponse } from "next/server"

import {
  createNoticeRecord,
  getNoticeRecords,
  type CreateNoticePayload,
  type NoticeRecord,
} from "@/lib/database"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

function mapNotice(record: NoticeRecord) {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    category: record.category,
    targetAudience: record.targetAudience,
    author: record.authorName,
    authorRole: record.authorRole,
    date: record.createdAt,
    isPinned: record.isPinned,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const audience = searchParams.get("audience") ?? undefined
    const pinned = searchParams.get("pinned")

    const notices = await getNoticeRecords({
      audience: audience ?? undefined,
      onlyPinned: pinned === "true",
    })

    return NextResponse.json({ notices: notices.map(mapNotice) })
  } catch (error) {
    logger.error("Failed to load notices", { error })
    return NextResponse.json({ error: "Failed to load notices" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const payload: CreateNoticePayload = {
      title: String(body?.title ?? "").trim(),
      content: String(body?.content ?? "").trim(),
      category: body?.category ?? "general",
      targetAudience: Array.isArray(body?.targetAudience) ? body.targetAudience : [],
      authorName: String(body?.authorName ?? "System"),
      authorRole: String(body?.authorRole ?? "admin"),
      isPinned: Boolean(body?.isPinned ?? false),
    }

    if (!payload.title || !payload.content || payload.targetAudience.length === 0) {
      return NextResponse.json(
        { error: "Title, content and at least one target audience are required" },
        { status: 400 },
      )
    }

    const notice = await createNoticeRecord(payload)
    return NextResponse.json({ notice: mapNotice(notice) }, { status: 201 })
  } catch (error) {
    logger.error("Failed to create notice", { error })
    return NextResponse.json({ error: "Failed to create notice" }, { status: 500 })
  }
}
