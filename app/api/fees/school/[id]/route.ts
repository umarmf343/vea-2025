import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  getSchoolFeeConfigurationById,
  listFeeConfigurationAuditLog,
  updateSchoolFeeConfiguration,
  type UpdateSchoolFeeConfigurationPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { sanitizeInput } from "@/lib/security"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const record = await getSchoolFeeConfigurationById(params.id)
    if (!record) {
      return NextResponse.json({ error: "Fee configuration not found" }, { status: 404 })
    }

    if (context.role === "super_admin") {
      const audit = await listFeeConfigurationAuditLog(25)
      return NextResponse.json({ fee: record, audit })
    }

    return NextResponse.json({ fee: record })
  } catch (error) {
    console.error("Failed to load school fee configuration:", error)
    return NextResponse.json({ error: "Unable to load school fee configuration" }, { status: 500 })
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
    const body = (await request.json()) as Partial<UpdateSchoolFeeConfigurationPayload>

    const payload: UpdateSchoolFeeConfigurationPayload = {
      className: typeof body.className === "string" ? sanitizeInput(body.className) : undefined,
      term: typeof body.term === "string" ? sanitizeInput(body.term) : undefined,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      effectiveDate: body.effectiveDate ?? undefined,
      isActive: body.isActive,
      notes: typeof body.notes === "string" ? sanitizeInput(body.notes) : undefined,
      classId: body.classId ? sanitizeInput(String(body.classId)) : undefined,
    }

    const updated = await updateSchoolFeeConfiguration(params.id, payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
      actorRole: context.role,
    })

    if (!updated) {
      return NextResponse.json({ error: "Fee configuration not found" }, { status: 404 })
    }

    return NextResponse.json({ fee: updated })
  } catch (error) {
    console.error("Failed to update school fee configuration:", error)
    const message = error instanceof Error ? error.message : "Unable to update school fee configuration"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
