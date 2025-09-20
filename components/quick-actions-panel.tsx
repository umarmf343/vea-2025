"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserPlus, FileText, DollarSign, Calendar, BookOpen, Settings, BarChart3, Bell } from "lucide-react"

interface QuickActionsPanelProps {
  userRole: string
  onActionClick: (action: string) => void
  className?: string
}

export function QuickActionsPanel({ userRole, onActionClick, className }: QuickActionsPanelProps) {
  const getQuickActions = () => {
    const actions = {
      "super-admin": [
        { id: "add-user", label: "Add User", icon: UserPlus, color: "bg-blue-500" },
        { id: "system-reports", label: "System Reports", icon: BarChart3, color: "bg-green-500" },
        { id: "system-settings", label: "Settings", icon: Settings, color: "bg-gray-500" },
        { id: "notifications", label: "Notifications", icon: Bell, color: "bg-orange-500" },
      ],
      admin: [
        { id: "add-student", label: "Add Student", icon: UserPlus, color: "bg-blue-500" },
        { id: "manage-classes", label: "Manage Classes", icon: BookOpen, color: "bg-purple-500" },
        { id: "payment-status", label: "Payment Status", icon: DollarSign, color: "bg-green-500" },
        { id: "generate-reports", label: "Generate Reports", icon: FileText, color: "bg-indigo-500" },
      ],
      teacher: [
        { id: "enter-marks", label: "Enter Marks", icon: FileText, color: "bg-blue-500" },
        { id: "create-assignment", label: "Create Assignment", icon: BookOpen, color: "bg-purple-500" },
        { id: "upload-materials", label: "Upload Materials", icon: FileText, color: "bg-green-500" },
        { id: "view-schedule", label: "View Schedule", icon: Calendar, color: "bg-orange-500" },
      ],
      parent: [
        { id: "view-report-card", label: "View Report Card", icon: FileText, color: "bg-blue-500" },
        { id: "pay-fees", label: "Pay School Fees", icon: DollarSign, color: "bg-green-500" },
        { id: "view-attendance", label: "View Attendance", icon: Calendar, color: "bg-purple-500" },
        { id: "contact-teacher", label: "Contact Teacher", icon: Bell, color: "bg-orange-500" },
      ],
      student: [
        { id: "view-assignments", label: "View Assignments", icon: BookOpen, color: "bg-blue-500" },
        { id: "study-materials", label: "Study Materials", icon: FileText, color: "bg-green-500" },
        { id: "view-grades", label: "View Grades", icon: BarChart3, color: "bg-purple-500" },
        { id: "view-timetable", label: "View Timetable", icon: Calendar, color: "bg-orange-500" },
      ],
    }

    return actions[userRole as keyof typeof actions] || []
  }

  const quickActions = getQuickActions()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-muted/50 bg-transparent"
                onClick={() => onActionClick(action.id)}
              >
                <div className={`p-2 rounded-full ${action.color} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-center leading-tight">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
