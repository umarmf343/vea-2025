import type { ReportCardRecord } from "./database"
import { mapReportCardRecordToRaw } from "./report-card-transformers"
import type { RawReportCardData, StoredStudentMarkRecord, StoredSubjectRecord } from "./report-card-types"
import { safeStorage } from "./safe-storage"
import { logger } from "./logger"
import { normalizeTermLabel } from "./report-card-access"

export interface StudentMarks {
  studentId: string
  studentName: string
  class: string
  subjects: {
    [subjectName: string]: {
      firstCA: number
      secondCA: number
      noteAssignment: number
      exam: number
      teacherRemark: string
      teacherId: string
      term: string
      session: string
      lastUpdated: string
    }
  }
  affectiveDomain: {
    neatness: string
    honesty: string
    punctuality: string
  }
  psychomotorDomain: {
    sport: string
    handwriting: string
  }
  classTeacherRemarks: string
  adminOverrides?: {
    [field: string]: any
    overriddenBy: string
    overrideDate: string
    reason: string
  }
}

export interface ReportCardSettings {
  schoolLogo?: string
  headmasterSignature?: string
  defaultRemarks: string
  gradingScale: {
    A: { min: number; max: number; description: string }
    B: { min: number; max: number; description: string }
    C: { min: number; max: number; description: string }
    D: { min: number; max: number; description: string }
    E: { min: number; max: number; description: string }
    F: { min: number; max: number; description: string }
  }
}

// Mock database storage
const studentMarksDatabase: { [studentId: string]: StudentMarks } = {}
let reportCardSettings: ReportCardSettings = {
  defaultRemarks: "Keep up the good work and continue to strive for excellence.",
  gradingScale: {
    A: { min: 75, max: 100, description: "Excellent" },
    B: { min: 60, max: 74, description: "Very Good" },
    C: { min: 50, max: 59, description: "Good" },
    D: { min: 40, max: 49, description: "Fair" },
    E: { min: 30, max: 39, description: "Poor" },
    F: { min: 0, max: 29, description: "Fail" },
  },
}

export const STUDENT_MARKS_STORAGE_KEY = "studentMarks"

type StudentMarksStore = Record<string, StoredStudentMarkRecord>

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? fallback : parsed
  }

  return fallback
}

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  return undefined
}

const parseStudentMarksStore = (): StudentMarksStore => {
  const raw = safeStorage.getItem(STUDENT_MARKS_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    const store: StudentMarksStore = {}

    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== "object") {
        return
      }

      const candidate = value as Partial<StoredStudentMarkRecord>
      if (typeof candidate.studentId !== "string") {
        return
      }

      const subjectsSource = candidate.subjects
      if (!subjectsSource || typeof subjectsSource !== "object") {
        return
      }

      const normalizedSubjects: Record<string, StoredSubjectRecord> = {}

      Object.entries(subjectsSource).forEach(([subjectKey, subjectValue]) => {
        if (!subjectValue || typeof subjectValue !== "object") {
          return
        }

        const subject = subjectValue as Partial<StoredSubjectRecord>
        const subjectName =
          typeof subject.subject === "string" && subject.subject.trim().length > 0
            ? subject.subject.trim()
            : subjectKey

        const ca1 = toFiniteNumber(subject.ca1)
        const ca2 = toFiniteNumber(subject.ca2)
        const assignment = toFiniteNumber(subject.assignment)
        const caTotal = toFiniteNumber(subject.caTotal, ca1 + ca2 + assignment)
        const exam = toFiniteNumber(subject.exam)
        const total = toFiniteNumber(
          subject.total,
          toFiniteNumber(subject.totalObtained, caTotal + exam),
        )

        normalizedSubjects[subjectKey] = {
          subject: subjectName,
          className: subject.className ?? candidate.className ?? "",
          ca1,
          ca2,
          assignment,
          caTotal,
          exam,
          total,
          grade: normalizeOptionalString(subject.grade)?.toUpperCase() ?? "",
          remark: normalizeOptionalString(subject.remark),
          position: subject.position ?? null,
          totalObtainable:
            typeof subject.totalObtainable === "number" && Number.isFinite(subject.totalObtainable)
              ? subject.totalObtainable
              : undefined,
          totalObtained:
            typeof subject.totalObtained === "number" && Number.isFinite(subject.totalObtained)
              ? subject.totalObtained
              : undefined,
          averageScore:
            typeof subject.averageScore === "number" && Number.isFinite(subject.averageScore)
              ? subject.averageScore
              : undefined,
          teacherId: normalizeOptionalString(subject.teacherId),
          teacherName: normalizeOptionalString(subject.teacherName),
          updatedAt: normalizeOptionalString(subject.updatedAt),
        }
      })

      store[key] = {
        studentId: candidate.studentId,
        studentName: candidate.studentName ?? "",
        className: candidate.className ?? "",
        term: candidate.term ?? "",
        session: candidate.session ?? "",
        subjects: normalizedSubjects,
        lastUpdated: candidate.lastUpdated,
        status: normalizeOptionalString(candidate.status),
        numberInClass: candidate.numberInClass,
        overallAverage:
          typeof candidate.overallAverage === "number" && Number.isFinite(candidate.overallAverage)
            ? candidate.overallAverage
            : undefined,
        overallPosition: candidate.overallPosition ?? null,
      }
    })

    return store
  } catch (error) {
    logger.error("Failed to parse stored student marks", { error })
    return {}
  }
}

