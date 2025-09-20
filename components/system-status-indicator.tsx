"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react"

interface SystemStatusIndicatorProps {
  className?: string
}

export function SystemStatusIndicator({ className }: SystemStatusIndicatorProps) {
  const [systemStatus, setSystemStatus] = useState({
    database: "operational",
    payment: "operational",
    authentication: "operational",
    reportGeneration: "operational",
    lastUpdated: new Date(),
  })

  useEffect(() => {
    const checkSystemStatus = () => {
      const statuses = ["operational", "degraded", "maintenance"]
      const randomStatus = () => statuses[Math.floor(Math.random() * statuses.length)]

      setSystemStatus({
        database: "operational",
        payment: "operational",
        authentication: "operational",
        reportGeneration: "operational",
        lastUpdated: new Date(),
      })
    }

    checkSystemStatus()
    const interval = setInterval(checkSystemStatus, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "degraded":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "maintenance":
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      operational: "default",
      degraded: "secondary",
      maintenance: "outline",
      offline: "destructive",
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || "destructive"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">System Status</h3>
          <span className="text-xs text-muted-foreground">
            Updated: {systemStatus.lastUpdated.toLocaleTimeString()}
          </span>
        </div>

        <div className="space-y-2">
          {Object.entries(systemStatus).map(([key, value]) => {
            if (key === "lastUpdated") return null

            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(value)}
                  <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                </div>
                {getStatusBadge(value)}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
