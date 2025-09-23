import { dbManager } from "@/lib/database-manager"
import { normalizeTermLabel } from "@/lib/report-card-access"
import { safeStorage } from "@/lib/safe-storage"

export type ReportCardWorkflowStatus = "draft" | "pending" | "approved" | "revoked"

export interface ReportCardWorkflowRecord {
  id: string
  studentId: string
  studentName: string
  className: string
  subject: string
  term: string
  session: string
  teacherId: string
  teacherName: string
  status: ReportCardWorkflowStatus
  submittedAt?: string
  updatedAt: string
  publishedAt?: string
  feedback?: string
  adminId?: string | null
  adminName?: string | null
}

export interface SubmitReportCardPayload {
  teacherId: string
  teacherName: string
  className: string
  subject: string
  term: string
  session: string
  students: Array<{ id: string | number; name: string }>
}

export interface UpdateWorkflowStatusPayload {
  studentId: string
  className: string
  subject: string
  term: string
  session: string
  status: ReportCardWorkflowStatus
  adminId?: string
  adminName?: string
  feedback?: string
}

export interface WorkflowSummary {
  status: ReportCardWorkflowStatus
  message?: string
  submittedDate?: string
}

const STORAGE_KEY = "vea_report_card_workflow"
export const REPORT_CARD_WORKFLOW_EVENT = "vea:report-card-workflow"

const now = () => new Date().toISOString()

const toRecordId = (params: {
  studentId: string
  className: string
  subject: string
  term: string
  session: string
}) =>
  [params.studentId, params.className, params.subject, params.term, params.session]
    .map((segment) => segment.replace(/\s+/g, "_").toLowerCase())
    .join("::")

const emitWorkflowUpdate = (records: ReportCardWorkflowRecord[]) => {
  const scope =
    typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & {
          dispatchEvent?: (event: Event) => boolean
          CustomEvent?: typeof CustomEvent
        })
      : undefined

  if (!scope || typeof scope.dispatchEvent !== "function" || typeof scope.CustomEvent !== "function") {
    return
  }

  const event = new scope.CustomEvent(REPORT_CARD_WORKFLOW_EVENT, { detail: { records } })
  scope.dispatchEvent(event)
}

const readRecords = (): ReportCardWorkflowRecord[] => {
  const raw = safeStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as ReportCardWorkflowRecord[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((entry) => ({
        ...entry,
        term: normalizeTermLabel(entry.term),
        updatedAt: entry.updatedAt ?? now(),
        status: (entry.status as ReportCardWorkflowStatus) ?? "draft",
      }))
      .filter((entry) => entry.studentId && entry.term && entry.session)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse report card workflow records", error)
    return []
  }
}

const writeRecords = (records: ReportCardWorkflowRecord[]) => {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  emitWorkflowUpdate(records)
}

const syncApprovedReports = (records: ReportCardWorkflowRecord[]) => {
  try {
    const approved = records.filter((record) => record.status === "approved")
    const approvalKeys = new Set<string>()
    approved.forEach((record) => {
      approvalKeys.add(String(record.studentId))
      if (record.studentId && !Number.isNaN(Number.parseInt(record.studentId, 10))) {
        approvalKeys.add(String(Number.parseInt(record.studentId, 10)))
      }
      if (record.className) {
        approvalKeys.add(`${record.studentId}::${record.className}`)
      }
    })

    safeStorage.setItem("approvedReports", JSON.stringify(Array.from(approvalKeys)))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to sync approved report cache", error)
  }
}

const saveRecords = (records: ReportCardWorkflowRecord[]) => {
  writeRecords(records)
  syncApprovedReports(records)
}

export const getWorkflowRecords = (): ReportCardWorkflowRecord[] => {
  return readRecords()
}

export const getWorkflowRecordsForPeriod = (term: string, session: string): ReportCardWorkflowRecord[] => {
  const normalizedTerm = normalizeTermLabel(term)
  return readRecords().filter((record) => record.term === normalizedTerm && record.session === session)
}

export const getWorkflowSummary = (
  records: ReportCardWorkflowRecord[],
): WorkflowSummary => {
  if (!records.length) {
    return { status: "draft" }
  }

  const anyPending = records.some((record) => record.status === "pending")
  const anyRevoked = records.find((record) => record.status === "revoked")
  const allApproved = records.every((record) => record.status === "approved")

  if (anyRevoked) {
    return {
      status: "revoked",
      message: anyRevoked.feedback,
      submittedDate: anyRevoked.submittedAt,
    }
  }

  if (anyPending) {
    return { status: "pending", submittedDate: records[0]?.submittedAt }
  }

  if (allApproved) {
    return {
      status: "approved",
      submittedDate: records[0]?.submittedAt,
    }
  }

  return { status: "draft" }
}

