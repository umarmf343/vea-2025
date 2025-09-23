import { randomUUID } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { addMessage, getMessagesForUser, markConversationRead, publishNotification, type ChatMessage } from "@/lib/realtime-hub"

export const runtime = "nodejs"

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number().nonnegative(),
  dataUrl: z.string().optional(),
})

const messageSchema = z.object({
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  senderRole: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).min(1),
  recipientNames: z.array(z.string().min(1)).min(1),
  recipientRoles: z.array(z.string().min(1)).min(1),
  content: z.string().min(1),
  messageType: z.enum(["text", "media"]).default("text"),
  attachments: z.array(attachmentSchema).default([]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  subject: z.string().optional(),
})

const markReadSchema = z.object({
  conversationId: z.string().min(1),
  userId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get("userId")
  const conversationId = searchParams.get("conversationId") ?? undefined

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const messages = getMessagesForUser(userId, conversationId)
  return NextResponse.json({ messages })
}

export async function POST(request: NextRequest) {
  try {
    const payload = messageSchema.parse(await request.json())

    const message: ChatMessage = {
      ...payload,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      readBy: [payload.senderId],
    }

    addMessage(message)

    publishNotification({
      id: randomUUID(),
      title: payload.subject ?? `New message from ${payload.senderName}`,
      body: payload.content.substring(0, 160),
      category: "message",
      createdAt: message.createdAt,
      targetUserIds: payload.recipientIds,
      targetRoles: payload.recipientRoles,
      actionUrl: `/messages/${message.conversationId}`,
      meta: {
        conversationId: message.conversationId,
        priority: payload.priority,
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 })
    }

    return NextResponse.json({ error: "Unable to send message" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = markReadSchema.parse(await request.json())
    markConversationRead(payload.conversationId, payload.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 })
    }

    return NextResponse.json({ error: "Unable to update message status" }, { status: 500 })
  }
}
