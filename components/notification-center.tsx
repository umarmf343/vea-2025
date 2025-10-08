"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bell,
  Check,
  X,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  BookOpen,
  DollarSign,
  Loader2,
  MessageCircle,
  CalendarClock,
  ClipboardCheck,
  Megaphone,
} from "lucide-react"
import { dbManager } from "@/lib/database-manager"
import { safeStorage } from "@/lib/safe-storage"

const resolveBrowserWindow = (): (Window & typeof globalThis) | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  const candidate = globalThis as Window & typeof globalThis

  if (typeof candidate.window === "undefined") {
    return null
  }

  return candidate
}

interface StoredNotification {
  id: string
  type?: "info" | "success" | "warning" | "error"
  title: string
  message: string
  timestamp?: string
  createdAt?: string
  read?: boolean
  category?: "system" | "academic" | "payment" | "user" | "message" | "calendar" | "task" | "promotion"
  audience?: string[] | string | null
  actionRequired?: boolean
  metadata?: Record<string, unknown>
  actionUrl?: string | null
}

interface NotificationCenterProps {
  userRole: string
  userId?: string
  studentIds?: string[]
}

export function NotificationCenter({ userRole, userId, studentIds }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const normalizedRole = useMemo(() => userRole.toLowerCase().replace(/\s+/g, "-"), [userRole])

  const resolvedUserId = useMemo(() => {
    if (userId) {
      const trimmed = String(userId).trim()
      return trimmed.length > 0 ? trimmed : null
    }

    const runtime = resolveBrowserWindow()
    if (!runtime) {
      return null
    }

    try {
      const cached = safeStorage.getItem("vea_current_user")
      if (!cached) {
        return null
      }

      const parsed = JSON.parse(cached) as { id?: unknown }
      const parsedId = typeof parsed?.id === "string" ? parsed.id.trim() : String(parsed?.id ?? "").trim()
      return parsedId.length > 0 ? parsedId : null
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unable to resolve current user ID for notifications", error)
      return null
    }
  }, [userId])

  const normalizedUserId = useMemo(
    () => (resolvedUserId ? resolvedUserId.trim().toLowerCase() : null),
    [resolvedUserId],
  )

  const studentIdsKey = useMemo(() => {
    if (!studentIds || studentIds.length === 0) {
      return ""
    }

    return studentIds
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => value.length > 0)
      .sort()
      .join("|")
  }, [studentIds])

  const normalizedStudentIds = useMemo(() => {
    if (!studentIdsKey) {
      return new Set<string>()
    }

    return new Set(studentIdsKey.split("|"))
  }, [studentIdsKey])


  const toAudienceArray = useCallback((audience: StoredNotification["audience"]) => {
    if (!audience) {
      return [] as string[]
    }

    if (Array.isArray(audience)) {
      return audience
        .map((entry) => (typeof entry === "string" ? entry : String(entry)))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    }

    if (typeof audience === "string") {
      return audience
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    }

    return [] as string[]
  }, [])

  const normaliseLabel = useCallback((value: string) => value.toLowerCase().replace(/[\s_]+/g, "-"), [])

  const matchRoleLabel = useCallback(
    (target: string) => {
      const label = normaliseLabel(target)

      if (["all", "everyone", "*"]?.includes(label)) {
        return true
      }

      if (label === normalizedRole || label === `${normalizedRole}s`) {
        return true
      }

      const roleAliases: Record<string, string[]> = {
        parent: ["parent", "parents", "guardian", "guardians"],
        teacher: ["teacher", "teachers", "instructor", "instructors"],
        student: ["student", "students", "learner", "learners"],
        admin: ["admin", "admins", "administrator", "administrators"],
        accountant: ["accountant", "accountants", "bursar", "bursars"],
        "super-admin": ["super-admin", "superadmin", "super-admins", "superadministrators"],
      }

      if (normalizedRole === "super-admin" && roleAliases.admin.includes(label)) {
        return true
      }

      const aliases = roleAliases[normalizedRole]
      if (aliases && aliases.includes(label)) {
        return true
      }

      return false
    },
    [normaliseLabel, normalizedRole],
  )

  const extractStudentIdsFromMetadata = useCallback((metadata?: Record<string, unknown>) => {
    if (!metadata) {
      return [] as string[]
    }

    const candidates: unknown[] = []

    if ("studentId" in metadata) candidates.push(metadata.studentId)
    if ("studentID" in metadata) candidates.push((metadata as Record<string, unknown>).studentID)
    if ("studentIds" in metadata) candidates.push((metadata as Record<string, unknown>).studentIds)
    if ("studentIDs" in metadata) candidates.push((metadata as Record<string, unknown>).studentIDs)
    if ("students" in metadata) candidates.push((metadata as Record<string, unknown>).students)
    if ("targetStudentId" in metadata) candidates.push((metadata as Record<string, unknown>).targetStudentId)
    if ("targetStudentIds" in metadata) candidates.push((metadata as Record<string, unknown>).targetStudentIds)

    const toStrings = (value: unknown): string[] => {
      if (!value) return []
      if (Array.isArray(value)) {
        return value.flatMap((entry) => toStrings(entry))
      }
      if (typeof value === "object") {
        return []
      }
      return [String(value)]
    }

    return candidates.flatMap((candidate) =>
      toStrings(candidate)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    )
  }, [])

  const normaliseNotification = useCallback((entry: any): StoredNotification => {
    const resolveType = (value: unknown): StoredNotification["type"] => {
      if (typeof value !== "string") {
        return "info"
      }
      const normalized = value.toLowerCase()
      if (["info", "success", "warning", "error"].includes(normalized)) {
        return normalized as StoredNotification["type"]
      }
      return "info"
    }

    const resolveCategory = (
      category: unknown,
      rawType: unknown,
    ): StoredNotification["category"] => {
      const normaliseCategory = (value: string) => value.toLowerCase()

      const tryResolve = (value?: string | null) => {
        if (!value) {
          return null
        }
        const normalized = normaliseCategory(value)
        if (["payment", "payments", "finance", "financial", "fee", "fees"].includes(normalized)) {
          return "payment"
        }
        if (["academic", "academics", "result", "results", "report", "reports"].includes(normalized)) {
          return "academic"
        }
        if (["user", "users", "profile", "profiles"].includes(normalized)) {
          return "user"
        }
        if (["message", "messages", "chat", "communication"].includes(normalized)) {
          return "message"
        }
        if (["calendar", "schedule", "event", "timetable"].includes(normalized)) {
          return "calendar"
        }
        if (["task", "action", "approval", "review", "assignment"].includes(normalized)) {
          return "task"
        }
        if (["promotion", "announcement", "news", "update"].includes(normalized)) {
          return "promotion"
        }
        if (normalized === "system") {
          return "system"
        }
        return null
      }

      return (
        tryResolve(typeof category === "string" ? category : null) ??
        tryResolve(typeof rawType === "string" ? rawType : null) ??
        "system"
      )
    }

    const resolveTimestamp = (value: unknown) => {
      if (typeof value === "string" && value.trim().length > 0) {
        return value
      }
      if (typeof value === "number") {
        return new Date(value).toISOString()
      }
      return new Date().toISOString()
    }

    const mergeMetadata = (...sources: Array<Record<string, unknown> | undefined>) => {
      return sources.reduce<Record<string, unknown>>((accumulator, source) => {
        if (!source) {
          return accumulator
        }

        Object.entries(source).forEach(([key, value]) => {
          if (value === undefined) {
            return
          }
          accumulator[key] = value
        })

        return accumulator
      }, {})
    }

    const rawType = typeof entry?.type === "string" ? entry.type : undefined

    const timestamp = resolveTimestamp(entry?.timestamp ?? entry?.createdAt ?? entry?.sentAt ?? entry?.updatedAt)

    const baseAudience = entry?.audience ?? entry?.targetAudience
    const roleAudience = Array.isArray(entry?.targetRoles)
      ? (entry.targetRoles as unknown[])
          .map((role) => (typeof role === "string" ? role : String(role)))
          .map((role) => `role:${role}`)
      : []
    const userAudience = Array.isArray(entry?.targetUserIds)
      ? (entry.targetUserIds as unknown[])
          .map((id) => (typeof id === "string" ? id : String(id)))
          .map((id) => `user:${id}`)
      : []
    const studentAudience = Array.isArray(entry?.targetStudentIds)
      ? (entry.targetStudentIds as unknown[])
          .map((id) => (typeof id === "string" ? id : String(id)))
          .map((id) => `student:${id}`)
      : []

    const combinedAudience = [...toAudienceArray(baseAudience), ...roleAudience, ...userAudience, ...studentAudience]
    const resolvedAudience = combinedAudience.length > 0 ? Array.from(new Set(combinedAudience)) : baseAudience ?? null

    const resolveActionUrl = (value: unknown): string | null => {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim()
      }
      return null
    }

    return {
      id: String(entry?.id ?? `${Date.now()}`),
      title: typeof entry?.title === "string" ? entry.title : "Notification",
      message:
        typeof entry?.message === "string" && entry.message.trim().length > 0
          ? entry.message
          : typeof entry?.body === "string"
            ? entry.body
            : typeof entry?.description === "string"
              ? entry.description
              : "",
      type: resolveType(rawType),
      timestamp,
      createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : timestamp,
      read: Boolean(entry?.read),
      category: resolveCategory(entry?.category, rawType),
      audience: resolvedAudience as StoredNotification["audience"],
      actionRequired: Boolean(entry?.actionRequired ?? entry?.requiresAction ?? entry?.requireAction),
      metadata: mergeMetadata(
        (entry?.metadata as Record<string, unknown>) ?? undefined,
        (entry?.meta as Record<string, unknown>) ?? undefined,
        (entry?.data as Record<string, unknown>) ?? undefined,
      ),
      actionUrl:
        resolveActionUrl(entry?.actionUrl) ??
        resolveActionUrl(entry?.url) ??
        resolveActionUrl(entry?.link) ??
        null,
    }
  }, [toAudienceArray])

  const applyAudienceFilter = useCallback(
    (items: any[]) => {
      const deduped = new Map<string, StoredNotification>()

      items
        .map((item) => normaliseNotification(item))
        .forEach((notification) => {
          deduped.set(notification.id, notification)
        })

      const matchesStudentMetadata = (notification: StoredNotification) => {
        if (normalizedStudentIds.size === 0) {
          return true
        }

        const metadataStudentIds = extractStudentIdsFromMetadata(notification.metadata)

        if (metadataStudentIds.length === 0) {
          return true
        }

        return metadataStudentIds.some((id) => normalizedStudentIds.has(id.trim().toLowerCase()))
      }

      const matchesAudience = (notification: StoredNotification) => {
        const targets = toAudienceArray(notification.audience)

        if (targets.length === 0) {
          return matchesStudentMetadata(notification)
        }

        const hasMatch = targets.some((target) => {
          const trimmed = target.trim()
          if (!trimmed) {
            return false
          }

          const [prefix, value] = trimmed.split(":")
          if (value === undefined) {
            return matchRoleLabel(prefix)
          }

          const normalizedPrefix = normaliseLabel(prefix)
          const normalizedValue = value.trim().toLowerCase()

          if (normalizedPrefix === "role") {
            return matchRoleLabel(normalizedValue)
          }

          if (["user", "recipient", "id"].includes(normalizedPrefix)) {
            return normalizedUserId ? normalizedUserId === normalizedValue : false
          }

          if (normalizedPrefix === "parent") {
            if (!normalizedValue) {
              return normalizedRole.startsWith("parent")
            }
            return normalizedUserId ? normalizedUserId === normalizedValue : false
          }

          if (normalizedPrefix === "student") {
            if (normalizedStudentIds.size === 0) {
              return false
            }
            if (!normalizedValue) {
              return true
            }
            return normalizedStudentIds.has(normalizedValue)
          }

          if (normalizedPrefix === "teacher" || normalizedPrefix === "staff") {
            if (normalizedRole !== "teacher") {
              return false
            }
            if (!normalizedValue) {
              return true
            }
            return normalizedUserId ? normalizedUserId === normalizedValue : true
          }

          // Fallback to role matching using the prefix
          if (matchRoleLabel(prefix)) {
            return true
          }

          return false
        })

        if (!hasMatch) {
          return false
        }

        return matchesStudentMetadata(notification)
      }

      return Array.from(deduped.values())
        .filter((notification) => matchesAudience(notification))
        .sort((a, b) => {
          const timestampA = Date.parse(a.timestamp ?? a.createdAt ?? "") || 0
          const timestampB = Date.parse(b.timestamp ?? b.createdAt ?? "") || 0
          return timestampB - timestampA
        })
    },
    [
      extractStudentIdsFromMetadata,
      matchRoleLabel,
      normaliseLabel,
      normaliseNotification,
      normalizedRole,
      normalizedStudentIds,
      normalizedUserId,
      toAudienceArray,
    ],
  )

  const loadNotifications = useCallback(
    async (withSpinner = false) => {
      if (withSpinner) {
        setIsLoading(true)
      }

      try {
        const allNotifications = await dbManager.getAllNotifications()
        setNotifications(applyAudienceFilter(allNotifications))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load notifications", error)
      } finally {
        setIsLoading(false)
      }
    },
    [applyAudienceFilter],
  )

  useEffect(() => {
    void loadNotifications(true)
  }, [loadNotifications])

  const ingestRealtimeNotification = useCallback(
    async (payload: unknown) => {
      const normalised = normaliseNotification(payload)

      try {
        await dbManager.saveNotification({
          ...normalised,
          read: false,
        })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to store realtime notification", error)
      }
    },
    [normaliseNotification],
  )

  useEffect(() => {
    if (!resolvedUserId) {
      return () => undefined
    }

    const runtime = resolveBrowserWindow()
    if (!runtime) {
      return () => undefined
    }

    const url = new URL("/api/realtime/stream", runtime.location.origin)
    url.searchParams.set("userId", resolvedUserId)
    if (normalizedRole) {
      url.searchParams.set("role", normalizedRole)
    }

    const eventSource = new EventSource(url.toString())
    eventSourceRef.current = eventSource

    const handleInit = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { notifications?: unknown[] }
        if (Array.isArray(data.notifications)) {
          void Promise.all(data.notifications.map((entry) => ingestRealtimeNotification(entry)))
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to process initial notifications", error)
      }
    }

    const handleNotification = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as unknown
        void ingestRealtimeNotification(data)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to process realtime notification", error)
      }
    }

    eventSource.addEventListener("init", handleInit as EventListener)
    eventSource.addEventListener("notification", handleNotification as EventListener)

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.removeEventListener("init", handleInit as EventListener)
      eventSource.removeEventListener("notification", handleNotification as EventListener)
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [ingestRealtimeNotification, normalizedRole, resolvedUserId])

  useEffect(() => {
    const handleRefresh = () => {
      void loadNotifications(false)
    }

    dbManager.addEventListener("notificationReceived", handleRefresh)
    dbManager.addEventListener("notificationRead", handleRefresh)
    dbManager.addEventListener("notificationDeleted", handleRefresh)

    return () => {
      dbManager.removeEventListener("notificationReceived", handleRefresh)
      dbManager.removeEventListener("notificationRead", handleRefresh)
      dbManager.removeEventListener("notificationDeleted", handleRefresh)
    }
  }, [loadNotifications])

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      setNotifications((previous) => previous.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)))

      try {
        await dbManager.markNotificationAsRead(id)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to mark notification as read", error)
        void loadNotifications(false)
      }
    },
    [loadNotifications],
  )

  const handleMarkAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id)

    if (unreadIds.length === 0) {
      return
    }

    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })))

    try {
      await Promise.all(unreadIds.map((notificationId) => dbManager.markNotificationAsRead(notificationId)))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to mark notifications as read", error)
      void loadNotifications(false)
    }
  }, [loadNotifications, notifications])

  const handleDelete = useCallback(
    async (id: string) => {
      setNotifications((previous) => previous.filter((notification) => notification.id !== id))

      try {
        await dbManager.deleteNotification(id)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to delete notification", error)
        void loadNotifications(false)
      }
    },
    [loadNotifications],
  )

  const resolvedNotifications = useMemo(() => {
    if (showUnreadOnly) {
      return notifications.filter((notification) => !notification.read)
    }
    return notifications
  }, [notifications, showUnreadOnly])

  const getNotificationIcon = (type: string, category: string) => {
    if (category === "payment") return <DollarSign className="h-4 w-4" />
    if (category === "academic") return <BookOpen className="h-4 w-4" />
    if (category === "user") return <User className="h-4 w-4" />
    if (category === "message") return <MessageCircle className="h-4 w-4" />
    if (category === "calendar") return <CalendarClock className="h-4 w-4" />
    if (category === "task") return <ClipboardCheck className="h-4 w-4" />
    if (category === "promotion") return <Megaphone className="h-4 w-4" />

    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4" />
      case "warning":
        return <AlertTriangle className="h-4 w-4" />
      case "error":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-600 bg-green-50 border-green-200"
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "error":
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-blue-600 bg-blue-50 border-blue-200"
    }
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) {
      return "Just now"
    }

    const parsed = new Date(timestamp)

    if (Number.isNaN(parsed.getTime())) {
      return "Just now"
    }

    const now = new Date()
    const diff = now.getTime() - parsed.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <Card className="mr-auto w-full max-w-3xl border-[#2d682d]/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="h-5 w-5 text-[#2d682d]" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <CardTitle className="text-[#2d682d]">Notifications</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              variant="outline"
              size="sm"
              className="border-[#2d682d]/20"
            >
              {showUnreadOnly ? "Show All" : "Unread Only"}
            </Button>
            {unreadCount > 0 && (
              <Button
                onClick={() => {
                  void handleMarkAllAsRead()
                }}
                variant="outline"
                size="sm"
                className="border-[#2d682d]/20 bg-transparent"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {unreadCount > 0 ? `${unreadCount} unread notifications` : "All notifications read"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-8 w-8 mb-3 animate-spin" />
            <p>Loading notifications...</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {resolvedNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications to display</p>
                </div>
              ) : (
                resolvedNotifications.map((notification) => (
                  <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    notification.read ? "bg-gray-50 border-gray-200" : "bg-white border-[#2d682d]/20 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-full ${getNotificationColor(notification.type ?? "info")}`}>
                        {getNotificationIcon(notification.type ?? "info", notification.category ?? "system")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium ${notification.read ? "text-gray-700" : "text-gray-900"}`}>
                            {notification.title}
                          </h4>
                          {!notification.read && <div className="w-2 h-2 bg-[#2d682d] rounded-full"></div>}
                          {notification.actionRequired && (
                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                              Action Required
                            </Badge>
                          )}
                        </div>
                        {notification.message ? (
                          <p className={`text-sm ${notification.read ? "text-gray-500" : "text-gray-600"}`}>
                            {notification.message}
                          </p>
                        ) : null}
                        {notification.actionUrl ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-xs text-[#2d682d]"
                            onClick={() => {
                              const runtime = resolveBrowserWindow()
                              runtime?.open?.(notification.actionUrl ?? "#", "_blank")
                            }}
                          >
                            View details
                          </Button>
                        ) : null}
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {formatTimestamp(notification.timestamp ?? notification.createdAt)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {(notification.category ?? "system").replace(/-/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!notification.read && (
                        <Button
                          onClick={() => {
                            void handleMarkAsRead(notification.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          void handleDelete(notification.id)
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
