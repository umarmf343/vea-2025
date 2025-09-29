import { safeStorage } from "./safe-storage"

export type AssignmentReminderAudience = "teacher" | "student"
export type AssignmentReminderType = "dueSoon" | "overdue" | "gradingPending" | "missingSubmissions"

interface AssignmentReminderEntry {
  timestamp: string
  dueDate?: string | null
}

interface AssignmentReminderLog {
  teacher: Record<string, Partial<Record<AssignmentReminderType, AssignmentReminderEntry>>>
  student: Record<string, Partial<Record<AssignmentReminderType, AssignmentReminderEntry>>>
}

const STORAGE_KEY = "assignmentReminderLog"

const createDefaultLog = (): AssignmentReminderLog => ({ teacher: {}, student: {} })

const readReminderLog = (): AssignmentReminderLog => {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDefaultLog()
    }

    const parsed = JSON.parse(raw) as AssignmentReminderLog
    return {
      teacher: parsed.teacher ?? {},
      student: parsed.student ?? {},
    }
  } catch (error) {
    console.error("Unable to parse assignment reminder log", error)
    return createDefaultLog()
  }
}

const writeReminderLog = (log: AssignmentReminderLog) => {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(log))
}

export const shouldSendAssignmentReminder = (
  audience: AssignmentReminderAudience,
  assignmentId: string,
  type: AssignmentReminderType,
  options: { dueDate?: string | null } = {},
): boolean => {
  if (!assignmentId) {
    return false
  }

  const log = readReminderLog()
  const assignmentLog = log[audience][assignmentId]?.[type]

  if (!assignmentLog) {
    return true
  }

  if (options.dueDate && assignmentLog.dueDate && assignmentLog.dueDate !== options.dueDate) {
    return true
  }

  return false
}

export const markAssignmentReminderSent = (
  audience: AssignmentReminderAudience,
  assignmentId: string,
  type: AssignmentReminderType,
  options: { dueDate?: string | null } = {},
) => {
  if (!assignmentId) {
    return
  }

  const log = readReminderLog()
  const assignmentEntries = log[audience][assignmentId] ?? {}
  assignmentEntries[type] = {
    timestamp: new Date().toISOString(),
    dueDate: options.dueDate ?? null,
  }

  log[audience][assignmentId] = assignmentEntries
  writeReminderLog(log)
}

export const clearAssignmentReminderHistory = (
  audience: AssignmentReminderAudience,
  assignmentId: string,
  options: { types?: AssignmentReminderType[] } = {},
) => {
  if (!assignmentId) {
    return
  }

  const log = readReminderLog()
  const assignmentEntries = log[audience][assignmentId]

  if (!assignmentEntries) {
    return
  }

  if (options.types && options.types.length > 0) {
    options.types.forEach((type) => {
      if (assignmentEntries[type]) {
        delete assignmentEntries[type]
      }
    })

    if (Object.keys(assignmentEntries).length === 0) {
      delete log[audience][assignmentId]
    }
  } else {
    delete log[audience][assignmentId]
  }

  writeReminderLog(log)
}
