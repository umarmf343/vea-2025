import { dbManager } from "@/lib/database-manager"
import { logger } from "@/lib/logger"
import { safeStorage } from "@/lib/safe-storage"

export type CalendarStatus = "draft" | "pending_approval" | "approved" | "published"

export type CalendarCategory = "academic" | "holiday" | "event" | "meeting" | "examination"

export type CalendarAudience = "all" | "students" | "parents" | "teachers"

export interface SchoolCalendarEvent {
  id: string
  title: string
  description: string
  startDate: string
  endDate?: string | null
  category: CalendarCategory
  audience: CalendarAudience
  location?: string | null
  isFullDay: boolean
  createdAt: string
  updatedAt: string
}

export interface SchoolCalendarRecord {
  id: string
  title: string
  term: string
  session: string
  status: CalendarStatus
  events: SchoolCalendarEvent[]
  createdAt: string
  lastUpdated: string
  submittedForApprovalAt?: string
  approvedAt?: string
  approvedBy?: string
  publishedAt?: string
  approvalNotes?: string
  requiresRepublish?: boolean
  version: number
}

const STORAGE_KEY = "vea_school_calendar"
const CALENDAR_ID_PREFIX = "cal"
const EVENT_ID_PREFIX = "cal_evt"

const VALID_STATUSES: CalendarStatus[] = ["draft", "pending_approval", "approved", "published"]
const VALID_CATEGORIES: CalendarCategory[] = ["academic", "holiday", "event", "meeting", "examination"]
const VALID_AUDIENCES: CalendarAudience[] = ["all", "students", "parents", "teachers"]

const now = () => new Date().toISOString()

const toDateOnly = (value: string) => {
  try {
    return new Date(value).toISOString().split("T")[0]
  } catch (error) {
    return value
  }
}

const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

const cloneCalendar = (calendar: SchoolCalendarRecord): SchoolCalendarRecord =>
  JSON.parse(JSON.stringify(calendar)) as SchoolCalendarRecord

const normalizeEvent = (event: Partial<SchoolCalendarEvent>): SchoolCalendarEvent => {
  const createdAt = typeof event.createdAt === "string" ? event.createdAt : now()
  const updatedAt = typeof event.updatedAt === "string" ? event.updatedAt : createdAt

  const startDate = typeof event.startDate === "string" && event.startDate ? toDateOnly(event.startDate) : toDateOnly(now())
  const endDate = typeof event.endDate === "string" && event.endDate ? toDateOnly(event.endDate) : undefined

  const category = VALID_CATEGORIES.includes((event.category as CalendarCategory) ?? "" as CalendarCategory)
    ? (event.category as CalendarCategory)
    : "academic"

  const audience = VALID_AUDIENCES.includes((event.audience as CalendarAudience) ?? "" as CalendarAudience)
    ? (event.audience as CalendarAudience)
    : "all"

  return {
    id: typeof event.id === "string" && event.id ? event.id : generateId(EVENT_ID_PREFIX),
    title: typeof event.title === "string" && event.title.trim() ? event.title.trim() : "School Activity",
    description:
      typeof event.description === "string" && event.description.trim()
        ? event.description.trim()
        : "Scheduled school programme",
    startDate,
    endDate,
    category,
    audience,
    location: typeof event.location === "string" && event.location.trim() ? event.location.trim() : null,
    isFullDay: Boolean(event.isFullDay ?? true),
    createdAt,
    updatedAt,
  }
}

