import { deepClone } from "./utils"

export interface ReportCardLayoutFieldConfig {
  id: string
  label: string
  enabled: boolean
}

export interface ReportCardLayoutSectionConfig {
  id: string
  title: string
  description?: string
  enabled: boolean
  fields: ReportCardLayoutFieldConfig[]
}

export interface ReportCardBehavioralItemConfig {
  id: string
  label: string
  enabled: boolean
}

export interface ReportCardDefaultRemarksConfig {
  classTeacher: string
  headTeacher: string
}

export interface ReportCardLayoutConfig {
  sections: ReportCardLayoutSectionConfig[]
  affectiveTraits: ReportCardBehavioralItemConfig[]
  psychomotorSkills: ReportCardBehavioralItemConfig[]
  defaultRemarks: ReportCardDefaultRemarksConfig
}

type IdGenerator = (prefix: string) => string

const ensureId = (value: unknown, prefix: string, used: Set<string>, generate?: IdGenerator) => {
  const fallbackGenerator: IdGenerator = (localPrefix: string) =>
    `${localPrefix}_${Math.random().toString(36).slice(2, 10)}`

  const raw = typeof value === "string" ? value.trim() : ""
  let id = raw.length > 0 ? raw : (generate ?? fallbackGenerator)(prefix)

  while (used.has(id)) {
    id = `${id}_${Math.random().toString(36).slice(2, 6)}`
  }

  used.add(id)
  return id
}

const sanitizeLabel = (value: unknown, fallback: string) => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }

  return fallback
}

const sanitizeOptional = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  return undefined
}

const sanitizeBoolean = (value: unknown, fallback = true) =>
  typeof value === "boolean" ? value : fallback

const DEFAULT_SECTIONS: ReportCardLayoutSectionConfig[] = [
  {
    id: "student_overview",
    title: "Student Overview",
    description: "Student bio data and academic summary details.",
    enabled: true,
    fields: [
      { id: "student_name", label: "NAME OF STUDENT:", enabled: true },
      { id: "admission_number", label: "ADMISSION NUMBER:", enabled: true },
      { id: "class_name", label: "CLASS:", enabled: true },
      { id: "number_in_class", label: "NUMBER IN CLASS:", enabled: true },
      { id: "term", label: "TERM:", enabled: true },
      { id: "session", label: "SESSION:", enabled: true },
      { id: "grade", label: "GRADE:", enabled: true },
      { id: "total_obtainable", label: "TOTAL MARKS OBTAINABLE:", enabled: true },
      { id: "total_obtained", label: "TOTAL MARKS OBTAINED:", enabled: true },
      { id: "average", label: "AVERAGE:", enabled: true },
      { id: "position", label: "POSITION:", enabled: true },
    ],
  },
  {
    id: "remarks",
    title: "Remarks",
    description: "Teacher and head remarks.",
    enabled: true,
    fields: [
      { id: "class_teacher_remark", label: "Class Teacher Remarks", enabled: true },
      { id: "head_teacher_remark", label: "Head Teacher's Remark", enabled: true },
    ],
  },
  {
    id: "behavioral_psychomotor",
    title: "Psychomotor Domain",
    description: "Skills and competencies demonstrated by the student.",
    enabled: true,
    fields: [{ id: "psychomotor_heading", label: "PSYCHOMOTOR DOMAIN", enabled: true }],
  },
  {
    id: "behavioral_affective",
    title: "Affective Domain",
    description: "Character traits demonstrated by the student.",
    enabled: true,
    fields: [{ id: "affective_heading", label: "AFFECTIVE DOMAIN", enabled: true }],
  },
  {
    id: "term_dates",
    title: "Term Dates",
    description: "Important academic calendar dates.",
    enabled: true,
    fields: [
      { id: "vacation_date", label: "Vacation Date", enabled: true },
      { id: "resumption_date", label: "Resumption Date", enabled: true },
    ],
  },
  {
    id: "signatures",
    title: "Signatures",
    description: "Areas for teacher and head signatures.",
    enabled: true,
    fields: [
      { id: "teacher_signature_label", label: "Teacher's Signature:", enabled: true },
      { id: "head_signature_label", label: "Headmaster's Signature:", enabled: true },
      { id: "head_name_label", label: "", enabled: true },
    ],
  },
  {
    id: "grading_key",
    title: "Grading Key",
    description: "Legend for interpreting student grades.",
    enabled: true,
    fields: [
      {
        id: "grading_legend",
        label: "75–100 A (Excellent) | 60–74 B (V.Good) | 50–59 C (Good) | 40–49 D (Fair) | 30–39 E (Poor) | 0–29 F (FAIL)",
        enabled: true,
      },
    ],
  },
]

