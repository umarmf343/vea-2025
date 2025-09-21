"use client"

import { useCallback, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  approveSchoolCalendar,
  publishSchoolCalendar,
  requestCalendarChanges,
  type SchoolCalendarEvent,
  type SchoolCalendarRecord,
} from "@/lib/school-calendar"
import { useSchoolCalendar } from "@/hooks/use-school-calendar"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { CalendarDays, CheckCircle2, Clock3, Megaphone, RefreshCw, SendHorizonal } from "lucide-react"

const STATUS_STYLES: Record<SchoolCalendarRecord["status"], { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "bg-gray-100 text-gray-700" },
  pending_approval: { label: "Pending Approval", badge: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", badge: "bg-blue-100 text-blue-800" },
  published: { label: "Published", badge: "bg-green-100 text-green-800" },
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

export function SchoolCalendarApprovalPanel() {
  const calendar = useSchoolCalendar()
  const { toast } = useToast()
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalNote, setApprovalNote] = useState("")
  const [changeDialogOpen, setChangeDialogOpen] = useState(false)
  const [changeNote, setChangeNote] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)

  const statusInfo = useMemo(() => STATUS_STYLES[calendar.status], [calendar.status])
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

  const handleApprove = useCallback(() => {
    try {
      approveSchoolCalendar({ approvedBy: "Super Admin", note: approvalNote })
      toast({ title: "Calendar approved", description: "Administrators can now publish the updated schedule." })
      setApprovalDialogOpen(false)
      setApprovalNote("")
    } catch (error) {
      toast({
        title: "Unable to approve calendar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [approvalNote, toast])

  const handleRequestChanges = useCallback(() => {
    if (!changeNote.trim()) {
      toast({
        title: "Share feedback",
        description: "Provide guidance or corrections so the administrator can adjust the calendar.",
        variant: "destructive",
      })
      return
    }

    try {
      requestCalendarChanges(changeNote)
      toast({ title: "Revision requested", description: "The calendar has been returned to draft with your notes." })
      setChangeDialogOpen(false)
      setChangeNote("")
    } catch (error) {
      toast({
        title: "Unable to send revision",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [changeNote, toast])

  const handlePublish = useCallback(() => {
    setIsPublishing(true)
    try {
      publishSchoolCalendar()
      toast({ title: "Calendar published", description: "Everyone will now see the approved schedule." })
    } catch (error) {
      toast({
        title: "Unable to publish calendar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }, [toast])

  const canApprove = calendar.status === "pending_approval"
  const canPublish = calendar.status === "approved"

  return (
    <Card className="border-[#2d682d]/20">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <CalendarDays className="h-5 w-5" />
            School Calendar Approval
          </CardTitle>
          <CardDescription>Review updates from administrators and unlock the calendar for publication.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusInfo.badge}>{statusInfo.label}</Badge>
          {calendar.requiresRepublish && (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              <RefreshCw className="mr-1 h-3 w-3" /> Changes awaiting publish
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#2d682d]/10 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Submitted</p>
            <p className="mt-1 font-semibold text-[#1f3d1f]">
              {calendar.submittedForApprovalAt ? formatDateDisplay(calendar.submittedForApprovalAt) : "Awaiting submission"}
            </p>
          </div>
          <div className="rounded-lg border border-[#2d682d]/10 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Approved</p>
            <p className="mt-1 font-semibold text-[#1f3d1f]">
              {calendar.approvedAt ? formatDateDisplay(calendar.approvedAt) : "Pending review"}
            </p>
          </div>
          <div className="rounded-lg border border-[#2d682d]/10 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Published</p>
            <p className="mt-1 font-semibold text-[#1f3d1f]">
              {calendar.publishedAt ? formatDateDisplay(calendar.publishedAt) : "Not yet published"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-[#2d682d] text-white hover:bg-[#1a4a1a]"
            disabled={!canApprove}
            onClick={() => setApprovalDialogOpen(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Calendar
          </Button>
          <Button variant="outline" className="border-[#b29032]/40 text-[#b29032]" onClick={() => setChangeDialogOpen(true)}>
            <SendHorizonal className="mr-2 h-4 w-4" /> Request Changes
          </Button>
          <Button
            variant="ghost"
            className="text-[#2d682d]"
            disabled={!canPublish || isPublishing}
            onClick={() => handlePublish()}
          >
            {isPublishing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
            Publish Calendar
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-[#2d682d]/15 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#2d682d]">Latest Activities</h3>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">No calendar activities available. Awaiting administrator input.</p>
          ) : (
            <div className="space-y-3">
              {sortedEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-lg border border-[#2d682d]/10 bg-[#f8faf5] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#1f3d1f]">{event.title}</p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                    </div>
                    <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                      {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#b29032]" />
                      {formatDateRange(event)}
                    </span>
                    <span>{event.location ?? "On campus"}</span>
                  </div>
                </div>
              ))}
              {sortedEvents.length > 4 && (
                <p className="text-xs text-gray-500">Showing first four activities. Full calendar available below.</p>
              )}
            </div>
          )}
        </div>

        <SchoolCalendarViewer role="super_admin" triggerText="Preview published calendar" />
      </CardContent>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve School Calendar</DialogTitle>
            <DialogDescription>Confirm approval and optionally leave a note for the administrator.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            placeholder="Optional remarks for the administrator"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2d682d] text-white" onClick={() => void handleApprove()}>
              Approve Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Calendar Changes</DialogTitle>
            <DialogDescription>
              Share feedback or adjustments needed. The calendar will return to draft for the administrator.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="Outline the updates required before approval"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#b29032] text-white" onClick={() => void handleRequestChanges()}>
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