const normalizeCalendar = (raw: unknown): SchoolCalendarRecord => {
  if (!raw || typeof raw !== "object") {
    return createDefaultCalendar()
  }

  try {
    const data = raw as Partial<SchoolCalendarRecord>
    const createdAt = typeof data.createdAt === "string" ? data.createdAt : now()
    const lastUpdated = typeof data.lastUpdated === "string" ? data.lastUpdated : createdAt

    const status = VALID_STATUSES.includes((data.status as CalendarStatus) ?? "" as CalendarStatus)
      ? (data.status as CalendarStatus)
      : "draft"

    const events = Array.isArray((data as Record<string, unknown>).events)
      ? ((data as Record<string, unknown>).events as Partial<SchoolCalendarEvent>[]).map(normalizeEvent)
      : []

    events.sort((a, b) => a.startDate.localeCompare(b.startDate))

    return {
      id: typeof data.id === "string" && data.id ? data.id : generateId(CALENDAR_ID_PREFIX),
      title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "School Calendar",
      term: typeof data.term === "string" && data.term.trim() ? data.term.trim() : "First Term",
      session: typeof data.session === "string" && data.session.trim() ? data.session.trim() : "2024/2025",
      status,
      events,
      createdAt,
      lastUpdated,
      submittedForApprovalAt:
        typeof data.submittedForApprovalAt === "string" ? data.submittedForApprovalAt : undefined,
      approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : undefined,
      approvedBy: typeof data.approvedBy === "string" && data.approvedBy ? data.approvedBy : undefined,
      publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : undefined,
      approvalNotes: typeof data.approvalNotes === "string" && data.approvalNotes ? data.approvalNotes : undefined,
      requiresRepublish: Boolean(data.requiresRepublish),
      version: typeof data.version === "number" && Number.isFinite(data.version) ? data.version : 1,
    }
  } catch (error) {
    logger.error("Failed to normalize school calendar", { error })
    return createDefaultCalendar()
  }
}

const createDefaultCalendar = (): SchoolCalendarRecord => {
  const timestamp = now()
  const sessionYear = new Date().getFullYear()
  const events: SchoolCalendarEvent[] = [
    {
      id: generateId(EVENT_ID_PREFIX),
      title: "Resumption & Orientation Week",
      description: "Students return to campus with orientation for new parents and learners.",
      startDate: `${sessionYear}-09-09`,
      endDate: `${sessionYear}-09-13`,
      category: "academic",
      audience: "all",
      location: "Main Assembly Hall",
      isFullDay: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: generateId(EVENT_ID_PREFIX),
      title: "Independence Day Cultural Exhibition",
      description: "Colourful showcase featuring cultural dances, debates, and exhibitions.",
      startDate: `${sessionYear}-10-01`,
      endDate: `${sessionYear}-10-01`,
      category: "event",
      audience: "parents",
      location: "Victory Events Arena",
      isFullDay: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: generateId(EVENT_ID_PREFIX),
      title: "First Term Examination Week",
      description: "Formal assessment for all classes with daily invigilation roster.",
      startDate: `${sessionYear}-11-25`,
      endDate: `${sessionYear}-11-29`,
      category: "examination",
      audience: "students",
      location: "All Classrooms",
      isFullDay: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]

  return {
    id: generateId(CALENDAR_ID_PREFIX),
    title: "2024/2025 First Term Calendar",
    term: "First Term",
    session: `${sessionYear}/${sessionYear + 1}`,
    status: "draft",
    events,
    createdAt: timestamp,
    lastUpdated: timestamp,
    version: 1,
    requiresRepublish: false,
  }
}

const persistCalendar = (calendar: SchoolCalendarRecord) => {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(calendar))
  dbManager.emit("schoolCalendarUpdated", calendar)
}

export const getSchoolCalendar = (): SchoolCalendarRecord => {
  const raw = safeStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = createDefaultCalendar()
    persistCalendar(seeded)
    return seeded
  }

  try {
    const parsed = JSON.parse(raw) as SchoolCalendarRecord
    return normalizeCalendar(parsed)
  } catch (error) {
    logger.error("Failed to parse stored school calendar", { error })
    const fallback = createDefaultCalendar()
    persistCalendar(fallback)
    return fallback
  }
}

export const subscribeToSchoolCalendar = (
  listener: (calendar: SchoolCalendarRecord) => void,
): (() => void) => {
  const handler = (data?: SchoolCalendarRecord) => {
    try {
      const calendar = data ? normalizeCalendar(data) : getSchoolCalendar()
      listener(calendar)
    } catch (error) {
      logger.error("Error handling school calendar subscription", { error })
    }
  }

  dbManager.on("schoolCalendarUpdated", handler)

  return () => {
    dbManager.off("schoolCalendarUpdated", handler)
  }
}

export const updateSchoolCalendar = (
  updater: (calendar: SchoolCalendarRecord) => SchoolCalendarRecord,
): SchoolCalendarRecord => {
  const current = getSchoolCalendar()
  const draft = cloneCalendar(current)
  const updated = normalizeCalendar(updater(draft))
  persistCalendar(updated)
  return updated
}

