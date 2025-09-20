export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import {
  createUserRecord,
  getAllUsersFromDb,
  getUserByIdFromDb,
  getUsersByRoleFromDb,
  updateUserRecord,
} from "@/lib/database"
import { hashPassword, sanitizeInput } from "@/lib/security"

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
    const { name, email, role, password, classId, studentId, subjects } = body

    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    const newUser = await createUserRecord({
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      role: sanitizeInput(role),
      passwordHash: hashedPassword,
      classId: classId ? String(classId) : undefined,
      studentId: studentId ? String(studentId) : undefined,
      subjects: Array.isArray(subjects) ? subjects.map((subject: string) => sanitizeInput(subject)) : undefined,
    })

    const { passwordHash, ...userWithoutPassword } = newUser

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
    const { id, password, subjects, classId, studentId, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const sanitizedUpdate: Record<string, any> = {}

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

    if (subjects !== undefined) {
      sanitizedUpdate.subjects = Array.isArray(subjects)
        ? subjects.map((subject: string) => sanitizeInput(subject))
        : undefined
    }

    if (password) {
      sanitizedUpdate.passwordHash = await hashPassword(password)
    }

    const updatedUser = await updateUserRecord(id, sanitizedUpdate)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { passwordHash, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      user: userWithoutPassword,
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Failed to update user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
