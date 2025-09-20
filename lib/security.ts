import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { rateLimit } from "express-rate-limit"
import crypto from "crypto"

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
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "24h" })
}

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!)
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
  const keyBuffer = crypto.scryptSync(key, "salt", 32)
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipher(algorithm, keyBuffer)
  cipher.setAAD(Buffer.from("additional-data"))

  let encrypted = cipher.update(data, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

export const decryptSensitiveData = (encryptedData: string): string => {
  if (typeof window !== "undefined") {
    // Client-side fallback
    return Buffer.from(encryptedData, "base64").toString("utf-8")
  }

  const algorithm = "aes-256-gcm"
  const key = process.env.ENCRYPTION_KEY || "default-key-change-in-production"
  const keyBuffer = crypto.scryptSync(key, "salt", 32)

  const [ivHex, authTagHex, encrypted] = encryptedData.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = crypto.createDecipher(algorithm, keyBuffer)
  decipher.setAAD(Buffer.from("additional-data"))
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
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

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const sanitizeSqlInput = (input: string): string => {
  return input.replace(/'/g, "''").replace(/;/g, "").replace(/--/g, "").replace(/\/\*/g, "").replace(/\*\//g, "").trim()
}

export const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString("hex")
}

export const isSessionValid = (sessionData: any): boolean => {
  if (!sessionData || !sessionData.expiresAt) {
    return false
  }

  return new Date(sessionData.expiresAt) > new Date()
}
