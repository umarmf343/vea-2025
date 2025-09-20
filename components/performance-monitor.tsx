"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import {
  Activity,
  Server,
  Database,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  HardDrive,
  Cpu,
  Wifi,
  RefreshCw,
} from "lucide-react"

interface PerformanceMonitorProps {
  userRole: string
}

export function PerformanceMonitor({ userRole }: PerformanceMonitorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const [systemMetrics, setSystemMetrics] = useState({
    serverStatus: "healthy",
    databaseStatus: "healthy",
    apiResponseTime: 245,
    activeUsers: 127,
    cpuUsage: 68,
    memoryUsage: 72,
    diskUsage: 45,
    networkLatency: 23,
  })

  const [performanceData, setPerformanceData] = useState([
    { time: "00:00", cpu: 45, memory: 52, users: 89 },
    { time: "04:00", cpu: 38, memory: 48, users: 23 },
    { time: "08:00", cpu: 72, memory: 68, users: 156 },
    { time: "12:00", cpu: 85, memory: 78, users: 203 },
    { time: "16:00", cpu: 68, memory: 72, users: 127 },
    { time: "20:00", cpu: 55, memory: 61, users: 89 },
  ])

  const [alerts, setAlerts] = useState([
    {
      id: "1",
      type: "warning",
      title: "High CPU Usage",
      message: "CPU usage has been above 80% for the last 15 minutes",
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      resolved: false,
    },
    {
      id: "2",
      type: "info",
      title: "Database Backup Completed",
      message: "Scheduled database backup completed successfully",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      resolved: true,
    },
    {
      id: "3",
      type: "error",
      title: "API Endpoint Timeout",
      message: "Payment API endpoint experiencing timeouts",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      resolved: false,
    },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics((prev) => ({
        ...prev,
        cpuUsage: Math.max(20, Math.min(95, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(30, Math.min(90, prev.memoryUsage + (Math.random() - 0.5) * 8)),
        activeUsers: Math.max(50, Math.min(250, prev.activeUsers + Math.floor((Math.random() - 0.5) * 20))),
        apiResponseTime: Math.max(100, Math.min(500, prev.apiResponseTime + (Math.random() - 0.5) * 50)),
        networkLatency: Math.max(10, Math.min(100, prev.networkLatency + (Math.random() - 0.5) * 10)),
      }))
      setLastUpdated(new Date())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch("/api/system/metrics")
      if (response.ok) {
        const data = await response.json()
        setSystemMetrics(data)
      }
    } catch (error) {
      console.error("Failed to fetch system metrics:", error)
    } finally {
      setIsRefreshing(false)
      setLastUpdated(new Date())
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50"
      case "warning":
        return "text-yellow-600 bg-yellow-50"
      case "error":
        return "text-red-600 bg-red-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getMetricStatus = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return "error"
    if (value >= thresholds.warning) return "warning"
    return "healthy"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d] flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Performance Monitoring
          </h2>
          <p className="text-gray-600">Real-time performance metrics and alerting</p>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server className="h-8 w-8 text-[#2d682d]" />
                <div>
                  <p className="text-sm text-gray-600">Server Status</p>
                  <Badge className={getStatusColor(systemMetrics.serverStatus)}>{systemMetrics.serverStatus}</Badge>
                </div>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-8 w-8 text-[#b29032]" />
                <div>
                  <p className="text-sm text-gray-600">Database</p>
                  <Badge className={getStatusColor(systemMetrics.databaseStatus)}>{systemMetrics.databaseStatus}</Badge>
                </div>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-600">{systemMetrics.activeUsers}</p>
                <p className="text-sm text-gray-600">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-600">{systemMetrics.apiResponseTime}ms</p>
                <p className="text-sm text-gray-600">API Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">System Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d] flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Current Usage</span>
                    <span className="text-2xl font-bold text-[#2d682d]">{systemMetrics.cpuUsage}%</span>
                  </div>
                  <Progress
                    value={systemMetrics.cpuUsage}
                    className={`h-3 ${
                      systemMetrics.cpuUsage > 80
                        ? "bg-red-100"
                        : systemMetrics.cpuUsage > 60
                          ? "bg-yellow-100"
                          : "bg-green-100"
                    }`}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <Badge
                    className={getStatusColor(getMetricStatus(systemMetrics.cpuUsage, { warning: 70, critical: 85 }))}
                  >
                    {getMetricStatus(systemMetrics.cpuUsage, { warning: 70, critical: 85 })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d] flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Current Usage</span>
                    <span className="text-2xl font-bold text-[#2d682d]">{systemMetrics.memoryUsage}%</span>
                  </div>
                  <Progress
                    value={systemMetrics.memoryUsage}
                    className={`h-3 ${
                      systemMetrics.memoryUsage > 80
                        ? "bg-red-100"
                        : systemMetrics.memoryUsage > 60
                          ? "bg-yellow-100"
                          : "bg-green-100"
                    }`}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <Badge
                    className={getStatusColor(
                      getMetricStatus(systemMetrics.memoryUsage, { warning: 75, critical: 90 }),
                    )}
                  >
                    {getMetricStatus(systemMetrics.memoryUsage, { warning: 75, critical: 90 })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d] flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Storage Used</span>
                    <span className="text-2xl font-bold text-[#2d682d]">{systemMetrics.diskUsage}%</span>
                  </div>
                  <Progress value={systemMetrics.diskUsage} className="h-3" />
                  <div className="text-sm text-gray-600">
                    <p>Used: {systemMetrics.diskUsage}% of 500GB</p>
                    <p>Free: {500 - (500 * systemMetrics.diskUsage) / 100}GB available</p>
                  </div>
                  <Badge
                    className={getStatusColor(getMetricStatus(systemMetrics.diskUsage, { warning: 80, critical: 95 }))}
                  >
                    {getMetricStatus(systemMetrics.diskUsage, { warning: 80, critical: 95 })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d] flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Network Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Latency</span>
                    <span className="text-2xl font-bold text-[#2d682d]">{systemMetrics.networkLatency}ms</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>API Response Time:</span>
                      <span className="font-medium">{systemMetrics.apiResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Database Query Time:</span>
                      <span className="font-medium">45ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Page Load Time:</span>
                      <span className="font-medium">1.2s</span>
                    </div>
                  </div>
                  <Badge
                    className={getStatusColor(
                      getMetricStatus(systemMetrics.networkLatency, { warning: 50, critical: 100 }),
                    )}
                  >
                    {getMetricStatus(systemMetrics.networkLatency, { warning: 50, critical: 100 })}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Performance Trends (24 Hours)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stackId="1"
                    stroke="#2d682d"
                    fill="#2d682d"
                    fillOpacity={0.6}
                    name="CPU %"
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stackId="2"
                    stroke="#b29032"
                    fill="#b29032"
                    fillOpacity={0.6}
                    name="Memory %"
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stackId="3"
                    stroke="#4ade80"
                    fill="#4ade80"
                    fillOpacity={0.6}
                    name="Active Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                System Alerts
                <Badge variant="outline">{alerts.filter((a) => !a.resolved).length} active</Badge>
              </CardTitle>
              <CardDescription>Recent system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${alert.resolved ? "bg-gray-50 opacity-75" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{alert.title}</h3>
                            {alert.resolved && <Badge className="bg-green-100 text-green-800">Resolved</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                          <p className="text-xs text-gray-500">{alert.timestamp.toLocaleString()}</p>
                        </div>
                      </div>
                      {!alert.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, resolved: true } : a)))
                          }
                        >
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
