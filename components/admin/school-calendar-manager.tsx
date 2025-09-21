"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  publishSchoolCalendar,
  removeCalendarEvent,
  setCalendarDetails,
  submitCalendarForApproval,
  type CalendarAudience,
  type CalendarCategory,
  type SchoolCalendarEvent,
  type SchoolCalendarRecord,
  upsertCalendarEvent,
} from "@/lib/school-calendar"
import { useSchoolCalendar } from "@/hooks/use-school-calendar"
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit,
  Megaphone,
  PlusCircle,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
  Trash2,
} from "lucide-react"

interface EventFormState {
  title: string
  description: string
  startDate: string
  endDate: string
  category: CalendarCategory
  audience: CalendarAudience
  location: string
  isFullDay: boolean
}

const INITIAL_EVENT_FORM: EventFormState = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  category: "academic",
  audience: "all",
  location: "",
  isFullDay: true,
}

const STATUS_STYLES: Record<SchoolCalendarRecord["status"], { label: string; badge: string; description: string }> = {
  draft: {
    label: "Draft",
    badge: "bg-gray-100 text-gray-700",
    description: "Calendar edits are in progress and not yet sent for approval.",
  },
  pending_approval: {
    label: "Pending Approval",
    badge: "bg-yellow-100 text-yellow-800",
    description: "Waiting for Super Admin approval before publishing to the community.",
  },
  approved: {
    label: "Approved",
    badge: "bg-blue-100 text-blue-800",
    description: "Calendar approved by Super Admin. Publish to make it visible to parents and teachers.",
  },
  published: {
    label: "Published",
    badge: "bg-green-100 text-green-800",
    description: "Calendar is live and visible across the portal.",
  },
}

const CATEGORY_STYLES: Record<CalendarCategory, string> = {
  academic: "bg-blue-50 text-blue-700 border border-blue-200",
  holiday: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  event: "bg-purple-50 text-purple-700 border border-purple-200",
  meeting: "bg-orange-50 text-orange-700 border border-orange-200",
  examination: "bg-red-50 text-red-700 border border-red-200",
}

const AUDIENCE_LABEL: Record<CalendarAudience, string> = {
  all: "Whole School",
  students: "Students",
  parents: "Parents",
  teachers: "Teachers",
}

const CATEGORY_OPTIONS: Array<{ label: string; value: CalendarCategory; description: string }> = [
  { label: "Academic", value: "academic", description: "Term dates, resumption, closing ceremonies." },
  { label: "Holiday", value: "holiday", description: "Public holidays and breaks." },
  { label: "Special Event", value: "event", description: "Cultural days, open house, excursions." },
  { label: "Meeting", value: "meeting", description: "PTA meetings, staff briefings, training." },
  { label: "Examination", value: "examination", description: "Assessment schedules and mock exams." },
]

const AUDIENCE_OPTIONS: Array<{ label: string; value: CalendarAudience }> = [
  { label: "Whole School", value: "all" },
  { label: "Students", value: "students" },
  { label: "Parents", value: "parents" },
  { label: "Teachers", value: "teachers" },
]

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

  if (!end || end === start) {
    return start
  }

  return `${start} – ${end}`
}

