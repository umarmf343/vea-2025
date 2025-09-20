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
      const users = await getUsersByRoleFromDb(role)
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
    const { name, email, role, password, classId, studentId, studentIds, subjects, status, isActive, metadata } = body

    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const statusValue = status !== undefined ? normalizeUserStatus(status) : undefined
    const isActiveValue = typeof isActive === "boolean" ? isActive : undefined

    const sanitizedStudentIds = Array.isArray(studentIds)
      ? studentIds.map((id: string) => sanitizeInput(String(id)))
      : undefined

    const sanitizedMetadata = sanitizeMetadata(metadata)

    const newUser = await createUserRecord({
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      role: sanitizeInput(role),
      passwordHash: hashedPassword,
      classId: classId ? String(classId) : undefined,
      studentId: studentId ? String(studentId) : undefined,
      studentIds: sanitizedStudentIds,
      subjects: Array.isArray(subjects) ? subjects.map((subject: string) => sanitizeInput(subject)) : undefined,
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
    const { id, password, subjects, classId, studentId, studentIds, status, isActive, metadata, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const sanitizedUpdate: Record<string, unknown> = {}

    Object.entries(updateData).forEach(([key, value]) => {
      if (typeof value === "string") {
        sanitizedUpdate[key] = sanitizeInput(value)
      } else {
        sanitizedUpdate[key] = value
      }
    })

    if (classId !== undefined) {
      sanitizedUpdate.classId = classId ? String(classId) : null
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
