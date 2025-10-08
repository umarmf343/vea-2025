import { normalizeSubjectList } from "./subject-utils"
import {
  type ClassRecord,
  type StoredUser,
  type SubjectRecord,
  type TeacherAssignmentSummary,
  getAllClassesFromDb,
  listSubjectRecords,
} from "./database"

export type NormalizedTeacherClassAssignment = {
  id: string
  name: string
  subjects: string[]
}

export type TeacherSubjectAssignmentDetail = {
  subjectId: string
  subjectName: string
  classId: string
  className: string
}

export type TeacherAssignmentSnapshot = {
  classes: NormalizedTeacherClassAssignment[]
  subjects: string[]
  subjectAssignments: TeacherSubjectAssignmentDetail[]
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

const normalizeAssignmentSubjects = (subjects: string[]): string[] =>
  Array.from(
    new Set(
      subjects
        .map((subject) => (typeof subject === "string" ? subject.trim() : ""))
        .filter((subject) => subject.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

const toToken = (value: string): string => value.trim().toLowerCase()

const toCollapsedToken = (value: string): string => toToken(value).replace(/\s+/g, "")

const buildClassIndex = (classes: ClassRecord[]) => {
  const byId = new Map<string, ClassRecord>()
  const byName = new Map<string, ClassRecord>()
  const byCollapsed = new Map<string, ClassRecord>()

  classes.forEach((cls) => {
    const idToken = toToken(cls.id)
    const nameToken = cls.name ? toToken(cls.name) : ""
    const collapsedId = idToken ? toCollapsedToken(cls.id) : ""
    const collapsedName = cls.name ? toCollapsedToken(cls.name) : ""

    if (idToken) {
      byId.set(idToken, cls)
    }

    if (nameToken) {
      byName.set(nameToken, cls)
    }

    if (collapsedId) {
      byCollapsed.set(collapsedId, cls)
    }

    if (collapsedName) {
      byCollapsed.set(collapsedName, cls)
    }
  })

  return { byId, byName, byCollapsed }
}

const buildSubjectIndex = (subjects: SubjectRecord[]) => {
  const byName = new Map<string, SubjectRecord[]>()

  subjects.forEach((subject) => {
    const nameToken = toToken(subject.name)
    if (!nameToken) {
      return
    }

    const existing = byName.get(nameToken)
    if (existing) {
      existing.push(subject)
      return
    }

    byName.set(nameToken, [subject])
  })

  return byName
}

const resolveClassRecord = (
  assignment: NormalizedTeacherClassAssignment,
  classIndex: ReturnType<typeof buildClassIndex>,
): ClassRecord | null => {
  const idToken = toToken(assignment.id)
  const collapsedId = toCollapsedToken(assignment.id)
  const nameToken = assignment.name ? toToken(assignment.name) : ""
  const collapsedName = assignment.name ? toCollapsedToken(assignment.name) : ""

  return (
    classIndex.byId.get(idToken) ??
    (nameToken ? classIndex.byName.get(nameToken) : undefined) ??
    classIndex.byCollapsed.get(collapsedId) ??
    (collapsedName ? classIndex.byCollapsed.get(collapsedName) : undefined) ??
    null
  )
}

const resolveSubjectRecord = (
  subjectName: string,
  assignment: NormalizedTeacherClassAssignment,
  subjectIndex: Map<string, SubjectRecord[]>,
): SubjectRecord | null => {
  const normalizedSubject = subjectName.trim()
  if (!normalizedSubject) {
    return null
  }

  const candidates = subjectIndex.get(toToken(normalizedSubject))
  if (!candidates || candidates.length === 0) {
    return null
  }

  const classTokens = new Set<string>()
  const idToken = toToken(assignment.id)
  const collapsedId = toCollapsedToken(assignment.id)
  const nameToken = assignment.name ? toToken(assignment.name) : ""
  const collapsedName = assignment.name ? toCollapsedToken(assignment.name) : ""

  if (idToken) {
    classTokens.add(idToken)
  }

  if (collapsedId) {
    classTokens.add(collapsedId)
  }

  if (nameToken) {
    classTokens.add(nameToken)
  }

  if (collapsedName) {
    classTokens.add(collapsedName)
  }

  const match = candidates.find((candidate) => {
    if (!Array.isArray(candidate.classes)) {
      return false
    }

    return candidate.classes.some((classRef) => {
      const token = toToken(String(classRef))
      const collapsedToken = toCollapsedToken(String(classRef))
      return classTokens.has(token) || classTokens.has(collapsedToken)
    })
  })

  return match ?? candidates[0] ?? null
}

export const summarizeTeacherAssignments = async (
  teacher: Partial<StoredUser> & Record<string, unknown>,
): Promise<TeacherAssignmentSnapshot> => {
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

  const classesFromStore = await getAllClassesFromDb().catch(() => [])
  const subjectRecords = await listSubjectRecords().catch(() => [])
  const classIndex = buildClassIndex(classesFromStore)
  const subjectIndex = buildSubjectIndex(subjectRecords)

  const enrichedClasses = registry.map((assignment) => {
    const classRecord = resolveClassRecord(assignment, classIndex)
    const normalizedSubjects = normalizeAssignmentSubjects([
      ...assignment.subjects,
      ...normalizeSubjectList(classRecord?.subjects),
    ])

    normalizedSubjects.forEach((subject) => subjectSet.add(subject))

    return {
      ...assignment,
      id: assignment.id,
      name: assignment.name,
      subjects: normalizedSubjects,
    }
  })

  const subjectAssignments: TeacherSubjectAssignmentDetail[] = enrichedClasses.flatMap((assignment) => {
    if (!assignment.subjects || assignment.subjects.length === 0) {
      return []
    }

    return assignment.subjects.map((subjectName) => {
      const subjectRecord = resolveSubjectRecord(subjectName, assignment, subjectIndex)
      const subjectId = subjectRecord?.id
        ? String(subjectRecord.id)
        : `subject_${toCollapsedToken(`${assignment.id}_${subjectName}`)}`

      return {
        subjectId,
        subjectName,
        classId: assignment.id,
        className: assignment.name,
      }
    })
  })

  return {
    classes: enrichedClasses,
    subjects: Array.from(subjectSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    subjectAssignments,
  }
}
