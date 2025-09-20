export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { dbManager } from "@/lib/database-manager"

export async function GET() {
  try {
    const classes = await dbManager.getClasses()
    return NextResponse.json({ classes })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, level, capacity, classTeacherId, subjects } = body

    const newClass = await dbManager.createClass({
      name,
      level,
      capacity: capacity || 30,
      classTeacherId,
      subjects: subjects || [],
      status: "active",
    })

    return NextResponse.json({
      class: newClass,
      message: "Class created successfully",
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    const updatedClass = await dbManager.updateClass(id, updateData)

    return NextResponse.json({
      class: updatedClass,
      message: "Class updated successfully",
    })
  } catch (error) {
    console.error("Failed to update class:", error)
    return NextResponse.json({ error: "Failed to update class" }, { status: 500 })
  }
}
