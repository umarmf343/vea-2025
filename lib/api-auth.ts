import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { getUserByIdFromDb, type StoredUser } from "@/lib/database"
import { logger } from "@/lib/logger"
import { verifyToken } from "@/lib/security"

interface RawAuthContext {
  userId: string
  role: string
  name: string
  tokenProvided: boolean
  userRecord: StoredUser | null
}

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

const normalizeRole = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

async function resolveContextFromToken(token: string): Promise<RawAuthContext | null> {
  try {
    const decoded = verifyToken(token)
    const userId = normalizeString((decoded as { userId?: unknown }).userId)
    const role = normalizeRole((decoded as { role?: unknown }).role)
    const name = normalizeString((decoded as { name?: unknown }).name)

    if (!userId) {
      logger.warn("Authorization token did not contain a user id")
      return null
    }

    const userRecord = await getUserByIdFromDb(userId)
    return {
      userId,
      role,
      name: name || userRecord?.name || "",
      tokenProvided: true,
      userRecord,
    }
  } catch (error) {
    logger.warn("Failed to verify authorization token", {
      error: error instanceof Error ? error.message : error,
    })
    return null
  }
}

async function resolveContextFromHeaders(request: NextRequest): Promise<RawAuthContext | null> {
  const roleHeader = normalizeRole(request.headers.get("x-user-role"))
  const idHeader = normalizeString(request.headers.get("x-user-id"))
  const nameHeader = normalizeString(request.headers.get("x-user-name"))

  if (!roleHeader || !idHeader) {
    return null
  }

  const userRecord = await getUserByIdFromDb(idHeader)

  return {
    userId: idHeader,
    role: roleHeader,
    name: nameHeader || userRecord?.name || "",
    tokenProvided: false,
    userRecord,
  }
}

export interface AuthenticatedContext {
  userId: string
  role: string
  name: string
  user: StoredUser | null
  tokenProvided: boolean
}

export async function resolveAuthenticatedContext(
  request: NextRequest,
): Promise<{ context: AuthenticatedContext | null; response?: NextResponse }> {
  const authHeader = request.headers.get("authorization")

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (!token) {
      return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }

    const context = await resolveContextFromToken(token)
    if (!context) {
      return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }

    return {
      context: {
        userId: context.userId,
        role: context.role,
        name: context.name,
        user: context.userRecord,
        tokenProvided: true,
      },
    }
  }

  const fallback = await resolveContextFromHeaders(request)
  if (fallback) {
    return {
      context: {
        userId: fallback.userId,
        role: fallback.role,
        name: fallback.name,
        user: fallback.userRecord,
        tokenProvided: false,
      },
    }
  }

  return { context: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
}

export async function requireUserWithRole(
  request: NextRequest,
  allowedRoles: string[],
): Promise<{ context?: AuthenticatedContext; response?: NextResponse }> {
  const { context, response } = await resolveAuthenticatedContext(request)
  if (response || !context) {
    return { response }
  }

  const normalisedRole = normalizeRole(context.role)
  const allowed = allowedRoles.map((role) => normalizeRole(role))

  if (!allowed.includes(normalisedRole)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { context }
}
