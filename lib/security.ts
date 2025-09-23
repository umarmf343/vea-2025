import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { rateLimit } from "express-rate-limit"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

const DEFAULT_JWT_SECRET = "vea-2025-development-secret"
const resolveJwtSecret = () => {
  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }

  return DEFAULT_JWT_SECRET
}

const JWT_SECRET = resolveJwtSecret()

// Password hashing utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash)
}

// JWT utilities
export const generateToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" })
}

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    throw new Error("Invalid token")
  }
}

// Rate limiting configuration
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  })
}

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
}

// Role-based access control
export const hasPermission = (userRole: string, requiredRoles: string[]): boolean => {
  const roleHierarchy = {
    "Super Admin": 7,
    Admin: 6,
    Teacher: 5,
    Accountant: 4,
    Librarian: 3,
    Parent: 2,
    Student: 1,
  }

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
  const requiredLevel = Math.max(...requiredRoles.map((role) => roleHierarchy[role as keyof typeof roleHierarchy] || 0))

  return userLevel >= requiredLevel
}

// Data encryption utilities
export const encryptSensitiveData = (data: string): string => {
  if (typeof window !== "undefined") {
    // Client-side fallback
    return Buffer.from(data).toString("base64")
  }

  const algorithm = "aes-256-gcm"
  const key = process.env.ENCRYPTION_KEY || "default-key-change-in-production"
  const keyBuffer = scryptSync(key, "salt", 32)
  const iv = randomBytes(16)

  const cipher = createCipheriv(algorithm, keyBuffer, iv)
  cipher.setAAD(Buffer.from("additional-data"))

  const encryptedBuffer = Buffer.concat([cipher.update(data, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encryptedBuffer.toString("hex")}`
}

export const decryptSensitiveData = (encryptedData: string): string => {
  if (typeof window !== "undefined") {
    // Client-side fallback
    return Buffer.from(encryptedData, "base64").toString("utf-8")
  }

  const algorithm = "aes-256-gcm"
  const key = process.env.ENCRYPTION_KEY || "default-key-change-in-production"
  const keyBuffer = scryptSync(key, "salt", 32)

  const parts = encryptedData.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format")
  }

  const [ivHex, authTagHex, encrypted] = parts as [string, string, string]
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = createDecipheriv(algorithm, keyBuffer, iv)
  decipher.setAAD(Buffer.from("additional-data"))
  decipher.setAuthTag(authTag)

  const decryptedBuffer = Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()])

  return decryptedBuffer.toString("utf8")
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

export const validatePassword = (
  password: string,
): { isValid: boolean; errors: string[]; message: string } => {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  const isValid = errors.length === 0

  return {
    isValid,
    errors,
    message: isValid ? "Password meets all requirements" : errors[0] ?? "Invalid password",
  }
}

export const sanitizeSqlInput = (input: string): string => {
  return input.replace(/'/g, "''").replace(/;/g, "").replace(/--/g, "").replace(/\/\*/g, "").replace(/\*\//g, "").trim()
}

export const generateSessionId = (): string => {
  return randomBytes(32).toString("hex")
}

export const isSessionValid = (sessionData: any): boolean => {
  if (!sessionData || !sessionData.expiresAt) {
    return false
  }

  return new Date(sessionData.expiresAt) > new Date()
}