export const readStudentMarksStore = (): StudentMarksStore => {
  return parseStudentMarksStore()
}

export const getStoredStudentMarksRecord = (
  studentId: string,
  term: string,
  session: string,
): StoredStudentMarkRecord | null => {
  const store = parseStudentMarksStore()
  const normalizedTerm = normalizeTermLabel(term)
  const key = `${studentId}-${normalizedTerm}-${session}`
  return store[key] ?? null
}

export const calculateGrade = (total: number): string => {
  const { gradingScale } = reportCardSettings
  for (const [grade, range] of Object.entries(gradingScale)) {
    if (total >= range.min && total <= range.max) {
      return grade
    }
  }
  return "F"
}

export const buildRawReportCardFromStoredRecord = (
  record: StoredStudentMarkRecord,
): RawReportCardData | null => {
  const subjectEntries = Object.values(record.subjects ?? {})
  if (subjectEntries.length === 0) {
    return null
  }

  let totalMarksObtainable = 0
  let totalMarksObtained = 0

  const normalizedSubjects = subjectEntries.map((subject) => {
    const ca1 = toFiniteNumber(subject.ca1)
    const ca2 = toFiniteNumber(subject.ca2)
    const assignment = toFiniteNumber(subject.assignment)
    const caTotal = toFiniteNumber(subject.caTotal, ca1 + ca2 + assignment)
    const exam = toFiniteNumber(subject.exam)
    const total = toFiniteNumber(subject.total, caTotal + exam)
    const grade = subject.grade && subject.grade.trim().length > 0 ? subject.grade.toUpperCase() : calculateGrade(total)
    const remarks = subject.remark ?? ""

    const obtainable =
      typeof subject.totalObtainable === "number" && Number.isFinite(subject.totalObtainable)
        ? subject.totalObtainable
        : 100

    totalMarksObtainable += obtainable
    totalMarksObtained += total

    return {
      name: subject.subject,
      ca1,
      ca2,
      assignment,
      caTotal,
      exam,
      total,
      grade,
      remarks,
      position: subject.position ?? undefined,
    }
  })

  const averageScore =
    totalMarksObtainable > 0 ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2)) : 0
  const normalizedTerm = record.term ? normalizeTermLabel(record.term) : ""

  const summary = {
    totalMarksObtainable,
    totalMarksObtained,
    averageScore,
    grade: calculateGrade(averageScore),
    position: record.overallPosition ?? undefined,
    numberOfStudents: record.numberInClass,
  }

  return {
    student: {
      id: record.studentId,
      name: record.studentName,
      admissionNumber: record.studentId ? `VEA/${record.studentId}` : record.studentName,
      class: record.className,
      term: normalizedTerm,
      session: record.session,
      numberInClass: record.numberInClass,
      status: record.status,
    },
    subjects: normalizedSubjects,
    summary,
    totalObtainable: totalMarksObtainable,
    totalObtained: totalMarksObtained,
    average: averageScore,
    position: summary.position,
  }
}

