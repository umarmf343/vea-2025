import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createEventFeeConfiguration,
  listEventFeeConfigurations,
  type CreateEventFeeConfigurationPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { sanitizeInput } from "@/lib/security"

const parseClassList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? sanitizeInput(entry) : ""))
    .filter((entry) => entry.length > 0)
}

export async function GET(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const events = await listEventFeeConfigurations()
    return NextResponse.json({ events })
  } catch (error) {
    console.error("Failed to load event fee configurations:", error)
    return NextResponse.json({ error: "Unable to load event fees" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateEventFeeConfigurationPayload>

    const payload: CreateEventFeeConfigurationPayload = {
      name: sanitizeInput(body.name ?? ""),
      description: typeof body.description === "string" ? sanitizeInput(body.description) : undefined,
      amount: typeof body.amount === "number" ? body.amount : Number(body.amount ?? 0),
      dueDate: body.dueDate ?? null,
      applicableClasses: parseClassList(body.applicableClasses),
      activate: body.activate !== false,
    }

    const event = await createEventFeeConfiguration(payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
      actorRole: context.role,
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error("Failed to create event fee configuration:", error)
    const message = error instanceof Error ? error.message : "Unable to create event fee configuration"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
