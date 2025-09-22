"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { dbManager } from "@/lib/database-manager"
import { Calendar, Clock, MapPin, User } from "lucide-react"

interface ExamScheduleOverviewProps {
  title?: string
  description?: string
  classNames?: string[]
  classIds?: string[]
  limit?: number
  emptyState?: string
  role?: "student" | "parent" | "teacher" | "admin" | "super_admin"
  className?: string
}

type ExamScheduleRecord = Awaited<ReturnType<typeof dbManager.getExamSchedules>>[number]

const normalizeValue = (value: string) => value.replace(/\s+/g, "").toLowerCase()

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

const formatTimeRange = (startTime?: string, endTime?: string) => {
  const formatTime = (time?: string) => {
    if (!time) return null
    const [hour = "0", minute = "0"] = time.split(":")
    const date = new Date()
    date.setHours(Number(hour), Number(minute))
    return new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  }

  const startLabel = formatTime(startTime)
  const endLabel = formatTime(endTime)

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`
  }

  return startLabel ?? endLabel ?? "Time to be announced"
}

const defaultEmptyState: Record<NonNullable<ExamScheduleOverviewProps["role"]>, string> = {
  student: "No upcoming exams scheduled for your class yet.",
  parent: "No upcoming exams scheduled for your child yet.",
  teacher: "No upcoming exams scheduled for your assigned classes.",
  admin: "No upcoming exams have been scheduled.",
  super_admin: "No upcoming exams scheduled by administrators yet.",
}

export function ExamScheduleOverview({
  title = "Upcoming Exams",
  description,
  classNames,
  classIds,
  limit = 5,
  emptyState,
  role = "admin",
  className,
}: ExamScheduleOverviewProps) {
  const [records, setRecords] = useState<ExamScheduleRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSchedules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const schedules = await dbManager.getExamSchedules()
      setRecords(schedules)
    } catch (err) {
      console.error("Failed to load exam schedules", err)
      setError(err instanceof Error ? err.message : "Unable to load exam schedules")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      await loadSchedules()
    }

    void initialize()

    const handleUpdate = () => {
      if (!isMounted) return
      void loadSchedules()
    }

    dbManager.on("examScheduleUpdated", handleUpdate)
    dbManager.on("examResultsUpdated", handleUpdate)

    return () => {
      isMounted = false
      dbManager.off("examScheduleUpdated", handleUpdate)
      dbManager.off("examResultsUpdated", handleUpdate)
    }
  }, [loadSchedules])

  const filteredSchedules = useMemo(() => {
    const normalizedNames = classNames?.map(normalizeValue)
    const normalizedIds = classIds?.map((value) => value.toLowerCase())

    return records
      .filter((exam) => exam.status === "scheduled")
      .filter((exam) => {
        if (normalizedIds && normalizedIds.length > 0) {
          if (!normalizedIds.includes(exam.classId.toLowerCase())) {
            return false
          }
        }
        if (normalizedNames && normalizedNames.length > 0) {
          if (!normalizedNames.includes(normalizeValue(exam.className))) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        const dateComparison = a.examDate.localeCompare(b.examDate)
        if (dateComparison !== 0) {
          return dateComparison
        }
        return a.startTime.localeCompare(b.startTime)
      })
  }, [classIds, classNames, records])

  const limitedSchedules = useMemo(() => filteredSchedules.slice(0, limit), [filteredSchedules, limit])

  const emptyMessage = emptyState ?? defaultEmptyState[role]

  return (
    <Card className={cn("border-[#2d682d]/20", className)}>
      <CardHeader>
        <CardTitle className="text-[#2d682d]">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-2 w-1/3 animate-pulse rounded bg-[#2d682d]/20" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-[#2d682d]/10" />
            <div className="h-20 animate-pulse rounded bg-[#2d682d]/10" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadSchedules()}>
              Try again
            </Button>
          </div>
        ) : limitedSchedules.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {limitedSchedules.map((exam) => (
              <div
                key={exam.id}
                className="rounded-lg border border-[#2d682d]/15 bg-[#f9fcf7] p-4 shadow-sm transition hover:border-[#2d682d]/30 hover:shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1f3d1f]">{exam.subject}</p>
                    <p className="text-sm text-gray-600">{exam.className}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                      {exam.term}
                    </Badge>
                    <Badge variant="outline" className="border-[#b29032]/40 text-[#b29032]">
                      {exam.session}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#2d682d]" />
                    {formatDate(exam.examDate)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#b29032]" />
                    {formatTimeRange(exam.startTime, exam.endTime)}
                  </span>
                  {exam.venue && (
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#2d682d]" />
                      {exam.venue}
                    </span>
                  )}
                  {exam.invigilator && (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#b29032]" />
                      {exam.invigilator}
                    </span>
                  )}
                </div>
                {exam.notes ? (
                  <p className="mt-2 text-xs italic text-gray-500">{exam.notes}</p>
                ) : null}
              </div>
            ))}
            {filteredSchedules.length > limit ? (
              <p className="text-xs text-gray-500">Showing the first {limit} exams. Additional schedules are available in the admin exam manager.</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ExamScheduleOverview
