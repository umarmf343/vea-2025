import { NextResponse, type NextRequest } from "next/server"

import {
  getMessagesForUser,
  getNotificationsForUser,
  subscribe,
  type ChatMessage,
  type RealtimeNotification,
  type TypingPayload,
} from "@/lib/realtime-hub"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get("userId")
  const role = searchParams.get("role")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      send("init", {
        messages: getMessagesForUser(userId),
        notifications: getNotificationsForUser(userId, role),
      })

      const messageUnsubscribe = subscribe<ChatMessage>("message", (message) => {
        if (message.senderId === userId || message.recipientIds.includes(userId)) {
          send("message", message)
        }
      })

      const notificationUnsubscribe = subscribe<RealtimeNotification>("notification", (notification) => {
        if (
          notification.targetUserIds.includes(userId) ||
          (role && notification.targetRoles.includes(role)) ||
          notification.targetRoles.includes("all")
        ) {
          send("notification", notification)
        }
      })

      const typingUnsubscribe = subscribe<TypingPayload>("typing", (payload) => {
        if (payload.recipients.includes(userId)) {
          send("typing", payload)
        }
      })

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"))
      }, 20000)

      const close = () => {
        clearInterval(keepAlive)
        messageUnsubscribe()
        notificationUnsubscribe()
        typingUnsubscribe()
      }

      request.signal.addEventListener("abort", close)
    },
    cancel() {
      // The abort handler in start covers cleanup.
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
