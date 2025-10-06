interface RawValueRecord {
  [key: string]: unknown
}

export type PaymentStatus = "completed" | "pending" | "failed"

export interface AnalyticsPayment {
  id: string
  studentId: string | null
  studentName: string
  parentName: string | null
  parentEmail: string | null
  className: string | null
  amount: number
  status: PaymentStatus
  method: string | null
  paymentType: string | null
  source: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface FeeCollectionEntry {
  month: string
  collected: number
  expected: number
  percentage: number
}

export interface ClassCollectionEntry {
  class: string
  collected: number
  expected: number
  students: number
  percentage: number
}

export interface FinancialSummary {
  totalCollected: number
  collectionRate: number
  studentsPaid: number
  defaultersCount: number
  outstandingAmount: number
  avgCollectionTime: number
  onTimePaymentRate: number
}

export interface FinancialDefaulterEntry {
  id: string
  name: string
  class: string
  term: string
  contact: string
  amount: number
}

export interface FinancialAnalyticsPeriod {
  summary: FinancialSummary
  feeCollection: FeeCollectionEntry[]
  classCollection: ClassCollectionEntry[]
}

export interface FinancialAnalyticsSnapshot {
  generatedAt: string
  periods: Record<string, FinancialAnalyticsPeriod>
  defaulters: FinancialDefaulterEntry[]
}

type NormalisedPeriodKey = "current-term" | "last-term" | "current-session" | "last-session" | "all"

const PERIOD_CONFIG: Record<NormalisedPeriodKey, { startDaysAgo: number | null; endDaysAgo: number | null }>
  = {
    "current-term": { startDaysAgo: 120, endDaysAgo: null },
    "last-term": { startDaysAgo: 240, endDaysAgo: 120 },
    "current-session": { startDaysAgo: 365, endDaysAgo: null },
    "last-session": { startDaysAgo: 730, endDaysAgo: 365 },
    all: { startDaysAgo: null, endDaysAgo: null },
  }

const COMPLETED_STATUSES = new Set(["completed", "paid", "success", "successful"])
const FAILED_STATUSES = new Set(["failed", "declined", "reversed"])

const getString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return null
}

const normaliseStatus = (value: unknown): PaymentStatus => {
  const status = getString(value)?.toLowerCase()

  if (!status) {
    return "pending"
  }

  if (COMPLETED_STATUSES.has(status)) {
    return "completed"
  }

  if (FAILED_STATUSES.has(status)) {
    return "failed"
  }

  if (status === "pending" || status === "in-progress" || status === "processing") {
    return "pending"
  }

  return "pending"
}

const getNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const ensureNumberLike = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return getNumber(value)
}

const ensureDate = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  return null
}

export const normaliseFinancialPeriodKey = (period: string): NormalisedPeriodKey => {
  switch (period) {
    case "current-term":
    case "last-term":
    case "current-session":
    case "last-session":
    case "all":
      return period
    default:
      return "current-term"
  }
}

const subtractDays = (anchor: Date, days: number): Date => {
  const clone = new Date(anchor)
  clone.setDate(clone.getDate() - days)
  return clone
}

const isWithinPeriod = (timestamp: Date, period: NormalisedPeriodKey, now: Date): boolean => {
  const config = PERIOD_CONFIG[period]
  const start = config.startDaysAgo !== null ? subtractDays(now, config.startDaysAgo) : null
  const end = config.endDaysAgo !== null ? subtractDays(now, config.endDaysAgo) : null

  if (start && timestamp < start) {
    return false
  }

  if (end && timestamp >= end) {
    return false
  }

  return true
}

const formatMonthLabel = (date: Date): { key: string; label: string; order: number } => {
  const year = date.getFullYear()
  const monthIndex = date.getMonth() + 1
  const monthKey = String(monthIndex).padStart(2, "0")

  return {
    key: `${year}-${monthKey}`,
    label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    order: year * 12 + (monthIndex - 1),
  }
}

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value < 0) {
    return 0
  }

  if (value > 100) {
    return 100
  }

  return Number(value.toFixed(1))
}

const determineTermLabel = (date: Date): string => {
  const month = date.getMonth()
  if (month <= 3) {
    return "First Term"
  }
  if (month <= 6) {
    return "Second Term"
  }
  if (month <= 9) {
    return "Third Term"
  }
  return "Holiday Session"
}

