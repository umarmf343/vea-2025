"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, ArrowClockwise, BookOpen, CreditCard, TrendingUp, Users } from "lucide-react"

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

interface OverviewStats {
  totalStudents: number
  activeStudents: number
  totalTeachers: number
  totalRevenue: number
  paidStudents: number
  pendingPayments: number
  overduePayments: number
  metrics: SystemMetricResponse | null
}

export function SystemOverview() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<OverviewStats | null>(null)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [metricsResponse, usersResponse, paymentsResponse] = await Promise.all([
        fetch("/api/system/metrics"),
        fetch("/api/users"),
        fetch("/api/payments/records"),
      ])

      if (!metricsResponse.ok) {
        throw new Error("Unable to fetch system metrics")
      }

      if (!usersResponse.ok) {
        throw new Error("Unable to fetch user records")
      }

      if (!paymentsResponse.ok) {
        throw new Error("Unable to fetch payment records")
      }

      const metricData = (await metricsResponse.json()) as SystemMetricResponse
      const userData = (await usersResponse.json()) as { users: UserRecord[] }
      const paymentData = (await paymentsResponse.json()) as { payments: PaymentRecord[] }

      const students = userData.users.filter((user) => user.role.toLowerCase() === "student")
      const teachers = userData.users.filter((user) => user.role.toLowerCase() === "teacher")
      const activeStudents = students.filter((student) => (student.status ?? "active").toLowerCase() === "active")

      const payments = paymentData.payments ?? []
      const paidPayments = payments.filter((payment) => payment.status === "completed")
      const pendingPayments = payments.filter((payment) => payment.status === "pending").length
      const failedPayments = payments.filter((payment) => payment.status === "failed").length

      const revenue = paidPayments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0)
      const paidStudentIds = new Set<string>()
      paidPayments.forEach((payment) => {
        if (payment.studentId) {
          paidStudentIds.add(payment.studentId)
        }
      })

      setStats({
        totalStudents: students.length,
        activeStudents: activeStudents.length,
        totalTeachers: teachers.length,
        totalRevenue: revenue,
        paidStudents: paidStudentIds.size,
        pendingPayments,
        overduePayments: failedPayments,
        metrics: metricData,
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load system overview")
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const paymentRate = useMemo(() => {
    if (!stats || stats.totalStudents === 0) {
      return 0
    }

    return (stats.paidStudents / stats.totalStudents) * 100
  }, [stats])

  const activeRate = useMemo(() => {
    if (!stats || stats.totalStudents === 0) {
      return 0
    }

    return (stats.activeStudents / stats.totalStudents) * 100
  }, [stats])

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-10 text-[#2d682d]">
          Loading overview…
        </CardContent>
      </Card>
    )
  }

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
          <ArrowClockwise className="h-4 w-4" /> Refresh
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
        <StatCard
          title="Revenue"
          description="Completed payments"
          value={`₦${(stats.totalRevenue / 1000000).toFixed(2)}M`}
          icon={CreditCard}
          iconClass="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#2d682d]">
              <TrendingUp className="h-5 w-5" /> Payment Progress
            </CardTitle>
            <CardDescription>Current term payment completion rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Payment Rate</span>
                <span className="font-semibold">{paymentRate.toFixed(1)}%</span>
              </div>
              <Progress value={paymentRate} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Summary value={stats.paidStudents} label="Paid" tone="text-green-600" />
              <Summary value={stats.pendingPayments} label="Pending" tone="text-yellow-600" />
              <Summary value={stats.overduePayments} label="Overdue" tone="text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#b29032]">
              <Users className="h-5 w-5" /> Student Activity
            </CardTitle>
            <CardDescription>Active student engagement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Active Rate</span>
                <span className="font-semibold">{activeRate.toFixed(1)}%</span>
              </div>
              <Progress value={activeRate} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Summary value={stats.activeStudents} label="Active" tone="text-[#2d682d]" />
              <Summary
                value={stats.totalStudents - stats.activeStudents}
                label="Inactive"
                tone="text-gray-600"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2d682d]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <AlertCircle className="h-5 w-5" /> Infrastructure Health
          </CardTitle>
          <CardDescription>Live metrics from the portal infrastructure</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Metric label="Server" value={stats.metrics?.serverStatus ?? "unknown"} />
          <Metric label="Database" value={stats.metrics?.databaseStatus ?? "unknown"} />
          <Metric label="API Latency" value={`${stats.metrics?.apiResponseTime ?? 0}ms`} />
          <Metric label="Active Users" value={stats.metrics?.activeUsers ?? 0} />
          <Metric label="CPU Usage" value={`${stats.metrics?.cpuUsage ?? 0}%`} />
          <Metric label="Memory Usage" value={`${stats.metrics?.memoryUsage ?? 0}%`} />
          <Metric label="Disk Usage" value={`${stats.metrics?.diskUsage ?? 0}%`} />
          <Metric label="Network" value={`${stats.metrics?.networkLatency ?? 0}ms`} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  description,
  value,
  icon: Icon,
  iconClass,
}: {
  title: string
  description: string
  value: string
  icon: typeof Users
  iconClass: string
}) {
  return (
    <Card className="border-[#2d682d]/20">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-gray-600">{description}</p>
          <p className="text-2xl font-bold text-[#2d682d]">{value}</p>
          <p className="text-xs text-gray-500">{title}</p>
        </div>
        <div className={`rounded-full bg-[#2d682d]/10 p-3 ${iconClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  )
}

function Summary({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-semibold ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1 rounded-lg border border-[#2d682d]/10 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-[#2d682d]">{value}</p>
    </div>
  )
}
