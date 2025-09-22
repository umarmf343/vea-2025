"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useSchoolCalendar } from "@/hooks/use-school-calendar"
import { useBranding } from "@/hooks/use-branding"
import type { CalendarAudience, CalendarCategory, SchoolCalendarEvent } from "@/lib/school-calendar"
import {
  CalendarDays,
  CalendarRange,
  Clock3,
  MapPin,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react"

interface SchoolCalendarViewerProps {
  triggerText?: string
  role?: "parent" | "teacher" | "admin" | "super_admin"
  className?: string
  allowDraftPreview?: boolean
}

const CATEGORY_STYLE: Record<CalendarCategory, string> = {
  academic: "bg-blue-50 text-blue-700",
  holiday: "bg-emerald-50 text-emerald-700",
  event: "bg-purple-50 text-purple-700",
  meeting: "bg-orange-50 text-orange-700",
  examination: "bg-red-50 text-red-700",
}

const AUDIENCE_LABEL: Record<CalendarAudience, string> = {
  all: "Whole School",
  parents: "Parents",
  students: "Students",
  teachers: "Teachers",
}

const formatDateDisplay = (value?: string | null) => {
  if (!value) {
    return "—"
  }

  try {
    return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  } catch (error) {
    return value
  }
}

const formatDateRange = (event: SchoolCalendarEvent) => {
  const start = formatDateDisplay(event.startDate)
  const end = event.endDate ? formatDateDisplay(event.endDate) : undefined

  if (!end || start === end) {
    return start
  }

  return `${start} – ${end}`
}

const roleMessage: Record<NonNullable<SchoolCalendarViewerProps["role"]>, string> = {
  parent: "Stay coordinated with cultural days, holidays, and exam schedules for your ward.",
  teacher: "Plan lessons and assessments with clarity on upcoming school-wide engagements.",
  admin: "Monitor the community-facing calendar exactly as parents and teachers see it.",
  super_admin: "Final published view with full branding for quality assurance.",
}

export function SchoolCalendarViewer({
  triggerText,
  role = "parent",
  className,
  allowDraftPreview = false,
}: SchoolCalendarViewerProps) {
  const calendar = useSchoolCalendar()
  const branding = useBranding()
  const [isOpen, setIsOpen] = useState(false)

  const isPublished = calendar.status === "published"
  const canPreview = isPublished || allowDraftPreview
  const isDraftPreview = allowDraftPreview && !isPublished

  const sortedEvents = useMemo(
    () =>
      [...calendar.events].sort((a, b) => {
        if (a.startDate === b.startDate) {
          return a.title.localeCompare(b.title)
        }
        return a.startDate.localeCompare(b.startDate)
      }),
    [calendar.events],
  )

  const publishedAt = calendar.publishedAt ? formatDateDisplay(calendar.publishedAt) : null
  const statusBadge = isPublished
    ? publishedAt
      ? { label: `Published ${publishedAt}`, tone: "bg-emerald-100 text-emerald-800" }
      : null
    : allowDraftPreview
      ? { label: "Awaiting publication", tone: "bg-amber-100 text-amber-800" }
      : null
  const effectiveTriggerText = triggerText ?? (isDraftPreview ? "Preview submitted calendar" : "View School Calendar")

  return (
    <Card className={cn("border-[#2d682d]/20", className)}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <CalendarDays className="h-5 w-5" />
            School Calendar Highlights
          </CardTitle>
          <CardDescription>
            {roleMessage[role] ?? "Explore key moments in the school year."}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
            {calendar.term} • {calendar.session}
          </Badge>
          {statusBadge && (
            <Badge className={statusBadge.tone}>
              <Megaphone className="mr-1 h-3 w-3" /> {statusBadge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-[#2d682d] text-white hover:bg-[#1a4a1a]"
            onClick={() => setIsOpen(true)}
            disabled={!canPreview}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {effectiveTriggerText}
          </Button>
          {!isPublished && !allowDraftPreview && (
            <span className="text-sm text-gray-500">
              Calendar will appear once the administrator publishes the latest schedule.
            </span>
          )}
        </div>
      </CardContent>

      <Dialog open={isOpen && canPreview} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{branding.schoolName ?? "Victory Educational Academy"} School Calendar</DialogTitle>
            <DialogDescription>Published school calendar view</DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-br from-[#2d682d] via-[#256f45] to-[#b29032] px-6 py-8 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-white/70">{calendar.session}</p>
                <h2 className="text-2xl font-semibold">
                  {branding.schoolName ?? "Victory Educational Academy"} • {calendar.term}
                </h2>
                <p className="text-sm text-white/80">
                  {branding.schoolAddress ?? "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Abuja"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-white/15 text-white">
                  <Users className="mr-1 h-3 w-3" /> Curated for {AUDIENCE_LABEL[role === "parent" ? "parents" : role === "teacher" ? "teachers" : "all"]}
                </Badge>
                {publishedAt && (
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    <Megaphone className="mr-1 h-3 w-3" /> Published {publishedAt}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isDraftPreview && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
              This is a preview of the submitted calendar. Publishing will make these updates visible to parents and
              teachers.
            </div>
          )}

          <div className="space-y-6 p-6">
            {sortedEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2d682d]/30 p-6 text-center text-sm text-gray-500">
                Calendar is published but no activities are visible yet. Please check back soon.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-[#2d682d]/10 bg-[#fdfaf4] p-5 shadow-sm"
                  >
                    <div className="flex flex-col items-center gap-2 text-[#2d682d]">
                      <CalendarRange className="h-6 w-6" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#b29032]">
                        {formatDateDisplay(event.startDate).split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[#1f3d1f]">{event.title}</h3>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={CATEGORY_STYLE[event.category]}> 
                            {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                            {AUDIENCE_LABEL[event.audience]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-[#b29032]" />
                          {formatDateRange(event)}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#b29032]" />
                            {event.location}
                          </span>
                        )}
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-[#b29032]" />
                          {event.isFullDay ? "Full day" : "Specific time"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

