export const CONTINUOUS_ASSESSMENT_MAXIMUMS = {
  ca1: 20,
  ca2: 20,
  assignment: 20,
  exam: 40,
} as const

export type ContinuousAssessmentKey = keyof typeof CONTINUOUS_ASSESSMENT_MAXIMUMS

export const GRADE_BANDS = ["A", "B", "C", "D", "F"] as const

const GRADE_BOUNDARIES: Array<{ min: number; grade: (typeof GRADE_BANDS)[number]; remark: string }> = [
  { min: 90, grade: "A", remark: "Outstanding performance" },
  { min: 80, grade: "B", remark: "Very good work" },
  { min: 70, grade: "C", remark: "Good effort" },
  { min: 60, grade: "D", remark: "Fair – room for growth" },
  { min: 0, grade: "F", remark: "Requires urgent attention" },
]

export const TERM_LABELS: Record<string, string> = {
  first: "First Term",
  second: "Second Term",
  third: "Third Term",
}

export const TERM_KEYS: Record<string, string> = {
  "First Term": "first",
  "Second Term": "second",
  "Third Term": "third",
}

const clampScore = (value: number, key: ContinuousAssessmentKey): number => {
  const maxValue = CONTINUOUS_ASSESSMENT_MAXIMUMS[key]
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > maxValue) {
    return maxValue
  }
  return Math.round(value)
}

export const normalizeAssessmentScores = (input: Partial<Record<ContinuousAssessmentKey, number>>) => ({
  ca1: clampScore(input.ca1 ?? 0, "ca1"),
  ca2: clampScore(input.ca2 ?? 0, "ca2"),
  assignment: clampScore(input.assignment ?? 0, "assignment"),
  exam: clampScore(input.exam ?? 0, "exam"),
})

export const calculateContinuousAssessmentTotal = (
  ca1: number,
  ca2: number,
  assignment: number,
): number => {
  const scores = normalizeAssessmentScores({ ca1, ca2, assignment, exam: 0 })
  return scores.ca1 + scores.ca2 + scores.assignment
}

export const calculateGrandTotal = (ca1: number, ca2: number, assignment: number, exam: number): number => {
  const scores = normalizeAssessmentScores({ ca1, ca2, assignment, exam })
  return scores.ca1 + scores.ca2 + scores.assignment + scores.exam
}

export const deriveGradeFromScore = (total: number): (typeof GRADE_BANDS)[number] => {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0
  const boundary = GRADE_BOUNDARIES.find((item) => safeTotal >= item.min)
  return boundary?.grade ?? "F"
}

export const getRemarkForGrade = (grade: string): string => {
  const normalizedGrade = grade.toUpperCase()
  const match = GRADE_BOUNDARIES.find((item) => item.grade === normalizedGrade)
  return match?.remark ?? ""
}

export const summarizeGradeDistribution = (scores: number[]) => {
  const distribution: Record<(typeof GRADE_BANDS)[number], number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  }

  scores.forEach((score) => {
    const grade = deriveGradeFromScore(score)
    distribution[grade] += 1
  })

  const total = scores.length
  const passes = total === 0 ? 0 : total - distribution.F
  const passRate = total === 0 ? 0 : Math.round((passes / total) * 100)

  return { distribution, total, passes, passRate }
}

export const mapTermKeyToLabel = (termKey: string): string => {
  return TERM_LABELS[termKey] ?? termKey
}

export const mapTermLabelToKey = (termLabel: string): string => {
  return TERM_KEYS[termLabel] ?? termLabel
}
