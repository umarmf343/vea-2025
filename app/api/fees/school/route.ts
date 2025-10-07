import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createSchoolFeeConfiguration,
  listFeeConfigurationAuditLog,
  listSchoolFeeConfigurations,
  type CreateSchoolFeeConfigurationPayload,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { sanitizeInput } from "@/lib/security"

function parseBoolean(value: string | null): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export async function GET(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant", "super_admin"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const fees = await listSchoolFeeConfigurations()
    const { searchParams } = new URL(request.url)
    const includeAudit = parseBoolean(searchParams.get("includeAudit"))

    if (includeAudit && context.role === "super_admin") {
      const audit = await listFeeConfigurationAuditLog(50)
      return NextResponse.json({ fees, audit })
    }

    return NextResponse.json({ fees })
  } catch (error) {
    console.error("Failed to load school fee configurations:", error)
    return NextResponse.json({ error: "Unable to load school fee configurations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, response } = await requireUserWithRole(request, ["accountant"])
  if (response || !context) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateSchoolFeeConfigurationPayload>

    const payload: CreateSchoolFeeConfigurationPayload = {
      className: sanitizeInput(body.className ?? ""),
      term: sanitizeInput(body.term ?? ""),
      amount: typeof body.amount === "number" ? body.amount : Number(body.amount ?? 0),
      effectiveDate: body.effectiveDate ?? null,
      notes: typeof body.notes === "string" ? sanitizeInput(body.notes) : null,
      classId: body.classId ? sanitizeInput(String(body.classId)) : null,
      activate: body.activate !== false,
    }

    const record = await createSchoolFeeConfiguration(payload, {
      userId: context.userId,
      userName: context.name || context.user?.name || "Accountant",
      actorRole: context.role,
    })

    return NextResponse.json({ fee: record }, { status: 201 })
  } catch (error) {
    console.error("Failed to create school fee configuration:", error)
    const message = error instanceof Error ? error.message : "Unable to create school fee configuration"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
