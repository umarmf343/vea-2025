"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Bell, BookOpen, Calendar, Edit, Loader2, Pin, Plus, Trash2, Users } from "lucide-react"
import { logger } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"

type BrowserRuntime = typeof globalThis & Partial<Window>

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  return globalThis as BrowserRuntime
}

interface Notice {
  id: string
  title: string
  content: string
  category: "general" | "academic" | "event" | "urgent" | "celebration"
  targetAudience: string[]
  author: string
  authorRole: string
  date: string
  isPinned: boolean
  scheduledFor: string | null
  status: "draft" | "scheduled" | "published"
}

interface NoticeboardProps {
  userRole: "admin" | "teacher" | "student" | "parent"
  userName?: string
}

const AUDIENCE_OPTIONS = ["student", "teacher", "parent", "admin"] as const

const FALLBACK_NOTICES: Notice[] = [
  {
    id: "notice_seed_1",
    title: "Mid-Term Examination Schedule",
    content:
      "The mid-term examinations will commence on January 20th, 2025. All students are expected to be present and punctual.",
    category: "academic",
    targetAudience: ["student", "parent", "teacher"],
    author: "Academic Office",
    authorRole: "admin",
    date: "2025-01-08",
    isPinned: true,
    scheduledFor: null,
    status: "published",
  },
  {
    id: "notice_seed_2",
    title: "Parent-Teacher Conference",
    content:
      "We invite all parents to attend the quarterly parent-teacher conference scheduled for January 25th, 2025.",
    category: "event",
    targetAudience: ["parent", "teacher"],
    author: "Principal's Office",
    authorRole: "admin",
    date: "2025-01-07",
    isPinned: true,
    scheduledFor: null,
    status: "published",
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseAudience(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry : null))
    .filter((entry): entry is string => entry !== null)
}

function toNotice(value: unknown): Notice {
  if (!isRecord(value)) {
    return {
      id: `notice_${Date.now()}`,
      title: "Untitled",
      content: "",
      category: "general",
      targetAudience: [],
      author: "School Administration",
      authorRole: "admin",
      date: new Date().toISOString(),
      isPinned: false,
      scheduledFor: null,
      status: "published",
    }
  }

  const idCandidate = value.id
  const generatedId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `notice_${Date.now()}`

  return {
    id: typeof idCandidate === "string" && idCandidate ? idCandidate : String(idCandidate ?? generatedId),
    title: typeof value.title === "string" && value.title.trim().length > 0 ? value.title : "Untitled",
    content: typeof value.content === "string" ? value.content : "",
    category: (value.category as Notice["category"]) ?? "general",
    targetAudience: parseAudience(value.targetAudience),
    author: typeof value.author === "string" ? value.author : String(value.authorName ?? "School Administration"),
    authorRole: typeof value.authorRole === "string" ? value.authorRole : "admin",
    date: typeof value.date === "string" ? value.date : String(value.createdAt ?? new Date().toISOString()),
    isPinned: Boolean(value.isPinned),
    scheduledFor:
      typeof value.scheduledFor === "string"
        ? value.scheduledFor
        : typeof (value as { scheduled_for?: string }).scheduled_for === "string"
          ? (value as { scheduled_for?: string }).scheduled_for
          : null,
    status:
      value.status === "scheduled" || value.status === "draft" || value.status === "published"
        ? value.status
        : "published",
  }
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch (error) {
    logger.warn("Failed to format notice date", { error })
    return value
  }
}

function toDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const pad = (num: number) => num.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseDateTimeLocalInput(value: string): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function determineStatusFromSchedule(schedule: string | null): Notice["status"] {
  if (!schedule) {
    return "published"
  }

  const scheduleTime = new Date(schedule).getTime()
  if (Number.isNaN(scheduleTime)) {
    return "published"
  }

  return scheduleTime > Date.now() ? "scheduled" : "published"
}