export const normalisePaymentForAnalytics = (raw: unknown): AnalyticsPayment | null => {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const record = raw as RawValueRecord
  const metadata =
    typeof record.metadata === "object" && record.metadata !== null ? (record.metadata as RawValueRecord) : {}
  const sources: RawValueRecord[] = [record, metadata]

  const pickString = (...keys: string[]): string | null => {
    for (const source of sources) {
      for (const key of keys) {
        const value = getString((source as Record<string, unknown>)[key])
        if (value) {
          return value
        }
      }
    }
    return null
  }

  const pickNumber = (...keys: string[]): number | null => {
    for (const source of sources) {
      for (const key of keys) {
        const rawValue = (source as Record<string, unknown>)[key]
        if (rawValue === undefined || rawValue === null) {
          continue
        }

        if (typeof rawValue === "string" && rawValue.trim().length === 0) {
          continue
        }

        const parsed = getNumber(rawValue)

        if (parsed === 0) {
          if (typeof rawValue === "number") {
            return parsed
          }
          continue
        }

        if (Number.isFinite(parsed)) {
          return parsed
        }
      }
    }

    return null
  }

  const id = pickString("id", "reference") ?? `payment-${Date.now()}`
  const studentId = pickString("studentId", "student_id", "studentID") ?? null
  const studentName =
    pickString("studentName", "student_name", "student") ?? "Unknown Student"
  const parentName = pickString(
    "parentName",
    "parent_name",
    "guardianName",
    "guardian_name",
    "customerName",
    "customer_name",
  )
  const parentEmail = pickString(
    "parentEmail",
    "parent_email",
    "guardianEmail",
    "guardian_email",
    "customerEmail",
    "customer_email",
    "email",
  )
  const className = pickString("className", "class_name", "class", "classroom")
  const status = normaliseStatus(pickString("status") ?? record.status)
  const method = pickString("method", "paymentChannel", "payment_channel")
  const paymentType = pickString("paymentType", "payment_type", "type")
  const source = pickString("source", "channel", "payment_channel")
  const createdAt = ensureDate(
    pickString("createdAt", "created_at", "date", "timestamp") ?? metadata.createdAt ?? metadata.timestamp,
  )
  const updatedAt = ensureDate(
    pickString("updatedAt", "updated_at", "processedAt", "processed_at", "completedAt", "completed_at") ??
      metadata.verifiedAt ??
      metadata.verified_at,
  )
  const amount = pickNumber("amount", "total", "value") ?? getNumber(record.amount)

  return {
    id,
    studentId,
    studentName,
    parentName,
    parentEmail,
    className,
    amount,
    status,
    method,
    paymentType,
    source,
    createdAt,
    updatedAt,
  }
}

const buildFeeCollection = (payments: AnalyticsPayment[]): FeeCollectionEntry[] => {
  const groups = new Map<string, { label: string; collected: number; expected: number; order: number }>()

  payments.forEach((payment) => {
    const timestamp = ensureDate(payment.updatedAt ?? payment.createdAt)
    const resolvedDate = timestamp ? new Date(timestamp) : new Date()
    if (Number.isNaN(resolvedDate.getTime())) {
      return
    }

    const { key, label, order } = formatMonthLabel(resolvedDate)
    if (!groups.has(key)) {
      groups.set(key, { label, collected: 0, expected: 0, order })
    }

    const bucket = groups.get(key)!
    const amount = ensureNumberLike(payment.amount)

    if (payment.status === "completed") {
      bucket.collected += amount
      bucket.expected += amount
    } else if (payment.status === "pending") {
      bucket.expected += amount
    }
  })

  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      month: entry.label,
      collected: Number(entry.collected.toFixed(2)),
      expected: Number(entry.expected.toFixed(2)),
      percentage: entry.expected > 0 ? clampPercentage((entry.collected / entry.expected) * 100) : 0,
    }))
}

const buildClassCollection = (payments: AnalyticsPayment[]): ClassCollectionEntry[] => {
  const groups = new Map<string, { collected: number; expected: number; students: Set<string> }>()

  payments.forEach((payment) => {
    const classKey = payment.className ?? "Unassigned"
    if (!groups.has(classKey)) {
      groups.set(classKey, { collected: 0, expected: 0, students: new Set<string>() })
    }

    const bucket = groups.get(classKey)!
    const amount = ensureNumberLike(payment.amount)

    if (payment.status === "completed") {
      bucket.collected += amount
      bucket.expected += amount
      if (payment.studentId) {
        bucket.students.add(payment.studentId)
      } else if (payment.studentName) {
        bucket.students.add(payment.studentName)
      }
    } else if (payment.status === "pending") {
      bucket.expected += amount
    }
  })

  return Array.from(groups.entries())
    .map(([classKey, bucket]) => ({
      class: classKey,
      collected: Number(bucket.collected.toFixed(2)),
      expected: Number(bucket.expected.toFixed(2)),
      students: bucket.students.size,
      percentage: bucket.expected > 0 ? clampPercentage((bucket.collected / bucket.expected) * 100) : 0,
    }))
    .sort((a, b) => b.collected - a.collected)
}