const markCalendarDirty = (calendar: SchoolCalendarRecord): SchoolCalendarRecord => {
  const next = cloneCalendar(calendar)
  next.lastUpdated = now()
  next.version = (next.version ?? 1) + 1
  next.approvalNotes = undefined

  if (calendar.status === "published") {
    next.status = "draft"
    next.requiresRepublish = true
    next.submittedForApprovalAt = undefined
    next.approvedAt = undefined
    next.approvedBy = undefined
    next.publishedAt = undefined
  } else if (calendar.status === "approved" || calendar.status === "pending_approval") {
    next.status = "draft"
    next.submittedForApprovalAt = undefined
    next.approvedAt = undefined
    next.approvedBy = undefined
  }

  if (typeof next.requiresRepublish !== "boolean") {
    next.requiresRepublish = false
  }

  return next
}

export interface CalendarEventInput {
  id?: string
  title: string
  description: string
  startDate: string
  endDate?: string | null
  category: CalendarCategory
  audience: CalendarAudience
  location?: string | null
  isFullDay?: boolean
}

export const upsertCalendarEvent = (payload: CalendarEventInput): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    const next = markCalendarDirty(calendar)
    const existingIndex = next.events.findIndex((event) => event.id === payload.id)
    const normalized = normalizeEvent({ ...payload, updatedAt: now(), createdAt: payload.id ? undefined : now() })

    if (existingIndex >= 0) {
      next.events.splice(existingIndex, 1, { ...next.events[existingIndex], ...normalized, id: next.events[existingIndex].id })
    } else {
      next.events.push({ ...normalized, id: normalized.id ?? generateId(EVENT_ID_PREFIX) })
    }

    next.events.sort((a, b) => a.startDate.localeCompare(b.startDate))
    return next
  })
}

export const removeCalendarEvent = (eventId: string): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    const next = markCalendarDirty(calendar)
    next.events = next.events.filter((event) => event.id !== eventId)
    return next
  })
}

export const setCalendarDetails = (details: Partial<Pick<SchoolCalendarRecord, "title" | "term" | "session">>) => {
  return updateSchoolCalendar((calendar) => {
    const nextTitle = details.title && details.title.trim() ? details.title.trim() : calendar.title
    const nextTerm = details.term && details.term.trim() ? details.term.trim() : calendar.term
    const nextSession = details.session && details.session.trim() ? details.session.trim() : calendar.session

    if (nextTitle === calendar.title && nextTerm === calendar.term && nextSession === calendar.session) {
      return calendar
    }

    const next = markCalendarDirty(calendar)
    next.title = nextTitle
    next.term = nextTerm
    next.session = nextSession
    return next
  })
}

export const submitCalendarForApproval = (note?: string): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    if (!calendar.events.length) {
      return calendar
    }

    const next = cloneCalendar(calendar)
    next.status = "pending_approval"
    next.submittedForApprovalAt = now()
    next.approvalNotes = note?.trim() ? note.trim() : undefined
    next.lastUpdated = now()
    next.version = (next.version ?? 1) + 1
    return next
  })
}

export const approveSchoolCalendar = (params: { approvedBy: string; note?: string }): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    const next = cloneCalendar(calendar)
    next.status = "approved"
    next.approvedAt = now()
    next.approvedBy = params.approvedBy
    next.approvalNotes = params.note?.trim() ? params.note.trim() : undefined
    next.requiresRepublish = Boolean(next.requiresRepublish && next.status === "approved")
    next.lastUpdated = now()
    next.version = (next.version ?? 1) + 1
    return next
  })
}

export const requestCalendarChanges = (note: string): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    const next = cloneCalendar(calendar)
    next.status = "draft"
    next.approvalNotes = note.trim()
    next.submittedForApprovalAt = undefined
    next.approvedAt = undefined
    next.approvedBy = undefined
    next.publishedAt = undefined
    next.requiresRepublish = true
    next.lastUpdated = now()
    next.version = (next.version ?? 1) + 1
    return next
  })
}

export const publishSchoolCalendar = (): SchoolCalendarRecord => {
  return updateSchoolCalendar((calendar) => {
    if (calendar.status !== "approved") {
      return calendar
    }

    const next = cloneCalendar(calendar)
    next.status = "published"
    next.publishedAt = now()
    next.requiresRepublish = false
    next.lastUpdated = now()
    next.version = (next.version ?? 1) + 1
    return next
  })
}

export const resetCalendar = (): SchoolCalendarRecord => {
  const seeded = createDefaultCalendar()
  persistCalendar(seeded)
  return seeded
}

