import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createEventFeeConfiguration,
  listEventFeeConfigurations,
  type CreateEventFeeConfigurationPayload,
  type EventFeeConfigurationRecord,
  type StoredUser,
  type StudentRecord,
  listStudentRecords,
  getAllUsersFromDb,
  canonicalClassKey,
} from "@/lib/database"
import { requireUserWithRole } from "@/lib/api-auth"
import { sanitizeInput } from "@/lib/security"
import { publishNotification } from "@/lib/realtime-hub"

const parseClassList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? sanitizeInput(entry) : ""))
    .filter((entry) => entry.length > 0)
}

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
})

type StudentMetadata = StudentRecord & {
  metadata?: Record<string, unknown> | null
  className?: string | null
}

const resolveStudentClassDetails = (student: StudentMetadata): { key: string | null; label: string | null } => {
  const metadata = (student.metadata ?? {}) as Record<string, unknown>
  const candidates: Array<string | null | undefined> = [
    student.class,
    student.className,
    typeof metadata.className === "string" ? metadata.className : undefined,
    typeof metadata.assignedClassName === "string" ? (metadata.assignedClassName as string) : undefined,
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue
    }

    const key = canonicalClassKey(candidate)
    if (key) {
      return { key, label: candidate }
    }
  }

  return { key: null, label: null }
}

const buildParentIndex = (users: StoredUser[]) => {
  const parentIndex = new Map<string, StoredUser>()

  for (const user of users) {
    const role = typeof user.role === "string" ? user.role.trim().toLowerCase() : ""
    if (role !== "parent") {
      continue
    }

    const studentIds = new Set<string>()
    if (Array.isArray(user.studentIds)) {
      for (const value of user.studentIds) {
        const id = typeof value === "string" ? value : String(value ?? "")
        if (id.trim().length > 0) {
          studentIds.add(id.trim())
        }
      }
    }

    const metadata = (user.metadata ?? {}) as Record<string, unknown>
    const linkedStudentId = metadata.linkedStudentId
    if (typeof linkedStudentId === "string" && linkedStudentId.trim().length > 0) {
      studentIds.add(linkedStudentId.trim())
    }

    const linkedStudentIds = metadata.linkedStudentIds
    if (Array.isArray(linkedStudentIds)) {
      for (const value of linkedStudentIds) {
        const id = typeof value === "string" ? value : String(value ?? "")
        if (id.trim().length > 0) {
          studentIds.add(id.trim())
        }
      }
    }

    if (studentIds.size === 0) {
      continue
    }

    for (const id of studentIds) {
      parentIndex.set(id, user)
    }
  }

  return parentIndex
}

const notifyParentsAboutEvent = async (
  event: EventFeeConfigurationRecord,
  actor: { id: string; name: string },
) => {
  try {
    const [students, users] = await Promise.all([listStudentRecords(), getAllUsersFromDb()])
    const parentIndex = buildParentIndex(users)
    const targetClassKeys = event.applicableClassKeys.length > 0 ? new Set(event.applicableClassKeys) : null

    const recipients = students
      .map((record) => {
        const student = record as StudentMetadata
        const { key: classKey, label: classLabel } = resolveStudentClassDetails(student)

        if (targetClassKeys && (!classKey || !targetClassKeys.has(classKey))) {
          return null
        }

        const parentUser = parentIndex.get(student.id)

        const parentName =
          typeof student.parentName === "string" && student.parentName.trim().length > 0
            ? student.parentName.trim()
            : typeof parentUser?.name === "string"
              ? parentUser.name
              : null

        const parentEmail =
          typeof student.parentEmail === "string" && student.parentEmail.trim().length > 0
            ? student.parentEmail.trim().toLowerCase()
            : typeof parentUser?.email === "string" && parentUser.email.trim().length > 0
              ? parentUser.email.trim().toLowerCase()
              : null

        const parentPhone =
          typeof student.guardianPhone === "string" && student.guardianPhone.trim().length > 0
            ? student.guardianPhone.trim()
            : typeof student.phone === "string" && student.phone.trim().length > 0
              ? student.phone.trim()
              : null

        return {
          studentId: student.id,
          studentName: student.name,
          className: classLabel,
          parentUserId: parentUser?.id ? String(parentUser.id) : null,
          parentName,
          parentEmail,
          parentPhone,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

    if (recipients.length === 0) {
      return
    }

    const targetUserIds = Array.from(
      new Set(
        recipients
          .map((entry) => entry.parentUserId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    )

    const targetStudentIds = recipients.map((entry) => entry.studentId)

    const formattedAmount = currencyFormatter.format(event.amount)
    const classLabel =
      event.applicableClasses.length > 0 ? event.applicableClasses.join(", ") : "all classes"
    const dueDateLabel = event.dueDate ? new Date(event.dueDate).toLocaleDateString() : null
    const messageParts = [
      `${event.name} has a new event fee of ${formattedAmount} for ${classLabel}.`,
      dueDateLabel ? `Payment is due by ${dueDateLabel}.` : null,
      "Use the payments section to complete this event fee online.",
    ].filter((part): part is string => Boolean(part))

    publishNotification({
      id: randomUUID(),
      title: `New event fee: ${event.name}`,
      body: messageParts.join(" "),
      category: "payment",
      createdAt: event.createdAt,
      targetUserIds,
      targetRoles: ["parent"],
      targetStudentIds,
      actionUrl: "/?tab=payments",
      meta: {
        eventId: event.id,
        eventName: event.name,
        amount: event.amount,
        dueDate: event.dueDate ?? null,
        applicableClasses: event.applicableClasses,
        studentIds: targetStudentIds,
        recipients,
        createdBy: actor,
      },
    })
  } catch (error) {
    console.error("Unable to notify parents about event fee", error)
  }
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

    await notifyParentsAboutEvent(event, {
      id: context.userId,
      name: context.name || context.user?.name || "Accountant",
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error("Failed to create event fee configuration:", error)
    const message = error instanceof Error ? error.message : "Unable to create event fee configuration"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
