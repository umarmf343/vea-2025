"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BookOpen, Users, FileText, GraduationCap, Clock, User, Plus, Save, Loader2 } from "lucide-react"
import { StudyMaterials } from "@/components/study-materials"
import { Noticeboard } from "@/components/noticeboard"
import { InternalMessaging } from "@/components/internal-messaging"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { EnhancedReportCard } from "@/components/enhanced-report-card"
import {
  CONTINUOUS_ASSESSMENT_MAXIMUMS,
  calculateContinuousAssessmentTotal,
  calculateGrandTotal,
  deriveGradeFromScore,
  mapTermKeyToLabel,
  normalizeAssessmentScores,
} from "@/lib/grade-utils"
import { safeStorage } from "@/lib/safe-storage"
import { dbManager } from "@/lib/database-manager"
import { logger } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import {
  REPORT_CARD_WORKFLOW_EVENT,
  getWorkflowRecords,
  getWorkflowSummary,
  resetReportCardSubmission,
  submitReportCardsForApproval,
  type ReportCardWorkflowRecord,
} from "@/lib/report-card-workflow"
import {
  AFFECTIVE_TRAITS,
  BEHAVIORAL_RATING_OPTIONS,
  PSYCHOMOTOR_SKILLS,
  normalizeBehavioralRating,
} from "@/lib/report-card-constants"
import type { RawReportCardData } from "@/lib/report-card-types"

type BrowserRuntime = typeof globalThis & Partial<Window>

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  return globalThis as BrowserRuntime
}

interface TeacherDashboardProps {
  teacher: {
    id: string
    name: string
    email: string
    subjects: string[]
    classes: string[]
  }
}

interface TeacherExamSummary {
  id: string
  subject: string
  className: string
  examDate: string
  startTime: string
  endTime: string
  term: string
  session: string
  status: "scheduled" | "completed" | "cancelled"
}

interface TeacherTimetableSlot {
  id: string
  day: string
  time: string
  subject: string
  teacher: string
  location?: string | null
}

type BehavioralDomainState = Record<number, Record<string, string>>
type AttendanceState = Record<number, { present: number; absent: number; total: number }>
type StudentStatusState = Record<number, string>

type TermInfoState = {
  numberInClass: string
  nextTermBegins: string
  vacationEnds: string
  nextTermFees: string
  feesBalance: string
}

const STUDENT_STATUS_OPTIONS = [
  { value: "promoted", label: "Promoted" },
  { value: "promoted-on-trial", label: "Promoted on Trial" },
  { value: "repeat", label: "Repeat Class" },
  { value: "withdrawn", label: "Withdrawn" },
] as const

const createEmptyTermInfo = (): TermInfoState => ({
  numberInClass: "",
  nextTermBegins: "",
  vacationEnds: "",
  nextTermFees: "",
  feesBalance: "",
})

interface MarksRecord {
  studentId: number
  studentName: string
  firstCA: number
  secondCA: number
  noteAssignment: number
  caTotal: number
  exam: number
  grandTotal: number
  totalMarksObtainable: number
  totalMarksObtained: number
  averageScore: number
  position: number
  grade: string
  teacherRemark: string
}

interface AssignmentSubmissionRecord {
  id: string
  studentId: string
  status: "pending" | "submitted" | "graded"
  submittedAt: string | null
  files?: { id: string; name: string }[]
  comment?: string | null
  grade?: string | null
}

interface TeacherAssignmentSummary {
  id: string
  title: string
  description: string
  subject: string
  className: string
  dueDate: string
  status: string
  submissions: AssignmentSubmissionRecord[]
  assignedStudentIds: string[]
  resourceName?: string | null
  resourceType?: string | null
  resourceUrl?: string | null
  resourceSize?: number | null
  updatedAt?: string
}

