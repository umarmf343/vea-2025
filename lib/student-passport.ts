import { safeStorage } from "./safe-storage"
import { logger } from "./logger"

interface StudentIdentifiers {
  id?: string | null
  admissionNumber?: string | null
  name?: string | null
}

const normalizeTrimmedString = (value: unknown): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    const trimmed = String(value).trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return null
}

const normalizeComparisonToken = (value: unknown): string | null => {
  const trimmed = normalizeTrimmedString(value)
  return trimmed ? trimmed.replace(/\s+/g, "").toLowerCase() : null
}

const normalizeNameToken = (value: unknown): string | null => {
  const trimmed = normalizeTrimmedString(value)
  return trimmed ? trimmed.toLowerCase() : null
}

const extractStudentFromMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const container = metadata as Record<string, unknown>
  const candidate =
    container.enhancedReportCard ??
    container.enhancedReport ??
    container.rawReportCard ??
    container.reportCard ??
    container.preview ??
    null

  if (candidate && typeof candidate === "object") {
    const candidateRecord = candidate as Record<string, unknown>
    const student = candidateRecord.student
    if (student && typeof student === "object") {
      return student as Record<string, unknown>
    }
  }

  return null
}

const parseStudentsCache = (): Record<string, unknown>[] => {
  const raw = safeStorage.getItem("students")
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
  } catch (error) {
    logger.warn("Unable to parse cached students for passport lookup", { error })
    return []
  }
}

const parseReportCardStudents = (): Record<string, unknown>[] => {
  const raw = safeStorage.getItem("reportCards")
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const results: Record<string, unknown>[] = []

    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return
      }

      const record = entry as Record<string, unknown>
      const metadataStudent = extractStudentFromMetadata(record.metadata)

      if (metadataStudent) {
        results.push({
          ...metadataStudent,
          id: metadataStudent["id"] ?? record["studentId"],
          admissionNumber: metadataStudent["admissionNumber"] ?? record["studentId"],
          name: metadataStudent["name"] ?? record["studentName"],
        })
      }

      results.push({
        id: record["studentId"],
        admissionNumber: record["studentId"],
        name: record["studentName"],
        passportUrl: record["passportUrl"],
        photoUrl: record["photoUrl"],
      })
    })

    return results
  } catch (error) {
    logger.warn("Unable to parse cached report cards for passport lookup", { error })
    return []
  }
}

export const collectStudentCandidates = (): Record<string, unknown>[] => {
  return [...parseStudentsCache(), ...parseReportCardStudents()]
}

const extractPassportFromRecord = (record: Record<string, unknown>): string | null => {
  return (
    normalizeTrimmedString(record["passportUrl"]) ??
    normalizeTrimmedString(record["photoUrl"]) ??
    normalizeTrimmedString(record["imageUrl"]) ??
    normalizeTrimmedString(record["avatarUrl"])
  )
}

const extractPhotoFromRecord = (record: Record<string, unknown>): string | null => {
  return (
    normalizeTrimmedString(record["photoUrl"]) ??
    normalizeTrimmedString(record["passportUrl"]) ??
    normalizeTrimmedString(record["imageUrl"]) ??
    normalizeTrimmedString(record["avatarUrl"])
  )
}

export const resolveStudentPassportFromCache = (
  identifiers: StudentIdentifiers,
  fallback?: Record<string, unknown> | null,
): { passportUrl: string | null; photoUrl: string | null } => {
  const normalizedId = normalizeComparisonToken(identifiers.id)
  const normalizedAdmission = normalizeComparisonToken(identifiers.admissionNumber)
  const normalizedName = normalizeNameToken(identifiers.name)

  let resolvedPassport: string | null = null
  let resolvedPhoto: string | null = null

  if (fallback && typeof fallback === "object") {
    resolvedPassport = extractPassportFromRecord(fallback)
    resolvedPhoto = extractPhotoFromRecord(fallback)
  }

  const candidates = collectStudentCandidates()

  for (const candidate of candidates) {
    const candidateId = normalizeComparisonToken(candidate["id"] ?? candidate["studentId"])
    const candidateAdmission = normalizeComparisonToken(
      candidate["admissionNumber"] ?? candidate["admission"] ?? candidate["admissionNo"],
    )
    const candidateName = normalizeNameToken(candidate["name"] ?? candidate["studentName"])

    const matches =
      (normalizedId && candidateId === normalizedId) ||
      (normalizedAdmission && candidateAdmission === normalizedAdmission) ||
      (normalizedName && candidateName === normalizedName)

    if (!matches) {
      continue
    }

    if (!resolvedPassport) {
      resolvedPassport = extractPassportFromRecord(candidate)
    }

    if (!resolvedPhoto) {
      resolvedPhoto = extractPhotoFromRecord(candidate)
    }

    if (resolvedPassport && resolvedPhoto) {
      break
    }
  }

  return {
    passportUrl: resolvedPassport ?? null,
    photoUrl: resolvedPhoto ?? resolvedPassport ?? null,
  }
}
