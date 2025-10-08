import { normalizeSubjectList } from "./subject-utils"
import type { StoredUser, TeacherAssignmentSummary } from "./database"

export type NormalizedTeacherClassAssignment = {
  id: string
  name: string
  subjects: string[]
}

export type TeacherAssignmentSnapshot = {
  classes: NormalizedTeacherClassAssignment[]
  subjects: string[]
}

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const buildIdentifierFromName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const registerClassAssignment = (
  registry: NormalizedTeacherClassAssignment[],
  subjectSet: Set<string>,
  indexById: Map<string, number>,
  indexByName: Map<string, number>,
  idValue: unknown,
  nameValue?: unknown,
  subjectsValue?: unknown,
  fallbackIndex?: number,
) => {
  const rawId = normalizeString(idValue)
  const rawName = normalizeString(nameValue)
  const normalizedSubjects = normalizeSubjectList(subjectsValue)

  normalizedSubjects.forEach((subject) => subjectSet.add(subject))

  if (!rawId && !rawName && normalizedSubjects.length === 0) {
    return
  }

  const fallbackPosition = typeof fallbackIndex === "number" ? fallbackIndex : registry.length
  const resolvedId = rawId || (rawName ? buildIdentifierFromName(rawName) : `class_${fallbackPosition + 1}`)
  const resolvedName = rawName || rawId || `Class ${fallbackPosition + 1}`

  const idToken = resolvedId.trim().toLowerCase()
  const nameToken = resolvedName.trim().toLowerCase()

  const existingIndex =
    (idToken && indexById.has(idToken) ? indexById.get(idToken) : undefined) ??
    (nameToken && indexByName.has(nameToken) ? indexByName.get(nameToken) : undefined) ??
    -1

  if (existingIndex !== undefined && existingIndex >= 0) {
    const existing = registry[existingIndex]
    const mergedSubjects = new Set([...existing.subjects, ...normalizedSubjects])
    registry[existingIndex] = {
      id: existing.id || resolvedId,
      name: existing.name || resolvedName,
      subjects: Array.from(mergedSubjects),
    }

    if (idToken) {
      indexById.set(idToken, existingIndex)
    }

    if (nameToken) {
      indexByName.set(nameToken, existingIndex)
    }

    return
  }

  const insertionIndex = registry.length
  registry.push({
    id: resolvedId,
    name: resolvedName,
    subjects: normalizedSubjects,
  })

  if (idToken) {
    indexById.set(idToken, insertionIndex)
  }

  if (nameToken) {
    indexByName.set(nameToken, insertionIndex)
  }
}

export const summarizeTeacherAssignments = (
  teacher: Partial<StoredUser> & Record<string, unknown>,
): TeacherAssignmentSnapshot => {
  const registry: NormalizedTeacherClassAssignment[] = []
  const indexById = new Map<string, number>()
  const indexByName = new Map<string, number>()
  const subjectSet = new Set<string>()

  const teachingAssignments = Array.isArray(teacher.teachingAssignments)
    ? (teacher.teachingAssignments as TeacherAssignmentSummary[])
    : []

  teachingAssignments.forEach((assignment, index) => {
    registerClassAssignment(
      registry,
      subjectSet,
      indexById,
      indexByName,
      (assignment as TeacherAssignmentSummary)?.classId,
      (assignment as TeacherAssignmentSummary)?.className,
      (assignment as TeacherAssignmentSummary)?.subjects,
      index,
    )
  })

  const assignedSummaries = Array.isArray((teacher as { assignedClasses?: unknown }).assignedClasses)
    ? ((teacher as { assignedClasses?: Array<{ id?: unknown; name?: unknown; subjects?: unknown }> }).assignedClasses ?? [])
    : []

  assignedSummaries.forEach((entry, index) => {
    registerClassAssignment(
      registry,
      subjectSet,
      indexById,
      indexByName,
      entry?.id,
      entry?.name,
      entry?.subjects,
      teachingAssignments.length + index,
    )
  })

  const fallbackAssignedIds = Array.isArray((teacher as { assignedClassIds?: unknown }).assignedClassIds)
    ? ((teacher as { assignedClassIds?: unknown[] }).assignedClassIds ?? [])
    : []

  fallbackAssignedIds.forEach((identifier, index) => {
    registerClassAssignment(
      registry,
      subjectSet,
      indexById,
      indexByName,
      identifier,
      undefined,
      undefined,
      teachingAssignments.length + assignedSummaries.length + index,
    )
  })

  const fallbackAssignedNames = Array.isArray((teacher as { assignedClassNames?: unknown }).assignedClassNames)
    ? ((teacher as { assignedClassNames?: unknown[] }).assignedClassNames ?? [])
    : []

  fallbackAssignedNames.forEach((name, index) => {
    registerClassAssignment(
      registry,
      subjectSet,
      indexById,
      indexByName,
      undefined,
      name,
      undefined,
      teachingAssignments.length + assignedSummaries.length + fallbackAssignedIds.length + index,
    )
  })

  registerClassAssignment(
    registry,
    subjectSet,
    indexById,
    indexByName,
    (teacher as { classId?: unknown }).classId,
    (teacher as { className?: unknown }).className,
    teacher.subjects,
    teachingAssignments.length +
      assignedSummaries.length +
      fallbackAssignedIds.length +
      fallbackAssignedNames.length,
  )

  normalizeSubjectList(teacher.subjects).forEach((subject) => subjectSet.add(subject))

  return {
    classes: registry,
    subjects: Array.from(subjectSet),
  }
}