export function TeacherDashboard({ teacher }: TeacherDashboardProps) {
  const { toast } = useToast()
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [showSubmissions, setShowSubmissions] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignmentSummary | null>(null)
  const [selectedClass, setSelectedClass] = useState(teacher.classes[0] ?? "")
  const [selectedSubject, setSelectedSubject] = useState(teacher.subjects[0] ?? "")
  const [selectedTerm, setSelectedTerm] = useState("first")
  const [selectedSession, setSelectedSession] = useState("2024/2025")
  const [workflowRecords, setWorkflowRecords] = useState<ReportCardWorkflowRecord[]>([])
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false)
  const [isCancellingSubmission, setIsCancellingSubmission] = useState(false)
  const [additionalData, setAdditionalData] = useState(() => ({
    classPositions: {} as Record<number, number>,
    affectiveDomain: {} as BehavioralDomainState,
    psychomotorDomain: {} as BehavioralDomainState,
    classTeacherRemarks: {} as Record<number, string>,
    attendance: {} as AttendanceState,
    studentStatus: {} as StudentStatusState,
    termInfo: createEmptyTermInfo(),
  }))
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<RawReportCardData | null>(null)

  const [assignmentForm, setAssignmentForm] = useState(() => ({
    title: "",
    description: "",
    dueDate: "",
    subject: teacher.subjects[0] ?? "",
    className: teacher.classes[0] ?? "",
    file: null as File | null,
  }))
  const [assignments, setAssignments] = useState<TeacherAssignmentSummary[]>([])
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(true)
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)

  const [teacherExams, setTeacherExams] = useState<TeacherExamSummary[]>([])
  const [isExamLoading, setIsExamLoading] = useState(true)
  const [teacherTimetable, setTeacherTimetable] = useState<TeacherTimetableSlot[]>([])
  const [isTeacherTimetableLoading, setIsTeacherTimetableLoading] = useState(true)
  const [isSyncingGrades, setIsSyncingGrades] = useState(false)

  const subjectSummary =
    teacher.subjects.length > 0 ? teacher.subjects.join(", ") : "No subjects assigned yet"
  const classSummary =
    teacher.classes.length > 0 ? teacher.classes.join(", ") : "No classes assigned yet"

  useEffect(() => {
    setSelectedClass(teacher.classes[0] ?? "")
  }, [teacher.classes])

  useEffect(() => {
    setSelectedSubject(teacher.subjects[0] ?? "")
  }, [teacher.subjects])

  useEffect(() => {
    setAssignmentForm((prev) => ({
      ...prev,
      subject: prev.subject || (teacher.subjects[0] ?? ""),
      className: prev.className || (teacher.classes[0] ?? ""),
    }))
  }, [teacher.classes, teacher.subjects])

  const mockStudents = [
    { id: 1, name: "John Doe", class: "JSS 1A", subjects: ["Mathematics", "English"] },
    { id: 2, name: "Jane Smith", class: "JSS 1A", subjects: ["Mathematics"] },
    { id: 3, name: "Mike Johnson", class: "JSS 2B", subjects: ["English"] },
  ]

  const formatExamDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value))
    } catch (error) {
      return value
    }
  }

  const normalizeClassName = (value: string) => value.replace(/\s+/g, "").toLowerCase()

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.onerror = () => reject(new Error("Unable to read file"))
      reader.readAsDataURL(file)
    })

  const loadAssignments = useCallback(async () => {
    try {
      setIsAssignmentsLoading(true)
      const records = await dbManager.getAssignments({ teacherId: teacher.id })

      const normalised = records.map((record) => {
        const submissions = Array.isArray(record.submissions) ? record.submissions : []
        const assignedStudentIds = Array.isArray(record.assignedStudentIds)
          ? record.assignedStudentIds
          : []

        return {
          id: String(record.id),
          title: record.title,
          description: record.description ?? "",
          subject: record.subject,
          className: record.className ?? (record as { class?: string }).class ?? "General",
          dueDate: record.dueDate,
          status: record.status ?? "sent",
          submissions,
          assignedStudentIds,
          resourceName: record.resourceName ?? null,
          resourceType: record.resourceType ?? null,
          resourceUrl: record.resourceUrl ?? null,
          resourceSize:
            typeof record.resourceSize === "number"
              ? record.resourceSize
              : record.resourceSize
                ? Number(record.resourceSize)
                : null,
          updatedAt: record.updatedAt,
        } satisfies TeacherAssignmentSummary
      })

      setAssignments(normalised)
    } catch (error) {
      logger.error("Failed to load teacher assignments", { error })
      toast({
        variant: "destructive",
        title: "Unable to load assignments",
        description: "We could not retrieve your assignments. Please try again shortly.",
      })
    } finally {
      setIsAssignmentsLoading(false)
    }
  }, [teacher.id, toast])

  const sortedTeacherTimetable = useMemo(
    () => teacherTimetable.slice().sort((a, b) => a.time.localeCompare(b.time)),
    [teacherTimetable],
  )

  useEffect(() => {
    void loadAssignments()

    const handleAssignmentsUpdate = () => {
      void loadAssignments()
    }

    dbManager.on("assignmentsUpdate", handleAssignmentsUpdate)

    return () => {
      dbManager.off("assignmentsUpdate", handleAssignmentsUpdate)
    }
  }, [loadAssignments])

  useEffect(() => {
    let isMounted = true

    const loadExams = async () => {
      try {
        setIsExamLoading(true)
        const schedules = await dbManager.getExamSchedules()
        if (!isMounted) return

        const normalizedClasses = new Set(teacher.classes.map((cls) => normalizeClassName(cls)))
        const relevantExams = schedules.filter((exam) =>
          normalizedClasses.has(normalizeClassName(exam.className)),
        )

        setTeacherExams(relevantExams)
      } catch (error) {
        logger.error("Failed to load teacher exams", { error })
      } finally {
        if (isMounted) {
          setIsExamLoading(false)
        }
      }
    }

    loadExams()

    const handleExamUpdate = () => {
      loadExams()
    }

    dbManager.on("examScheduleUpdated", handleExamUpdate)
    dbManager.on("examResultsUpdated", handleExamUpdate)

    return () => {
      isMounted = false
      dbManager.off("examScheduleUpdated", handleExamUpdate)
      dbManager.off("examResultsUpdated", handleExamUpdate)
    }
  }, [teacher.classes])

  useEffect(() => {
    let isMounted = true

    const loadTimetable = async () => {
      if (!selectedClass) {
        setTeacherTimetable([])
        setIsTeacherTimetableLoading(false)
        return
      }

      try {
        setIsTeacherTimetableLoading(true)
        const response = await fetch(`/api/timetable?className=${encodeURIComponent(selectedClass)}`)
        if (!isMounted) return

        if (response.ok) {
          const data: unknown = await response.json()
          const slots = Array.isArray((data as Record<string, unknown>)?.timetable)
            ? ((data as Record<string, unknown>).timetable as unknown[])
            : []
          setTeacherTimetable(
            slots.map((slot) => {
              if (!slot || typeof slot !== "object") {
                return {
                  id: `slot_${Math.random().toString(36).slice(2)}`,
                  day: "Monday",
                  time: "8:00 AM - 8:45 AM",
                  subject: "",
                  teacher: "",
                  location: null,
                }
              }

              const record = slot as Record<string, unknown>
              return {
                id: typeof record.id === "string" ? record.id : String(record.id ?? `slot_${Date.now()}`),
                day: typeof record.day === "string" ? record.day : "Monday",
                time: typeof record.time === "string" ? record.time : String(record.startTime ?? "8:00 AM - 8:45 AM"),
                subject: typeof record.subject === "string" ? record.subject : "",
                teacher: typeof record.teacher === "string" ? record.teacher : "",
                location: typeof record.location === "string" ? record.location : null,
              }
            }),
          )
        } else {
          setTeacherTimetable([])
        }
      } catch (error) {
        logger.error("Failed to load teacher timetable", { error })
        if (isMounted) {
          setTeacherTimetable([])
        }
      } finally {
        if (isMounted) {
          setIsTeacherTimetableLoading(false)
        }
      }
    }

    void loadTimetable()

    return () => {
      isMounted = false
    }
  }, [selectedClass])

  const [marksData, setMarksData] = useState<MarksRecord[]>([
    {
      studentId: 1,
      studentName: "John Doe",
      firstCA: 19,
      secondCA: 18,
      noteAssignment: 19,
      caTotal: 56,
      exam: 36,
      grandTotal: 92,
      totalMarksObtainable: 100,
      totalMarksObtained: 92,
      averageScore: 92,
      position: 1,
      grade: "A",
      teacherRemark: "Excellent performance",
    },
    {
      studentId: 2,
      studentName: "Jane Smith",
      firstCA: 17,
      secondCA: 16,
      noteAssignment: 17,
      caTotal: 50,
      exam: 32,
      grandTotal: 82,
      totalMarksObtainable: 100,
      totalMarksObtained: 82,
      averageScore: 82,
      position: 2,
      grade: "B",
      teacherRemark: "Strong understanding of concepts",
    },
    {
      studentId: 3,
      studentName: "Mike Johnson",
      firstCA: 14,
      secondCA: 13,
      noteAssignment: 15,
      caTotal: 42,
      exam: 28,
      grandTotal: 70,
      totalMarksObtainable: 100,
      totalMarksObtained: 70,
      averageScore: 70,
      position: 3,
      grade: "C",
      teacherRemark: "Showing steady improvement",
    },
  ])

  const calculatePositionsAndAverages = (data: MarksRecord[]) => {
    // Sort by grand total descending to determine positions
    const sorted = [...data].sort((a, b) => b.grandTotal - a.grandTotal)

    return data.map((student) => {
      const position = sorted.findIndex((s) => s.studentId === student.studentId) + 1
      const averageScore =
        student.totalMarksObtained > 0 && student.totalMarksObtainable > 0
          ? Math.round((student.totalMarksObtained / student.totalMarksObtainable) * 100)
          : 0

      return {
        ...student,
        position,
        averageScore,
        totalMarksObtained: student.grandTotal, // Update obtained marks to match grand total
      }
    })
  }

  const calculateGrade = (total: number) => deriveGradeFromScore(total)

  const handleMarksUpdate = (studentId: number, field: string, value: unknown) => {
    setMarksData((prev) => {
      const updated = prev.map((student) => {
        if (student.studentId !== studentId) {
          return student
        }

        if (field === "teacherRemark") {
          return { ...student, teacherRemark: typeof value === "string" ? value : student.teacherRemark }
        }

        if (field === "totalMarksObtainable") {
          const numericValue = typeof value === "number" ? value : Number(value)
          const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 100
          return { ...student, totalMarksObtainable: safeValue }
        }

        const numericValue = typeof value === "number" ? value : Number(value)
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0
        let updatedStudent: MarksRecord = { ...student, [field]: safeValue }

        const normalizedScores = normalizeAssessmentScores({
          ca1: updatedStudent.firstCA,
          ca2: updatedStudent.secondCA,
          assignment: updatedStudent.noteAssignment,
          exam: updatedStudent.exam,
        })

        updatedStudent = {
          ...updatedStudent,
          firstCA: normalizedScores.ca1,
          secondCA: normalizedScores.ca2,
          noteAssignment: normalizedScores.assignment,
          exam: normalizedScores.exam,
        }

        const caTotal = calculateContinuousAssessmentTotal(
          normalizedScores.ca1,
          normalizedScores.ca2,
          normalizedScores.assignment,
        )
        const grandTotal = calculateGrandTotal(
          normalizedScores.ca1,
          normalizedScores.ca2,
          normalizedScores.assignment,
          normalizedScores.exam,
        )

        updatedStudent.caTotal = caTotal
        updatedStudent.grandTotal = grandTotal
        updatedStudent.totalMarksObtained = grandTotal
        updatedStudent.grade = calculateGrade(grandTotal)

        return updatedStudent
      })

      return calculatePositionsAndAverages(updated)
    })
  }

  const openPreviewForStudent = useCallback(
    (student: MarksRecord) => {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Choose a class and subject to generate a report card preview.",
        })
        return
      }

      const attendanceStats = additionalData.attendance[student.studentId] ?? {
        present: 0,
        absent: 0,
        total: 0,
      }
      const totalAttendance =
        attendanceStats.total && attendanceStats.total > 0
          ? attendanceStats.total
          : attendanceStats.present + attendanceStats.absent

      const summaryGrade = deriveGradeFromScore(student.averageScore)
      const preview: RawReportCardData = {
        student: {
          id: String(student.studentId),
          name: student.studentName,
          admissionNumber: `VEA/${student.studentId}`,
          class: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          numberInClass: additionalData.termInfo.numberInClass,
          status: additionalData.studentStatus[student.studentId],
        },
        subjects: [
          {
            name: selectedSubject || "Subject",
            ca1: student.firstCA,
            ca2: student.secondCA,
            assignment: student.noteAssignment,
            caTotal: student.caTotal,
            exam: student.exam,
            total: student.grandTotal,
            grade: student.grade,
            remarks: student.teacherRemark,
            position: student.position,
          },
        ],
        summary: {
          totalMarksObtainable: student.totalMarksObtainable,
          totalMarksObtained: student.totalMarksObtained,
          averageScore: student.averageScore,
          position: student.position,
          numberOfStudents: marksData.length,
          grade: summaryGrade,
        },
        totalObtainable: student.totalMarksObtainable,
        totalObtained: student.totalMarksObtained,
        average: student.averageScore,
        position: student.position,
        affectiveDomain: additionalData.affectiveDomain[student.studentId] ?? {},
        psychomotorDomain: additionalData.psychomotorDomain[student.studentId] ?? {},
        classTeacherRemarks: additionalData.classTeacherRemarks[student.studentId] ?? "",
        remarks: {
          classTeacher: additionalData.classTeacherRemarks[student.studentId] ?? student.teacherRemark,
        },
        attendance: {
          present: attendanceStats.present ?? 0,
          absent: attendanceStats.absent ?? 0,
          total: totalAttendance,
        },
        termInfo: {
          numberInClass: additionalData.termInfo.numberInClass,
          vacationEnds: additionalData.termInfo.vacationEnds,
          nextTermBegins: additionalData.termInfo.nextTermBegins,
          nextTermFees: additionalData.termInfo.nextTermFees,
          feesBalance: additionalData.termInfo.feesBalance,
        },
      }

      setPreviewStudentId(student.studentId)
      setPreviewData(preview)
      setPreviewDialogOpen(true)
    },
    [
      additionalData,
      marksData.length,
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      selectedSubject,
      toast,
    ],
  )

  const handleSyncAcademicMarks = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Choose both a class and subject before syncing grades.",
        })
        return
      }

      if (marksData.length === 0) {
        toast({
          variant: "destructive",
          title: "No marks recorded",
          description: "Add student scores before sending them to the exam office.",
        })
        return
      }

      const termLabel = mapTermKeyToLabel(selectedTerm)
      const normalizedClass = normalizeClassName(selectedClass)
      const matchingExam = teacherExams.find(
        (exam) =>
          normalizeClassName(exam.className) === normalizedClass &&
          exam.subject.toLowerCase() === selectedSubject.toLowerCase() &&
          exam.term === termLabel &&
          exam.session === selectedSession,
      )

      if (!matchingExam) {
        toast({
          variant: "destructive",
          title: "Exam schedule not found",
          description: "Ask the administrator to schedule this assessment in Exam Management first.",
        })
        return
      }

      setIsSyncingGrades(true)

      const resultsPayload = marksData.map((student) => {
        const normalizedScores = normalizeAssessmentScores({
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: student.noteAssignment,
          exam: student.exam,
        })
        const total = calculateGrandTotal(
          normalizedScores.ca1,
          normalizedScores.ca2,
          normalizedScores.assignment,
          normalizedScores.exam,
        )

        return {
          studentId: String(student.studentId),
          studentName: student.studentName,
          ca1: normalizedScores.ca1,
          ca2: normalizedScores.ca2,
          assignment: normalizedScores.assignment,
          exam: normalizedScores.exam,
          grade: deriveGradeFromScore(total),
          position: student.position,
          remarks: student.teacherRemark.trim() ? student.teacherRemark.trim() : undefined,
          totalStudents: marksData.length,
          status: "pending" as const,
        }
      })

      await dbManager.saveExamResults(matchingExam.id, resultsPayload, { autoPublish: false })
      toast({
        title: "Grades synced",
        description: "Marks are now available in the admin Exam Management portal for consolidation.",
      })
    } catch (error) {
      logger.error("Failed to sync academic marks", { error })
      toast({
        variant: "destructive",
        title: "Unable to sync grades",
        description: "Please try again or contact the administrator if the problem persists.",
      })
    } finally {
      setIsSyncingGrades(false)
    }
  }

  const normalizedTermLabel = useMemo(() => mapTermKeyToLabel(selectedTerm), [selectedTerm])

  const loadAdditionalData = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }

    const parseStorageRecord = (key: string) => {
      try {
        const storedValue = safeStorage.getItem(key)
        if (!storedValue) {
          return {}
        }
        const parsed = JSON.parse(storedValue)
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
      } catch (error) {
        logger.error(`Failed to parse ${key} storage`, { error })
        return {}
      }
    }

    const behavioralStore = parseStorageRecord("behavioralAssessments")
    const attendanceStore = parseStorageRecord("attendancePositions")
    const remarksStore = parseStorageRecord("classTeacherRemarks")

    const nextState = {
      classPositions: {} as Record<number, number>,
      affectiveDomain: {} as BehavioralDomainState,
      psychomotorDomain: {} as BehavioralDomainState,
      classTeacherRemarks: {} as Record<number, string>,
      attendance: {} as AttendanceState,
      studentStatus: {} as StudentStatusState,
      termInfo: createEmptyTermInfo(),
    }

    let termInfoLoaded = false

    marksData.forEach((student) => {
      const studentKey = `${student.studentId}-${normalizedTermLabel}-${selectedSession}`

      const behavioralRecord = behavioralStore[studentKey] as
        | {
            affectiveDomain?: Record<string, unknown>
            psychomotorDomain?: Record<string, unknown>
          }
        | undefined

      if (behavioralRecord) {
        const affectiveRatings: Record<string, string> = {}
        const storedAffective = behavioralRecord.affectiveDomain ?? {}
        AFFECTIVE_TRAITS.forEach(({ key }) => {
          const rating = normalizeBehavioralRating(
            typeof storedAffective[key] === "string" ? (storedAffective[key] as string) : undefined,
          )
          if (rating) {
            affectiveRatings[key] = rating
          }
        })
        if (Object.keys(affectiveRatings).length > 0) {
          nextState.affectiveDomain[student.studentId] = affectiveRatings
        }

        const psychomotorRatings: Record<string, string> = {}
        const storedPsychomotor = behavioralRecord.psychomotorDomain ?? {}
        PSYCHOMOTOR_SKILLS.forEach(({ key }) => {
          const rating = normalizeBehavioralRating(
            typeof storedPsychomotor[key] === "string" ? (storedPsychomotor[key] as string) : undefined,
          )
          if (rating) {
            psychomotorRatings[key] = rating
          }
        })
        if (Object.keys(psychomotorRatings).length > 0) {
          nextState.psychomotorDomain[student.studentId] = psychomotorRatings
        }
      }

      const attendanceRecord = attendanceStore[studentKey] as
        | {
            position?: number | string | null
            attendance?: { present?: number; absent?: number; total?: number }
            status?: string
            termInfo?: Partial<TermInfoState>
          }
        | undefined

      if (attendanceRecord) {
        const positionValue = attendanceRecord.position
        if (typeof positionValue === "number" && Number.isFinite(positionValue)) {
          nextState.classPositions[student.studentId] = positionValue
        } else if (typeof positionValue === "string" && positionValue.trim().length > 0) {
          const parsedPosition = Number.parseInt(positionValue, 10)
          if (!Number.isNaN(parsedPosition)) {
            nextState.classPositions[student.studentId] = parsedPosition
          }
        }

        if (attendanceRecord.attendance && typeof attendanceRecord.attendance === "object") {
          const { present = 0, absent = 0, total = 0 } = attendanceRecord.attendance
          nextState.attendance[student.studentId] = {
            present: Number.isFinite(present) ? present : 0,
            absent: Number.isFinite(absent) ? absent : 0,
            total: Number.isFinite(total) ? total : 0,
          }
        }

        if (typeof attendanceRecord.status === "string") {
          nextState.studentStatus[student.studentId] = attendanceRecord.status
        }

        if (attendanceRecord.termInfo && typeof attendanceRecord.termInfo === "object") {
          termInfoLoaded = true
          nextState.termInfo = {
            numberInClass:
              typeof attendanceRecord.termInfo.numberInClass === "number"
                ? String(attendanceRecord.termInfo.numberInClass)
                : attendanceRecord.termInfo.numberInClass ?? nextState.termInfo.numberInClass,
            nextTermBegins: attendanceRecord.termInfo.nextTermBegins ?? nextState.termInfo.nextTermBegins,
            vacationEnds: attendanceRecord.termInfo.vacationEnds ?? nextState.termInfo.vacationEnds,
            nextTermFees: attendanceRecord.termInfo.nextTermFees ?? nextState.termInfo.nextTermFees,
            feesBalance: attendanceRecord.termInfo.feesBalance ?? nextState.termInfo.feesBalance,
          }
        }
      }

      const remarksRecord = remarksStore[studentKey] as { remark?: string } | undefined
      if (remarksRecord?.remark) {
        nextState.classTeacherRemarks[student.studentId] = remarksRecord.remark
      }
    })

    setAdditionalData((prev) => ({
      ...prev,
      classPositions: nextState.classPositions,
      affectiveDomain: nextState.affectiveDomain,
      psychomotorDomain: nextState.psychomotorDomain,
      classTeacherRemarks: nextState.classTeacherRemarks,
      attendance: nextState.attendance,
      studentStatus: nextState.studentStatus,
      termInfo: termInfoLoaded ? nextState.termInfo : createEmptyTermInfo(),
    }))
  }, [marksData, normalizedTermLabel, selectedSession])

  useEffect(() => {
    loadAdditionalData()
  }, [loadAdditionalData])

  useEffect(() => {
    setWorkflowRecords(getWorkflowRecords())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleWorkflowUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ records?: ReportCardWorkflowRecord[] }>).detail
      if (Array.isArray(detail?.records)) {
        setWorkflowRecords(detail.records)
      }
    }

    window.addEventListener(REPORT_CARD_WORKFLOW_EVENT, handleWorkflowUpdate as EventListener)
    return () => {
      window.removeEventListener(REPORT_CARD_WORKFLOW_EVENT, handleWorkflowUpdate as EventListener)
    }
  }, [])

  const currentWorkflowRecords = useMemo(
    () =>
      workflowRecords.filter(
        (record) =>
          record.className === selectedClass &&
          record.subject === selectedSubject &&
          record.term === normalizedTermLabel &&
          record.session === selectedSession &&
          record.teacherId === teacher.id,
      ),
    [normalizedTermLabel, selectedClass, selectedSession, selectedSubject, teacher.id, workflowRecords],
  )

  const currentStatus = useMemo(() => getWorkflowSummary(currentWorkflowRecords), [currentWorkflowRecords])

  const handleSubmitForApproval = useCallback(async () => {
    if (!selectedClass || !selectedSubject) {
      toast({
        variant: "destructive",
        title: "Select class & subject",
        description: "Choose a class and subject before sending report cards for approval.",
      })
      return
    }

    if (!marksData.length) {
      toast({
        variant: "destructive",
        title: "No student results",
        description: "Add student scores before submitting for approval.",
      })
      return
    }

    try {
      setIsSubmittingForApproval(true)
      const updated = submitReportCardsForApproval({
        teacherId: teacher.id,
        teacherName: teacher.name,
        className: selectedClass,
        subject: selectedSubject,
        term: normalizedTermLabel,
        session: selectedSession,
        students: marksData.map((student) => ({
          id: student.studentId,
          name: student.studentName,
        })),
      })

      setWorkflowRecords(updated)
      toast({
        title: "Sent for approval",
        description: "Admin has been notified to review this result batch.",
      })
    } catch (error) {
      logger.error("Failed to submit report cards for approval", { error })
      toast({
        variant: "destructive",
        title: "Unable to submit",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsSubmittingForApproval(false)
    }
  }, [
    marksData,
    normalizedTermLabel,
    selectedClass,
    selectedSession,
    selectedSubject,
    teacher.id,
    teacher.name,
    toast,
  ])

  const handleCancelSubmission = useCallback(async () => {
    try {
      setIsCancellingSubmission(true)
      const updated = resetReportCardSubmission({
        teacherId: teacher.id,
        className: selectedClass,
        subject: selectedSubject,
        term: normalizedTermLabel,
        session: selectedSession,
      })
      setWorkflowRecords(updated)
      toast({
        title: "Submission cancelled",
        description: "You can continue editing the report card details before resubmitting.",
      })
    } catch (error) {
      logger.error("Failed to cancel report card submission", { error })
      toast({
        variant: "destructive",
        title: "Unable to cancel submission",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsCancellingSubmission(false)
    }
  }, [normalizedTermLabel, selectedClass, selectedSession, selectedSubject, teacher.id, toast])

  const handleDownloadAssignmentAttachment = (assignment: TeacherAssignmentSummary) => {
    if (!assignment.resourceUrl) {
      toast({
        variant: "destructive",
        title: "No attachment",
        description: "This assignment does not have an attachment to download.",
      })
      return
    }

    const runtime = getBrowserRuntime()
    if (!runtime?.document) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: "Attachments can only be downloaded in a browser environment.",
      })
      return
    }

    const link = runtime.document.createElement("a")
    link.href = assignment.resourceUrl
    link.download = assignment.resourceName || `${assignment.title}.attachment`
    runtime.document.body?.appendChild(link)
    link.click()
    runtime.document.body?.removeChild(link)
  }

  const handleCreateAssignment = async () => {
    if (!assignmentForm.title || !assignmentForm.subject || !assignmentForm.className || !assignmentForm.dueDate) {
      toast({
        variant: "destructive",
        title: "Incomplete details",
        description: "Please provide the title, subject, class, and due date for the assignment.",
      })
      return
    }

    try {
      setIsCreatingAssignment(true)
      let attachmentData: string | null = null
      let attachmentType: string | null = null
      let attachmentSize: number | null = null
      let attachmentName: string | null = null

      if (assignmentForm.file) {
        attachmentData = await readFileAsDataUrl(assignmentForm.file)
        attachmentType = assignmentForm.file.type || "application/octet-stream"
        attachmentSize = assignmentForm.file.size
        attachmentName = assignmentForm.file.name
      }

      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assignmentForm.title.trim(),
          description: assignmentForm.description.trim(),
          subject: assignmentForm.subject,
          classId: null,
          className: assignmentForm.className,
          teacherId: teacher.id,
          teacherName: teacher.name,
          dueDate: assignmentForm.dueDate,
          attachmentName,
          attachmentSize,
          attachmentType,
          attachmentData,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to create assignment")
      }

      toast({
        title: "Assignment created",
        description: "Students can now view the assignment details.",
      })

      setShowCreateAssignment(false)
      setAssignmentForm({
        title: "",
        description: "",
        dueDate: "",
        subject: teacher.subjects[0] ?? "",
        className: teacher.classes[0] ?? "",
        file: null,
      })

      void loadAssignments()
    } catch (error) {
      logger.error("Failed to create assignment", { error })
      toast({
        variant: "destructive",
        title: "Unable to create assignment",
        description: error instanceof Error ? error.message : "Please try again or contact the administrator.",
      })
    } finally {
      setIsCreatingAssignment(false)
    }
  }

  const handleViewSubmissions = (assignment: TeacherAssignmentSummary) => {
    setSelectedAssignment(assignment)
    setShowSubmissions(true)
  }

  const handleSaveBehavioralAssessment = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Please choose both a class and a subject before saving assessments.",
        })
        return
      }

      const timestamp = new Date().toISOString()
      const termLabel = normalizedTermLabel
      const existingData = JSON.parse(safeStorage.getItem("behavioralAssessments") || "{}") as Record<string, unknown>

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`
        const storedAffective = additionalData.affectiveDomain[student.studentId] ?? {}
        const storedPsychomotor = additionalData.psychomotorDomain[student.studentId] ?? {}

        const affectiveEntries: Record<string, string> = {}
        AFFECTIVE_TRAITS.forEach(({ key }) => {
          const rating = normalizeBehavioralRating(storedAffective[key])
          if (rating) {
            affectiveEntries[key] = rating
          }
        })

        const psychomotorEntries: Record<string, string> = {}
        PSYCHOMOTOR_SKILLS.forEach(({ key }) => {
          const rating = normalizeBehavioralRating(storedPsychomotor[key])
          if (rating) {
            psychomotorEntries[key] = rating
          }
        })

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          affectiveDomain: affectiveEntries,
          psychomotorDomain: psychomotorEntries,
          teacherId: teacher.id,
          timestamp,
        }
      })

      safeStorage.setItem("behavioralAssessments", JSON.stringify(existingData))

      toast({
        title: "Behavioral assessment saved",
        description: "Affective and psychomotor records have been updated for the selected students.",
      })
      loadAdditionalData()
    } catch (error) {
      logger.error("Error saving behavioral assessment", { error })
      toast({
        variant: "destructive",
        title: "Failed to save assessment",
        description: "Please try again or contact the administrator if the issue persists.",
      })
    }
  }

  const handleSaveAttendancePosition = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Please choose both a class and a subject before saving attendance records.",
        })
        return
      }

      const timestamp = new Date().toISOString()
      const termLabel = normalizedTermLabel
      const existingData = JSON.parse(safeStorage.getItem("attendancePositions") || "{}") as Record<string, unknown>
      const normalizedTermInfo = {
        numberInClass: additionalData.termInfo.numberInClass.trim(),
        nextTermBegins: additionalData.termInfo.nextTermBegins,
        vacationEnds: additionalData.termInfo.vacationEnds,
        nextTermFees: additionalData.termInfo.nextTermFees,
        feesBalance: additionalData.termInfo.feesBalance,
      }

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`
        const attendanceStats = additionalData.attendance[student.studentId] ?? {
          present: 0,
          absent: 0,
          total: 0,
        }

        const present = Number.isFinite(attendanceStats.present) ? attendanceStats.present : 0
        const absent = Number.isFinite(attendanceStats.absent) ? attendanceStats.absent : 0
        const total =
          Number.isFinite(attendanceStats.total) && attendanceStats.total > 0
            ? attendanceStats.total
            : present + absent

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          position: additionalData.classPositions[student.studentId] ?? null,
          attendance: { present, absent, total },
          status: additionalData.studentStatus[student.studentId] ?? "promoted",
          termInfo: normalizedTermInfo,
          teacherId: teacher.id,
          timestamp,
        }
      })

      safeStorage.setItem("attendancePositions", JSON.stringify(existingData))

      toast({
        title: "Attendance saved",
        description: "Attendance, status, and class summaries have been updated for the selected students.",
      })
      loadAdditionalData()
    } catch (error) {
      logger.error("Error saving attendance/position", { error })
      toast({
        variant: "destructive",
        title: "Failed to save attendance",
        description: "Please try again or contact the administrator if the issue persists.",
      })
    }
  }

  const handleSaveClassTeacherRemarks = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Please choose both a class and a subject before saving teacher remarks.",
        })
        return
      }

      const timestamp = new Date().toISOString()
      const termLabel = normalizedTermLabel
      const existingData = JSON.parse(safeStorage.getItem("classTeacherRemarks") || "{}") as Record<string, unknown>

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`
        const remark = additionalData.classTeacherRemarks[student.studentId]?.trim() ?? ""

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          remark,
          teacherId: teacher.id,
          timestamp,
        }
      })

      safeStorage.setItem("classTeacherRemarks", JSON.stringify(existingData))

      toast({
        title: "Remarks saved",
        description: "Class teacher remarks have been updated for the selected students.",
      })
      loadAdditionalData()
    } catch (error) {
      logger.error("Error saving class teacher remarks", { error })
      toast({
        variant: "destructive",
        title: "Failed to save remarks",
        description: "Please try again or contact the administrator if the issue persists.",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {teacher.name}</h1>
            <div className="text-green-100 text-sm sm:text-base space-y-1">
              <p>Subjects: {subjectSummary}</p>
              <p>Classes: {classSummary}</p>
            </div>
          </div>
          <TutorialLink href="https://www.youtube.com/watch?v=HkyVTxH2fIM" variant="inverse" />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{mockStudents.length}</p>
                <p className="text-sm text-gray-600">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{teacher.subjects.length}</p>
                <p className="text-sm text-gray-600">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{teacher.classes.length}</p>
                <p className="text-sm text-gray-600">Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">
                  {isExamLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : teacherExams.length}
                </p>
                <p className="text-sm text-gray-600">Exams</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="marks">Enter Marks</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="noticeboard">Noticeboard</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">My Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teacher.classes.map((className, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{className}</span>
                      <Badge variant="outline">{teacher.subjects[index] || "Multiple"}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <ExamScheduleOverview
              role="teacher"
              title="Upcoming Exams"
              description="Next scheduled assessments across your assigned classes."
              classNames={teacher.classes}
              className="h-full"
              emptyState="No upcoming exams scheduled for your classes."
              limit={4}
            />
          </div>

          <SchoolCalendarViewer role="teacher" />
        </TabsContent>

        {/* Profile tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Profile</CardTitle>
              <CardDescription>View your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-[#2d682d] rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{teacher.name}</h3>
                    <p className="text-gray-600">{teacher.email}</p>
                    <p className="text-sm text-gray-500">Teacher ID: TCH{teacher.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Subjects</label>
                    <div className="flex gap-1 mt-1">
                      {teacher.subjects.map((subject, index) => (
                        <Badge key={index} variant="secondary">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Classes</label>
                    <div className="flex gap-1 mt-1">
                      {teacher.classes.map((className, index) => (
                        <Badge key={index} variant="outline">
                          {className}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Enter Student Marks & Report Card Details</CardTitle>
              <CardDescription>Enter comprehensive assessment data that will appear on report cards</CardDescription>
              {selectedClass && selectedSubject && (
                <div className="mt-2">
                  <Badge
                    variant={
                      currentStatus.status === "approved"
                        ? "default"
                        : currentStatus.status === "pending"
                          ? "secondary"
                          : currentStatus.status === "revoked"
                            ? "destructive"
                            : "outline"
                    }
                    className="text-sm"
                  >
                    Status: {currentStatus.status.charAt(0).toUpperCase() + currentStatus.status.slice(1)}
                  </Badge>
                  {currentStatus.status === "revoked" && currentStatus.message && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 font-medium">Admin Feedback:</p>
                      <p className="text-sm text-red-600">{currentStatus.message}</p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      onClick={() => void handleSubmitForApproval()}
                      disabled={
                        isSubmittingForApproval ||
                        currentStatus.status === "pending" ||
                        currentStatus.status === "approved"
                      }
                    >
                      {isSubmittingForApproval ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {currentStatus.status === "approved"
                        ? "Published"
                        : currentStatus.status === "pending"
                          ? "Awaiting Approval"
                          : "Send for Approval"}
                    </Button>
                    {currentStatus.status === "revoked" && (
                      <Button
                        variant="outline"
                        onClick={() => void handleSubmitForApproval()}
                        disabled={isSubmittingForApproval}
                      >
                        Resubmit to Admin
                      </Button>
                    )}
                    {currentStatus.status === "pending" && (
                      <Button
                        variant="ghost"
                        onClick={() => void handleCancelSubmission()}
                        disabled={isCancellingSubmission}
                      >
                        {isCancellingSubmission ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Cancel Submission
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Selection Controls */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Class</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {teacher.classes.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {teacher.subjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First Term</SelectItem>
                        <SelectItem value="second">Second Term</SelectItem>
                        <SelectItem value="third">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Session</Label>
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2023/2024">2023/2024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs defaultValue="academic" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="academic">Academic Marks</TabsTrigger>
                    <TabsTrigger value="behavioral">Behavioral Assessment</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance & Position</TabsTrigger>
                    <TabsTrigger value="remarks">Class Teacher Remarks</TabsTrigger>
                  </TabsList>

                  <TabsContent value="academic" className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-gray-500">
                        Grade Management weighting: 1st CA {CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1}, 2nd CA {CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2},
                        note/assignment {CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment}, exam {CONTINUOUS_ASSESSMENT_MAXIMUMS.exam}.
                      </p>
                      <Button
                        className="bg-[#2d682d] hover:bg-[#245224] text-white"
                        onClick={handleSyncAcademicMarks}
                        disabled={isSyncingGrades}
                      >
                        {isSyncingGrades ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Sync to Exam Management
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 p-2 grid grid-cols-13 gap-2 font-medium text-xs">
                        <div>Student Name</div>
                        <div>1st C.A. ({CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1})</div>
                        <div>2nd C.A. ({CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2})</div>
                        <div>NOTE/ASSIGN ({CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment})</div>
                        <div>
                          C.A. TOTAL ({
                            CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1 +
                            CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2 +
                            CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment
                          })
                        </div>
                        <div>EXAM ({CONTINUOUS_ASSESSMENT_MAXIMUMS.exam})</div>
                        <div>GRAND TOTAL (100)</div>
                        <div>Total Obtainable</div>
                        <div>Total Obtained</div>
                        <div>Average %</div>
                        <div>Position</div>
                        <div>GRADE</div>
                        <div>Subject Remarks</div>
                        <div className="text-center">Preview</div>
                      </div>
                      {marksData.map((student) => (
                        <div key={student.studentId} className="p-2 grid grid-cols-13 gap-2 items-center border-t">
                          <div className="font-medium text-sm">{student.studentName}</div>
                          <div>
                            <Input
                              type="number"
                              max={CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1}
                              value={student.firstCA}
                              onChange={(e) =>
                                handleMarksUpdate(student.studentId, "firstCA", Number.parseInt(e.target.value) || 0)
                              }
                              className="w-14 h-8 text-xs"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              max={CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2}
                              value={student.secondCA}
                              onChange={(e) =>
                                handleMarksUpdate(student.studentId, "secondCA", Number.parseInt(e.target.value) || 0)
                              }
                              className="w-14 h-8 text-xs"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              max={CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment}
                              value={student.noteAssignment}
                              onChange={(e) =>
                                handleMarksUpdate(
                                  student.studentId,
                                  "noteAssignment",
                                  Number.parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-14 h-8 text-xs"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div className="font-bold text-[#2d682d] text-sm">{student.caTotal}</div>
                          <div>
                            <Input
                              type="number"
                              max={CONTINUOUS_ASSESSMENT_MAXIMUMS.exam}
                              value={student.exam}
                              onChange={(e) =>
                                handleMarksUpdate(student.studentId, "exam", Number.parseInt(e.target.value) || 0)
                              }
                              className="w-14 h-8 text-xs"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div className="font-bold text-[#b29032] text-sm">{student.grandTotal}</div>
                          <div>
                            <Input
                              type="number"
                              value={student.totalMarksObtainable}
                              onChange={(e) =>
                                handleMarksUpdate(
                                  student.studentId,
                                  "totalMarksObtainable",
                                  Number.parseInt(e.target.value) || 100,
                                )
                              }
                              className="w-16 h-8 text-xs"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div className="font-bold text-blue-600 text-sm">{student.totalMarksObtained}</div>
                          <div className="font-bold text-purple-600 text-sm">{student.averageScore}%</div>
                          <div className="font-bold text-orange-600 text-sm">#{student.position}</div>
                          <div>
                            <Badge
                              variant={
                                student.grade === "A" ? "default" : student.grade === "F" ? "destructive" : "secondary"
                              }
                              className="text-xs"
                            >
                              {student.grade}
                            </Badge>
                          </div>
                          <div>
                            <Input
                              value={student.teacherRemark}
                              onChange={(e) => handleMarksUpdate(student.studentId, "teacherRemark", e.target.value)}
                              className="w-24 h-8 text-xs"
                              placeholder="Subject remark"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openPreviewForStudent(student)}
                            >
                              Preview
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">Class Average</div>
                          <div className="text-2xl font-bold text-[#2d682d]">
                            {marksData.length > 0
                              ? Math.round(
                                  marksData.reduce((sum, student) => sum + student.averageScore, 0) /
                                    marksData.length,
                                )
                              : 0}
                            %
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">Highest Score</div>
                          <div className="text-2xl font-bold text-[#b29032]">
                            {marksData.length > 0 ? Math.max(...marksData.map((s) => s.grandTotal)) : 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">Lowest Score</div>
                          <div className="text-2xl font-bold text-red-600">
                            {marksData.length > 0 ? Math.min(...marksData.map((s) => s.grandTotal)) : 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">Pass Rate</div>
                          <div className="text-2xl font-bold text-green-600">
                            {marksData.length > 0
                              ? Math.round(
                                  (marksData.filter((s) => s.grade !== "F").length / marksData.length) * 100,
                                )
                              : 0}
                            %
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="behavioral" className="space-y-4">
                    <div className="space-y-4">
                      {marksData.map((student) => (
                        <Card key={student.studentId}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-[#2d682d]">{student.studentName}</CardTitle>
                            <CardDescription className="text-xs text-gray-500">
                              Provide affective and psychomotor ratings for this term.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-5">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                Affective Domain
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {AFFECTIVE_TRAITS.map(({ key, label }) => (
                                  <div key={key}>
                                    <Label className="text-xs">{label}</Label>
                                    <Select
                                      value={additionalData.affectiveDomain[student.studentId]?.[key] ?? ""}
                                      onValueChange={(value) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.affectiveDomain[student.studentId] ?? {}
                                          return {
                                            ...prev,
                                            affectiveDomain: {
                                              ...prev.affectiveDomain,
                                              [student.studentId]: {
                                                ...previous,
                                                [key]: value,
                                              },
                                            },
                                          }
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Rate" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {BEHAVIORAL_RATING_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                Psychomotor Domain
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {PSYCHOMOTOR_SKILLS.map(({ key, label }) => (
                                  <div key={key}>
                                    <Label className="text-xs">{label}</Label>
                                    <Select
                                      value={additionalData.psychomotorDomain[student.studentId]?.[key] ?? ""}
                                      onValueChange={(value) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.psychomotorDomain[student.studentId] ?? {}
                                          return {
                                            ...prev,
                                            psychomotorDomain: {
                                              ...prev.psychomotorDomain,
                                              [student.studentId]: {
                                                ...previous,
                                                [key]: value,
                                              },
                                            },
                                          }
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Rate" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {BEHAVIORAL_RATING_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        onClick={handleSaveBehavioralAssessment}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Behavioral Assessment
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="attendance" className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Position & Status</CardTitle>
                          <CardDescription className="text-xs">
                            Track promotion status alongside class positions.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {marksData.map((student) => (
                            <div key={student.studentId} className="mb-4 rounded-lg border p-3">
                              <p className="font-medium text-sm mb-2">{student.studentName}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Position</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={additionalData.classPositions[student.studentId] || ""}
                                    onChange={(e) =>
                                      setAdditionalData((prev) => ({
                                        ...prev,
                                        classPositions: {
                                          ...prev.classPositions,
                                          [student.studentId]: Number.parseInt(e.target.value, 10) || 0,
                                        },
                                      }))
                                    }
                                    className="h-8 text-xs"
                                    placeholder="1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Status</Label>
                                  <Select
                                    value={additionalData.studentStatus[student.studentId] || ""}
                                    onValueChange={(value) =>
                                      setAdditionalData((prev) => ({
                                        ...prev,
                                        studentStatus: {
                                          ...prev.studentStatus,
                                          [student.studentId]: value,
                                        },
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STUDENT_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Attendance Record</CardTitle>
                          <CardDescription className="text-xs">
                            These values are used to calculate attendance percentage.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {marksData.map((student) => {
                            const stats = additionalData.attendance[student.studentId] ?? {
                              present: 0,
                              absent: 0,
                              total: 0,
                            }
                            const totalDays = stats.total && stats.total > 0 ? stats.total : stats.present + stats.absent
                            const percentage = totalDays > 0 ? Math.round((stats.present / totalDays) * 100) : 0

                            return (
                              <div key={student.studentId} className="mb-4 rounded-lg border p-3">
                                <p className="font-medium text-sm mb-2">{student.studentName}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Present</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.present}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[student.studentId] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          }
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                present: Number.parseInt(e.target.value, 10) || 0,
                                              },
                                            },
                                          }
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Absent</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.absent}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[student.studentId] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          }
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                absent: Number.parseInt(e.target.value, 10) || 0,
                                              },
                                            },
                                          }
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Total Days</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.total}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[student.studentId] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          }
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                total: Number.parseInt(e.target.value, 10) || 0,
                                              },
                                            },
                                          }
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2">
                                  Attendance: {percentage}% ({stats.present} / {totalDays || 0})
                                </p>
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Term Summary & Fees</CardTitle>
                          <CardDescription className="text-xs">
                            Shared information that appears on every report card for this class.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Number in Class</Label>
                              <Input
                                type="number"
                                min="0"
                                value={additionalData.termInfo.numberInClass}
                                onChange={(e) =>
                                  setAdditionalData((prev) => ({
                                    ...prev,
                                    termInfo: { ...prev.termInfo, numberInClass: e.target.value },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="e.g. 25"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Vacation Date</Label>
                                <Input
                                  type="date"
                                  value={additionalData.termInfo.vacationEnds}
                                  onChange={(e) =>
                                    setAdditionalData((prev) => ({
                                      ...prev,
                                      termInfo: { ...prev.termInfo, vacationEnds: e.target.value },
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Next Term Begins</Label>
                                <Input
                                  type="date"
                                  value={additionalData.termInfo.nextTermBegins}
                                  onChange={(e) =>
                                    setAdditionalData((prev) => ({
                                      ...prev,
                                      termInfo: { ...prev.termInfo, nextTermBegins: e.target.value },
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Next Term Fees</Label>
                              <Input
                                value={additionalData.termInfo.nextTermFees}
                                onChange={(e) =>
                                  setAdditionalData((prev) => ({
                                    ...prev,
                                    termInfo: { ...prev.termInfo, nextTermFees: e.target.value },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="e.g. ₦45,000"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Outstanding Fees</Label>
                              <Input
                                value={additionalData.termInfo.feesBalance}
                                onChange={(e) =>
                                  setAdditionalData((prev) => ({
                                    ...prev,
                                    termInfo: { ...prev.termInfo, feesBalance: e.target.value },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveAttendancePosition}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Attendance & Summary
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="remarks" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Class Teacher General Remarks</CardTitle>
                        <CardDescription>Overall comments about each student's performance</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {marksData.map((student) => (
                          <div key={student.studentId} className="mb-4 p-3 border rounded-lg">
                            <Label className="text-sm font-medium">{student.studentName}</Label>
                            <Textarea
                              value={additionalData.classTeacherRemarks[student.studentId] || ""}
                              onChange={(e) =>
                                setAdditionalData((prev) => ({
                                  ...prev,
                                  classTeacherRemarks: {
                                    ...prev.classTeacherRemarks,
                                    [student.studentId]: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Enter overall class teacher remarks for this student..."
                              className="mt-2"
                              rows={2}
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <div className="flex justify-end mt-6">
                      <Button
                        onClick={handleSaveClassTeacherRemarks}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Class Teacher Remarks
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-[#2d682d]">Assignments</CardTitle>
                  <CardDescription>Manage assignments and view submissions</CardDescription>
                </div>
                <Button onClick={() => setShowCreateAssignment(true)} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Assignment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  No assignments created yet. Click "Create Assignment" to share work with your students.
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => {
                    const submittedCount = assignment.submissions.filter((submission) =>
                      ["submitted", "graded"].includes(submission.status),
                    ).length
                    const totalAssigned = assignment.assignedStudentIds.length || assignment.submissions.length

                    return (
                      <div
                        key={assignment.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <h3 className="font-medium text-[#2d682d]">{assignment.title}</h3>
                          <p className="text-sm text-gray-600">
                            {assignment.subject} • {assignment.className}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due: {formatExamDate(assignment.dueDate)}
                            {assignment.updatedAt ? ` • Updated ${formatExamDate(assignment.updatedAt)}` : ""}
                          </p>
                          {assignment.description && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{assignment.description}</p>
                          )}
                          {assignment.resourceName && (
                            <button
                              type="button"
                              className="mt-2 text-xs text-[#2d682d] underline"
                              onClick={() => handleDownloadAssignmentAttachment(assignment)}
                            >
                              Download attachment ({assignment.resourceName})
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <Badge variant="outline">
                            {submittedCount}/{totalAssigned || "--"} submitted
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleViewSubmissions(assignment)}>
                            View Submissions
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Students</CardTitle>
              <CardDescription>Students in your classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockStudents.map((student) => (
                  <div key={student.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{student.name}</h3>
                      <p className="text-sm text-gray-600">{student.class}</p>
                      <div className="flex gap-1 mt-1">
                        {student.subjects.map((subject, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Timetable</CardTitle>
              <CardDescription>Your teaching schedule</CardDescription>
            </CardHeader>
            <CardContent>
              {isTeacherTimetableLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading timetable...
                </div>
              ) : sortedTeacherTimetable.length === 0 ? (
                <p className="text-sm text-gray-500">No timetable entries available for {selectedClass}.</p>
              ) : (
                <div className="space-y-2">
                  {sortedTeacherTimetable.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Clock className="w-4 h-4 text-[#b29032]" />
                        <div>
                          <p className="font-medium">
                            {slot.day} - {slot.time}
                          </p>
                          <p className="text-sm text-gray-600">
                            {slot.subject}
                            {slot.location ? ` • ${slot.location}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Study Materials</CardTitle>
              <CardDescription>Upload and manage study materials for your students</CardDescription>
            </CardHeader>
            <CardContent>
              <StudyMaterials
                userRole="teacher"
                teacherName={teacher.name}
                teacherId={teacher.id}
                availableSubjects={teacher.subjects}
                availableClasses={teacher.classes}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noticeboard" className="space-y-4">
          <Noticeboard userRole="teacher" userName={teacher.name} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <InternalMessaging currentUser={{ id: teacher.id, name: teacher.name, role: "teacher" }} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={previewDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDialogOpen(false)
            setPreviewStudentId(null)
            setPreviewData(null)
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Report Card Preview</DialogTitle>
            <DialogDescription>
              {previewStudentId
                ? `${marksData.find((s) => s.studentId === previewStudentId)?.studentName ?? "Student"} • ${selectedClass} • ${
                    mapTermKeyToLabel(selectedTerm)
                  } (${selectedSession})`
                : "Select a student to preview their report card."}
            </DialogDescription>
          </DialogHeader>
          {previewData ? (
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border bg-white p-2 shadow-sm">
              <EnhancedReportCard data={previewData} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preview data available yet.</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewDialogOpen(false)
                setPreviewStudentId(null)
                setPreviewData(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Assignment Dialog */}
      <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Assignment</DialogTitle>
            <DialogDescription>Create an assignment for your students</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Assignment Title</Label>
              <Input
                id="title"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter assignment title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter assignment description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={assignmentForm.subject}
                  onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, subject: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacher.subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="class">Class</Label>
                <Select
                  value={assignmentForm.className}
                  onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, className: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacher.classes.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={assignmentForm.dueDate}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="file">Attachment (Optional)</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAssignment(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAssignment}
              disabled={isCreatingAssignment}
              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
            >
              {isCreatingAssignment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isCreatingAssignment ? "Creating..." : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submissions Dialog */}
      <Dialog open={showSubmissions} onOpenChange={setShowSubmissions}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assignment Submissions - {selectedAssignment?.title}</DialogTitle>
            <DialogDescription>
              {selectedAssignment?.subject} - {selectedAssignment?.className}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment?.submissions && selectedAssignment.submissions.length > 0 ? (
              selectedAssignment.submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <h3 className="font-medium">Student ID: {submission.studentId}</h3>
                    <p className="text-sm text-gray-600">
                      Status:{" "}
                      <Badge variant={submission.status === "submitted" ? "default" : "secondary"}>
                        {submission.status}
                      </Badge>
                    </p>
                    {submission.submittedAt && (
                      <p className="text-xs text-gray-500">
                        Submitted: {formatExamDate(submission.submittedAt)}
                      </p>
                    )}
                    {submission.comment && (
                      <p className="text-xs text-gray-500">Comment: {submission.comment}</p>
                    )}
                    {submission.files && submission.files.length > 0 && (
                      <p className="text-xs text-blue-600">
                        File: {submission.files.map((file) => file.name).join(", ")}
                      </p>
                    )}
                  </div>
                  {submission.grade && (
                    <Badge variant="outline" className="self-start md:self-center">
                      Grade: {submission.grade}
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No submissions have been received for this assignment yet.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSubmissions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
