import crypto from "crypto"
import {
  createUserRecord,
  getUserByEmail,
  getUserByIdFromDb,
  updateUserRecord,
  type CreateUserPayload,
  type StoredUser,
} from "@/lib/database"
import {
  hashPassword as hashPasswordInternal,
  verifyPassword as verifyPasswordInternal,
  validateEmail,
  validatePassword as validatePasswordStrength,
} from "@/lib/security"

export type UserRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "librarian"
  | "accountant"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  lastLogin?: string | null
  profileImage?: string | null
  metadata?: Record<string, any>
}

export interface AuthSession {
  user: User
  token: string
  expiresAt: string
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const activeTokens = new Map<string, { userId: string; expiresAt: number }>()

function issueToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex")
  activeTokens.set(token, { userId, expiresAt: Date.now() + TOKEN_TTL_MS })
  return token
}

function resolveUserRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase()
  switch (normalized) {
    case "super admin":
    case "super_admin":
      return "super_admin"
    case "admin":
      return "admin"
    case "teacher":
      return "teacher"
    case "student":
      return "student"
    case "parent":
      return "parent"
    case "librarian":
      return "librarian"
    case "accountant":
      return "accountant"
    default:
      return "student"
  }
}

function mapUser(record: StoredUser): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: resolveUserRole(record.role),
    isActive: record.isActive !== false,
    lastLogin: record.lastLogin,
    profileImage: record.profileImage ?? undefined,
    metadata: record.metadata ?? undefined,
  }
}

function removeExpiredTokens() {
  const now = Date.now()
  for (const [token, { expiresAt }] of activeTokens.entries()) {
    if (expiresAt <= now) {
      activeTokens.delete(token)
    }
  }
}

export function validateUser(email: string, password: string): boolean {
  if (!validateEmail(email)) {
    return false
  }

  const { isValid } = validatePasswordStrength(password)
  return isValid
}

export const hashPassword = hashPasswordInternal
export const verifyPassword = verifyPasswordInternal

export const auth = {
  login: async (email: string, password: string): Promise<AuthSession | null> => {
    const userRecord = await getUserByEmail(email)
    if (!userRecord || userRecord.isActive === false) {
      return null
    }

    const validPassword = await verifyPasswordInternal(password, userRecord.passwordHash)
    if (!validPassword) {
      return null
    }

    const lastLogin = new Date().toISOString()
    const updated = await updateUserRecord(userRecord.id, { lastLogin })
    const recordToUse = updated ?? userRecord
    const token = issueToken(recordToUse.id)

    return {
      user: mapUser(recordToUse),
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    }
  },

  validateToken: async (token: string): Promise<User | null> => {
    removeExpiredTokens()
    const entry = activeTokens.get(token)
    if (!entry) {
      return null
    }

    if (entry.expiresAt <= Date.now()) {
      activeTokens.delete(token)
      return null
    }

    const userRecord = await getUserByIdFromDb(entry.userId)
    if (!userRecord || userRecord.isActive === false) {
      return null
    }

    return mapUser(userRecord)
  },

  hasPermission: (userRole: UserRole, requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      super_admin: 7,
      admin: 6,
      teacher: 5,
      librarian: 4,
      accountant: 4,
      parent: 3,
      student: 2,
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  },

  register: async (userData: {
    name: string
    email: string
    password: string
    role: UserRole
    metadata?: Record<string, any>
    classId?: string | null
    studentIds?: string[]
  }): Promise<User | null> => {
    const existing = await getUserByEmail(userData.email)
    if (existing) {
      throw new Error("User already exists")
    }

    const hashedPassword = await hashPasswordInternal(userData.password)
    const payload: CreateUserPayload = {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      passwordHash: hashedPassword,
      metadata: userData.metadata ?? null,
      isActive: true,
      classId: userData.classId ?? undefined,
      studentIds: userData.studentIds ?? undefined,
    }

    const newUser = await createUserRecord(payload)
    return mapUser(newUser)
  },

  logout: async (token: string): Promise<boolean> => {
    return activeTokens.delete(token)
  },
}
