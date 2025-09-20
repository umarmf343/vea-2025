"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, Bell, Plus, Pin, Users, BookOpen, Loader2 } from "lucide-react"
import { dbManager } from "@/lib/database-manager"

interface Notice {
  id: string
  title: string
  content: string
  category: "general" | "academic" | "event" | "urgent"
  targetAudience: string[]
  author: string
  date: string
  isPinned: boolean
}

interface NoticeboardProps {
  userRole: "admin" | "teacher" | "student" | "parent"
  userName?: string
}

export function Noticeboard({ userRole, userName }: NoticeboardProps) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    category: "general" as Notice["category"],
    targetAudience: [] as string[],
  })

  const canCreateNotice = userRole === "admin" || userRole === "teacher"

  useEffect(() => {
    loadNotices()

    const handleNoticeUpdate = () => {
      loadNotices()
    }

    dbManager.on("noticeCreated", handleNoticeUpdate)
    dbManager.on("noticeUpdated", handleNoticeUpdate)
    dbManager.on("noticeDeleted", handleNoticeUpdate)

    return () => {
      dbManager.off("noticeCreated", handleNoticeUpdate)
      dbManager.off("noticeUpdated", handleNoticeUpdate)
      dbManager.off("noticeDeleted", handleNoticeUpdate)
    }
  }, [])

  const loadNotices = async () => {
    try {
      setLoading(true)
      const noticesData = await dbManager.getNotices()
      setNotices(noticesData)
    } catch (error) {
      console.error("Error loading notices:", error)
      setNotices([
        {
          id: "1",
          title: "Mid-Term Examination Schedule",
          content:
            "The mid-term examinations will commence on January 20th, 2025. All students are expected to be present and punctual.",
          category: "academic",
          targetAudience: ["student", "parent", "teacher"],
          author: "Academic Office",
          date: "2025-01-08",
          isPinned: true,
        },
        {
          id: "2",
          title: "Parent-Teacher Conference",
          content:
            "We invite all parents to attend the quarterly parent-teacher conference scheduled for January 25th, 2025.",
          category: "event",
          targetAudience: ["parent", "teacher"],
          author: "Principal's Office",
          date: "2025-01-07",
          isPinned: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newNotice.targetAudience.length === 0) {
      alert("Please select at least one target audience")
      return
    }

    try {
      setSaving(true)

      const notice: Notice = {
        id: Date.now().toString(),
        title: newNotice.title,
        content: newNotice.content,
        category: newNotice.category,
        targetAudience: newNotice.targetAudience,
        author: userName || "Unknown",
        date: new Date().toISOString().split("T")[0],
        isPinned: false,
      }

      await dbManager.createNotice(notice)
      setNewNotice({ title: "", content: "", category: "general", targetAudience: [] })
      setShowCreateForm(false)

      await loadNotices()
    } catch (error) {
      console.error("Error creating notice:", error)
      alert("Failed to create notice. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (id: string) => {
    try {
      const notice = notices.find((n) => n.id === id)
      if (notice) {
        const updatedNotice = { ...notice, isPinned: !notice.isPinned }
        await dbManager.updateNotice(id, updatedNotice)
        await loadNotices()
      }
    } catch (error) {
      console.error("Error updating notice pin status:", error)
      alert("Failed to update notice. Please try again.")
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

  const filteredNotices = notices.filter((notice) => notice.targetAudience.includes(userRole) || userRole === "admin")
  const pinnedNotices = filteredNotices.filter((notice) => notice.isPinned)
  const regularNotices = filteredNotices.filter((notice) => !notice.isPinned)

  if (loading) {
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
          <Button onClick={() => setShowCreateForm(true)} className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Notice
          </Button>
        )}
      </div>

      {/* Create Notice Form */}
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
                  onChange={(e) => setNewNotice((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter notice title"
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-content">Content</Label>
                <Textarea
                  id="notice-content"
                  value={newNotice.content}
                  onChange={(e) => setNewNotice((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter notice content"
                  rows={4}
                  required
                  disabled={saving}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notice-category">Category</Label>
                  <Select
                    value={newNotice.category}
                    onValueChange={(value: Notice["category"]) =>
                      setNewNotice((prev) => ({ ...prev, category: value }))
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <div className="flex flex-wrap gap-2">
                    {["student", "parent", "teacher"].map((audience) => (
                      <Button
                        key={audience}
                        type="button"
                        size="sm"
                        variant={newNotice.targetAudience.includes(audience) ? "default" : "outline"}
                        onClick={() => {
                          const updated = newNotice.targetAudience.includes(audience)
                            ? newNotice.targetAudience.filter((a) => a !== audience)
                            : [...newNotice.targetAudience, audience]
                          setNewNotice((prev) => ({ ...prev, targetAudience: updated }))
                        }}
                        className={
                          newNotice.targetAudience.includes(audience)
                            ? "bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
                            : "border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d] hover:text-white"
                        }
                        disabled={saving}
                      >
                        {audience.charAt(0).toUpperCase() + audience.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Post Notice"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pinned Notices */}
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
                        <Badge className={`${getCategoryColor(notice.category)} text-xs`}>
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
                  <p className="text-sm text-gray-700">{notice.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Regular Notices */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-[#2d682d]">Recent Notices</h4>
        <div className="space-y-3">
          {regularNotices.map((notice) => (
            <Card key={notice.id} className="border-[#2d682d]/20">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${getCategoryColor(notice.category)} text-xs`}>
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
                <p className="text-sm text-gray-700">{notice.content}</p>
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
