import os from "os"
import { statfs } from "node:fs/promises"

import { NextResponse } from "next/server"

import { getSystemUsageSnapshot, measureDatabaseLatency } from "@/lib/database"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"

function calculateMemoryUsage(): number {
  const total = os.totalmem()
  const free = os.freemem()
  if (total === 0) {
    return 0
  }

  const used = total - free
  return Number(((used / total) * 100).toFixed(1))
}

function calculateServerLoad(): number {
  const [load] = os.loadavg()
  const cpuCount = os.cpus().length || 1
  return Number(((load / cpuCount) * 100).toFixed(1))
}

function formatUptime(uptimeInSeconds: number): string {
  const hours = Math.floor(uptimeInSeconds / 3600)
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60)
  const seconds = Math.floor(uptimeInSeconds % 60)
  return `${hours}h ${minutes}m ${seconds}s`
}

function evaluateStatus(load: number, memoryUsage: number): "healthy" | "warning" | "critical" {
  if (load > 85 || memoryUsage > 90) {
    return "critical"
  }

  if (load > 70 || memoryUsage > 80) {
    return "warning"
  }

  return "healthy"
}

async function calculateDiskUsage(): Promise<number> {
  try {
    const stats = await statfs(process.cwd())
    const blockSize = Number(stats.bsize ?? stats.frsize ?? 0)
    const totalBlocks = Number(stats.blocks ?? 0)
    const freeBlocks = Number(stats.bfree ?? 0)

    if (blockSize === 0 || totalBlocks === 0) {
      return 0
    }

    const total = blockSize * totalBlocks
    const free = blockSize * freeBlocks
    const used = Math.max(total - free, 0)

    return Number(((used / total) * 100).toFixed(1))
  } catch (error) {
    logger.warn("Unable to read disk usage statistics", { error })
    return 0
  }
}

function formatLastBackup(lastBackupAt: string | null): string {
  if (!lastBackupAt) {
    return "No backups recorded"
  }

  const backupDate = new Date(lastBackupAt)
  if (Number.isNaN(backupDate.getTime())) {
    return "Unknown"
  }

  const diffMs = Date.now() - backupDate.getTime()
  if (diffMs <= 0) {
    return "Just now"
  }

  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)

  if (hours === 0 && minutes === 0) {
    return "Just now"
  }

  if (hours === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export async function GET() {
  try {
    const [snapshot, diskUsage, latency] = await Promise.all([
      getSystemUsageSnapshot(),
      calculateDiskUsage(),
      measureDatabaseLatency(),
    ])

    const uptime = formatUptime(process.uptime())
    const memoryUsage = calculateMemoryUsage()
    const serverLoad = calculateServerLoad()
    const networkLatency = latency ?? 0

    const metrics = {
      uptime,
      activeUsers: snapshot.activeUsers,
      databaseConnections: snapshot.databaseConnections,
      serverLoad,
      memoryUsage,
      diskUsage,
      networkLatency,
      lastBackup: formatLastBackup(snapshot.lastBackupAt),
      systemStatus: evaluateStatus(serverLoad, memoryUsage),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    logger.error("Failed to gather monitoring metrics", { error })
    return NextResponse.json({ error: "Failed to gather monitoring metrics" }, { status: 500 })
  }
}
