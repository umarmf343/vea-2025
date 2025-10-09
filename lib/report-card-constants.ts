export const AFFECTIVE_TRAITS = [
  { key: "neatness", label: "Neatness" },
  { key: "honesty", label: "Honesty" },
  { key: "punctuality", label: "Punctuality" },
  { key: "attentiveness", label: "Attentiveness" },
  { key: "politeness", label: "Politeness" },
  { key: "perseverance", label: "Perseverance" },
] as const

export const PSYCHOMOTOR_SKILLS = [
  { key: "sport", label: "Sport" },
  { key: "handwriting", label: "Handwriting" },
  { key: "creativeArts", label: "Creative Arts" },
  { key: "musicalSkills", label: "Computer Skills" },
  { key: "practicalProjects", label: "Practical Projects" },
  { key: "verbalFluency", label: "Verbal Fluency" },
] as const

type BehavioralDomain = "affective" | "psychomotor"

const startCase = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)[a-z]/g, (match) => match.toUpperCase())

const createAliasMap = (
  canonicalKeys: readonly { key: string; label: string }[],
  aliases: Record<string, string>,
) => {
  const map = new Map<string, string>()
  canonicalKeys.forEach(({ key }) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "")
    map.set(normalized, key)
  })
  Object.entries(aliases).forEach(([alias, target]) => {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "")
    map.set(normalizedAlias, target)
  })
  return map
}

const AFFECTIVE_ALIAS_MAP = createAliasMap(AFFECTIVE_TRAITS, {
  attentive: "attentiveness",
  attendance: "attentiveness",
  respectful: "politeness",
  courtesy: "politeness",
  resilient: "perseverance",
  resilience: "perseverance",
  discipline: "perseverance",
})

const PSYCHOMOTOR_ALIAS_MAP = createAliasMap(PSYCHOMOTOR_SKILLS, {
  sports: "sport",
  games: "sport",
  gamessports: "sport",
  gamesandsports: "sport",
  drawing: "creativeArts",
  craft: "practicalProjects",
  crafts: "practicalProjects",
  art: "creativeArts",
  arts: "creativeArts",
  music: "musicalSkills",
  musicals: "musicalSkills",
  oratory: "verbalFluency",
  communication: "verbalFluency",
})

const BEHAVIORAL_TRUE_VALUES = new Set([
  "true",
  "yes",
  "1",
  "y",
  "checked",
  "selected",
  "on",
  "excel",
  "excellent",
  "vgood",
  "verygood",
  "good",
  "fair",
  "poor",
])

const BEHAVIORAL_FALSE_VALUES = new Set(["false", "no", "0", "n", "unchecked", "off"])

export const normalizeBehavioralDomainKey = (domain: BehavioralDomain, key: string): string | null => {
  if (!key || typeof key !== "string") {
    return null
  }

  const sanitized = key.toLowerCase().replace(/[^a-z0-9]/g, "")
  const map = domain === "affective" ? AFFECTIVE_ALIAS_MAP : PSYCHOMOTOR_ALIAS_MAP
  return map.get(sanitized) ?? null
}

export const interpretBehavioralSelection = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return !Number.isNaN(value) && value > 0
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized.length) {
      return false
    }
    if (BEHAVIORAL_FALSE_VALUES.has(normalized)) {
      return false
    }
    if (BEHAVIORAL_TRUE_VALUES.has(normalized)) {
      return true
    }
    return true
  }

  return false
}

export const normalizeBehavioralSelections = (
  domain: BehavioralDomain,
  record: Record<string, unknown> | undefined,
): Record<string, boolean> => {
  const normalized: Record<string, boolean> = {}
  if (!record || typeof record !== "object") {
    return normalized
  }

  Object.entries(record).forEach(([rawKey, rawValue]) => {
    const canonicalKey = normalizeBehavioralDomainKey(domain, rawKey)
    if (!canonicalKey) {
      return
    }
    normalized[canonicalKey] = interpretBehavioralSelection(rawValue)
  })

  return normalized
}

const createLabelLookup = (entries: readonly { key: string; label: string }[]) => {
  const lookup = new Map<string, string>()
  entries.forEach(({ key, label }) => {
    lookup.set(key, label)
  })
  return lookup
}

const AFFECTIVE_LABEL_LOOKUP = createLabelLookup(AFFECTIVE_TRAITS)
const PSYCHOMOTOR_LABEL_LOOKUP = createLabelLookup(PSYCHOMOTOR_SKILLS)

export const getAffectiveTraitLabel = (key: string) =>
  AFFECTIVE_LABEL_LOOKUP.get(key) ?? startCase(key)

export const getPsychomotorSkillLabel = (key: string) =>
  PSYCHOMOTOR_LABEL_LOOKUP.get(key) ?? startCase(key)

export const createBehavioralRecordSkeleton = (
  entries: readonly { key: string; label: string }[],
): Record<string, boolean> =>
  Object.fromEntries(entries.map(({ key }) => [key, false] as const)) as Record<string, boolean>
