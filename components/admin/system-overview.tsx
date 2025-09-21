"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, BookOpen, CreditCard, RotateCcw, TrendingUp, Users } from "lucide-react"

interface SystemMetricResponse {
  serverStatus: string
  databaseStatus: string
  apiResponseTime: number
  activeUsers: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkLatency: number
}

interface UserRecord {
  id: string
  role: string
  status?: string
}

interface PaymentRecord {
  id: string
  amount: number
  status: string
  studentId: string | null
  metadata?: Record<string, any>
}
@@ -143,51 +143,51 @@ export function SystemOverview() {

  if (error || !stats) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error ?? "Unable to load system overview"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadOverview()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#2d682d]">System Overview</h3>
          <p className="text-sm text-gray-600">Key performance indicators for the school portal</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Students"
          description="Registered student accounts"
          value={stats.totalStudents.toLocaleString()}
          icon={Users}
          iconClass="text-[#2d682d]"
        />
        <StatCard
          title="Active Students"
          description="Students with active status"
          value={stats.activeStudents.toLocaleString()}
          icon={BookOpen}
          iconClass="text-blue-600"
        />
        <StatCard
          title="Teachers"
          description="Total teacher accounts"
          value={stats.totalTeachers.toLocaleString()}
          icon={Users}
          iconClass="text-[#b29032]"
        />
