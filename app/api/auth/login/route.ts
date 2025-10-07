import { type NextRequest, NextResponse } from "next/server"
import { verifyPassword, generateToken, sanitizeInput } from "@/lib/security"
import { getUserByEmail, type StoredUser } from "@/lib/database"
import { logger } from "@/lib/logger"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const collectTeacherClassContext = (teacher: StoredUser | null | undefined) => {
  if (!teacher) {
    return { ids: [] as string[], names: [] as string[], summaries: [] as Array<{ id: string; name: string }> }
  }

  const idSet = new Set<string>()
  const nameSet = new Set<string>()
  const summaryMap = new Map<string, { id: string; name: string }>()

  const registerSummary = (idCandidate: unknown, nameCandidate: unknown) => {
    const id = normalizeString(idCandidate)
    const name = normalizeString(nameCandidate)

    if (!id && !name) {
      return
    }

    const summaryId = id || name || `class_${summaryMap.size + 1}`
    const summaryName = name || id || `Class ${summaryMap.size + 1}`
    const summaryKey = `${summaryId.toLowerCase()}::${summaryName.toLowerCase()}`

    if (!summaryMap.has(summaryKey)) {
      summaryMap.set(summaryKey, { id: summaryId, name: summaryName })
    }
  }

  const registerId = (value: unknown, nameHint?: unknown) => {
    const normalized = normalizeString(value)
    if (normalized) {
      idSet.add(normalized)
    }

    registerSummary(normalized, nameHint)
  }

  const registerName = (value: unknown, idHint?: unknown) => {
    const normalized = normalizeString(value)
    if (normalized) {
      nameSet.add(normalized)
    }

    registerSummary(idHint, normalized)
  }

  const registerClass = (idValue: unknown, nameValue?: unknown) => {
    registerId(idValue, nameValue)
    registerName(nameValue, idValue)
  }

  const assignments = Array.isArray(teacher.teachingAssignments) ? teacher.teachingAssignments : []
  for (const assignment of assignments) {
    registerClass((assignment as { classId?: unknown }).classId, (assignment as { className?: unknown }).className)
  }

  const teachingClassIds = Array.isArray(teacher.teachingClassIds) ? teacher.teachingClassIds : []
  for (const identifier of teachingClassIds) {
    registerClass(identifier)
  }

  registerClass(teacher.classId, (teacher as { className?: unknown }).className)

  const metadata = (teacher.metadata ?? {}) as Record<string, unknown>
  const metadataAssignedIds = Array.isArray(metadata.assignedClassIds) ? metadata.assignedClassIds : []
  for (const identifier of metadataAssignedIds) {
    registerClass(identifier)
  }

  const metadataAssignedNames = Array.isArray(metadata.assignedClassNames) ? metadata.assignedClassNames : []
  for (const name of metadataAssignedNames) {
    registerClass(undefined, name)
  }

  registerClass(undefined, metadata.assignedClassName)

  return {
    ids: Array.from(idSet),
    names: Array.from(nameSet),
    summaries: Array.from(summaryMap.values()),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Sanitize inputs
    const email = typeof body.email === "string" ? sanitizeInput(body.email) : ""
    const password = typeof body.password === "string" ? body.password.trim() : ""

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Get user from database
    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token
    const normalizedRole = typeof user.role === "string"
      ? user.role.trim().toLowerCase().replace(/[\s-]+/g, "_")
      : "student"
    const tokenPayload: Record<string, unknown> = {
      userId: user.id,
      email: user.email,
      role: normalizedRole,
    }

    let assignedClassIds: string[] = []
    let assignedClassNames: string[] = []
    let assignedClasses: Array<{ id: string; name: string }> = []

    if (normalizedRole === "teacher") {
      const classContext = collectTeacherClassContext(user)
      assignedClassIds = classContext.ids
      assignedClassNames = classContext.names
      assignedClasses = classContext.summaries
      tokenPayload.teacherId = user.id

      if (assignedClassIds.length > 0) {
        tokenPayload.assignedClassIds = assignedClassIds
      }

      if (assignedClassNames.length > 0) {
        tokenPayload.assignedClassNames = assignedClassNames
      }

      if (assignedClasses.length > 0) {
        tokenPayload.assignedClasses = assignedClasses
      }
    }

    const token = generateToken(tokenPayload)

    // Return user data without password
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user
    void _passwordHash

    const responseUser: Record<string, unknown> = { ...userWithoutPassword, role: normalizedRole }

    if (normalizedRole === "teacher") {
      responseUser.assignedClassIds = assignedClassIds
      responseUser.assignedClassNames = assignedClassNames
      responseUser.assignedClasses = assignedClasses
    }

    return NextResponse.json({
      user: responseUser,
      token,
      message: "Login successful",
    })
  } catch (error) {
    logger.error("Login error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
