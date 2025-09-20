"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react"

interface AttendanceData {
  totalDays: number
  presentDays: number
  absentDays: number
  lateArrivals: number
  attendancePercentage: number
  recentAttendance: Array<{
    date: string
    status: "present" | "absent" | "late"
  }>
}

interface AttendanceTrackerProps {
  attendance: AttendanceData
  hasAccess: boolean
}

export function AttendanceTracker({ attendance, hasAccess }: AttendanceTrackerProps) {
  if (!hasAccess) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Calendar className="h-5 w-5" />
            Attendance Record
          </CardTitle>
          <CardDescription className="text-red-600">Payment required to view attendance record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Access Restricted</p>
            <p className="text-red-500 text-sm">Please complete payment to view attendance</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "absent":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "late":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "text-green-600"
      case "absent":
        return "text-red-600"
      case "late":
        return "text-yellow-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <Card className="border-[#2d682d]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2d682d]">
          <Calendar className="h-5 w-5" />
          Attendance Record
        </CardTitle>
        <CardDescription>Current term attendance summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Summary */}
        <div className="bg-[#2d682d]/5 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-[#2d682d]">Attendance Summary</h4>
            <span className="text-2xl font-bold text-[#b29032]">{attendance.attendancePercentage}%</span>
          </div>
          <Progress value={attendance.attendancePercentage} className="mb-4" />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-green-600 font-semibold">{attendance.presentDays}</p>
              <p className="text-gray-600">Present</p>
            </div>
            <div className="text-center">
              <p className="text-red-600 font-semibold">{attendance.absentDays}</p>
              <p className="text-gray-600">Absent</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-600 font-semibold">{attendance.lateArrivals}</p>
              <p className="text-gray-600">Late</p>
            </div>
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="space-y-3">
          <h4 className="font-semibold text-[#2d682d]">Recent Attendance</h4>
          <div className="space-y-2">
            {attendance.recentAttendance.map((record, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">{record.date}</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(record.status)}
                  <span className={`text-sm font-medium capitalize ${getStatusColor(record.status)}`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