export const saveTeacherMarks = async (marksData: {
  class: string
  subject: string
  term: string
  session: string
  marks: Array<{
    studentId: number
    studentName: string
    firstCA: number
    secondCA: number
    noteAssignment: number
    exam: number
    teacherRemark: string
  }>
  teacherId: string
}) => {
  try {
    // Save each student's marks
    for (const studentMark of marksData.marks) {
      const studentId = studentMark.studentId.toString()

      if (!studentMarksDatabase[studentId]) {
        studentMarksDatabase[studentId] = {
          studentId,
          studentName: studentMark.studentName,
          class: marksData.class,
          subjects: {},
          affectiveDomain: {
            neatness: "Good",
            honesty: "Good",
            punctuality: "Good",
          },
          psychomotorDomain: {
            sport: "Good",
            handwriting: "Good",
          },
          classTeacherRemarks: reportCardSettings.defaultRemarks,
        }
      }

      // Update subject marks
      studentMarksDatabase[studentId].subjects[marksData.subject] = {
        firstCA: studentMark.firstCA,
        secondCA: studentMark.secondCA,
        noteAssignment: studentMark.noteAssignment,
        exam: studentMark.exam,
        teacherRemark: studentMark.teacherRemark,
        teacherId: marksData.teacherId,
        term: marksData.term,
        session: marksData.session,
        lastUpdated: new Date().toISOString(),
      }
    }

    return { success: true, message: "Marks saved and will appear on report cards" }
  } catch (error) {
    logger.error("Error saving marks", { error })
    return { success: false, message: "Error saving marks" }
  }
}

export const getStudentReportCardData = (
  studentId: string,
  term: string,
  session: string,
): RawReportCardData | null => {
  const normalizedTerm = normalizeTermLabel(term)

  try {
    const stored = safeStorage.getItem("reportCards")
    if (stored) {
      const parsed = JSON.parse(stored) as ReportCardRecord[]
      if (Array.isArray(parsed)) {
        const match = parsed.find(
          (record) =>
            record.studentId === studentId &&
            normalizeTermLabel(record.term) === normalizedTerm &&
            record.session === session,
        )

        if (match) {
          return mapReportCardRecordToRaw(match)
        }
      }
    }
  } catch (error) {
    logger.error("Failed to load stored report card", { error })
  }

  const storedRecord = getStoredStudentMarksRecord(studentId, normalizedTerm, session)
  if (storedRecord) {
    const mapped = buildRawReportCardFromStoredRecord(storedRecord)
    if (mapped) {
      return mapped
    }
  }

  const studentData = studentMarksDatabase[studentId]
  if (!studentData) {
    return null
  }

  const subjects = Object.entries(studentData.subjects)
    .filter(
      ([, subjectData]) =>
        normalizeTermLabel(subjectData.term) === normalizedTerm && subjectData.session === session,
    )
    .map(([subjectName, subjectData]) => {
      const caTotal = subjectData.firstCA + subjectData.secondCA + subjectData.noteAssignment
      const grandTotal = caTotal + subjectData.exam
      const grade = calculateGrade(grandTotal)

      return {
        name: subjectName,
        ca1: subjectData.firstCA,
        ca2: subjectData.secondCA,
        assignment: subjectData.noteAssignment,
        caTotal,
        exam: subjectData.exam,
        total: grandTotal,
        grade,
        remarks: subjectData.teacherRemark,
      }
    })

  if (subjects.length === 0) {
    return null
  }

  const totalObtainable = subjects.length * 100
  const totalObtained = subjects.reduce((sum, subject) => sum + subject.total, 0)
  const average = totalObtainable > 0 ? Math.round((totalObtained / totalObtainable) * 100) : 0
  const position = average >= 80 ? "1st" : average >= 70 ? "2nd" : average >= 60 ? "3rd" : "4th"

  return {
    student: {
      id: studentId,
      name: studentData.studentName,
      admissionNumber: `VEA/${studentId}/2024`,
      class: studentData.class,
      term: normalizedTerm,
      session,
    },
    subjects,
    summary: {
      totalMarksObtainable: totalObtainable,
      totalMarksObtained: totalObtained,
      averageScore: average,
      position,
      grade: calculateGrade(average),
    },
    totalObtainable,
    totalObtained,
    average,
    position,
    affectiveDomain: studentData.affectiveDomain,
    psychomotorDomain: studentData.psychomotorDomain,
    classTeacherRemarks: studentData.classTeacherRemarks,
    remarks: {
      classTeacher: studentData.classTeacherRemarks,
    },
  }
}

export const updateReportCardSettings = (settings: Partial<ReportCardSettings>) => {
  reportCardSettings = { ...reportCardSettings, ...settings }
}

export const adminOverrideMarks = (studentId: string, overrides: any, adminId: string, reason: string) => {
  if (studentMarksDatabase[studentId]) {
    studentMarksDatabase[studentId].adminOverrides = {
      ...overrides,
      overriddenBy: adminId,
      overrideDate: new Date().toISOString(),
      reason,
    }
  }
}

// Export for debugging
export const getStudentMarksDatabase = () => studentMarksDatabase
export const getReportCardSettings = () => reportCardSettings