const calculateSummary = (payments: AnalyticsPayment[]): FinancialSummary => {
  const completed = payments.filter((payment) => payment.status === "completed")
  const outstanding = payments.filter((payment) => payment.status !== "completed")
  const totalCollected = completed.reduce(
    (sum, payment) => sum + ensureNumberLike(payment.amount),
    0,
  )
  const outstandingAmount = outstanding.reduce(
    (sum, payment) => sum + ensureNumberLike(payment.amount),
    0,
  )
  const expected = totalCollected + outstandingAmount
  const studentsPaid = new Set(
    completed.map((payment) => payment.studentId ?? payment.studentName ?? payment.id),
  ).size
  const defaultersCount = new Set(
    outstanding.map((payment) => payment.studentId ?? payment.studentName ?? payment.id),
  ).size

  const collectionRate = expected > 0 ? clampPercentage((totalCollected / expected) * 100) : 0

  const collectionDurations: number[] = []
  const onTimeCompletions: number[] = []

  completed.forEach((payment) => {
    if (!payment.createdAt || !payment.updatedAt) {
      return
    }

    const created = new Date(payment.createdAt)
    const updated = new Date(payment.updatedAt)
    if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) {
      return
    }

    const diffMs = Math.max(0, updated.getTime() - created.getTime())
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    collectionDurations.push(diffDays)
    onTimeCompletions.push(diffDays <= 14 ? 1 : 0)
  })

  const avgCollectionTime = collectionDurations.length
    ? Number((collectionDurations.reduce((sum, value) => sum + value, 0) / collectionDurations.length).toFixed(1))
    : 0
  const onTimePaymentRate = collectionDurations.length
    ? clampPercentage(
        (onTimeCompletions.reduce((sum, value) => sum + value, 0) / collectionDurations.length) * 100,
      )
    : 0

  return {
    totalCollected: Number(totalCollected.toFixed(2)),
    collectionRate,
    studentsPaid,
    defaultersCount,
    outstandingAmount: Number(outstandingAmount.toFixed(2)),
    avgCollectionTime,
    onTimePaymentRate,
  }
}

const buildDefaulters = (payments: AnalyticsPayment[]): FinancialDefaulterEntry[] => {
  const defaulterMap = new Map<string, FinancialDefaulterEntry & { amount: number }>()

  payments.forEach((payment) => {
    if (payment.status === "completed") {
      return
    }

    const key = payment.studentId ?? payment.studentName ?? payment.id
    if (!defaulterMap.has(key)) {
      const timestamp = ensureDate(payment.updatedAt ?? payment.createdAt)
      const resolvedDate = timestamp ? new Date(timestamp) : new Date()
      defaulterMap.set(key, {
        id: key,
        name: payment.studentName,
        class: payment.className ?? "Unassigned",
        term: determineTermLabel(resolvedDate),
        contact: payment.parentEmail ?? payment.parentName ?? "Contact unavailable",
        amount: 0,
      })
    }

    const entry = defaulterMap.get(key)!
    entry.amount += ensureNumberLike(payment.amount)
  })

  return Array.from(defaulterMap.values())
    .map((entry) => {
      const normalisedAmount = ensureNumberLike(entry.amount)
      return { ...entry, amount: Number(normalisedAmount.toFixed(2)) }
    })
    .sort((a, b) => b.amount - a.amount)
}

const filterPaymentsByPeriod = (
  payments: AnalyticsPayment[],
  period: NormalisedPeriodKey,
  now: Date,
): AnalyticsPayment[] => {
  if (period === "all") {
    return payments
  }

  return payments.filter((payment) => {
    const timestamp = ensureDate(payment.updatedAt ?? payment.createdAt)
    const resolvedDate = timestamp ? new Date(timestamp) : null
    if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {
      return false
    }

    return isWithinPeriod(resolvedDate, period, now)
  })
}

export const calculateFinancialAnalytics = (payments: AnalyticsPayment[]): FinancialAnalyticsSnapshot => {
  const now = new Date()
  const snapshot: FinancialAnalyticsSnapshot = {
    generatedAt: now.toISOString(),
    periods: {},
    defaulters: buildDefaulters(payments),
  }

  const periodKeys = Object.keys(PERIOD_CONFIG) as NormalisedPeriodKey[]
  periodKeys.forEach((key) => {
    const filtered = filterPaymentsByPeriod(payments, key, now)
    snapshot.periods[key] = {
      summary: calculateSummary(filtered),
      feeCollection: buildFeeCollection(filtered),
      classCollection: buildClassCollection(filtered),
    }
  })

  return snapshot
}

