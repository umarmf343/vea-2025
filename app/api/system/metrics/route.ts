import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const metrics = {
      serverStatus: "healthy",
      databaseStatus: "healthy",
      apiResponseTime: Math.floor(Math.random() * 200) + 150,
      activeUsers: Math.floor(Math.random() * 100) + 50,
      cpuUsage: Math.floor(Math.random() * 40) + 40,
      memoryUsage: Math.floor(Math.random() * 30) + 50,
      diskUsage: Math.floor(Math.random() * 20) + 30,
      networkLatency: Math.floor(Math.random() * 30) + 15,
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error("System metrics error:", error)
    return NextResponse.json({ error: "Failed to fetch system metrics" }, { status: 500 })
  }
}