const DEFAULT_AFFECTIVE_TRAITS: ReportCardBehavioralItemConfig[] = [
  { id: "neatness", label: "Neatness", enabled: true },
  { id: "honesty", label: "Honesty", enabled: true },
  { id: "punctuality", label: "Punctuality", enabled: true },
  { id: "attentiveness", label: "Attentiveness", enabled: true },
  { id: "teamwork", label: "Team Work", enabled: true },
]

const DEFAULT_PSYCHOMOTOR_SKILLS: ReportCardBehavioralItemConfig[] = [
  { id: "sport", label: "Sport", enabled: true },
  { id: "handwriting", label: "Handwriting", enabled: true },
  { id: "art_craft", label: "Art & Craft", enabled: true },
]

export const DEFAULT_REPORT_CARD_LAYOUT_CONFIG: ReportCardLayoutConfig = {
  sections: deepClone(DEFAULT_SECTIONS),
  affectiveTraits: deepClone(DEFAULT_AFFECTIVE_TRAITS),
  psychomotorSkills: deepClone(DEFAULT_PSYCHOMOTOR_SKILLS),
  defaultRemarks: {
    classTeacher: "Keep up the good work and continue to strive for excellence.",
    headTeacher: "Impressive performance. Maintain this momentum next term.",
  },
}

const mergeFields = (
  defaults: ReportCardLayoutFieldConfig[],
  incoming: ReportCardLayoutFieldConfig[] | undefined,
  usedFieldIds: Set<string>,
  generate?: IdGenerator,
): ReportCardLayoutFieldConfig[] => {
  const incomingMap = new Map<string, ReportCardLayoutFieldConfig>()
  incoming?.forEach((field) => {
    const id = typeof field.id === "string" ? field.id : ""
    if (id) {
      incomingMap.set(id, field)
    }
  })

  const merged: ReportCardLayoutFieldConfig[] = defaults.map((field) => {
    const override = field.id ? incomingMap.get(field.id) : undefined
    const id = ensureId(override?.id ?? field.id, "field", usedFieldIds, generate)

    return {
      id,
      label: sanitizeLabel(override?.label ?? field.label, field.label),
      enabled: sanitizeBoolean(override?.enabled, field.enabled),
    }
  })

  incoming?.forEach((field) => {
    if (!field || typeof field !== "object") {
      return
    }

    const candidateId = typeof field.id === "string" ? field.id : ""
    if (candidateId && merged.some((existing) => existing.id === candidateId)) {
      return
    }

    const id = ensureId(candidateId, "field", usedFieldIds, generate)
    merged.push({
      id,
      label: sanitizeLabel(field.label, field.label ?? "New Field"),
      enabled: sanitizeBoolean(field.enabled, true),
    })
  })

  return merged
}

