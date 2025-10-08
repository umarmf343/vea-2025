import { logger } from "./logger"

const SUBJECT_NAME_KEYS = ["name", "subject", "subjectName", "title", "label", "text", "value"] as const

const MAX_RECURSION_DEPTH = 3

type SubjectLikeRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is SubjectLikeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function extractFromRecord(record: SubjectLikeRecord, depth: number): string | null {
  for (const key of SUBJECT_NAME_KEYS) {
    const candidate = record[key]
    if (typeof candidate === "string") {
      const trimmed = candidate.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
      continue
    }

    if (isPlainObject(candidate) && depth < MAX_RECURSION_DEPTH) {
      const nested = extractFromRecord(candidate, depth + 1)
      if (nested) {
        return nested
      }
    }
  }

  if (depth < MAX_RECURSION_DEPTH) {
    for (const value of Object.values(record)) {
      if (typeof value === "string") {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
          return trimmed
        }
        continue
      }

      if (isPlainObject(value)) {
        const nested = extractFromRecord(value, depth + 1)
        if (nested) {
          return nested
        }
      }
    }
  }

  return null
}

export function extractSubjectName(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (isPlainObject(entry)) {
    return extractFromRecord(entry, 0)
  }

  return null
}

export function normalizeSubjectList(value: unknown): string[] {
  const seen = new Set<string>()

  const push = (entry: unknown) => {
    const subjectName = extractSubjectName(entry)
    if (subjectName && !seen.has(subjectName)) {
      seen.add(subjectName)
    }
  }

  if (Array.isArray(value)) {
    value.forEach(push)
  } else if (value !== undefined && value !== null) {
    push(value)
  }

  return Array.from(seen)
}

export function logSubjectNormalizationWarning(context: string, value: unknown) {
  if (process.env.NODE_ENV === "development") {
    logger.warn(`Unable to normalize subject entry for ${context}`, { value })
  }
}
