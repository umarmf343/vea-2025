import { safeStorage } from "@/lib/safe-storage"

export type ReportCardAccessSource = "payment" | "manual"

export interface ReportCardAccessRecord {
  parentId: string
  studentId: string
  term: string
  session: string
  grantedBy: ReportCardAccessSource
  grantedAt: string
}

const STORAGE_KEY = "vea_report_card_access"
export const REPORT_CARD_ACCESS_EVENT = "vea:report-card-access-updated"

const TERM_LABELS: Record<string, string> = {
  first: "First Term",
  "first term": "First Term",
  second: "Second Term",
  "second term": "Second Term",
  third: "Third Term",
  "third term": "Third Term",
}

const titleCase = (value: string) =>
  value.replace(/\w\S*/g, (segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())

export function normalizeTermLabel(term?: string | null): string {
  if (!term) {
    return "First Term"
  }

  const lookupKey = term.trim().toLowerCase()
  return TERM_LABELS[lookupKey] ?? titleCase(term.trim())
}

const recordKey = (record: Pick<ReportCardAccessRecord, "parentId" | "studentId" | "term" | "session">) =>
  `${record.parentId}::${record.studentId}::${record.session}::${record.term}`

const readRecords = (): ReportCardAccessRecord[] => {
  const raw = safeStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((entry) => {
        const candidate = entry as Partial<ReportCardAccessRecord>
        if (
          typeof candidate.parentId === "string" &&
          typeof candidate.studentId === "string" &&
          typeof candidate.term === "string" &&
          typeof candidate.session === "string" &&
          (candidate.grantedBy === "manual" || candidate.grantedBy === "payment")
        ) {
          return {
            parentId: candidate.parentId,
            studentId: candidate.studentId,
            term: candidate.term,
            session: candidate.session,
            grantedBy: candidate.grantedBy,
            grantedAt:
              typeof candidate.grantedAt === "string" ? candidate.grantedAt : new Date().toISOString(),
          }
        }
        return null
      })
      .filter((entry): entry is ReportCardAccessRecord => Boolean(entry))
  } catch (error) {
    return []
  }
}

const emitUpdate = (records: ReportCardAccessRecord[]) => {
  const scope =
    typeof globalThis === "undefined"
      ? undefined
      : (globalThis as {
          dispatchEvent?: (event: Event) => boolean
          CustomEvent?: typeof CustomEvent
        })
  if (!scope || typeof scope.dispatchEvent !== "function" || typeof scope.CustomEvent !== "function") {
    return
  }

  const event = new scope.CustomEvent(REPORT_CARD_ACCESS_EVENT, { detail: { records } })
  scope.dispatchEvent(event)
}

const writeRecords = (records: ReportCardAccessRecord[]) => {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  emitUpdate(records)
}

export const syncReportCardAccess = (term: string, session: string): ReportCardAccessRecord[] => {
  const records = readRecords()
  const filtered = records.filter((record) => record.term === term && record.session === session)

  if (filtered.length !== records.length) {
    writeRecords(filtered)
  }

  return filtered
}

export const grantReportCardAccess = (record: {
  parentId: string
  studentId: string
  term: string
  session: string
  grantedBy: ReportCardAccessSource
}): ReportCardAccessRecord[] => {
  if (!record.parentId || !record.studentId || !record.term || !record.session) {
    return syncReportCardAccess(record.term, record.session)
  }

  const current = syncReportCardAccess(record.term, record.session)
  const key = recordKey(record)
  const withoutExisting = current.filter((entry) => recordKey(entry) !== key)
  const updated: ReportCardAccessRecord[] = [
    ...withoutExisting,
    { ...record, grantedAt: new Date().toISOString() },
  ]

  writeRecords(updated)
  return updated
}

export const revokeReportCardAccess = (record: {
  parentId: string
  studentId: string
  term: string
  session: string
}): ReportCardAccessRecord[] => {
  const current = syncReportCardAccess(record.term, record.session)
  const key = recordKey(record)
  const updated = current.filter((entry) => recordKey(entry) !== key)

  if (updated.length !== current.length) {
    writeRecords(updated)
  }

  return updated
}

export const hasReportCardAccess = (record: {
  parentId: string
  studentId: string
  term: string
  session: string
}): { granted: boolean; record?: ReportCardAccessRecord } => {
  const records = syncReportCardAccess(record.term, record.session)
  const match = records.find(
    (entry) => entry.parentId === record.parentId && entry.studentId === record.studentId,
  )

  return { granted: Boolean(match), record: match }
}

export const clearReportCardAccess = () => {
  safeStorage.removeItem(STORAGE_KEY)
  emitUpdate([])
}
