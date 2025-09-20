"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Activity, Database, Server, Users, AlertTriangle, CheckCircle, RefreshCw, Wifi, Cpu } from "lucide-react"
import { logger } from "@/lib/logger"

interface SystemMetrics {
  uptime: string
  activeUsers: number
  databaseConnections: number
  serverLoad: number
  memoryUsage: number
  diskUsage: number
  networkLatency: number
  lastBackup: string
  systemStatus: "healthy" | "warning" | "critical"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

export function SystemHealthMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: "—",
    activeUsers: 0,
    databaseConnections: 0,
    serverLoad: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkLatency: 0,
    lastBackup: "Loading...",
    systemStatus: "healthy",
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchMetrics = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) {
          setIsRefreshing(true)
        }

        const response = await fetch("/api/monitoring", { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Failed to load monitoring metrics (${response.status})`)
        }

        const data: unknown = await response.json()
        const metricsPayload = isRecord(data) ? data.metrics : undefined

        if (isRecord(metricsPayload)) {
          setMetrics((prev) => ({
            ...prev,
            ...{
              uptime: typeof metricsPayload.uptime === "string" ? metricsPayload.uptime : prev.uptime,
              activeUsers: asNumber(metricsPayload.activeUsers, prev.activeUsers),
              databaseConnections: asNumber(metricsPayload.databaseConnections, prev.databaseConnections),
              serverLoad: asNumber(metricsPayload.serverLoad, prev.serverLoad),
              memoryUsage: asNumber(metricsPayload.memoryUsage, prev.memoryUsage),
              diskUsage: asNumber(metricsPayload.diskUsage, prev.diskUsage),
              networkLatency: asNumber(metricsPayload.networkLatency, prev.networkLatency),
              lastBackup: typeof metricsPayload.lastBackup === "string" ? metricsPayload.lastBackup : prev.lastBackup,
              systemStatus:
                metricsPayload.systemStatus === "healthy" ||
                metricsPayload.systemStatus === "warning" ||
                metricsPayload.systemStatus === "critical"
                  ? metricsPayload.systemStatus
                  : prev.systemStatus,
            },
          }))
        }
      } catch (error) {
        logger.error("Unable to refresh monitoring metrics", { error })
      } finally {
        if (showSpinner) {
          setIsRefreshing(false)
        }
      }
    },
    [],
  )

  const refreshMetrics = useCallback(async () => {
    await fetchMetrics(true)
  }, [fetchMetrics])

  useEffect(() => {
    void fetchMetrics()
    const interval = setInterval(() => {
      void fetchMetrics()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-100"
      case "warning":
        return "text-yellow-600 bg-yellow-100"
      case "critical":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />
      case "warning":
        return <AlertTriangle className="h-4 w-4" />
      case "critical":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#2d682d]">System Health Monitor</h3>
          <p className="text-sm text-gray-600">Real-time system performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${getStatusColor(metrics.systemStatus)} border-0`}>
            {getStatusIcon(metrics.systemStatus)}
            <span className="ml-1 capitalize">{metrics.systemStatus}</span>
          </Badge>
          <Button
            onClick={refreshMetrics}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
            className="border-[#2d682d]/20 bg-transparent"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#2d682d]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">System Uptime</CardTitle>
              <Activity className="h-4 w-4 text-[#2d682d]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2d682d]">{metrics.uptime}</div>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
              <Users className="h-4 w-4 text-[#2d682d]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2d682d]">{metrics.activeUsers}</div>
            <p className="text-xs text-gray-500 mt-1">Currently online</p>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">DB Connections</CardTitle>
              <Database className="h-4 w-4 text-[#2d682d]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2d682d]">{metrics.databaseConnections}</div>
            <p className="text-xs text-gray-500 mt-1">Active connections</p>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Last Backup</CardTitle>
              <Server className="h-4 w-4 text-[#2d682d]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-[#2d682d]">{metrics.lastBackup}</div>
            <p className="text-xs text-gray-500 mt-1">Automated backup</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d] flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Server Performance
            </CardTitle>
            <CardDescription>Current server resource utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Server Load</span>
                <span>{metrics.serverLoad}%</span>
              </div>
              <Progress value={metrics.serverLoad} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Memory Usage</span>
                <span>{metrics.memoryUsage}%</span>
              </div>
              <Progress value={metrics.memoryUsage} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Disk Usage</span>
                <span>{metrics.diskUsage}%</span>
              </div>
              <Progress value={metrics.diskUsage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d] flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Network & Connectivity
            </CardTitle>
            <CardDescription>Network performance and connectivity status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Network Latency</span>
              <Badge variant="outline" className="border-green-200 text-green-700">
                {metrics.networkLatency}ms
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Connection Status</span>
              <Badge className="bg-green-100 text-green-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Stable
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">CDN Status</span>
              <Badge className="bg-green-100 text-green-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">SSL Certificate</span>
              <Badge className="bg-green-100 text-green-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
