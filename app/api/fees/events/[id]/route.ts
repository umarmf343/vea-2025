import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  getEventFeeConfigurationById,
  updateEventFeeConfiguration,
  type UpdateEventFeeConfigurationPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { sanitizeInput } from "@/lib/security"

const parseClassList = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? sanitizeInput(entry) : ""))
    .filter((entry) => entry.length > 0)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const event = await getEventFeeConfigurationById(params.id)
    if (!event) {
      return NextResponse.json({ error: "Event fee not found" }, { status: 404 })
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Failed to load event fee configuration:", error)
    return NextResponse.json({ error: "Unable to load event fee" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<UpdateEventFeeConfigurationPayload>

    const payload: UpdateEventFeeConfigurationPayload = {
      name: typeof body.name === "string" ? sanitizeInput(body.name) : undefined,
      description: typeof body.description === "string" ? sanitizeInput(body.description) : undefined,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      dueDate: body.dueDate ?? undefined,
      applicableClasses: parseClassList(body.applicableClasses),
      isActive: body.isActive,
    }

    const updated = await updateEventFeeConfiguration(params.id, payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
      actorRole: context.role,
    })

    if (!updated) {
      return NextResponse.json({ error: "Event fee not found" }, { status: 404 })
    }

    return NextResponse.json({ event: updated })
  } catch (error) {
    console.error("Failed to update event fee configuration:", error)
    const message = error instanceof Error ? error.message : "Unable to update event fee configuration"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
