import type React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface GradeBadgeProps {
  grade: string
  children: React.ReactNode
  className?: string
}

export function GradeBadge({ grade, children, className }: GradeBadgeProps) {
  const getGradeClass = (grade: string) => {
    const normalizedGrade = grade.toLowerCase().replace("+", "-plus")
    switch (normalizedGrade) {
      case "a+":
      case "a-plus":
      case "a":
        return "grade-a"
      case "b+":
      case "b-plus":
      case "b":
        return "grade-b"
      case "c+":
      case "c-plus":
      case "c":
        return "grade-c"
      case "d":
      case "f":
        return "grade-d"
      default:
        return "grade-c"
    }
  }

  return <Badge className={cn(getGradeClass(grade), className)}>{children}</Badge>
}
