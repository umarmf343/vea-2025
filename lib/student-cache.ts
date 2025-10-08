import { collectStudentCandidates } from "./student-passport"

const normalizeToken = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : ""
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      const stringified = String(value)
      return stringified.trim().length > 0 ? stringified.trim() : ""
    }

    return ""
  }

  if (value && typeof value === "object") {
    return normalizeToken((value as { toString?: () => string }).toString?.())
  }

  return ""
}

const normalizeName = (value: unknown): string => {
  const token = normalizeToken(value)
  return token.toLowerCase()
}

const extractAdmissionNumber = (record: Record<string, unknown>): string | null => {
  const candidates = [
    record["admissionNumber"],
    record["admission_number"],
    record["admissionNo"],
    record["admission_no"],
    record["admission"],
  ]

  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

const extractIdTokens = (record: Record<string, unknown>): string[] => {
  const tokens = [
    record["id"],
    record["studentId"],
    record["student_id"],
    record["studentID"],
  ]

  return tokens
    .map((token) => normalizeToken(token))
    .filter((token): token is string => token.length > 0)
}

const extractNameTokens = (record: Record<string, unknown>): string[] => {
  const tokens = [
    record["name"],
    record["studentName"],
    record["fullName"],
  ]

  return tokens
    .map((token) => normalizeName(token))
    .filter((token): token is string => token.length > 0)
}

interface CachedStudentLookupOptions {
  id?: string | null
  admissionNumber?: string | null
  name?: string | null
}

export const findCachedStudentRecord = (
  options: CachedStudentLookupOptions,
): Record<string, unknown> | null => {
  const normalizedId = normalizeToken(options.id)
  const normalizedAdmission = normalizeToken(options.admissionNumber)
  const normalizedName = normalizeName(options.name)

  const candidates = collectStudentCandidates()

  for (const candidate of candidates) {
    const idTokens = extractIdTokens(candidate)
    const nameTokens = extractNameTokens(candidate)
    const admission = extractAdmissionNumber(candidate)

    const matchesId = normalizedId && idTokens.includes(normalizedId)
    const matchesAdmission = normalizedAdmission && admission === normalizedAdmission
    const matchesName = normalizedName && nameTokens.includes(normalizedName)

    if (matchesId || matchesAdmission || matchesName) {
      return candidate
    }
  }

  return null
}

export const resolveCachedAdmissionNumber = (options: CachedStudentLookupOptions): string | null => {
  const record = findCachedStudentRecord(options)
  if (!record) {
    return null
  }

  const admission = extractAdmissionNumber(record)
  return admission && admission.length > 0 ? admission : null
}