export function Noticeboard({ userRole, userName }: NoticeboardProps) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    category: "general" as Notice["category"],
    targetAudience: [] as string[],
    scheduledFor: "",
  })
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    category: "general" as Notice["category"],
    targetAudience: [] as string[],
    scheduledFor: "",
  })
  const { toast } = useToast()

  const canCreateNotice = userRole === "admin" || userRole === "teacher"

  const canModifyNotice = useCallback(
    (notice: Notice) => {
      if (!canCreateNotice || typeof userName !== "string") {
        return false
      }

      const authorName = notice.author?.trim().toLowerCase() ?? ""
      const currentUserName = userName.trim().toLowerCase()

      return currentUserName.length > 0 && authorName === currentUserName
    },
    [canCreateNotice, userName],
  )

  const resolveNoticeState = useCallback(
    (notice: Notice): Notice["status"] => {
      if (notice.status === "draft") {
        return "draft"
      }

      const scheduleTime = notice.scheduledFor ? new Date(notice.scheduledFor).getTime() : NaN
      if (Number.isNaN(scheduleTime)) {
        return notice.status === "scheduled" ? "scheduled" : "published"
      }

      if (scheduleTime > Date.now()) {
        return "scheduled"
      }

      return "published"
    },
    [],
  )

  const loadNotices = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({ audience: userRole })
      if (canCreateNotice) {
        params.set("includeScheduled", "true")
      }
      const response = await fetch(`/api/noticeboard?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data: unknown = await response.json()
      const incoming: Notice[] = Array.isArray((data as Record<string, unknown>)?.notices)
        ? ((data as Record<string, unknown>).notices as unknown[]).map(toNotice)
        : []

      setNotices(incoming.length > 0 ? incoming : FALLBACK_NOTICES)
    } catch (err) {
      logger.error("Error loading notices", { error: err })
      setError("We could not load notices from the server. Displaying the last known updates.")
      setNotices(FALLBACK_NOTICES)
    } finally {
      setIsLoading(false)
    }
  }, [canCreateNotice, userRole])

  useEffect(() => {
    void loadNotices()
  }, [loadNotices])

  const filteredNotices = useMemo(() => {
    const scoped =
      userRole === "admin" ? notices : notices.filter((notice) => notice.targetAudience.includes(userRole))

    if (!canCreateNotice) {
      return scoped.filter((notice) => resolveNoticeState(notice) !== "scheduled")
    }

    return scoped
  }, [canCreateNotice, notices, resolveNoticeState, userRole])

  const scheduledNotices = useMemo(
    () =>
      canCreateNotice
        ? filteredNotices.filter((notice) => resolveNoticeState(notice) === "scheduled")
        : [],
    [canCreateNotice, filteredNotices, resolveNoticeState],
  )

  const activeNotices = useMemo(
    () => filteredNotices.filter((notice) => resolveNoticeState(notice) !== "scheduled"),
    [filteredNotices, resolveNoticeState],
  )

  const pinnedNotices = useMemo(
    () => activeNotices.filter((notice) => notice.isPinned),
    [activeNotices],
  )
  const regularNotices = useMemo(
    () => activeNotices.filter((notice) => !notice.isPinned),
    [activeNotices],
  )

  const handleCreateNotice = async (event: React.FormEvent) => {
    event.preventDefault()

    if (newNotice.targetAudience.length === 0) {
      toast({
        variant: "destructive",
        title: "Target audience required",
        description: "Select at least one audience segment before publishing a notice.",
      })
      return
    }

    try {
      setIsSaving(true)
      const scheduledForIso = parseDateTimeLocalInput(newNotice.scheduledFor)
      const status = determineStatusFromSchedule(scheduledForIso)
      const response = await fetch("/api/noticeboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newNotice.title,
          content: newNotice.content,
          category: newNotice.category,
          targetAudience: newNotice.targetAudience,
          authorName: userName ?? "School Administrator",
          authorRole: userRole,
          scheduledFor: scheduledForIso,
          status,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to create notice")
      }

      setNewNotice({ title: "", content: "", category: "general", targetAudience: [], scheduledFor: "" })
      setShowCreateForm(false)
      await loadNotices()
    } catch (err) {
      logger.error("Error creating notice", { error: err })
      toast({
        variant: "destructive",
        title: "Unable to create notice",
        description: err instanceof Error ? err.message : "Failed to create notice. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const togglePin = async (id: string) => {
    const target = notices.find((notice) => notice.id === id)
    if (!target) {
      return
    }

    if (!canModifyNotice(target)) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You can only pin or unpin notices that you created.",
      })
      return
    }

    try {
      const response = await fetch(`/api/noticeboard/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !target.isPinned }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to update notice")
      }

      await loadNotices()
    } catch (err) {
      logger.error("Error updating notice pin status", { error: err })
      toast({
        variant: "destructive",
        title: "Unable to update notice",
        description: err instanceof Error ? err.message : "Failed to update notice. Please try again.",
      })
    }
  }

  const handleStartEdit = (notice: Notice) => {
    if (!canModifyNotice(notice)) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You can only edit notices that you created.",
      })
      return
    }

    setEditingNotice(notice)
    setEditForm({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      targetAudience: [...notice.targetAudience],
      scheduledFor: toDateTimeLocalInput(notice.scheduledFor),
    })
    setEditDialogOpen(true)
  }

  const handleUpdateNotice = async () => {
    if (!editingNotice) {
      return
    }

    if (!canModifyNotice(editingNotice)) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You can only update notices that you created.",
      })
      return
    }

    if (editForm.targetAudience.length === 0) {
      toast({
        variant: "destructive",
        title: "Target audience required",
        description: "Select at least one audience segment before saving the notice.",
      })
      return
    }

    try {
      setIsUpdating(true)
      const scheduledForIso = parseDateTimeLocalInput(editForm.scheduledFor)
      const status = determineStatusFromSchedule(scheduledForIso)
      const response = await fetch(`/api/noticeboard/${editingNotice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          category: editForm.category,
          targetAudience: editForm.targetAudience,
          scheduledFor: scheduledForIso,
          status,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to update notice")
      }

      setEditDialogOpen(false)
      setEditingNotice(null)
      await loadNotices()
    } catch (error) {
      logger.error("Failed to update notice", { error })
      toast({
        variant: "destructive",
        title: "Unable to update notice",
        description: error instanceof Error ? error.message : "Failed to update notice. Please try again.",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteNotice = async (notice: Notice) => {
    if (!canModifyNotice(notice)) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You can only delete notices that you created.",
      })
      return
    }

    const runtime = getBrowserRuntime()
    const confirmDelete = runtime?.confirm
      ? runtime.confirm(`Delete notice “${notice.title}”? This action cannot be undone.`)
      : true
    if (!confirmDelete) {
      return
    }

    try {
      const response = await fetch(`/api/noticeboard/${notice.id}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to delete notice")
      }

      toast({
        title: "Notice deleted",
        description: "The notice was removed successfully.",
      })
      await loadNotices()
    } catch (error) {
      logger.error("Failed to delete notice", { error })
      toast({
        variant: "destructive",
        title: "Unable to delete notice",
        description: error instanceof Error ? error.message : "Failed to delete notice. Please try again.",
      })
    }
  }

  const getCategoryColor = (category: Notice["category"]) => {
    switch (category) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200"
      case "academic":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "event":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "celebration":
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getCategoryIcon = (category: Notice["category"]) => {
    switch (category) {
      case "urgent":
        return <Bell className="h-4 w-4" />
      case "academic":
        return <BookOpen className="h-4 w-4" />
      case "event":
        return <Calendar className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#2d682d]" />
        <span className="ml-2 text-[#2d682d]">Loading notices...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#2d682d]">School Noticeboard</h3>
          <p className="text-gray-600">Important announcements and updates</p>
        </div>
        {canCreateNotice && (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Notice
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-[#b29032]/30 bg-[#b29032]/10">
          <CardContent className="py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#8a6b25]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadNotices()}
                className="border-[#b29032]/40 text-[#b29032]"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreateForm && canCreateNotice && (
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#b29032]">Create New Notice</CardTitle>
            <CardDescription>Post a new announcement for the school community</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateNotice} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notice-title">Title</Label>
                <Input
                  id="notice-title"
                  value={newNotice.title}
                  onChange={(event) =>
                    setNewNotice((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Enter notice title"
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-content">Content</Label>
                <Textarea
                  id="notice-content"
                  value={newNotice.content}
                  onChange={(event) =>
                    setNewNotice((prev) => ({ ...prev, content: event.target.value }))
                  }
                  placeholder="Enter notice content"
                  rows={4}
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notice-category">Category</Label>
                  <Select
                    value={newNotice.category}
                    onValueChange={(value: Notice["category"]) =>
                      setNewNotice((prev) => ({ ...prev, category: value }))
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger id="notice-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="celebration">Celebration</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map((audience) => {
                      const isActive = newNotice.targetAudience.includes(audience)
                      return (
                        <Button
                          key={audience}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          className={cn(
                            "capitalize",
                            isActive ? "bg-[#2d682d] hover:bg-[#1a4a1a]" : "text-[#2d682d]",
                          )}
                          disabled={isSaving}
                          onClick={() => {
                            setNewNotice((prev) => {
                              const updated = isActive
                                ? prev.targetAudience.filter((value) => value !== audience)
                                : [...prev.targetAudience, audience]
                              return { ...prev, targetAudience: updated }
                            })
                          }}
                        >
                          {audience}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-schedule">Schedule (optional)</Label>
                <Input
                  id="notice-schedule"
                  type="datetime-local"
                  value={newNotice.scheduledFor}
                  onChange={(event) =>
                    setNewNotice((prev) => ({ ...prev, scheduledFor: event.target.value }))
                  }
                  disabled={isSaving}
                />
                <p className="text-xs text-gray-500">Leave blank to publish immediately.</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#2d682d]" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Post Notice
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canCreateNotice && scheduledNotices.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-[#2d682d] flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Notices
          </h4>
          <div className="space-y-3">
            {scheduledNotices.map((notice) => {
              const state = resolveNoticeState(notice)
              const scheduleLabel = formatDateTime(notice.scheduledFor ?? notice.date)
              return (
                <Card key={notice.id} className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge className={cn(getCategoryColor(notice.category), "text-xs border")}> 
                            <span className="flex items-center gap-1">
                              {getCategoryIcon(notice.category)}
                              {notice.category.toUpperCase()}
                            </span>
                          </Badge>
                          <Badge variant="outline" className="border-blue-300 text-blue-700">
                            {state === "scheduled" ? "Scheduled" : state === "draft" ? "Draft" : "Published"}
                          </Badge>
                        </div>
                        <CardTitle className="text-[#2d682d]">{notice.title}</CardTitle>
                        <CardDescription className="text-xs space-y-1">
                          <span className="block">By {notice.author}</span>
                          <span className="block">Scheduled for {scheduleLabel}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        {canModifyNotice(notice) ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#2d682d] hover:text-[#1a4a1a]"
                              onClick={() => handleStartEdit(notice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteNotice(notice)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-500 hover:text-blue-600"
                              onClick={() => togglePin(notice.id)}
                            >
                              <Pin className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            View only
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{notice.content}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {pinnedNotices.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-[#2d682d] flex items-center gap-2">
            <Pin className="h-5 w-5" />
            Pinned Notices
          </h4>
          <div className="space-y-3">
            {pinnedNotices.map((notice) => {
              const state = resolveNoticeState(notice)
              const publishedLabel = formatDateTime(
                state === "scheduled" ? notice.scheduledFor ?? notice.date : notice.date,
              )
              return (
                <Card key={notice.id} className="border-[#b29032]/30 bg-[#b29032]/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn(getCategoryColor(notice.category), "text-xs border")}> 
                            <span className="flex items-center gap-1">
                              {getCategoryIcon(notice.category)}
                              {notice.category.toUpperCase()}
                            </span>
                          </Badge>
                          <Pin className="h-4 w-4 text-[#b29032]" />
                          {state === "scheduled" && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">Scheduled</Badge>
                          )}
                        </div>
                        <CardTitle className="text-[#2d682d]">{notice.title}</CardTitle>
                        <CardDescription className="text-xs space-y-1">
                          <span className="block">By {notice.author}</span>
                          <span className="block">
                            {state === "scheduled" ? `Scheduled for ${publishedLabel}` : `Published ${publishedLabel}`}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        {canModifyNotice(notice) ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#2d682d] hover:text-[#1a4a1a]"
                              onClick={() => handleStartEdit(notice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteNotice(notice)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePin(notice.id)}
                              className="text-[#b29032] hover:text-[#8a6b25]"
                            >
                              <Pin className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            View only
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{notice.content}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-[#2d682d]">Recent Notices</h4>
        <div className="space-y-3">
          {regularNotices.map((notice) => {
            const publishedLabel = formatDateTime(notice.date)
            return (
              <Card key={notice.id} className="border-[#2d682d]/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn(getCategoryColor(notice.category), "text-xs border")}> 
                          <span className="flex items-center gap-1">
                            {getCategoryIcon(notice.category)}
                            {notice.category.toUpperCase()}
                          </span>
                        </Badge>
                      </div>
                      <CardTitle className="text-[#2d682d]">{notice.title}</CardTitle>
                      <CardDescription className="text-xs space-y-1">
                        <span className="block">By {notice.author}</span>
                        <span className="block">Published {publishedLabel}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      {canModifyNotice(notice) ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#2d682d] hover:text-[#1a4a1a]"
                            onClick={() => handleStartEdit(notice)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteNotice(notice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePin(notice.id)}
                            className="text-gray-400 hover:text-[#b29032]"
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          View only
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{notice.content}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {filteredNotices.length === 0 && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notices</h3>
            <p className="text-gray-500 text-center">No announcements available at the moment</p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingNotice(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notice</DialogTitle>
            <DialogDescription>Update the notice details and schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editForm.content}
                onChange={(event) => setEditForm((prev) => ({ ...prev, content: event.target.value }))}
                rows={4}
                disabled={isUpdating}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value: Notice["category"]) =>
                    setEditForm((prev) => ({ ...prev, category: value }))
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="celebration">Celebration</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((audience) => {
                    const isActive = editForm.targetAudience.includes(audience)
                    return (
                      <Button
                        key={audience}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "capitalize",
                          isActive ? "bg-[#2d682d] hover:bg-[#1a4a1a]" : "text-[#2d682d]",
                        )}
                        disabled={isUpdating}
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            targetAudience: isActive
                              ? prev.targetAudience.filter((value) => value !== audience)
                              : [...prev.targetAudience, audience],
                          }))
                        }
                      >
                        {audience}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-schedule">Schedule (optional)</Label>
              <Input
                id="edit-schedule"
                type="datetime-local"
                value={editForm.scheduledFor}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                }
                disabled={isUpdating}
              />
              <p className="text-xs text-gray-500">Set a future date and time to publish later.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingNotice(null)
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateNotice()} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
