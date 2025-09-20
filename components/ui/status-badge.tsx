import type React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: "paid" | "pending" | "overdue" | "active" | "inactive"
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusClasses = {
    paid: "status-paid",
    pending: "status-pending",
    overdue: "status-overdue",
    active: "status-active",
    inactive: "status-inactive",
  }

  return <Badge className={cn(statusClasses[status], className)}>{children}</Badge>
}
