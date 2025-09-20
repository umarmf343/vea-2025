"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users, GraduationCap, CreditCard, BookOpen, TrendingUp, AlertCircle } from "lucide-react"

export function SystemOverview() {
  const stats = {
    totalStudents: 450,
    activeStudents: 435,
    totalTeachers: 25,
    totalRevenue: 22500000,
    paidStudents: 380,
    pendingPayments: 55,
    overduePayments: 15,
  }

  const paymentRate = (stats.paidStudents / stats.totalStudents) * 100
  const activeRate = (stats.activeStudents / stats.totalStudents) * 100

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#2d682d]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2d682d]/10 rounded-lg">
                <Users className="h-6 w-6 text-[#2d682d]" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-[#2d682d]">{stats.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#b29032]/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-[#b29032]" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Teachers</p>
                <p className="text-2xl font-bold text-[#b29032]">{stats.totalTeachers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-green-600">₦{(stats.totalRevenue / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Students</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#2d682d]">
              <TrendingUp className="h-5 w-5" />
              Payment Progress
            </CardTitle>
            <CardDescription>Current term fee collection status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Payment Rate</span>
                <span className="font-medium">{paymentRate.toFixed(1)}%</span>
              </div>
              <Progress value={paymentRate} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-green-600 font-semibold">{stats.paidStudents}</p>
                <p className="text-gray-600">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-600 font-semibold">{stats.pendingPayments}</p>
                <p className="text-gray-600">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-red-600 font-semibold">{stats.overduePayments}</p>
                <p className="text-gray-600">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#b29032]">
              <Users className="h-5 w-5" />
              Student Activity
            </CardTitle>
            <CardDescription>Active vs inactive student status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Active Rate</span>
                <span className="font-medium">{activeRate.toFixed(1)}%</span>
              </div>
              <Progress value={activeRate} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <p className="text-[#2d682d] font-semibold">{stats.activeStudents}</p>
                <p className="text-gray-600">Active</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 font-semibold">{stats.totalStudents - stats.activeStudents}</p>
                <p className="text-gray-600">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            System Alerts
          </CardTitle>
          <CardDescription className="text-red-600">Important notifications requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">{stats.overduePayments} overdue payments</p>
                <p className="text-xs text-red-600">Students with payment delays need follow-up</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-700">{stats.pendingPayments} pending payments</p>
                <p className="text-xs text-yellow-600">Offline payments awaiting verification</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
