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
          const normalizedTerm = normalizeTermLabel(candidate.term)
          return {
            parentId: candidate.parentId,
            studentId: candidate.studentId,
            term: normalizedTerm,
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

const filterRecordsForPeriod = (records: ReportCardAccessRecord[], term: string, session: string) => {
  const normalizedTerm = normalizeTermLabel(term)
  return records.filter(
    (entry) => entry.term === normalizedTerm && entry.session === session,
  )
}

export const syncReportCardAccess = (term: string, session: string): ReportCardAccessRecord[] => {
  const records = readRecords()
  return filterRecordsForPeriod(records, term, session)
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

  const normalizedTerm = normalizeTermLabel(record.term)
  const currentRecords = readRecords()
  const key = recordKey({ ...record, term: normalizedTerm })
  const withoutExisting = currentRecords.filter((entry) => recordKey(entry) !== key)
  const updatedRecord: ReportCardAccessRecord = {
    parentId: record.parentId,
    studentId: record.studentId,
    term: normalizedTerm,
    session: record.session,
    grantedBy: record.grantedBy,
    grantedAt: new Date().toISOString(),
  }
  const updated = [...withoutExisting, updatedRecord]

  writeRecords(updated)
  return filterRecordsForPeriod(updated, record.term, record.session)
}

export const revokeReportCardAccess = (record: {
  parentId: string
  studentId: string
  term: string
  session: string
}): ReportCardAccessRecord[] => {
  const normalizedTerm = normalizeTermLabel(record.term)
  const currentRecords = readRecords()
  const key = recordKey({ ...record, term: normalizedTerm })
  const updated = currentRecords.filter((entry) => recordKey(entry) !== key)

  if (updated.length !== currentRecords.length) {
    writeRecords(updated)
  }

  return filterRecordsForPeriod(updated, record.term, record.session)
}

export const hasReportCardAccess = (record: {
  parentId: string
  studentId: string
  term: string
  session: string
}): { granted: boolean; record?: ReportCardAccessRecord } => {
  const normalizedTerm = normalizeTermLabel(record.term)
  const records = readRecords()
  const match = records.find(
    (entry) =>
      entry.parentId === record.parentId &&
      entry.studentId === record.studentId &&
      entry.term === normalizedTerm &&
      entry.session === record.session,
  )

  return { granted: Boolean(match), record: match }
}

export const clearReportCardAccess = () => {
  safeStorage.removeItem(STORAGE_KEY)
  emitUpdate([])
}
