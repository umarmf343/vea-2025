import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { emitTyping } from "@/lib/realtime-hub"

export const runtime = "nodejs"

const typingSchema = z.object({
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  recipients: z.array(z.string().min(1)).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const payload = typingSchema.parse(await request.json())

    emitTyping({
      ...payload,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 })
    }

    return NextResponse.json({ error: "Unable to broadcast typing event" }, { status: 500 })
  }
}