const notify = async (
  data: {
    title: string
    message: string
    audience?: string[]
    category?: string
    type?: "info" | "success" | "warning" | "error"
    metadata?: Record<string, unknown>
  },
) => {
  try {
    await dbManager.saveNotification({
      title: data.title,
      message: data.message,
      audience: data.audience ?? ["admin", "super-admin"],
      category: data.category ?? "academic",
      type: data.type ?? "info",
      metadata: data.metadata,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to broadcast notification", error)
  }
}

export const submitReportCardsForApproval = (payload: SubmitReportCardPayload): ReportCardWorkflowRecord[] => {
  const records = readRecords()
  const normalizedTerm = normalizeTermLabel(payload.term)
  const timestamp = now()

  const studentEntries = payload.students.map((student) => {
    const studentId = String(student.id)
    const recordId = toRecordId({
      studentId,
      className: payload.className,
      subject: payload.subject,
      term: normalizedTerm,
      session: payload.session,
    })

    const existing = records.find((entry) => entry.id === recordId)

    return {
      id: recordId,
      studentId,
      studentName: student.name,
      className: payload.className,
      subject: payload.subject,
      term: normalizedTerm,
      session: payload.session,
      teacherId: payload.teacherId,
      teacherName: payload.teacherName,
      status: "pending" as ReportCardWorkflowStatus,
      submittedAt: timestamp,
      updatedAt: timestamp,
      feedback: undefined,
      adminId: existing?.adminId,
      adminName: existing?.adminName,
    }
  })

  const merged = [
    ...records.filter((record) =>
      !(record.className === payload.className &&
        record.subject === payload.subject &&
        record.term === normalizedTerm &&
        record.session === payload.session &&
        record.teacherId === payload.teacherId &&
        studentEntries.some((entry) => entry.id === record.id))),
    ...studentEntries,
  ]

  saveRecords(merged)

  void notify({
    title: "Report cards submitted",
    message: `${payload.teacherName} submitted ${payload.className} ${payload.subject} results for approval`,
    audience: ["admin", "super-admin"],
    metadata: {
      className: payload.className,
      subject: payload.subject,
      term: normalizedTerm,
      session: payload.session,
    },
  })

  return merged
}

export const updateReportCardWorkflowStatus = (
  payload: UpdateWorkflowStatusPayload,
): ReportCardWorkflowRecord[] => {
  const records = readRecords()
  const normalizedTerm = normalizeTermLabel(payload.term)
  const recordId = toRecordId({
    studentId: payload.studentId,
    className: payload.className,
    subject: payload.subject,
    term: normalizedTerm,
    session: payload.session,
  })

  const timestamp = now()

  const updatedRecords = records.map((record) => {
    if (record.id !== recordId) {
      return record
    }

    const nextStatus = payload.status
    const nextRecord: ReportCardWorkflowRecord = {
      ...record,
      status: nextStatus,
      updatedAt: timestamp,
      feedback: payload.feedback,
      adminId: payload.adminId ?? record.adminId ?? null,
      adminName: payload.adminName ?? record.adminName ?? null,
      publishedAt: nextStatus === "approved" ? timestamp : record.publishedAt,
    }

    if (nextStatus !== "revoked") {
      nextRecord.feedback = undefined
    }

    if (nextStatus !== "pending") {
      nextRecord.submittedAt = record.submittedAt ?? timestamp
    }

    return nextRecord
  })

  saveRecords(updatedRecords)

  const affected = updatedRecords.find((record) => record.id === recordId)

  if (affected) {
    if (payload.status === "approved") {
      void notify({
        title: "Report card published",
        message: `${affected.studentName}'s result has been published to parents`,
        audience: ["teacher", "parent"],
        type: "success",
        metadata: {
          studentId: affected.studentId,
          className: affected.className,
          subject: affected.subject,
          term: affected.term,
          session: affected.session,
        },
      })
    } else if (payload.status === "revoked") {
      void notify({
        title: "Report card needs revision",
        message: `${affected.studentName}'s result was returned for correction`,
        audience: ["teacher"],
        type: "warning",
        metadata: {
          studentId: affected.studentId,
          className: affected.className,
          subject: affected.subject,
          term: affected.term,
          session: affected.session,
        },
      })
    }
  }

  return updatedRecords
}

export const resetReportCardSubmission = (params: {
  teacherId: string
  className: string
  subject: string
  term: string
  session: string
}): ReportCardWorkflowRecord[] => {
  const records = readRecords()
  const normalizedTerm = normalizeTermLabel(params.term)

  const filtered = records.filter((record) => {
    const matches =
      record.teacherId === params.teacherId &&
      record.className === params.className &&
      record.subject === params.subject &&
      record.term === normalizedTerm &&
      record.session === params.session

    if (!matches) {
      return true
    }

    return false
  })

  saveRecords(filtered)

  return filtered
}

