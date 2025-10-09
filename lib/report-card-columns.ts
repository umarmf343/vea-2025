import { deepClone } from "./utils"

export interface ReportCardColumnConfig {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  isRequired: boolean
  order: number
}

export interface ResolvedReportCardColumn {
  config: ReportCardColumnConfig
  occurrence: number
  keyCandidates: string[]
  isExam: boolean
}

export const DEFAULT_REPORT_CARD_COLUMNS: ReportCardColumnConfig[] = [
  { id: "column_ca1", name: "1st Test", type: "test", maxScore: 10, weight: 10, isRequired: true, order: 1 },
  { id: "column_ca2", name: "2nd Test", type: "test", maxScore: 10, weight: 10, isRequired: true, order: 2 },
  {
    id: "column_assignment",
    name: "Note / Assignment",
    type: "assignment",
    maxScore: 20,
    weight: 20,
    isRequired: true,
    order: 3,
  },
  { id: "column_exam", name: "Exam", type: "exam", maxScore: 60, weight: 60, isRequired: true, order: 4 },
]

const sanitizeKey = (value: string) => value.replace(/[^a-z0-9]+/gi, "").toLowerCase()

const toCamelCase = (value: string) =>
  value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment.toLowerCase() : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join("")

const createKeyVariants = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return []
  }

  const normalized = trimmed.toLowerCase()
  const tokens = normalized.split(/[^a-z0-9]+/i).filter(Boolean)
  const slug = tokens.join("-")
  const snake = tokens.join("_")
  const compact = tokens.join("")
  const camel = toCamelCase(trimmed)
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1)

  return Array.from(
    new Set(
      [
        trimmed,
        normalized,
        compact,
        slug,
        snake,
        camel,
        pascal,
        sanitizeKey(trimmed),
        sanitizeKey(normalized),
      ].filter((entry) => entry && entry.length > 0),
    ),
  )
}

export const normalizeColumnType = (value: unknown): string => {
  if (typeof value !== "string") {
    return "custom"
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "test" || normalized === "exam" || normalized === "assignment" || normalized === "project") {
    return normalized
  }

  return "custom"
}

const getColumnWeight = (column: ReportCardColumnConfig): number => {
  if (typeof column.maxScore === "number" && Number.isFinite(column.maxScore) && column.maxScore > 0) {
    return column.maxScore
  }

  if (typeof column.weight === "number" && Number.isFinite(column.weight) && column.weight > 0) {
    return column.weight
  }

  return 0
}

export const getColumnMaximum = (column: ReportCardColumnConfig): number => {
  if (typeof column.maxScore === "number" && Number.isFinite(column.maxScore) && column.maxScore > 0) {
    return column.maxScore
  }

  if (typeof column.weight === "number" && Number.isFinite(column.weight) && column.weight > 0) {
    return column.weight
  }

  return 0
}

const mapColumnToResolved = (
  column: ReportCardColumnConfig,
  occurrence: number,
  keyCandidates: string[],
): ResolvedReportCardColumn => ({
  config: column,
  occurrence,
  keyCandidates,
  isExam: normalizeColumnType(column.type) === "exam",
})

const createTypeSpecificCandidates = (type: string, occurrence: number) => {
  switch (type) {
    case "test":
      return [
        `ca${occurrence}`,
        `ca_${occurrence}`,
        occurrence === 1 ? "ca1" : `ca${occurrence}`,
        occurrence === 2 ? "ca2" : `ca${occurrence}`,
        occurrence === 1 ? "firstca" : `ca${occurrence}`,
        occurrence === 2 ? "secondca" : `ca${occurrence}`,
        occurrence === 1 ? "first_ca" : `ca_${occurrence}`,
        occurrence === 2 ? "second_ca" : `ca_${occurrence}`,
        `test${occurrence}`,
        `test_${occurrence}`,
      ]
    case "assignment":
      return ["assignment", "noteAssignment", "note_assignment", "continuousAssessment", "continuous_assessment", "ca3"]
    case "project":
      return ["project", `project${occurrence}`, `project_${occurrence}`, "projectScore", "project_score"]
    case "exam":
      if (occurrence === 1) {
        return ["exam", "examScore", "exam_score", "finalExam", "final_exam"]
      }
      return [`exam${occurrence}`, `exam_${occurrence}`]
    default:
      return []
  }
}

export const buildResolvedColumns = (columns: ReportCardColumnConfig[]): ResolvedReportCardColumn[] => {
  const normalized = Array.isArray(columns) && columns.length > 0 ? columns : DEFAULT_REPORT_CARD_COLUMNS
  const ordered = [...normalized].sort((a, b) => a.order - b.order)
  const occurrences = new Map<string, number>()

  return ordered.map((column) => {
    const type = normalizeColumnType(column.type)
    const currentCount = occurrences.get(type) ?? 0
    const occurrence = currentCount + 1
    occurrences.set(type, occurrence)

    const baseKeyCandidates = [column.id, column.name]
      .filter((candidate): candidate is string => typeof candidate === "string")
      .flatMap((candidate) => createKeyVariants(candidate))

    const typeSpecific = createTypeSpecificCandidates(type, occurrence)

    const keyCandidates = Array.from(new Set([...baseKeyCandidates, ...typeSpecific]))

    const normalizedColumn: ReportCardColumnConfig = {
      ...column,
      id: column.id || `column_${Math.random().toString(36).slice(2, 10)}`,
      name: column.name || `Column ${occurrence}`,
      type,
      maxScore: getColumnWeight(column),
      weight: getColumnWeight(column),
      order: typeof column.order === "number" ? column.order : occurrence,
    }

    return mapColumnToResolved(normalizedColumn, occurrence, keyCandidates)
  })
}

export const normalizeColumnsFromResponse = (input: unknown): ReportCardColumnConfig[] => {
  if (!Array.isArray(input)) {
    return deepClone(DEFAULT_REPORT_CARD_COLUMNS)
  }

  const normalized = (input as Array<Partial<ReportCardColumnConfig>>).map((column, index) => {
    const id = typeof column.id === "string" && column.id.trim().length > 0 ? column.id : `column_${index + 1}`
    const name = typeof column.name === "string" && column.name.trim().length > 0 ? column.name : `Column ${index + 1}`
    const type = typeof column.type === "string" && column.type.trim().length > 0 ? column.type : "custom"
    const maxScore =
      typeof column.maxScore === "number" && Number.isFinite(column.maxScore) && column.maxScore > 0
        ? column.maxScore
        : typeof column.weight === "number" && Number.isFinite(column.weight) && column.weight > 0
          ? column.weight
          : DEFAULT_REPORT_CARD_COLUMNS[index]?.maxScore ?? 10
    const weight =
      typeof column.weight === "number" && Number.isFinite(column.weight) && column.weight > 0
        ? column.weight
        : maxScore
    const isRequired = typeof column.isRequired === "boolean" ? column.isRequired : true
    const order = typeof column.order === "number" ? column.order : index + 1

    return { id, name, type, maxScore, weight, isRequired, order }
  })

  return normalized.length > 0 ? normalized : deepClone(DEFAULT_REPORT_CARD_COLUMNS)
}

export const clampScoreToColumn = (value: number, column: ReportCardColumnConfig): number => {
  const max = getColumnMaximum(column)
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value < 0) {
    return 0
  }

  if (value > max) {
    return max
  }

  return Math.round(value)
}
