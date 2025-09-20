import { type NextRequest, NextResponse } from "next/server"

import { auth, type UserRole } from "@/lib/auth"
import { sanitizeInput, validateEmail, validatePassword } from "@/lib/security"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

const ROLE_MAP: Record<string, UserRole> = {
  admin: "admin",
  "super-admin": "super_admin",
  super_admin: "super_admin",
  teacher: "teacher",
  student: "student",
  parent: "parent",
  librarian: "librarian",
  accountant: "accountant",
}

function normalizeRole(roleInput: string): UserRole {
  const mapped = ROLE_MAP[roleInput.toLowerCase()]
  return mapped ?? "student"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = sanitizeInput(String(body?.name ?? "")).trim()
    const email = sanitizeInput(String(body?.email ?? "")).trim().toLowerCase()
    const password = String(body?.password ?? "")
    const roleInput = String(body?.role ?? "student")
    const resolvedRole = normalizeRole(roleInput)

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.message }, { status: 400 })
    }

    const user = await auth.register({
      name,
      email,
      password,
      role: resolvedRole,
    })

    if (!user) {
      return NextResponse.json({ error: "Unable to register user" }, { status: 500 })
    }

    return NextResponse.json({
      user,
      message: "Registration successful",
    })
  } catch (error) {
    logger.error("Registration error", { error })
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message === "User already exists" ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
