import { type NextRequest, NextResponse } from "next/server"
import { verifyPassword, generateToken, sanitizeInput } from "@/lib/security"
import { getUserByEmail } from "@/lib/database"
import { logger } from "@/lib/logger"

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
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Return user data without password
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user
    void _passwordHash

    return NextResponse.json({
      user: userWithoutPassword,
      token,
      message: "Login successful",
    })
  } catch (error) {
    logger.error("Login error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
