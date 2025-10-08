"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BookOpen,
  Calendar,
  FileText,
  User,
  Clock,
  Trophy,
  Upload,
  CheckCircle,
  AlertCircle,
  Award,
  Download,
  Sparkles,
  Loader2,
  UserCheck,
  Users,
} from "lucide-react"
import { StudyMaterials } from "@/components/study-materials"
import { Noticeboard } from "@/components/noticeboard"
import { NotificationCenter } from "@/components/notification-center"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { TimetableWeeklyView, type TimetableWeeklyViewSlot } from "@/components/timetable-weekly-view"
import { dbManager } from "@/lib/database-manager"
import { logger } from "@/lib/logger"
import { normalizeTimetableCollection } from "@/lib/timetable"
import { CONTINUOUS_ASSESSMENT_MAXIMUMS, deriveGradeFromScore } from "@/lib/grade-utils"
import { useBranding } from "@/hooks/use-branding"
import { useSchoolCalendar } from "@/hooks/use-school-calendar"

type TimetableSlotSummary = TimetableWeeklyViewSlot

type UpcomingEventSource = "calendar" | "assignment"

interface UpcomingEventSummary {
  id: string
  title: string
  date: string
  description?: string
  source: UpcomingEventSource
  location?: string | null
  category?: string | null
}

type AssignedClassTeacher = {
  teacherId: string | null
  teacherName: string
  role: string
  teacherEmail: string | null
}

type AssignedSubjectTeacher = {
  subject: string
  teacherId: string | null
  teacherName: string | null
  teacherEmail: string | null
}

