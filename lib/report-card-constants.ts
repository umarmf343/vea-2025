export const AFFECTIVE_TRAITS = [
  { key: "neatness", label: "Neatness" },
  { key: "attentiveness", label: "Attentiveness" },
  { key: "honesty", label: "Honesty" },
  { key: "politeness", label: "Politeness" },
  { key: "punctuality", label: "Punctuality" },
  { key: "perseverance", label: "Perseverance" },
] as const

export const PSYCHOMOTOR_SKILLS = [
  { key: "gamesSports", label: "Games & Sports" },
  { key: "handwriting", label: "Handwriting" },
  { key: "creativeArts", label: "Creative Arts" },
  { key: "musicalSkills", label: "Musical Skills" },
  { key: "practicalProjects", label: "Practical Projects" },
  { key: "verbalFluency", label: "Verbal Fluency" },
] as const

export const BEHAVIORAL_RATING_COLUMNS = [
  { key: "excel", label: "Excellent" },
  { key: "vgood", label: "V. Good" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "poor", label: "Needs Imp." },
] as const

export const BEHAVIORAL_RATING_OPTIONS = [
  { value: "excel", label: "Excellent" },
  { value: "vgood", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Needs Improvement" },
] as const

export const normalizeBehavioralRating = (value: string | undefined | null) => {
  if (!value) {
    return null
  }

  const normalized = value.toString().trim().toLowerCase()

  if (normalized.length === 0) {
    return null
  }

  if (["excellent", "excel", "ex"].includes(normalized)) {
    return "excel"
  }

  if (["very good", "v.good", "vgood", "verygood", "vg"].includes(normalized.replace(/\s+/g, ""))) {
    return "vgood"
  }

  if (["good", "gd"].includes(normalized.replace(/\s+/g, ""))) {
    return "good"
  }

  if (["fair", "average"].includes(normalized)) {
    return "fair"
  }

  if (["poor", "vpoor", "verypoor", "needsimprovement"].includes(normalized.replace(/\s+/g, ""))) {
    return "poor"
  }

  return null
}
