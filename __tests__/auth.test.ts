import { describe, it, expect, beforeEach } from "@jest/globals"
import { validateUser, hashPassword, verifyPassword } from "../lib/auth"

describe("Authentication System", () => {
  beforeEach(() => {
    // Reset any mocks or test data
  })

  it("should validate user credentials correctly", () => {
    const validUser = {
      email: "admin@vea.edu.ng",
      password: "Admin2025!",
      role: "admin" as const,
    }

    expect(validateUser(validUser.email, validUser.password)).toBeTruthy()
  })

  it("should hash passwords securely", async () => {
    const password = "TestPassword123!"
    const hashedPassword = await hashPassword(password)

    expect(hashedPassword).not.toBe(password)
    expect(hashedPassword.length).toBeGreaterThan(50)
  })

  it("should verify passwords correctly", async () => {
    const password = "TestPassword123!"
    const hashedPassword = await hashPassword(password)

    const isValid = await verifyPassword(password, hashedPassword)
    expect(isValid).toBe(true)

    const isInvalid = await verifyPassword("WrongPassword", hashedPassword)
    expect(isInvalid).toBe(false)
  })
})