export function SchoolCalendarManager() {
  const { toast } = useToast()
  const calendar = useSchoolCalendar()

  const [metadata, setMetadata] = useState({
    title: calendar.title,
    term: calendar.term,
    session: calendar.session,
  })
  const [isSavingMetadata, setIsSavingMetadata] = useState(false)
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [eventForm, setEventForm] = useState<EventFormState>(INITIAL_EVENT_FORM)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalNote, setApprovalNote] = useState("")
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  useEffect(() => {
    setMetadata({ title: calendar.title, term: calendar.term, session: calendar.session })
  }, [calendar.title, calendar.term, calendar.session])

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

  const handleOpenCreateEvent = useCallback(() => {
    setEditingEventId(null)
    setEventForm({ ...INITIAL_EVENT_FORM })
    setEventDialogOpen(true)
  }, [])

  const handleEditEvent = useCallback((event: SchoolCalendarEvent) => {
    setEditingEventId(event.id)
    setEventForm({
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate ?? "",
      category: event.category,
      audience: event.audience,
      location: event.location ?? "",
      isFullDay: event.isFullDay,
    })
    setEventDialogOpen(true)
  }, [])

  const handleSaveMetadata = useCallback(async () => {
    if (!metadata.title.trim() || !metadata.term.trim() || !metadata.session.trim()) {
      toast({
        title: "Complete calendar details",
        description: "Provide a calendar title, term, and session before saving.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSavingMetadata(true)
      setCalendarDetails({
        title: metadata.title,
        term: metadata.term,
        session: metadata.session,
      })
      toast({ title: "Calendar details saved", description: "Your changes have been recorded." })
    } catch (error) {
      toast({
        title: "Unable to save calendar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingMetadata(false)
    }
  }, [metadata.session, metadata.term, metadata.title, toast])

  const handleSubmitEvent = useCallback(() => {
    if (!eventForm.title.trim() || !eventForm.startDate) {
      toast({
        title: "Event details required",
        description: "Please provide a title and start date for the calendar event.",
        variant: "destructive",
      })
      return
    }

    try {
      upsertCalendarEvent({
        id: editingEventId ?? undefined,
        title: eventForm.title,
        description: eventForm.description,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate || null,
        category: eventForm.category,
        audience: eventForm.audience,
        location: eventForm.location || null,
        isFullDay: eventForm.isFullDay,
      })
      toast({
        title: editingEventId ? "Calendar event updated" : "Calendar event added",
        description: editingEventId
          ? "The selected event has been refreshed with your changes."
          : "A new activity has been added to the school calendar.",
      })
      setEventDialogOpen(false)
      setEditingEventId(null)
      setEventForm({ ...INITIAL_EVENT_FORM })
    } catch (error) {
      toast({
        title: "Unable to save event",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [editingEventId, eventForm.audience, eventForm.category, eventForm.description, eventForm.endDate, eventForm.isFullDay, eventForm.location, eventForm.startDate, eventForm.title, toast])

  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      try {
        removeCalendarEvent(eventId)
        toast({ title: "Event removed", description: "The activity is no longer part of the school calendar." })
      } catch (error) {
        toast({
          title: "Unable to remove event",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const handleSendForApproval = useCallback(() => {
    if (!calendar.events.length) {
      toast({
        title: "Add events before requesting approval",
        description: "At least one calendar activity is required before sending for approval.",
        variant: "destructive",
      })
      return
    }

    try {
      submitCalendarForApproval(approvalNote)
      toast({
        title: "Calendar submitted",
        description: "Super Admin has been notified to review the updated calendar.",
      })
      setApprovalDialogOpen(false)
      setApprovalNote("")
    } catch (error) {
      toast({
        title: "Unable to submit for approval",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [approvalNote, calendar.events.length, toast])

  const handlePublish = useCallback(() => {
    if (calendar.status !== "approved") {
      toast({
        title: "Approval required",
        description: "Obtain Super Admin approval before publishing the calendar.",
        variant: "destructive",
      })
      return
    }

    try {
      publishSchoolCalendar()
      toast({
        title: "Calendar published",
        description: "Parents and teachers can now view the latest calendar.",
      })
      setPublishDialogOpen(false)
    } catch (error) {
      toast({
        title: "Unable to publish calendar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [calendar.status, toast])

  const hasPendingApproval = calendar.status === "pending_approval"
  const canPublish = calendar.status === "approved"

  return (
    <div className="space-y-6">
      <Card className="border-[#2d682d]/20">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-[#2d682d]" />
              <CardTitle className="text-[#2d682d]">School Calendar Workflow</CardTitle>
            </div>
            <CardDescription>
              Design the official academic calendar, collaborate with Super Admin, and publish polished updates to the entire
              school community.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={statusInfo.badge}>{statusInfo.label}</Badge>
            <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
              v{calendar.version}
            </Badge>
            <div className="text-xs text-gray-500">
              Last updated {formatDateDisplay(calendar.lastUpdated)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="calendar-title">Calendar Title</Label>
                <Input
                  id="calendar-title"
                  value={metadata.title}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. 2024/2025 Academic Calendar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-session">Session</Label>
                <Input
                  id="calendar-session"
                  value={metadata.session}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, session: event.target.value }))}
                  placeholder="e.g. 2024/2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-term">Term</Label>
                <Input
                  id="calendar-term"
                  value={metadata.term}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, term: event.target.value }))}
                  placeholder="e.g. First Term"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-events-count">Total Events</Label>
                <Input id="calendar-events-count" value={`${calendar.events.length} activities`} readOnly />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleSaveMetadata()} disabled={isSavingMetadata} className="bg-[#2d682d] text-white">
                {isSavingMetadata ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save Calendar Details
              </Button>
              <Button variant="outline" onClick={handleOpenCreateEvent} className="border-[#2d682d]/40">
                <PlusCircle className="mr-2 h-4 w-4 text-[#2d682d]" /> Add Activity
              </Button>
            </div>
            <p className="text-sm text-gray-600">{statusInfo.description}</p>
            {calendar.requiresRepublish && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Updates since the last publication require approval and republishing so stakeholders see the latest schedule.
              </div>
            )}
            {calendar.approvalNotes && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="font-medium">Approval feedback</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-blue-900">{calendar.approvalNotes}</p>
              </div>
            )}
          </div>
          <div className="space-y-4 rounded-xl border border-[#2d682d]/20 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#2d682d]">Approval Timeline</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <SendHorizonal className="mt-0.5 h-4 w-4 text-[#2d682d]" />
                <div>
                  <p className="font-medium">Submission</p>
                  <p>{calendar.submittedForApprovalAt ? formatDateDisplay(calendar.submittedForApprovalAt) : "Not submitted"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[#2d682d]" />
                <div>
                  <p className="font-medium">Approval</p>
                  <p>
                    {calendar.approvedAt
                      ? `${formatDateDisplay(calendar.approvedAt)} • ${calendar.approvedBy ?? "Super Admin"}`
                      : "Awaiting approval"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 text-[#2d682d]" />
                <div>
                  <p className="font-medium">Publication</p>
                  <p>{calendar.publishedAt ? formatDateDisplay(calendar.publishedAt) : "Not yet published"}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1 bg-[#2d682d] text-white hover:bg-[#1a4a1a]"
                disabled={hasPendingApproval}
                onClick={() => setApprovalDialogOpen(true)}
              >
                <SendHorizonal className="mr-2 h-4 w-4" />
                {hasPendingApproval ? "Submitted for Approval" : "Send for Approval"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-[#2d682d]/30 text-[#2d682d]"
                disabled={!canPublish}
                onClick={() => setPublishDialogOpen(true)}
              >
                <Megaphone className="mr-2 h-4 w-4" />
                {calendar.requiresRepublish ? "Republish Calendar" : "Publish Calendar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#2d682d]/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <CalendarRange className="h-5 w-5" />
            Calendar Activities
          </CardTitle>
          <CardDescription>Curate term highlights, cultural days, holidays, and assessments.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#2d682d]/5">
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">
                    No activities added yet. Use the “Add Activity” button to design your term programme.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-semibold text-[#1f3d1f]">{event.title}</div>
                      <p className="text-xs text-gray-500">{event.description}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Clock3 className="h-4 w-4 text-[#b29032]" />
                        {formatDateRange(event)}
                      </div>
                      <p className="text-xs text-gray-500">{event.isFullDay ? "Full day activity" : "Specific time"}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${CATEGORY_STYLES[event.category]}`}>
                        {CATEGORY_OPTIONS.find((option) => option.value === event.category)?.label ?? event.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                        {AUDIENCE_LABEL[event.audience]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{event.location ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditEvent(event)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEventId ? "Edit Calendar Activity" : "Add Calendar Activity"}</DialogTitle>
            <DialogDescription>
              Capture the details of the school programme to keep parents, teachers, and students informed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="event-title">Activity Title</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g. Independence Day Cultural Exhibition"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-start">Start Date</Label>
              <Input
                id="event-start"
                type="date"
                value={eventForm.startDate}
                onChange={(event) => setEventForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">End Date</Label>
              <Input
                id="event-end"
                type="date"
                value={eventForm.endDate}
                onChange={(event) => setEventForm((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={eventForm.category}
                onValueChange={(value: CalendarCategory) => setEventForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={eventForm.audience}
                onValueChange={(value: CalendarAudience) => setEventForm((prev) => ({ ...prev, audience: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="event-location">Location / Venue</Label>
              <Input
                id="event-location"
                value={eventForm.location}
                onChange={(event) => setEventForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="e.g. Victory Events Arena"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="event-description">Activity Description</Label>
              <Textarea
                id="event-description"
                rows={4}
                value={eventForm.description}
                onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Outline the purpose, expectations, or dress code for this activity."
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={eventForm.isFullDay}
                  onCheckedChange={(checked) =>
                    setEventForm((prev) => ({ ...prev, isFullDay: Boolean(checked) }))
                  }
                />
                Treat as a full-day activity
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2d682d] text-white" onClick={() => void handleSubmitEvent()}>
              {editingEventId ? "Save Changes" : "Add Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Calendar for Approval</DialogTitle>
            <DialogDescription>
              Share optional notes for the Super Admin. Approval is required before you can publish the calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="approval-note">Message</Label>
            <Textarea
              id="approval-note"
              rows={4}
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
              placeholder="Summarise major updates or areas that need review."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2d682d] text-white" onClick={() => void handleSendForApproval()}>
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {calendar.requiresRepublish ? "Republish updated calendar" : "Publish school calendar"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {calendar.requiresRepublish
                ? "Confirm to republish the refreshed calendar so parents and teachers immediately see the updated schedule."
                : "Publishing will present the approved calendar in the parent and teacher dashboards."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#2d682d] text-white hover:bg-[#1a4a1a]" onClick={() => void handlePublish()}>
              Publish Calendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

