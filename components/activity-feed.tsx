"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, FileText, DollarSign, BookOpen, CheckCircle, AlertCircle } from "lucide-react"

interface ActivityItem {
  id: string
  type: "user" | "report" | "payment" | "assignment" | "system"
  title: string
  description: string
  timestamp: Date
  priority: "low" | "medium" | "high"
  user?: string
}

interface ActivityFeedProps {
  userRole: string
  className?: string
}

export function ActivityFeed({ userRole, className }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    const generateActivities = () => {
      const baseActivities: ActivityItem[] = [
        {
          id: "1",
          type: "user",
          title: "New Student Registration",
          description: "John Doe has been registered in Class 10A",
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          priority: "medium",
          user: "Admin",
        },
        {
          id: "2",
          type: "report",
          title: "Report Card Generated",
          description: "Term 1 report cards generated for Class 9B",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          priority: "high",
          user: "Teacher Smith",
        },
        {
          id: "3",
          type: "payment",
          title: "Fee Payment Received",
          description: "School fees paid for Sarah Johnson - Class 8C",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
          priority: "low",
          user: "Parent",
        },
        {
          id: "4",
          type: "assignment",
          title: "Assignment Submitted",
          description: "Mathematics homework submitted by 25 students",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
          priority: "medium",
          user: "Students",
        },
        {
          id: "5",
          type: "system",
          title: "System Backup Completed",
          description: "Daily backup completed successfully",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
          priority: "low",
          user: "System",
        },
      ]

      setActivities(baseActivities)
    }

    generateActivities()
  }, [userRole])

  const getActivityIcon = (type: string) => {
    const icons = {
      user: User,
      report: FileText,
      payment: DollarSign,
      assignment: BookOpen,
      system: CheckCircle,
    }

    const Icon = icons[type as keyof typeof icons] || AlertCircle
    return <Icon className="h-4 w-4" />
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-red-100 text-red-800",
    }

    return colors[priority as keyof typeof colors] || colors.low
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (minutes < 60) {
      return `${minutes}m ago`
    } else if (hours < 24) {
      return `${hours}h ago`
    } else {
      return timestamp.toLocaleDateString()
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-full bg-muted">{getActivityIcon(activity.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm truncate">{activity.title}</h4>
                    <Badge variant="secondary" className={`text-xs ${getPriorityColor(activity.priority)}`}>
                      {activity.priority}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{activity.user}</span>
                    <span>{formatTimestamp(activity.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
