export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  createUserRecord,
  deleteUserRecord,
  getAllUsersFromDb,
  getUserByIdFromDb,
  getUsersByRoleFromDb,
  updateUserRecord,
  type StoredUserStatus,
} from "@/lib/database"
import { hashPassword, sanitizeInput } from "@/lib/security"

function normalizeUserStatus(status: unknown): StoredUserStatus {
  if (typeof status !== "string") {
    return "active"
  }

  const normalized = sanitizeInput(status).trim().toLowerCase()

  if (normalized === "inactive") {
    return "inactive"
  }

  if (normalized === "suspended") {
    return "suspended"
  }

  return "active"
}

function normalizeRoleInput(role: unknown): string | null {
  if (typeof role !== "string") {
    return null
  }

  const normalized = sanitizeInput(role).trim().toLowerCase().replace(/[\s-]+/g, "_")

  switch (normalized) {
    case "super_admin":
    case "admin":
    case "teacher":
    case "student":
    case "parent":
    case "librarian":
    case "accountant":
      return normalized
    default:
      return null
  }
}

// const dbManager = new DatabaseManager()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const userId = searchParams.get("userId")

    if (userId) {
      const user = await getUserByIdFromDb(userId)
      return NextResponse.json({ users: user ? [user] : [] })
    }

    if (role) {
      const resolvedRole = normalizeRoleInput(role) ?? role
      const users = await getUsersByRoleFromDb(resolvedRole)
      return NextResponse.json({ users })
    }

    const users = await getAllUsersFromDb()
    return NextResponse.json({ users })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      role,
      password,
      classId,
      classIds,
      studentId,
      studentIds,
      subjects,
      status,
      isActive,
      metadata,
    } = body

    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const resolvedRole = normalizeRoleInput(role)
    if (!resolvedRole) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const statusValue = status !== undefined ? normalizeUserStatus(status) : undefined
    const isActiveValue = typeof isActive === "boolean" ? isActive : undefined

    const sanitizedStudentIds = Array.isArray(studentIds)
      ? studentIds.map((id: string) => sanitizeInput(String(id)))
      : undefined

    const sanitizedMetadata = sanitizeMetadata(metadata)

    const sanitizedClassIds = Array.isArray(classIds)
      ? classIds.map((id: string) => sanitizeInput(String(id)))
      : undefined

    const newUser = await createUserRecord({
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      role: resolvedRole,
      passwordHash: hashedPassword,
      classId: resolvedRole === "teacher" ? undefined : classId ? String(classId) : undefined,
      classIds: resolvedRole === "teacher" ? sanitizedClassIds : undefined,
      studentId: studentId ? String(studentId) : undefined,
      studentIds: sanitizedStudentIds,
      subjects:
        resolvedRole === "teacher"
          ? undefined
          : Array.isArray(subjects)
            ? subjects.map((subject: string) => sanitizeInput(subject))
            : undefined,
      status: statusValue,
      isActive: isActiveValue,
      metadata: sanitizedMetadata ?? null,
    })

    const { passwordHash: _passwordHash, ...userWithoutPassword } = newUser
    void _passwordHash

    return NextResponse.json({
      user: userWithoutPassword,
      message: "User created successfully",
    })
  } catch (error) {
    console.error("Failed to create user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      password,
      subjects,
      classId,
      classIds,
      studentId,
      studentIds,
      status,
      isActive,
      metadata,
      ...updateData
    } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const sanitizedUpdate: Record<string, unknown> = {}

    Object.entries(updateData).forEach(([key, value]) => {
      if (typeof value === "string") {
        if (key === "role") {
          const normalizedRole = normalizeRoleInput(value)
          if (normalizedRole) {
            sanitizedUpdate.role = normalizedRole
          }
        } else {
          sanitizedUpdate[key] = sanitizeInput(value)
        }
      } else {
        sanitizedUpdate[key] = value
      }
    })

    if (classId !== undefined) {
      sanitizedUpdate.classId = classId ? String(classId) : null
    }

    if (classIds !== undefined) {
      sanitizedUpdate.classIds = Array.isArray(classIds)
        ? classIds.map((value: string) => sanitizeInput(String(value)))
        : []
    }

    if (studentId !== undefined) {
      sanitizedUpdate.studentIds = studentId ? [String(studentId)] : []
    }

    if (studentIds !== undefined) {
      sanitizedUpdate.studentIds = Array.isArray(studentIds)
        ? studentIds.map((student: string) => String(student))
        : []
    }

    if (subjects !== undefined) {
      sanitizedUpdate.subjects = Array.isArray(subjects)
        ? subjects.map((subject: string) => sanitizeInput(subject))
        : undefined
    }

    if (metadata !== undefined) {
      sanitizedUpdate.metadata = sanitizeMetadata(metadata) ?? null
    }

    if (status !== undefined) {
      sanitizedUpdate.status = normalizeUserStatus(status)
    }

    if (isActive !== undefined) {
      sanitizedUpdate.isActive = Boolean(isActive)
    }

    if (password) {
      sanitizedUpdate.passwordHash = await hashPassword(password)
    }

    const updatedUser = await updateUserRecord(id, sanitizedUpdate)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { passwordHash: _passwordHash, ...userWithoutPassword } = updatedUser
    void _passwordHash

    return NextResponse.json({
      user: userWithoutPassword,
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Failed to update user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

function sanitizeMetadata(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const result: Record<string, any> = {}

  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (rawValue === undefined) {
      continue
    }

    if (typeof rawValue === "string") {
      result[key] = sanitizeInput(rawValue)
    } else if (Array.isArray(rawValue)) {
      result[key] = rawValue.map((entry) => (typeof entry === "string" ? sanitizeInput(entry) : entry))
    } else if (typeof rawValue === "object" && rawValue !== null) {
      const nested = sanitizeMetadata(rawValue)
      if (nested !== undefined) {
        result[key] = nested
      }
    } else {
      result[key] = rawValue
    }
  }

  return result
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const deleted = await deleteUserRecord(id)

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