const mergeSections = (
  defaults: ReportCardLayoutSectionConfig[],
  incoming: ReportCardLayoutSectionConfig[] | undefined,
  usedIds: Set<string>,
  generate?: IdGenerator,
): ReportCardLayoutSectionConfig[] => {
  const incomingMap = new Map<string, ReportCardLayoutSectionConfig>()
  incoming?.forEach((section) => {
    const id = typeof section.id === "string" ? section.id : ""
    if (id) {
      incomingMap.set(id, section)
    }
  })

  const merged: ReportCardLayoutSectionConfig[] = defaults.map((section) => {
    const override = section.id ? incomingMap.get(section.id) : undefined
    const sectionId = ensureId(override?.id ?? section.id, "section", usedIds, generate)
    const fieldIds = new Set<string>()

    return {
      id: sectionId,
      title: sanitizeLabel(override?.title ?? section.title, section.title),
      description: sanitizeOptional(override?.description ?? section.description),
      enabled: sanitizeBoolean(override?.enabled, section.enabled),
      fields: mergeFields(section.fields, override?.fields, fieldIds, generate),
    }
  })

  incoming?.forEach((section) => {
    if (!section || typeof section !== "object") {
      return
    }

    const candidateId = typeof section.id === "string" ? section.id : ""
    if (candidateId && merged.some((existing) => existing.id === candidateId)) {
      return
    }

    const sectionId = ensureId(candidateId, "section", usedIds, generate)
    const fieldIds = new Set<string>()
    merged.push({
      id: sectionId,
      title: sanitizeLabel(section.title, section.title ?? "Untitled Section"),
      description: sanitizeOptional(section.description),
      enabled: sanitizeBoolean(section.enabled, true),
      fields: mergeFields([], section.fields ?? [], fieldIds, generate),
    })
  })

  return merged
}

const mergeBehavioralItems = (
  defaults: ReportCardBehavioralItemConfig[],
  incoming: ReportCardBehavioralItemConfig[] | undefined,
  usedIds: Set<string>,
  prefix: string,
  generate?: IdGenerator,
) => {
  const incomingMap = new Map<string, ReportCardBehavioralItemConfig>()
  incoming?.forEach((item) => {
    const id = typeof item.id === "string" ? item.id : ""
    if (id) {
      incomingMap.set(id, item)
    }
  })

  const merged = defaults.map((item) => {
    const override = item.id ? incomingMap.get(item.id) : undefined
    const id = ensureId(override?.id ?? item.id, prefix, usedIds, generate)

    return {
      id,
      label: sanitizeLabel(override?.label ?? item.label, item.label),
      enabled: sanitizeBoolean(override?.enabled, item.enabled),
    }
  })

  incoming?.forEach((item) => {
    if (!item || typeof item !== "object") {
      return
    }

    const candidateId = typeof item.id === "string" ? item.id : ""
    if (candidateId && merged.some((existing) => existing.id === candidateId)) {
      return
    }

    const id = ensureId(candidateId, prefix, usedIds, generate)
    merged.push({
      id,
      label: sanitizeLabel(item.label, item.label ?? ""),
      enabled: sanitizeBoolean(item.enabled, true),
    })
  })

  return merged
}

export const normalizeLayoutConfig = (
  config?: Partial<ReportCardLayoutConfig>,
  generate?: IdGenerator,
): ReportCardLayoutConfig => {
  const usedSectionIds = new Set<string>()
  const normalizedSections = mergeSections(
    DEFAULT_SECTIONS,
    config?.sections,
    usedSectionIds,
    generate,
  )

  const affectiveIds = new Set<string>()
  const psychomotorIds = new Set<string>()

  const normalizedAffective = mergeBehavioralItems(
    DEFAULT_AFFECTIVE_TRAITS,
    config?.affectiveTraits,
    affectiveIds,
    "affective",
    generate,
  )

  const normalizedPsychomotor = mergeBehavioralItems(
    DEFAULT_PSYCHOMOTOR_SKILLS,
    config?.psychomotorSkills,
    psychomotorIds,
    "psychomotor",
    generate,
  )

  return {
    sections: normalizedSections,
    affectiveTraits: normalizedAffective,
    psychomotorSkills: normalizedPsychomotor,
    defaultRemarks: {
      classTeacher: sanitizeLabel(
        config?.defaultRemarks?.classTeacher,
        DEFAULT_REPORT_CARD_LAYOUT_CONFIG.defaultRemarks.classTeacher,
      ),
      headTeacher: sanitizeLabel(
        config?.defaultRemarks?.headTeacher,
        DEFAULT_REPORT_CARD_LAYOUT_CONFIG.defaultRemarks.headTeacher,
      ),
    },
  }
}

export const applyLayoutDefaults = (
  config?: Partial<ReportCardLayoutConfig>,
  generate?: IdGenerator,
): ReportCardLayoutConfig => normalizeLayoutConfig(config, generate)

