export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

// const dbManager = new DatabaseManager()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const userId = searchParams.get("userId")

    let users = []

    if (userId) {
      const user = await dbManager.getUser(userId)
      users = user ? [user] : []
    } else if (role) {
      users = await dbManager.getUsersByRole(role)
    } else {
      users = await dbManager.getAllUsers()
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, password, ...additionalData } = body

    const userData = {
      name,
      email,
      role,
      status: "active",
      createdAt: new Date().toISOString(),
      ...additionalData,
    }

    const newUser = await dbManager.createUser(userData)

    return NextResponse.json({
      user: newUser,
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
    const { id, ...updateData } = body

    updateData.updatedAt = new Date().toISOString()

    const updatedUser = await dbManager.updateUser(id, updateData)

    return NextResponse.json({
      user: updatedUser,
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Failed to update user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