const UPCOMING_EVENT_SOURCE_STYLES: Record<UpcomingEventSource, { label: string; badgeClass: string }> = {
  calendar: {
    label: "School calendar",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  assignment: {
    label: "Assignment due",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
}

interface IdentifiedRecord {
  id: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toIdentifiedRecord(value: unknown, prefix: string): IdentifiedRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const record = value
  const idSource =
    record.id ?? record.ID ?? record._id ?? record.reference ?? record.slug ?? record.email ?? record.name ?? null

  let id: string
  if (typeof idSource === "string" && idSource.trim().length > 0) {
    id = idSource
  } else if (typeof idSource === "number") {
    id = String(idSource)
  } else {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${prefix}_${Math.random().toString(36).slice(2)}`
  }

  return { id, ...record }
}

function normalizeIdentifiedCollection(values: unknown, prefix: string): IdentifiedRecord[] {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((item) => toIdentifiedRecord(item, prefix))
    .filter((record): record is IdentifiedRecord => record !== null)
}

const normalizeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number") {
    return String(value)
  }

  return ""
}

const normalizeClassIdentifier = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, "").toLowerCase() : ""

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

  return Math.round(value)
}

const haveSameStringMembers = (current: string[], next: string[]): boolean => {
  if (current.length !== next.length) {
    return false
  }

  const normalizedCurrent = [...current].map((value) => value.toLowerCase()).sort()
  const normalizedNext = [...next].map((value) => value.toLowerCase()).sort()

  return normalizedCurrent.every((value, index) => value === normalizedNext[index])
}

const sortAssignmentsByDueDate = (records: IdentifiedRecord[]): IdentifiedRecord[] => {
  const toTimestamp = (record: IdentifiedRecord) => {
    const rawDate =
      (typeof record.dueDate === "string" && record.dueDate.trim().length > 0
        ? record.dueDate
        : typeof (record as Record<string, unknown>).due_date === "string"
          ? ((record as Record<string, unknown>).due_date as string)
          : null) ?? null

    if (!rawDate) {
      return Number.POSITIVE_INFINITY
    }

    const parsed = Date.parse(rawDate)
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
  }

  return [...records].sort((a, b) => toTimestamp(a) - toTimestamp(b))
}

const extractRecordId = (record: Record<string, unknown>): string | null => {
  const candidates = [
    record.id,
    record.studentId,
    record.student_id,
    record.userId,
    record.user_id,
    record.reference,
    record.admissionNumber,
    record.admission_number,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized.length > 0) {
      return normalized
    }
  }

  return null
}

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const collectTeacherTokens = (value: unknown): string[] => {
  if (typeof value !== "string") {
    return []
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  const lower = trimmed.toLowerCase()
  const withoutPunctuation = lower.replace(/[\.]+/g, " ")
  const collapsedWhitespace = withoutPunctuation.replace(/\s+/g, " ").trim()
  const alphanumeric = collapsedWhitespace.replace(/[^a-z0-9]+/g, "")

  const tokens = new Set<string>([lower])

  if (collapsedWhitespace.length > 0) {
    tokens.add(collapsedWhitespace)
  }

  if (alphanumeric.length > 0) {
    tokens.add(alphanumeric)
  }

  return Array.from(tokens)
}

const extractAttendanceSummary = (
  value: unknown,
  fallback?: { present: number; total: number; percentage: number },
): { present: number; total: number; percentage: number } | null => {
  if (!isRecord(value)) {
    if (!fallback) {
      return null
    }

    const adjustedTotal = fallback.total > 0 ? fallback.total : Math.max(fallback.present, 0)
    const adjustedPercentage =
      fallback.percentage >= 0
        ? fallback.percentage
        : adjustedTotal > 0
          ? Math.round((fallback.present / adjustedTotal) * 100)
          : 0

    return {
      present: Math.max(0, Math.round(fallback.present)),
      total: Math.max(0, Math.round(adjustedTotal)),
      percentage: adjustedPercentage,
    }
  }

  const presentCandidate = Number(value.present ?? value.presentDays ?? value.attended ?? fallback?.present ?? 0)
  const absentCandidate = Number(value.absent ?? value.absentDays ?? fallback?.total ?? 0) - presentCandidate
  const totalCandidate = Number(
    value.total ??
      value.totalDays ??
      (Number.isFinite(absentCandidate) && absentCandidate >= 0
        ? presentCandidate + absentCandidate
        : fallback?.total ?? 0),
  )

  const present = Number.isFinite(presentCandidate) && presentCandidate >= 0 ? Math.round(presentCandidate) : 0
  const total = Number.isFinite(totalCandidate) && totalCandidate > 0 ? Math.round(totalCandidate) : present

  const percentageCandidate = Number(value.percentage ?? fallback?.percentage ?? NaN)
  const percentage =
    Number.isFinite(percentageCandidate) && percentageCandidate >= 0
      ? Math.round(percentageCandidate)
      : total > 0
        ? Math.round((present / total) * 100)
        : 0

  return { present, total, percentage }
}

const resolveAssignmentMaximum = (assignment: IdentifiedRecord, fallback: number): number => {
  const candidates = [
    assignment.maximumScore,
    assignment.maximum_score,
    assignment.maxScore,
    assignment.max_score,
    assignment.totalMarks,
    assignment.total_marks,
  ]

  for (const candidate of candidates) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric)
    }
  }

  return fallback
}

const getRecordValue = (record: Record<string, unknown> | null | undefined, key: string): unknown => {
  if (!record) {
    return undefined
  }

  return record[key]
}

const resolveStudentProfile = (
  profile: unknown,
  fallback: StudentDashboardProps["student"],
): StudentDashboardProps["student"] => {
  if (!isRecord(profile)) {
    return { ...fallback }
  }

  const record = profile as Record<string, unknown>
  const resolvedId = extractRecordId(record) ?? fallback.id
  const resolvedName =
    normalizeString(record.name) ||
    normalizeString(record.fullName) ||
    normalizeString(record.full_name) ||
    fallback.name
  const resolvedEmail =
    normalizeString(record.email) ||
    normalizeString(record.emailAddress) ||
    normalizeString(record.email_address) ||
    fallback.email
  const resolvedClass =
    normalizeString(record.class) ||
    normalizeString(record.className) ||
    normalizeString(record.class_name) ||
    normalizeString(record.classId) ||
    normalizeString(record.class_id) ||
    normalizeString(record.level) ||
    normalizeString(record.grade) ||
    fallback.class
  const resolvedAdmission =
    normalizeString(record.admissionNumber) ||
    normalizeString(record.admission_number) ||
    normalizeString(record.admissionNo) ||
    normalizeString(record.admission_no) ||
    normalizeString(record.studentId) ||
    normalizeString(record.student_id) ||
    fallback.admissionNumber

  return {
    id: resolvedId,
    name: normalizeString(resolvedName || fallback.name) || fallback.name,
    email: normalizeString(resolvedEmail || fallback.email) || fallback.email,
    class: normalizeString(resolvedClass || fallback.class) || fallback.class,
    admissionNumber:
      normalizeString(resolvedAdmission || fallback.admissionNumber) || fallback.admissionNumber,
  }
}

interface StudentDashboardProps {
  student: {
    id: string
    name: string
    email: string
    class: string
    admissionNumber: string
  }
}

export function StudentDashboard({ student }: StudentDashboardProps) {
  const branding = useBranding()
  const resolvedSchoolName = branding.schoolName
  const calendar = useSchoolCalendar()
  const router = useRouter()
  const {
    id: initialStudentId,
    name: initialStudentName,
    email: initialStudentEmail,
    class: initialStudentClass,
    admissionNumber: initialStudentAdmissionNumber,
  } = student
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<IdentifiedRecord | null>(null)
  const [submissionForm, setSubmissionForm] = useState({
    file: null as File | null,
    comment: "",
  })

  const [effectiveStudentId, setEffectiveStudentId] = useState(initialStudentId)
  const [effectiveClassName, setEffectiveClassName] = useState(initialStudentClass)
  const [studentTeachers, setStudentTeachers] = useState<string[]>([])
  const [assignedClassTeachers, setAssignedClassTeachers] = useState<AssignedClassTeacher[]>([])
  const [assignedSubjectTeachers, setAssignedSubjectTeachers] = useState<AssignedSubjectTeacher[]>([])
  const [teacherLookupMessage, setTeacherLookupMessage] = useState<string | null>(null)
  const [teacherLookupError, setTeacherLookupError] = useState<string | null>(null)
  const [isTeacherLookupLoading, setIsTeacherLookupLoading] = useState(false)
  const [subjects, setSubjects] = useState<IdentifiedRecord[]>([])
  const [timetable, setTimetable] = useState<TimetableSlotSummary[]>([])
  const [assignments, setAssignments] = useState<IdentifiedRecord[]>([])
  const [libraryBooks, setLibraryBooks] = useState<IdentifiedRecord[]>([])
  const [attendance, setAttendance] = useState({ present: 0, total: 0, percentage: 0 })
  const [studentProfile, setStudentProfile] = useState(student)
  const [loading, setLoading] = useState(true)

  const defaultAssignmentMaximum = CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment ?? 20

  const studentAssignmentInsights = useMemo(() => {
    if (!assignments.length) {
      return {
        total: 0,
        submitted: 0,
        graded: 0,
        pending: 0,
        completionRate: 0,
        averageScore: null as number | null,
      }
    }

    let submittedCount = 0
    let gradedCount = 0
    let scoreTotal = 0
    let scoreEntries = 0

    assignments.forEach((assignment) => {
      const status = typeof assignment.status === "string" ? assignment.status.toLowerCase() : "sent"
      if (status === "submitted") {
        submittedCount += 1
      } else if (status === "graded") {
        gradedCount += 1
      }

      const numericScore = typeof assignment.score === "number" ? assignment.score : null
      if (numericScore !== null) {
        scoreTotal += numericScore
        scoreEntries += 1
      }
    })

    const totalAssignments = assignments.length
    const completionRate = totalAssignments
      ? Math.round(((submittedCount + gradedCount) / totalAssignments) * 100)
      : 0
    const averageScore = scoreEntries > 0 ? Math.round((scoreTotal / scoreEntries) * 100) / 100 : null

    return {
      total: totalAssignments,
      submitted: submittedCount,
      graded: gradedCount,
      pending: Math.max(totalAssignments - gradedCount, 0),
      completionRate,
      averageScore,
    }
  }, [assignments])

  const filterAssignmentsForStudent = useCallback(
    (items: IdentifiedRecord[], teacherCandidates?: Iterable<string>) => {
      const normalizedStudentClass = normalizeClassIdentifier(effectiveClassName)
      const teacherTokenSet = new Set(
        Array.from(teacherCandidates ?? studentTeachers)
          .flatMap((teacher) => collectTeacherTokens(teacher))
          .filter((token): token is string => token.length > 0),
      )

      const filtered =
        teacherTokenSet.size > 0
          ? items.filter((assignment) => {
              const assignmentRecord = assignment as Record<string, unknown>
              const assignmentTokens = new Set<string>()

              collectTeacherTokens(assignmentRecord.teacher).forEach((token) => assignmentTokens.add(token))
              collectTeacherTokens(assignmentRecord.teacherName).forEach((token) => assignmentTokens.add(token))
              collectTeacherTokens(assignmentRecord.teacherId).forEach((token) => assignmentTokens.add(token))
              collectTeacherTokens(assignmentRecord.teacher_id).forEach((token) => assignmentTokens.add(token))

              if (assignmentTokens.size === 0) {
                return true
              }

              const matchesTeacher = Array.from(assignmentTokens).some((token) => teacherTokenSet.has(token))

              if (matchesTeacher) {
                return true
              }

              if (!normalizedStudentClass) {
                return false
              }

              const classCandidates = [
                assignmentRecord.className,
                assignmentRecord.class,
                assignmentRecord.classId,
                assignmentRecord.class_id,
              ]

              return classCandidates
                .map((value) => normalizeClassIdentifier(value))
                .some((identifier) => identifier && identifier === normalizedStudentClass)
            })
          : items

      return sortAssignmentsByDueDate(filtered)
    },
    [effectiveClassName, studentTeachers],
  )

  const refreshAssignments = useCallback(async () => {
    if (!effectiveStudentId) {
      return
    }

    try {
      const assignmentsData = await dbManager.getAssignments({ studentId: effectiveStudentId })
      const normalizedAssignments = normalizeIdentifiedCollection(assignmentsData, "assignment")
      setAssignments(filterAssignmentsForStudent(normalizedAssignments))
    } catch (error) {
      logger.error("Failed to refresh assignments", { error })
    }
  }, [effectiveStudentId, filterAssignmentsForStudent])

  const filterAssignmentsForStudentRef = useRef(filterAssignmentsForStudent)

  useEffect(() => {
    filterAssignmentsForStudentRef.current = filterAssignmentsForStudent
  }, [filterAssignmentsForStudent])

  useEffect(() => {
    if (!effectiveStudentId) {
      return
    }

    const normalizedStudentId = normalizeString(effectiveStudentId)

    const handleAssignmentUpdate = (payload: unknown) => {
      if (!isRecord(payload)) {
        void refreshAssignments()
        return
      }

      const record = payload as Record<string, unknown>
      const candidateStudentId = normalizeString(record.studentId ?? record.student_id)

      if (candidateStudentId && normalizedStudentId !== candidateStudentId) {
        const assignedIds = record.assignedStudentIds ?? record.assigned_student_ids

        if (Array.isArray(assignedIds)) {
          const normalizedAssigned = assignedIds
            .map((value) => normalizeString(value))
            .filter((value) => value.length > 0)

          if (!normalizedAssigned.includes(normalizedStudentId)) {
            return
          }
        } else {
          return
        }
      }

      void refreshAssignments()
    }

    dbManager.on("assignmentsUpdate", handleAssignmentUpdate)
    dbManager.on("assignmentSubmitted", handleAssignmentUpdate)

    return () => {
      dbManager.off("assignmentsUpdate", handleAssignmentUpdate)
      dbManager.off("assignmentSubmitted", handleAssignmentUpdate)
    }
  }, [effectiveStudentId, refreshAssignments])

  useEffect(() => {
    let isActive = true

    const loadDashboardData = async () => {
      setLoading(true)

      try {
        const fallbackStudent: StudentDashboardProps["student"] = {
          id: initialStudentId,
          name: initialStudentName,
          email: initialStudentEmail,
          class: initialStudentClass,
          admissionNumber: initialStudentAdmissionNumber,
        }

        let resolvedProfile = fallbackStudent

        try {
          const profileRecord = await dbManager.getStudentProfile(initialStudentId)
          resolvedProfile = resolveStudentProfile(profileRecord, fallbackStudent)
        } catch (profileError) {
          logger.error("Failed to load student profile", {
            error: profileError,
            studentId: initialStudentId,
          })
          resolvedProfile = resolveStudentProfile(null, fallbackStudent)
        }

        if (!isActive) {
          return
        }

        setStudentProfile(resolvedProfile)
        setEffectiveStudentId((previous) => (previous !== resolvedProfile.id ? resolvedProfile.id : previous))
        setEffectiveClassName((previous) =>
          previous !== resolvedProfile.class ? resolvedProfile.class : previous,
        )

        const targetStudentId = resolvedProfile.id
        const targetClassName = resolvedProfile.class

        const [academicResult, attendanceResult, timetableResult, assignmentsResult, libraryResult] =
          await Promise.allSettled([
            dbManager.getStudentAcademicData(targetStudentId),
            dbManager.getStudentAttendance(targetStudentId),
            dbManager.getTimetable(targetClassName),
            dbManager.getAssignments({ studentId: targetStudentId }),
            dbManager.getLibraryBooks(targetStudentId),
          ])

        if (!isActive) {
          return
        }

        const teacherCandidates = new Set<string>()

        if (academicResult.status === "fulfilled") {
          const normalizedSubjects = normalizeIdentifiedCollection(academicResult.value, "subject").map(
            (subject) => {
              const record = subject as Record<string, unknown>
              const subjectName =
                normalizeString(subject.subject) ||
                normalizeString(getRecordValue(record, "name")) ||
                normalizeString(getRecordValue(record, "title")) ||
                "Subject"

              const totalCandidates = [
                subject.total,
                subject.totalPercentage,
                subject.percentage,
                getRecordValue(record, "totalScore"),
                getRecordValue(record, "totalMarks"),
                getRecordValue(record, "score"),
              ]

              const resolvedTotalCandidate = totalCandidates
                .map((value) => toNumber(value))
                .find((value) => Number.isFinite(value) && value > 0)

              const resolvedTotal = clampPercentage(
                resolvedTotalCandidate ?? toNumber(subject.totalPercentage ?? 0),
              )

              const gradeCandidate =
                normalizeString(subject.grade) || normalizeString(getRecordValue(record, "grade"))
              const resolvedGrade = gradeCandidate ? gradeCandidate.toUpperCase() : deriveGradeFromScore(resolvedTotal)

              const teacherCandidate =
                normalizeString(subject.teacherName) ||
                normalizeString(subject.teacher) ||
                normalizeString(getRecordValue(record, "instructor")) ||
                normalizeString(getRecordValue(record, "teacherName")) ||
                normalizeString(getRecordValue(record, "teacher")) ||
                ""

              if (teacherCandidate) {
                teacherCandidates.add(teacherCandidate)
              }

              return {
                ...subject,
                subject: subjectName,
                total: resolvedTotal,
                grade: resolvedGrade,
                teacherName: teacherCandidate || null,
              }
            },
          )

          setSubjects(normalizedSubjects)
        } else {
          setSubjects([])
        }

        const attendanceFallback = { present: 0, total: 0, percentage: 0 }
        if (attendanceResult.status === "fulfilled") {
          const summary = extractAttendanceSummary(attendanceResult.value, attendanceFallback)
          setAttendance(summary ?? attendanceFallback)
        } else {
          setAttendance(attendanceFallback)
        }

        let normalizedTimetable: TimetableSlotSummary[] = []
        if (timetableResult.status === "fulfilled") {
          normalizedTimetable = normalizeTimetableCollection(timetableResult.value).map((slot) => {
            const teacherName = normalizeString(slot.teacher)
            if (teacherName) {
              teacherCandidates.add(teacherName)
            }

            return {
              id: slot.id,
              day: slot.day,
              time: slot.time,
              subject: slot.subject,
              teacher: slot.teacher,
              location: slot.location,
            }
          })
        }
        setTimetable(normalizedTimetable)

        let normalizedAssignments: IdentifiedRecord[] = []
        if (assignmentsResult.status === "fulfilled") {
          normalizedAssignments = normalizeIdentifiedCollection(assignmentsResult.value, "assignment")

          normalizedAssignments.forEach((assignment) => {
            const assignmentRecord = assignment as Record<string, unknown>
            const teacherName =
              normalizeString(assignment.teacherName) ||
              normalizeString(assignment.teacher) ||
              normalizeString(getRecordValue(assignmentRecord, "teacherName")) ||
              normalizeString(getRecordValue(assignmentRecord, "teacher"))

            if (teacherName) {
              teacherCandidates.add(teacherName)
            }
          })
        }

        const filteredAssignments = filterAssignmentsForStudentRef.current(
          normalizedAssignments,
          teacherCandidates,
        )
        setAssignments(filteredAssignments)

        const normalizedLibraryBooks =
          libraryResult.status === "fulfilled"
            ? normalizeIdentifiedCollection(libraryResult.value, "libraryBook")
            : []
        setLibraryBooks(normalizedLibraryBooks)

        const nextTeacherList = Array.from(teacherCandidates)
        setStudentTeachers((previous) =>
          haveSameStringMembers(previous, nextTeacherList) ? previous : nextTeacherList,
        )
      } catch (error) {
        if (!isActive) {
          return
        }

        logger.error("Failed to load student dashboard data", { error, studentId: initialStudentId })
        setSubjects([])
        setAssignments([])
        setTimetable([])
        setLibraryBooks([])
        setAttendance({ present: 0, total: 0, percentage: 0 })
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadDashboardData()

    return () => {
      isActive = false
    }
  }, [
    initialStudentAdmissionNumber,
    initialStudentClass,
    initialStudentEmail,
    initialStudentId,
    initialStudentName,
  ])

  useEffect(() => {
    const studentIdCandidate =
      normalizeString(effectiveStudentId) ||
      normalizeString(studentProfile.id) ||
      normalizeString(student.id)
    const classHint =
      normalizeString(studentProfile.class) ||
      normalizeString(effectiveClassName) ||
      normalizeString(student.class)

    if (!studentIdCandidate && !classHint) {
      setAssignedClassTeachers([])
      setAssignedSubjectTeachers([])
      setTeacherLookupMessage("Class information is not available yet.")
      setTeacherLookupError(null)
      setIsTeacherLookupLoading(false)
      return
    }

    let isActive = true
    setIsTeacherLookupLoading(true)
    setTeacherLookupError(null)
    setTeacherLookupMessage(null)

    const params = new URLSearchParams()
    if (classHint) {
      params.set("className", classHint)
    }

    const targetId = studentIdCandidate || "__unknown__"

    const fetchAssignments = async () => {
      try {
        const response = await fetch(
          `/api/students/${encodeURIComponent(targetId)}/teachers${
            params.toString() ? `?${params.toString()}` : ""
          }`,
          { cache: "no-store" },
        )
        const payload = await response.json().catch(() => ({}))

        if (!isActive) {
          return
        }

        if (!response.ok) {
          const message =
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error?: string }).error
              : "Unable to load assigned teachers."
          throw new Error(message)
        }

        const rawClassTeachers = Array.isArray((payload as { classTeachers?: unknown }).classTeachers)
          ? ((payload as { classTeachers?: unknown[] }).classTeachers ?? [])
          : []
        const normalizedClassTeachers = rawClassTeachers
          .map((entry) => {
            const record = entry as Record<string, unknown>
            const teacherName =
              normalizeString(record.teacherName) ||
              normalizeString(record.name) ||
              normalizeString(record.teacher)
            if (!teacherName) {
              return null
            }

            const teacherId =
              normalizeString(record.teacherId) ||
              normalizeString(record.id) ||
              null
            const role = normalizeString(record.role) || "Class Teacher"
            const teacherEmail = normalizeString(record.teacherEmail) || normalizeString(record.email) || null

            return {
              teacherId,
              teacherName,
              role,
              teacherEmail,
            }
          })
          .filter((entry): entry is AssignedClassTeacher => entry !== null)

        const rawSubjectTeachers = Array.isArray((payload as { subjectTeachers?: unknown }).subjectTeachers)
          ? ((payload as { subjectTeachers?: unknown[] }).subjectTeachers ?? [])
          : []

        const subjectTeacherMap = new Map<string, AssignedSubjectTeacher>()
        rawSubjectTeachers.forEach((entry) => {
          const record = entry as Record<string, unknown>
          const subjectName =
            normalizeString(record.subject) ||
            normalizeString(record.subjectName) ||
            normalizeString(record.name)

          if (!subjectName) {
            return
          }

          const key = subjectName.toLowerCase()
          const teacherName =
            normalizeString(record.teacherName) ||
            normalizeString(record.teacher) ||
            normalizeString(record.name) ||
            null
          const teacherId =
            normalizeString(record.teacherId) ||
            normalizeString(record.id) ||
            null
          const teacherEmail = normalizeString(record.teacherEmail) || normalizeString(record.email) || null

          const assignment: AssignedSubjectTeacher = {
            subject: subjectName,
            teacherId,
            teacherName,
            teacherEmail,
          }

          if (!subjectTeacherMap.has(key) || !subjectTeacherMap.get(key)?.teacherName) {
            subjectTeacherMap.set(key, assignment)
          }
        })

        const subjectAssignments = Array.from(subjectTeacherMap.values()).sort((a, b) =>
          a.subject.localeCompare(b.subject),
        )

        setAssignedClassTeachers(normalizedClassTeachers)
        setAssignedSubjectTeachers(subjectAssignments)
        setTeacherLookupError(null)

        const payloadMessage =
          typeof (payload as { message?: unknown }).message === "string"
            ? ((payload as { message?: string }).message as string)
            : null
        setTeacherLookupMessage(payloadMessage)

        setStudentTeachers((previous) => {
          const names = new Set(previous)
          normalizedClassTeachers.forEach((teacher) => {
            if (teacher.teacherName) {
              names.add(teacher.teacherName)
            }
          })
          subjectAssignments.forEach((entry) => {
            if (entry.teacherName) {
              names.add(entry.teacherName)
            }
          })
          const next = Array.from(names)
          return haveSameStringMembers(previous, next) ? previous : next
        })
      } catch (error) {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Unable to load assigned teachers."
        setAssignedClassTeachers([])
        setAssignedSubjectTeachers([])
        setTeacherLookupError(message)
        setTeacherLookupMessage(null)
      } finally {
        if (isActive) {
          setIsTeacherLookupLoading(false)
        }
      }
    }

    void fetchAssignments()

    return () => {
      isActive = false
    }
  }, [
    effectiveClassName,
    effectiveStudentId,
    student.class,
    student.id,
    studentProfile.class,
    studentProfile.id,
  ])

  const getAssignmentStatusMeta = (status: unknown) => {
    const normalized = typeof status === "string" ? status : "sent"

    switch (normalized) {
      case "graded":
        return {
          label: "Graded",
          badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
          accent: "from-emerald-100/80",
          icon: <Award className="h-4 w-4 text-emerald-500" />,
        }
      case "submitted":
        return {
          label: "Submitted",
          badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
          accent: "from-blue-100/80",
          icon: <Upload className="h-4 w-4 text-blue-500" />,
        }
      case "overdue":
        return {
          label: "Overdue",
          badgeClass: "border-red-200 bg-red-50 text-red-700",
          accent: "from-red-100/80",
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        }
      default:
        return {
          label: "Awaiting submission",
          badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
          accent: "from-amber-100/80",
          icon: <Clock className="h-4 w-4 text-amber-500" />,
        }
    }
  }

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment) return

    try {
      let fileDataUrl: string | null = null

      if (submissionForm.file) {
        try {
          fileDataUrl = await readFileAsDataUrl(submissionForm.file)
        } catch (error) {
          logger.error("Failed to read submission file", { error })
          fileDataUrl = null
        }
      }

      const submissionData = {
        assignmentId: selectedAssignment.id,
        studentId: effectiveStudentId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        submittedFile: submissionForm.file?.name || null,
        submittedComment: submissionForm.comment,
        submittedFileUrl: fileDataUrl,
      }

      // Save to database
      await dbManager.submitAssignment(submissionData)

      // Update local state
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === selectedAssignment.id ? { ...assignment, ...submissionData } : assignment,
        ),
      )

      setShowSubmitConfirm(false)
      setSelectedAssignment(null)
      setSubmissionForm({ file: null, comment: "" })
    } catch (error) {
      logger.error("Failed to submit assignment", { error })
    }
  }

  const aggregatedUpcomingEvents = useMemo<UpcomingEventSummary[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dateFormatter = new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

    const parseDateValue = (value: unknown): Date | null => {
      if (typeof value !== "string" || value.trim().length === 0) {
        return null
      }

      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        return null
      }

      return parsed
    }

    const formatRangeLabel = (start: Date, end?: Date | null) => {
      if (!end || end.getTime() === start.getTime()) {
        return dateFormatter.format(start)
      }

      return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`
    }

    const collected: Array<{ sortKey: number; event: UpcomingEventSummary }> = []

    if (calendar.status === "published") {
      calendar.events.forEach((event) => {
        const start = parseDateValue(event.startDate)
        if (!start) {
          return
        }

        const end = parseDateValue(event.endDate ?? event.startDate)
        const endBoundary = new Date(end ?? start)
        endBoundary.setHours(23, 59, 59, 999)
        if (endBoundary < today) {
          return
        }

        const audience = typeof event.audience === "string" ? event.audience : "all"
        if (!["all", "students"].includes(audience)) {
          return
        }

        const normalizedStart = new Date(start)
        normalizedStart.setHours(0, 0, 0, 0)

        collected.push({
          sortKey: normalizedStart.getTime(),
          event: {
            id:
              typeof event.id === "string" && event.id.trim().length > 0
                ? `calendar_${event.id}`
                : `calendar_${normalizedStart.getTime()}`,
            title:
              typeof event.title === "string" && event.title.trim().length > 0
                ? event.title.trim()
                : "School event",
            date: formatRangeLabel(start, end),
            description:
              typeof event.description === "string" && event.description.trim().length > 0
                ? event.description
                : undefined,
            source: "calendar",
            location:
              typeof event.location === "string" && event.location.trim().length > 0
                ? event.location.trim()
                : null,
            category: typeof event.category === "string" ? event.category : null,
          },
        })
      })
    }

    assignments.forEach((assignment) => {
      const dueDate = typeof assignment.dueDate === "string" ? assignment.dueDate : null
      if (!dueDate) {
        return
      }

      const due = parseDateValue(dueDate)
      if (!due) {
        return
      }

      const endBoundary = new Date(due)
      endBoundary.setHours(23, 59, 59, 999)
      if (endBoundary < today) {
        return
      }

      collected.push({
        sortKey: due.getTime(),
        event: {
          id: `assignment_${assignment.id}`,
          title:
            typeof assignment.title === "string" && assignment.title.trim().length > 0
              ? `Assignment: ${assignment.title}`
              : "Assignment due",
          date: dateFormatter.format(due),
          description:
            typeof assignment.description === "string" && assignment.description.trim().length > 0
              ? assignment.description
              : undefined,
          source: "assignment",
        },
      })
    })

    const orderedUnique = new Map<string, UpcomingEventSummary>()

    collected
      .sort((a, b) => a.sortKey - b.sortKey)
      .forEach((entry) => {
        if (!orderedUnique.has(entry.event.id)) {
          orderedUnique.set(entry.event.id, entry.event)
        }
      })

    return Array.from(orderedUnique.values())
  }, [assignments, calendar.events, calendar.status])

  const subjectTeacherDetailMap = useMemo(() => {
    const map = new Map<string, AssignedSubjectTeacher>()
    assignedSubjectTeachers.forEach((entry) => {
      const key = entry.subject.toLowerCase()
      if (!map.has(key) || !map.get(key)?.teacherName) {
        map.set(key, entry)
      }
    })
    return map
  }, [assignedSubjectTeachers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading student data...</p>
        </div>
      </div>
    )
  }

  const averageGrade =
    subjects.length > 0
      ? Math.round(subjects.reduce((sum, subject) => sum + (subject.total || 0), 0) / subjects.length)
      : 0;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {studentProfile.name}</h1>
            <p className="text-green-100">
              Student Portal - {(studentProfile.class || effectiveClassName) ?? "Unassigned"} - {resolvedSchoolName}
            </p>
            <p className="text-sm text-green-200">
              Admission No: {studentProfile.admissionNumber || student.admissionNumber}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Button
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-amber-400 px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={() => router.push("/student/games")}
            >
              <Sparkles className="h-4 w-4 transition group-hover:rotate-12" /> Play Game
            </Button>
            <TutorialLink href="https://www.youtube.com/watch?v=1FJD7jZqZEk" variant="inverse" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{subjects.length}</p>
                <p className="text-sm text-gray-600">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{assignments.length}</p>
                <p className="text-sm text-gray-600">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{averageGrade}%</p>
                <p className="text-sm text-gray-600">Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{attendance.percentage}%</p>
                <p className="text-sm text-gray-600">Attendance</p>
                <p className="text-xs text-gray-500">
                  {attendance.present}/{attendance.total} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max flex-nowrap gap-1 bg-green-50 p-1">
            <TabsTrigger
              value="overview"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Subjects
            </TabsTrigger>
            <TabsTrigger
              value="timetable"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Timetable
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="library"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Library
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Academic Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subjects.slice(0, 3).map((subject, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{subject.subject}</span>
                        <span className="text-sm text-[#b29032] font-bold">{subject.grade}</span>
                      </div>
                      <Progress value={subject.total || 0} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {aggregatedUpcomingEvents.length > 0 ? (
                    aggregatedUpcomingEvents.slice(0, 3).map((event) => {
                      const style = UPCOMING_EVENT_SOURCE_STYLES[event.source] ?? {
                        label: "Schedule",
                        badgeClass: "border-gray-200 bg-gray-50 text-gray-600",
                      }

                      return (
                        <div
                          key={event.id}
                          className="rounded border border-[#b29032]/40 bg-yellow-50/60 p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-[#2d682d]">{event.title}</p>
                            <Badge variant="outline" className={`${style.badgeClass} text-[10px] font-semibold`}>
                              {style.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{event.date}</p>
                          {event.location ? (
                            <p className="text-xs text-gray-500">Location: {event.location}</p>
                          ) : null}
                          {event.description ? (
                            <p className="text-xs text-gray-500">{event.description}</p>
                          ) : null}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-gray-500">
                      {calendar.status === "published"
                        ? "No upcoming events"
                        : "No visible activities yet. Awaiting published calendar or class updates."}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

          <ExamScheduleOverview
            role="student"
            title="Upcoming Exams"
            description="Plan ahead with the latest exam schedule for your class."
            classNames={
              [studentProfile.class || effectiveClassName].filter(
                (value): value is string => typeof value === "string" && value.length > 0,
              )
            }
            className="h-full"
            emptyState="No upcoming exams scheduled for your class yet."
            limit={4}
          />
          <SchoolCalendarViewer role="student" className="md:col-span-2 xl:col-span-3" />
        </div>

        <div className="mt-8">
          <NotificationCenter
            userRole="student"
            userId={studentProfile.id}
            studentIds={[studentProfile.id, effectiveStudentId]}
          />
        </div>

        <div className="mt-8">
          <Noticeboard userRole="student" userName={studentProfile.name} />
        </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Assigned Teachers</CardTitle>
              <CardDescription>Meet the teachers guiding your class this term</CardDescription>
            </CardHeader>
            <CardContent>
              {isTeacherLookupLoading ? (
                <div className="flex items-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading assigned teachers...
                </div>
              ) : teacherLookupError ? (
                <p className="text-sm text-red-600">{teacherLookupError}</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-[#2d682d]" />
                        <h3 className="text-sm font-semibold text-gray-700">Class Teachers</h3>
                      </div>
                      {studentProfile.class || effectiveClassName ? (
                        <Badge variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                          {(studentProfile.class || effectiveClassName) ?? "Unassigned"}
                        </Badge>
                      ) : null}
                    </div>
                    {assignedClassTeachers.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {assignedClassTeachers.map((teacher) => (
                          <li
                            key={`${teacher.teacherId ?? teacher.teacherName}`}
                            className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-[#2d682d]">{teacher.teacherName}</p>
                              <p className="text-xs text-gray-500">{teacher.role}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">
                        {teacherLookupMessage ?? "No class teacher has been assigned yet."}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#b29032]" />
                      <h3 className="text-sm font-semibold text-gray-700">Subject Teachers</h3>
                    </div>
                    {assignedSubjectTeachers.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {assignedSubjectTeachers.map((entry) => (
                          <div
                            key={entry.subject.toLowerCase()}
                            className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm"
                          >
                            <p className="text-xs uppercase text-gray-500">{entry.subject}</p>
                            <p className="text-sm font-medium text-[#2d682d]">
                              {entry.teacherName ?? "Not Assigned"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">
                        {teacherLookupMessage
                          ? teacherLookupMessage
                          : "Subject teachers will appear once your school assigns them."}
                      </p>
                    )}
                  </div>
                  {teacherLookupMessage &&
                  (assignedClassTeachers.length > 0 || assignedSubjectTeachers.length > 0) ? (
                    <p className="text-xs text-gray-500">{teacherLookupMessage}</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Subjects</CardTitle>
              <CardDescription>View your subjects and assigned teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjects.map((subject, index) => {
                  const normalizedSubject =
                    typeof subject.subject === "string" ? subject.subject.toLowerCase() : ""
                  const assignedTeacher = normalizedSubject
                    ? subjectTeacherDetailMap.get(normalizedSubject)
                    : undefined
                  const teacherName =
                    assignedTeacher?.teacherName || subject.teacherName || "Not Assigned"

                  return (
                    <div key={index} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{subject.subject}</h3>
                        <div className="mt-1 flex items-start gap-2">
                          <User className="mt-0.5 h-4 w-4 text-[#2d682d]" />
                          <div>
                            <p className="text-sm font-medium text-[#2d682d]">Teacher: {teacherName}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Performance</span>
                            <span className="font-medium">{subject.total || 0}%</span>
                          </div>
                          <Progress value={subject.total || 0} className="h-2" />
                        </div>
                      </div>
                      <div className="text-center sm:ml-4">
                        <Badge variant="outline" className="text-[#b29032] border-[#b29032] font-bold text-lg px-3 py-1">
                          {subject.grade || "N/A"}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Class Timetable</CardTitle>
              <CardDescription>Your weekly class schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <TimetableWeeklyView
                slots={timetable}
                emptyMessage="No timetable available yet. Check back soon."
                renderDetails={(slot) => (
                  <p className="text-sm text-emerald-700/80">
                    {slot.teacher && slot.teacher.trim().length > 0
                      ? `With ${slot.teacher}`
                      : "Teacher to be announced"}
                    {slot.location && slot.location.trim().length > 0 ? ` • ${slot.location}` : ""}
                  </p>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Assignments</CardTitle>
              <CardDescription>Track your assignments and submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex items-center justify-between text-sm font-medium text-emerald-700">
                      <span>Completion rate</span>
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-emerald-900">
                      {studentAssignmentInsights.completionRate}%
                    </p>
                    <Progress value={studentAssignmentInsights.completionRate} className="mt-3 h-2 bg-emerald-100" />
                    <p className="mt-2 text-xs text-emerald-700/80">
                      {studentAssignmentInsights.submitted + studentAssignmentInsights.graded} of {studentAssignmentInsights.total}{" "}
                      assignments submitted.
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex items-center justify-between text-sm font-medium text-amber-700">
                      <span>Pending actions</span>
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-amber-900">
                      {studentAssignmentInsights.pending}
                    </p>
                    <p className="mt-2 text-xs text-amber-700/80">
                      Assignments still awaiting submission or grading feedback.
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between text-sm font-medium text-blue-700">
                      <span>Average score</span>
                      <Trophy className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-blue-900">
                      {studentAssignmentInsights.averageScore !== null
                        ? `${studentAssignmentInsights.averageScore}`
                        : "--"}
                    </p>
                    <p className="mt-2 text-xs text-blue-700/80">
                      Based on graded submissions available in this term.
                    </p>
                  </div>
                </div>

                {assignments.map((assignment) => {
                  const statusMeta = getAssignmentStatusMeta(assignment.status)
                  const submittedAt = typeof assignment.submittedAt === "string" ? assignment.submittedAt : ""
                  const grade = typeof assignment.grade === "string" ? assignment.grade : ""
                  const score =
                    typeof assignment.score === "number"
                      ? Math.round(assignment.score * 100) / 100
                      : null
                  const canSubmit = ["sent", "overdue"].includes(
                    typeof assignment.status === "string" ? assignment.status : "sent",
                  )

                  return (
                    <div
                      key={assignment.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${statusMeta.accent} via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                      />
                      <div className="relative z-10 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-800">
                            {statusMeta.icon}
                            <h3 className="text-lg font-semibold md:text-xl">
                              {typeof assignment.title === "string" ? assignment.title : "Assignment"}
                            </h3>
                          </div>
                          <Badge className={`${statusMeta.badgeClass} uppercase`}>{statusMeta.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                            {typeof assignment.subject === "string" ? assignment.subject : "Subject"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            {typeof assignment.teacher === "string" ? assignment.teacher : "Teacher"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-amber-500" /> Due {formatAssignmentDate(assignment.dueDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="h-3.5 w-3.5 text-purple-500" />
                            {resolveAssignmentMaximum(assignment, defaultAssignmentMaximum)} marks
                          </span>
                          <span className="text-slate-500">{describeDueDate(assignment.dueDate)}</span>
                        </div>
                        <p className="text-sm text-slate-700">
                          {typeof assignment.description === "string" && assignment.description.length > 0
                            ? assignment.description
                            : "No description provided for this assignment."}
                        </p>
                        {submittedAt ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                            <p className="flex items-center gap-2 font-medium">
                              <CheckCircle className="h-4 w-4 text-emerald-600" /> Submitted on {formatAssignmentDate(submittedAt)}
                            </p>
                            {typeof assignment.submittedFile === "string" && assignment.submittedFile.length > 0 ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-emerald-700/80">
                                <FileText className="h-4 w-4" />
                                <span>{assignment.submittedFile}</span>
                                {typeof assignment.submittedFileUrl === "string" && assignment.submittedFileUrl.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadSubmittedResource(assignment)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                                  >
                                    <Download className="h-3.5 w-3.5" /> Download submission
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {typeof assignment.submittedComment === "string" && assignment.submittedComment.length > 0 ? (
                              <p className="mt-1 italic text-emerald-700/80">“{assignment.submittedComment}”</p>
                            ) : null}
                          </div>
                        ) : null}
                        {grade || score !== null ? (
                          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                            <p className="flex items-center gap-2 font-medium">
                              <Trophy className="h-4 w-4 text-purple-600" />
                              Score: {score ?? "--"} / {resolveAssignmentMaximum(assignment, defaultAssignmentMaximum)}
                              {grade ? ` • Grade ${grade}` : ""}
                            </p>
                          </div>
                        ) : null}
                        {typeof assignment.resourceName === "string" && assignment.resourceName.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadAssignmentResource(assignment)}
                            className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                          >
                            <Download className="h-3.5 w-3.5" /> {assignment.resourceName}
                          </button>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {canSubmit ? (
                            <Button
                              size="sm"
                              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                              onClick={() => {
                                setSelectedAssignment(assignment)
                                setShowSubmitConfirm(true)
                              }}
                            >
                              <Upload className="w-4 h-4 mr-1" /> Submit Assignment
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {grade ? "Keep up the great work!" : "You've already submitted this assignment."}
                            </p>
                          )}
                          {typeof assignment.status === "string" && assignment.status === "overdue" ? (
                            <p className="text-xs font-medium text-red-600">This assignment is overdue — submit as soon as possible.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Study Materials</CardTitle>
              <CardDescription>
                Access study materials for your class ({(studentProfile.class || effectiveClassName) ?? "Unassigned"})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudyMaterials
                userRole="student"
                studentClass={effectiveClassName}
                allowedTeacherNames={studentTeachers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Library Books</CardTitle>
              <CardDescription>Manage your borrowed books</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {libraryBooks.map((book) => (
                  <div key={book.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{book.title}</h3>
                      <p className="text-sm text-gray-600">by {book.author}</p>
                      <p className="text-sm text-gray-500">Due: {book.dueDate}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={book.status === "overdue" ? "destructive" : "default"}>{book.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRenewBook(book.id)}
                        disabled={book.status === "overdue"}
                      >
                        Renew
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        

        

        
      </Tabs>

      

      

      

      {/* Assignment Submission Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
            <DialogDescription>
              {selectedAssignment?.title} - {selectedAssignment?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" /> Due {formatAssignmentDate(selectedAssignment.dueDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-purple-500" />
                    {resolveAssignmentMaximum(selectedAssignment, defaultAssignmentMaximum)} marks
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-emerald-500" />
                    {typeof selectedAssignment.teacher === "string"
                      ? selectedAssignment.teacher
                      : typeof selectedAssignment.teacherName === "string"
                        ? selectedAssignment.teacherName
                        : "Subject teacher"}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  {typeof selectedAssignment.description === "string" && selectedAssignment.description.length > 0
                    ? selectedAssignment.description
                    : "No description has been provided for this assignment yet."}
                </p>
                {typeof selectedAssignment.resourceName === "string" && selectedAssignment.resourceName.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadAssignmentResource(selectedAssignment)}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                  >
                    <Download className="h-3.5 w-3.5" /> Download attachment ({selectedAssignment.resourceName})
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No attachment was provided for this assignment.</p>
                )}
              </div>
            ) : null}
            <div>
              <Label htmlFor="file">Upload File (Optional)</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) =>
                  setSubmissionForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] || null,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="comment">Comment (Optional)</Label>
              <Textarea
                id="comment"
                placeholder="Add any comments about your submission..."
                value={submissionForm.comment}
                onChange={(e) => setSubmissionForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">Are you sure you want to submit this assignment?</p>
              <p className="text-xs text-yellow-700 mt-1">
                Once submitted, the status will change to &quot;Submitted&quot; and your teacher will be notified.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              No, Cancel
            </Button>
            <Button onClick={handleSubmitAssignment} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Yes, Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
