"use client"

import { jest } from "@jest/globals"
import "@testing-library/jest-dom"

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "/",
      query: "",
      asPath: "",
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock environment variables
process.env.PAYSTACK_SECRET_KEY = "sk_test_mock_key"
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
process.env.NODE_ENV = "test"

// Global test utilities
global.mockUser = {
  id: "1",
  email: "test@vea.edu.ng",
  role: "student",
  name: "Test Student",
  class: "JSS 1A",
}

// Mock fetch for API calls
global.fetch = jest.fn()
