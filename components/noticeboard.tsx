"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Bell, BookOpen, Calendar, Loader2, Pin, Plus, Users } from "lucide-react"
import { logger } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"

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
  }
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
  })
  const { toast } = useToast()

  const canCreateNotice = userRole === "admin" || userRole === "teacher"

  const loadNotices = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({ audience: userRole })
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
  }, [userRole])

  useEffect(() => {
    void loadNotices()
  }, [loadNotices])

  const filteredNotices = useMemo(() => {
    if (userRole === "admin") {
      return notices
    }

    return notices.filter((notice) => notice.targetAudience.includes(userRole))
  }, [notices, userRole])

  const pinnedNotices = useMemo(
    () => filteredNotices.filter((notice) => notice.isPinned),
    [filteredNotices],
  )
  const regularNotices = useMemo(
    () => filteredNotices.filter((notice) => !notice.isPinned),
    [filteredNotices],
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
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to create notice")
      }

      setNewNotice({ title: "", content: "", category: "general", targetAudience: [] })
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

      {pinnedNotices.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-[#2d682d] flex items-center gap-2">
            <Pin className="h-5 w-5" />
            Pinned Notices
          </h4>
          <div className="space-y-3">
            {pinnedNotices.map((notice) => (
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
                      </div>
                      <CardTitle className="text-[#2d682d]">{notice.title}</CardTitle>
                      <CardDescription className="text-xs">
                        By {notice.author} • {new Date(notice.date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {canCreateNotice && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePin(notice.id)}
                        className="text-[#b29032] hover:text-[#8a6b25]"
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{notice.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-[#2d682d]">Recent Notices</h4>
        <div className="space-y-3">
          {regularNotices.map((notice) => (
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
                    <CardDescription className="text-xs">
                      By {notice.author} • {new Date(notice.date).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {canCreateNotice && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePin(notice.id)}
                      className="text-gray-400 hover:text-[#b29032]"
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-700 whitespace-pre-line">{notice.content}</p>
              </CardContent>
            </Card>
          ))}
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
    </div>
  )
}
