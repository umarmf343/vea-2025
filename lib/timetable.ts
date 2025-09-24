export type TimetablePeriodKind = "class" | "break"

export interface TimetablePeriodDefinition {
  id: string
  label: string
  startTime: string
  endTime: string
  kind: TimetablePeriodKind
}

export interface TimetableSlotViewModel {
  id: string
  className?: string
  day: string
  time: string
  startTime: string
  endTime: string
  subject: string
  teacher: string
  location: string | null
}

export interface TimetableNotificationPayload extends TimetableSlotViewModel {}

export const DAY_ORDER: readonly string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function to24HourTime(time: string): string {
  const trimmed = time.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)

  if (!match) {
    return trimmed
  }

  let hour = Number(match[1])
  const minute = match[2]
  const meridiem = match[3]?.toUpperCase()

  if (meridiem === "PM" && hour !== 12) {
    hour += 12
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0
  }

  return `${hour.toString().padStart(2, "0")}:${minute}`
}

export function to12HourTime(time: string): string {
  const [rawHour, rawMinute = "00"] = time.split(":")
  let hour = Number(rawHour)
  const minute = rawMinute.padStart(2, "0")
  const meridiem = hour >= 12 ? "PM" : "AM"
  hour = hour % 12 || 12
  return `${hour}:${minute} ${meridiem}`
}

export function parseTimeRangeLabel(range: string): { start: string; end: string } {
  if (typeof range !== "string" || range.trim().length === 0) {
    return { start: "08:00", end: "08:40" }
  }

  const [rawStart, rawEnd] = range.split("-").map((value) => value.trim())
  return {
    start: to24HourTime(rawStart ?? "08:00"),
    end: to24HourTime(rawEnd ?? "08:40"),
  }
}

export function formatTimeRange(start: string, end: string): string {
  return `${to12HourTime(start)} - ${to12HourTime(end)}`
}

export function normaliseTimeRangeLabel(range: string): string {
  const { start, end } = parseTimeRangeLabel(range)
  return formatTimeRange(start, end)
}

function createDefaultPeriods(): TimetablePeriodDefinition[] {
  const periods: TimetablePeriodDefinition[] = []
  let currentMinutes = 8 * 60 // 8:00 AM

  for (let index = 1; index <= 3; index += 1) {
    const start = minutesToTime(currentMinutes)
    const end = minutesToTime(currentMinutes + 40)
    periods.push({
      id: `period-${index}`,
      label: `Period ${index}`,
      startTime: start,
      endTime: end,
      kind: "class",
    })
    currentMinutes += 40
  }

  const breakStart = minutesToTime(currentMinutes)
  currentMinutes += 10
  const breakEnd = minutesToTime(currentMinutes)

  periods.push({
    id: "break",
    label: "Break",
    startTime: breakStart,
    endTime: breakEnd,
    kind: "break",
  })

  for (let index = 4; index <= 7; index += 1) {
    const start = minutesToTime(currentMinutes)
    const end = minutesToTime(currentMinutes + 40)
    periods.push({
      id: `period-${index}`,
      label: `Period ${index}`,
      startTime: start,
      endTime: end,
      kind: "class",
    })
    currentMinutes += 40
  }

  return periods
}

export const DEFAULT_TIMETABLE_PERIODS: readonly TimetablePeriodDefinition[] = createDefaultPeriods()

export const CLASS_TIMETABLE_PERIODS = DEFAULT_TIMETABLE_PERIODS.filter((period) => period.kind === "class")

export function formatTimetablePeriodRange(period: TimetablePeriodDefinition): string {
  return formatTimeRange(period.startTime, period.endTime)
}

export function mapTimetableRecordToResponse(slot: {
  id: string
  className: string
  day: string
  startTime: string
  endTime: string
  subject: string
  teacher: string
  location?: string | null
}): TimetableSlotViewModel {
  const time = formatTimeRange(slot.startTime, slot.endTime)
  return {
    id: slot.id,
    className: slot.className,
    day: slot.day,
    subject: slot.subject,
    teacher: slot.teacher,
    location: slot.location ?? null,
    startTime: slot.startTime,
    endTime: slot.endTime,
    time,
  }
}

export function normalizeTimetableSlot(slot: unknown): TimetableSlotViewModel | null {
  if (!slot || typeof slot !== "object") {
    return null
  }

  const record = slot as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : String(record.id ?? `slot_${Date.now()}`)
  const day = typeof record.day === "string" ? record.day : "Monday"
  const className = typeof record.className === "string" ? record.className : undefined

  const rawTime =
    typeof record.time === "string"
      ? record.time
      : `${typeof record.startTime === "string" ? record.startTime : "08:00"} - ${
          typeof record.endTime === "string" ? record.endTime : "08:40"
        }`

  const { start, end } = parseTimeRangeLabel(rawTime)
  const subject = typeof record.subject === "string" ? record.subject : ""
  const teacher = typeof record.teacher === "string" ? record.teacher : ""
  const location = typeof record.location === "string" ? record.location : null

  return {
    id,
    day,
    className,
    subject,
    teacher,
    location,
    startTime: start,
    endTime: end,
    time: formatTimeRange(start, end),
  }
}

export function normalizeTimetableCollection(value: unknown): TimetableSlotViewModel[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => normalizeTimetableSlot(entry))
    .filter((slot): slot is TimetableSlotViewModel => slot !== null)
}

export function minutesFromTimeLabel(label: string): number {
  const { start } = parseTimeRangeLabel(label)
  const [hour, minute] = start.split(":").map(Number)
  return hour * 60 + minute
}

