"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  BookOpen,
  Users,
  FileText,
  GraduationCap,
  Clock,
  User,
  Plus,
  Save,
  Loader2,
  Eye,
  Send,
  Trash2,
  Pencil,
  Sparkles,
  CalendarClock,
  Download,
  Trophy,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  UserPlus,
} from "lucide-react"
import { StudyMaterials } from "@/components/study-materials"
import { Noticeboard } from "@/components/noticeboard"
import { NotificationCenter } from "@/components/notification-center"
import { InternalMessaging } from "@/components/internal-messaging"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { EnhancedReportCard } from "@/components/enhanced-report-card"
import { ReportCardPreviewOverlay } from "@/components/report-card-preview-overlay"
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
import { normalizeTimetableCollection } from "@/lib/timetable"
import { useToast } from "@/hooks/use-toast"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { TimetableWeeklyView, type TimetableWeeklyViewSlot } from "@/components/timetable-weekly-view"
import {
  STUDENT_MARKS_STORAGE_KEY,
  buildRawReportCardFromStoredRecord,
  getStoredStudentMarksRecord,
  readStudentMarksStore,
} from "@/lib/report-card-data"
import { mapReportCardRecordToRaw } from "@/lib/report-card-transformers"
import { buildReportCardHtml } from "@/lib/report-card-html"
import {
  REPORT_CARD_WORKFLOW_EVENT,
  getWorkflowRecords,
  getWorkflowSummary,
  resetReportCardSubmission,
  submitReportCardsForApproval,
  type ReportCardCumulativeSummary,
  type ReportCardWorkflowRecord,
} from "@/lib/report-card-workflow"
import type { ReportCardRecord, ReportCardSubjectRecord } from "@/lib/database"
import {
  AFFECTIVE_TRAITS,
  BEHAVIORAL_RATING_OPTIONS,
  PSYCHOMOTOR_SKILLS,
  normalizeBehavioralRating,
} from "@/lib/report-card-constants"
import type {
  RawReportCardData,
  StoredStudentMarkRecord,
  StoredSubjectRecord,
} from "@/lib/report-card-types"
import {
  clearAssignmentReminderHistory,
  markAssignmentReminderSent,
  shouldSendAssignmentReminder,
} from "@/lib/assignment-reminders"

type BrowserRuntime = typeof globalThis & Partial<Window>

const SUBJECT_REMARK_OPTIONS = ["Excellent", "V. Good", "Good", "Poor"] as const

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  return globalThis as BrowserRuntime
}

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  const sanitized = trimmed.replace(/[^a-z0-9\-_.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return sanitized.length > 0 ? sanitized : "report-card"
}

type TeacherClassAssignment = {
  id: string
  name: string
  subjects: string[]
}

type AssignmentStudentInfo = {
  id: string
  name: string | null
  className: string | null
}

interface TeacherDashboardProps {
  teacher: {
    id: string
    name: string
    email: string
    subjects: string[]
    classes: TeacherClassAssignment[]
  }
  isContextLoading?: boolean
  contextError?: string | null
  onRefreshAssignments?: () => void
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

type TeacherTimetableSlot = TimetableWeeklyViewSlot

type BehavioralDomainState = Record<string, Record<string, string>>
type AttendanceState = Record<string, { present: number; absent: number; total: number }>
type StudentStatusState = Record<string, string>

type TermInfoState = {
  numberInClass: string
  nextTermBegins: string
  vacationEnds: string
  nextTermFees: string
  feesBalance: string
}

const createEmptyTermInfo = (): TermInfoState => ({
  numberInClass: "",
  nextTermBegins: "",
  vacationEnds: "",
  nextTermFees: "",
  feesBalance: "",
})

interface MarksRecord {
  studentId: string
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

type TeacherAssignmentStatus = "draft" | "sent" | "submitted" | "graded" | "overdue"

interface AssignmentSubmissionRecord {
  id: string
  studentId: string
  status: "pending" | "submitted" | "graded"
  submittedAt: string | null
  files?: { id: string; name: string; url?: string | null }[]
  comment?: string | null
  grade?: string | null
  score?: number | null
}

interface TeacherAssignmentSummary {
  id: string
  title: string
  description: string
  subject: string
  className: string
  classId?: string | null
  dueDate: string
  status: TeacherAssignmentStatus
  maximumScore: number | null
  submissions: AssignmentSubmissionRecord[]
  assignedStudentIds: string[]
  resourceName?: string | null
  resourceType?: string | null
  resourceUrl?: string | null
  resourceSize?: number | null
  createdAt?: string | null
  updatedAt?: string
}

type RawAssignmentRecord = Awaited<ReturnType<typeof dbManager.getAssignments>>[number]

const ASSIGNMENT_STATUS_META: Record<
  TeacherAssignmentStatus,
  { label: string; badgeClass: string; accent: string; glow: string }
> = {
  draft: {
    label: "Draft",
    badgeClass: "border border-slate-200 bg-slate-100 text-slate-700",
    accent: "from-slate-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(71,85,105,0.8)]",
  },
  sent: {
    label: "Sent",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700",
    accent: "from-blue-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(59,130,246,0.8)]",
  },
  submitted: {
    label: "Submitted",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-700",
    accent: "from-amber-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(217,119,6,0.8)]",
  },
  graded: {
    label: "Graded",
    badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    accent: "from-emerald-100/70",
    glow: "shadow-[0_0_30px_-12px_rgba(16,185,129,0.8)]",
  },
  overdue: {
    label: "Overdue",
    badgeClass: "border border-red-200 bg-red-100 text-red-700",
    accent: "from-red-100/70",
    glow: "shadow-[0_0_30px_-12px_rgba(248,113,113,0.8)]",
  },
}

export function TeacherDashboard({
  teacher,
  isContextLoading = false,
  contextError = null,
  onRefreshAssignments,
}: TeacherDashboardProps) {
  const { toast } = useToast()
  const firstTeacherClass = teacher.classes[0] ?? null
  const teacherClassNames = useMemo(() => teacher.classes.map((cls) => cls.name), [teacher.classes])
  const teacherClassIds = useMemo(() => teacher.classes.map((cls) => cls.id), [teacher.classes])
  const noClassesAssigned = teacher.classes.length === 0
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [assignmentDialogMode, setAssignmentDialogMode] = useState<"create" | "edit">("create")
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [showSubmissions, setShowSubmissions] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignmentSummary | null>(null)
  const [previewAssignment, setPreviewAssignment] = useState<TeacherAssignmentSummary | null>(null)
  const [assignmentRoster, setAssignmentRoster] = useState<Record<string, AssignmentStudentInfo>>({})
  const [selectedClass, setSelectedClass] = useState(() => firstTeacherClass?.name ?? "")
  const [selectedSubject, setSelectedSubject] = useState(
    () => firstTeacherClass?.subjects[0] ?? teacher.subjects[0] ?? "",
  )
  const [selectedTerm, setSelectedTerm] = useState("first")
  const [selectedSession, setSelectedSession] = useState("2024/2025")
  const [workflowRecords, setWorkflowRecords] = useState<ReportCardWorkflowRecord[]>([])
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSavingAcademicRecords, setIsSavingAcademicRecords] = useState(false)
  const [isCancellingSubmission, setIsCancellingSubmission] = useState(false)
  const [additionalData, setAdditionalData] = useState(() => ({
    affectiveDomain: {
      student_john_doe: {
        neatness: "Excellent",
        honesty: "Excellent",
        punctuality: "Excellent",
        leadership: "Very Good",
        relationship: "Excellent",
      },
    } as BehavioralDomainState,
    psychomotorDomain: {
      student_john_doe: {
        handwriting: "Excellent",
        sport: "Very Good",
        drawing: "Good",
        craft: "Very Good",
      },
    } as BehavioralDomainState,
    classTeacherRemarks: {
      student_john_doe: "Excellent",
      student_alice_smith: "V. Good",
      student_mike_johnson: "Good",
    } as Record<string, string>,
    attendance: {
      student_john_doe: { present: 58, absent: 2, total: 60 },
      student_alice_smith: { present: 55, absent: 5, total: 60 },
      student_mike_johnson: { present: 53, absent: 7, total: 60 },
    } as AttendanceState,
    studentStatus: {
      student_john_doe: "promoted",
      student_alice_smith: "promoted",
      student_mike_johnson: "promoted-on-trial",
    } as StudentStatusState,
    termInfo: {
      numberInClass: "25",
      nextTermBegins: "2025-05-06",
      vacationEnds: "2025-04-30",
      nextTermFees: "₦52,500",
      feesBalance: "₦0",
    },
  }))
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<RawReportCardData | null>(null)
  const [isPreviewDownloading, setIsPreviewDownloading] = useState(false)

  const defaultAssignmentMaximum = CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment ?? 20

  const [assignmentForm, setAssignmentForm] = useState(() => ({
    title: "",
    description: "",
    dueDate: "",
    subject: firstTeacherClass?.subjects[0] ?? teacher.subjects[0] ?? "",
    classId: firstTeacherClass?.id ?? "",
    className: firstTeacherClass?.name ?? "",
    maximumScore: String(defaultAssignmentMaximum),
    file: null as File | null,
    resourceName: "",
    resourceType: "",
    resourceUrl: "",
    resourceSize: null as number | null,
  }))
  const [assignments, setAssignments] = useState<TeacherAssignmentSummary[]>([])
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(true)
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)
  const [assignmentActionId, setAssignmentActionId] = useState<string | null>(null)
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null)
  const [gradingDrafts, setGradingDrafts] = useState<Record<string, { score: string; comment: string }>>({})
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null)
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)

  const assignmentMaximum = defaultAssignmentMaximum
  const resolvedAssignmentMaximum = (() => {
    const parsed = Number(assignmentForm.maximumScore)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : assignmentMaximum
  })()
  const isEditingAssignment = assignmentDialogMode === "edit"
  const assignmentDialogTitle = isEditingAssignment ? "Update Assignment" : "Create New Assignment"
  const assignmentDialogDescription = isEditingAssignment
    ? "Refresh the assignment details before you share or resend it to your class."
    : "Design a rich assignment experience for your students with attachments and clear guidance."

  const assignmentInsights = useMemo(() => {
    if (assignments.length === 0) {
      return {
        total: 0,
        draftCount: 0,
        sentCount: 0,
        overdueCount: 0,
        activeAssignments: 0,
        totalCapacity: 0,
        submissionCount: 0,
        gradedCount: 0,
        pendingGrading: 0,
        submissionRate: 0,
        gradingRate: 0,
        averageScore: null as number | null,
      }
    }

    let draftCount = 0
    let sentCount = 0
    let overdueCount = 0
    let totalCapacity = 0
    let submissionCount = 0
    let gradedCount = 0
    let pendingGrading = 0
    let scoreSum = 0
    let scoreEntries = 0

    assignments.forEach((assignment) => {
      const status = assignment.status
      if (status === "draft") {
        draftCount += 1
      } else if (status === "sent" || status === "submitted") {
        sentCount += 1
      } else if (status === "overdue") {
        overdueCount += 1
      }

      const assignedStudents = Array.isArray(assignment.assignedStudentIds)
        ? assignment.assignedStudentIds.length
        : 0
      const capacity = assignedStudents || assignment.submissions.length
      totalCapacity += capacity

      assignment.submissions.forEach((submission) => {
        if (["submitted", "graded"].includes(submission.status)) {
          submissionCount += 1
        }
        if (submission.status === "graded") {
          gradedCount += 1
        }
        if (submission.status === "submitted") {
          pendingGrading += 1
        }
        if (typeof submission.score === "number") {
          scoreSum += submission.score
          scoreEntries += 1
        }
      })

      if (status !== "draft" && status !== "graded" && status !== "overdue") {
        const dueTimestamp = Date.parse(assignment.dueDate)
        if (!Number.isNaN(dueTimestamp) && dueTimestamp < Date.now()) {
          overdueCount += 1
        }
      }
    })

    const activeAssignments = Math.max(assignments.length - draftCount, 0)
    const submissionRate = totalCapacity > 0
      ? Math.round((submissionCount / totalCapacity) * 100)
      : submissionCount > 0
        ? 100
        : 0
    const gradingRate = submissionCount > 0 ? Math.round((gradedCount / submissionCount) * 100) : 0
    const averageScore = scoreEntries > 0 ? Math.round((scoreSum / scoreEntries) * 100) / 100 : null

    return {
      total: assignments.length,
      draftCount,
      sentCount,
      overdueCount,
      activeAssignments,
      totalCapacity,
      submissionCount,
      gradedCount,
      pendingGrading,
      submissionRate,
      gradingRate,
      averageScore,
    }
  }, [assignments])

  const [teacherExams, setTeacherExams] = useState<TeacherExamSummary[]>([])
  const [isExamLoading, setIsExamLoading] = useState(true)
  const [teacherTimetable, setTeacherTimetable] = useState<TeacherTimetableSlot[]>([])
  const [isTeacherTimetableLoading, setIsTeacherTimetableLoading] = useState(true)
  const [isSyncingGrades, setIsSyncingGrades] = useState(false)
  const [cumulativeSummaries, setCumulativeSummaries] = useState<
    Record<string, ReportCardCumulativeSummary>
  >({})
  const [isGeneratingCumulative, setIsGeneratingCumulative] = useState(false)
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  const [isRosterLoading, setIsRosterLoading] = useState(false)
  const [rosterCandidates, setRosterCandidates] = useState<AssignmentStudentInfo[]>([])
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null)
  const [rosterNotice, setRosterNotice] = useState<string | null>(null)

  const normalizedTermLabel = useMemo(() => mapTermKeyToLabel(selectedTerm), [selectedTerm])

  const subjectSummary =
    teacher.subjects.length > 0 ? teacher.subjects.join(", ") : "No subjects assigned yet"
  const classSummary =
    teacherClassNames.length > 0 ? teacherClassNames.join(", ") : "No classes assigned yet"

  const normalizeClassName = useCallback((value: string) => value.replace(/\s+/g, "").toLowerCase(), [])

  useEffect(() => {
    setSelectedClass(teacherClassNames[0] ?? "")
  }, [teacherClassNames])

  useEffect(() => {
    setAssignmentForm((prev) => {
      const normalizedSelection = normalizeClassName(selectedClass)
      const defaultClass = teacher.classes.find(
        (cls) => normalizeClassName(cls.name) === normalizedSelection,
      )
      const fallbackClass = defaultClass ?? teacher.classes[0] ?? null
      const normalizedPrevSubject = typeof prev.subject === "string" ? prev.subject.trim().toLowerCase() : ""
      const normalizedOptions = subjectsForSelectedClass.map((subject) => subject.trim().toLowerCase())
      const nextSubject =
        normalizedPrevSubject && normalizedOptions.includes(normalizedPrevSubject)
          ? prev.subject
          : subjectsForSelectedClass[0] ?? ""

      return {
        ...prev,
        subject: nextSubject,
        classId: prev.classId || (fallbackClass?.id ?? ""),
        className: prev.className || (fallbackClass?.name ?? ""),
      }
    })
  }, [normalizeClassName, selectedClass, subjectsForSelectedClass, teacher.classes])

  const mockStudents = useMemo(
    () => [
      { id: "student_john_doe", name: "John Doe", class: "JSS 1A", subjects: ["Mathematics", "English"] },
      { id: "student_alice_smith", name: "Alice Smith", class: "JSS 1A", subjects: ["Mathematics"] },
      { id: "student_mike_johnson", name: "Mike Johnson", class: "JSS 2B", subjects: ["English"] },
    ],
    [],
  )

  const formatExamDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value))
    } catch (error) {
      return value
    }
  }

  const subjectsForSelectedClass = useMemo(() => {
    if (teacher.classes.length === 0) {
      return teacher.subjects
    }

    const normalized = normalizeClassName(selectedClass)
    if (!normalized) {
      return teacher.classes[0]?.subjects.length ? teacher.classes[0]?.subjects : teacher.subjects
    }

    const match = teacher.classes.find((cls) => normalizeClassName(cls.name) === normalized)
    if (match && match.subjects.length > 0) {
      return match.subjects
    }

    return teacher.subjects
  }, [normalizeClassName, selectedClass, teacher.classes, teacher.subjects])

  useEffect(() => {
    if (subjectsForSelectedClass.length === 0) {
      setSelectedSubject("")
      return
    }

    setSelectedSubject((prev) => {
      const normalizedPrev = prev.trim().toLowerCase()
      const normalizedOptions = subjectsForSelectedClass.map((subject) => subject.trim().toLowerCase())
      if (normalizedPrev && normalizedOptions.includes(normalizedPrev)) {
        return prev
      }

      return subjectsForSelectedClass[0] ?? ""
    })
  }, [subjectsForSelectedClass])

  const buildInitialGradingDrafts = (submissions: AssignmentSubmissionRecord[]) =>
    submissions.reduce(
      (acc, submission) => {
        acc[submission.id] = {
          score: typeof submission.score === "number" ? String(submission.score) : "",
          comment: submission.comment ?? "",
        }
        return acc
      },
      {} as Record<string, { score: string; comment: string }>,
    )

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.onerror = () => reject(new Error("Unable to read file"))
      reader.readAsDataURL(file)
    })

  const normaliseAssignmentRecord = useCallback(
    (record: RawAssignmentRecord): TeacherAssignmentSummary => {
      const submissions = Array.isArray(record.submissions) ? record.submissions : []
      const assignedStudentIds = Array.isArray(record.assignedStudentIds)
        ? record.assignedStudentIds
        : []

      const normalisedSubmissions: AssignmentSubmissionRecord[] = submissions.map((submission) => ({
        id: submission.id,
        studentId: submission.studentId,
        status: submission.status,
        submittedAt: submission.submittedAt ?? null,
        files: Array.isArray(submission.files)
          ? submission.files.map((file) => ({
              id: typeof file.id === "string" ? file.id : `${submission.id}_${Math.random().toString(36).slice(2)}`,
              name: typeof file.name === "string" ? file.name : "Submission attachment",
              url: typeof (file as { url?: unknown }).url === "string" ? (file as { url?: string }).url : null,
            }))
          : [],
        comment: submission.comment ?? null,
        grade: submission.grade ?? null,
        score: typeof submission.score === "number" ? submission.score : null,
      }))

      return {
        id: String(record.id),
        title: record.title,
        description: record.description ?? "",
        subject: record.subject,
        className: record.className ?? (record as { class?: string }).class ?? "General",
        classId: record.classId ?? null,
        dueDate: record.dueDate,
        status: (record.status ?? "draft") as TeacherAssignmentStatus,
        maximumScore:
          typeof (record as { maximumScore?: unknown }).maximumScore === "number"
            ? ((record as { maximumScore?: number }).maximumScore as number)
            : (record as { maximumScore?: string | number | null }).maximumScore
            ? Number((record as { maximumScore?: string | number | null }).maximumScore)
            : null,
        submissions: normalisedSubmissions,
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
        createdAt: "createdAt" in record ? (record as { createdAt?: string | null }).createdAt ?? null : null,
        updatedAt: record.updatedAt,
      }
    },
    [],
  )

  const resolveAssignmentRoster = useCallback(
    async (assignment: TeacherAssignmentSummary) => {
      const roster = new Map<string, AssignmentStudentInfo>()

      const addStudent = (student: AssignmentStudentInfo) => {
        if (!student.id) {
          return
        }

        const existing = roster.get(student.id)
        roster.set(student.id, {
          id: student.id,
          name: student.name ?? existing?.name ?? null,
          className: student.className ?? existing?.className ?? assignment.className ?? null,
        })
      }

      const assignedIds = new Set(
        assignment.assignedStudentIds
          .filter((id) => typeof id === "string" && id.trim().length > 0)
          .map((id) => id.trim()),
      )

      const classLabel = assignment.className ?? assignment.classId ?? ""

      if (classLabel) {
        try {
          const students = await dbManager.getStudentsByClass(classLabel)
          students.forEach((student: any) => {
            const id = typeof student?.id === "string" ? student.id : String(student?.id ?? "")
            if (!id) {
              return
            }

            if (assignedIds.size === 0 || assignedIds.has(id)) {
              addStudent({
                id,
                name:
                  typeof student?.name === "string"
                    ? student.name
                    : typeof student?.fullName === "string"
                      ? student.fullName
                      : null,
                className:
                  typeof student?.class === "string"
                    ? student.class
                    : typeof student?.className === "string"
                      ? student.className
                      : assignment.className ?? null,
              })
            }
          })
        } catch (error) {
          logger.error("Unable to load class roster for assignment", { error })
        }
      }

      if (assignedIds.size > 0) {
        const missingAssigned = Array.from(assignedIds).filter((id) => !roster.has(id))
        if (missingAssigned.length > 0) {
          try {
            const users = await dbManager.getAllUsers()
            missingAssigned.forEach((studentId) => {
              const match = users.find((user: any) => {
                const candidateId = typeof user?.id === "string" ? user.id : String(user?.id ?? "")
                return candidateId.trim() === studentId
              })

              if (match) {
                addStudent({
                  id: studentId,
                  name:
                    typeof match?.name === "string"
                      ? match.name
                      : typeof match?.fullName === "string"
                        ? match.fullName
                        : null,
                  className:
                    typeof match?.className === "string"
                      ? match.className
                      : typeof match?.class === "string"
                        ? match.class
                        : assignment.className ?? null,
                })
              }
            })
          } catch (error) {
            logger.error("Unable to resolve assigned students for roster", { error })
          }
        }
      }

      if (roster.size === 0) {
        mockStudents
          .filter((student) => {
            if (!classLabel) {
              return true
            }
            return normalizeClassName(student.class) === normalizeClassName(classLabel)
          })
          .forEach((student) => {
            if (assignedIds.size === 0 || assignedIds.has(student.id)) {
              addStudent({ id: student.id, name: student.name, className: student.class })
            }
          })
      }

      assignment.submissions.forEach((submission) => {
        if (!roster.has(submission.studentId)) {
          addStudent({ id: submission.studentId, name: null, className: assignment.className ?? null })
        }
      })

      return Object.fromEntries(roster.entries())
    },
    [mockStudents],
  )

  const combinedSubmissionRecords = useMemo(() => {
    if (!selectedAssignment) {
      return [] as Array<{ student: AssignmentStudentInfo; submission: AssignmentSubmissionRecord }>
    }

    const submissionMap = new Map(
      selectedAssignment.submissions.map((submission) => [submission.studentId, submission] as const),
    )

    const combined = new Map<string, { student: AssignmentStudentInfo; submission: AssignmentSubmissionRecord }>()
    const createPlaceholder = (studentId: string): AssignmentSubmissionRecord => ({
      id: `pending-${studentId}`,
      studentId,
      status: "pending",
      submittedAt: null,
      files: [],
      comment: null,
      grade: null,
      score: null,
    })

    Object.values(assignmentRoster).forEach((student) => {
      const submission = submissionMap.get(student.id) ?? createPlaceholder(student.id)
      combined.set(student.id, { student, submission })
    })

    selectedAssignment.submissions.forEach((submission) => {
      const current = combined.get(submission.studentId)
      if (current) {
        combined.set(submission.studentId, { student: current.student, submission })
      } else {
        combined.set(submission.studentId, {
          student: {
            id: submission.studentId,
            name: null,
            className: selectedAssignment.className ?? null,
          },
          submission,
        })
      }
    })

    return Array.from(combined.values()).sort((a, b) => {
      const nameA = a.student.name ?? a.student.id
      const nameB = b.student.name ?? b.student.id
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" })
    })
  }, [assignmentRoster, selectedAssignment])

  const pendingSubmissionRecords = useMemo(
    () => combinedSubmissionRecords.filter((entry) => entry.submission.status === "pending"),
    [combinedSubmissionRecords],
  )

  const receivedSubmissionRecords = useMemo(
    () => combinedSubmissionRecords.filter((entry) => entry.submission.status !== "pending"),
    [combinedSubmissionRecords],
  )

  const gradedSubmissionCount = useMemo(
    () => receivedSubmissionRecords.filter((entry) => entry.submission.status === "graded").length,
    [receivedSubmissionRecords],
  )

  const loadAssignments = useCallback(async () => {
    try {
      setIsAssignmentsLoading(true)
      const records = await dbManager.getAssignments({ teacherId: teacher.id })

      const normalised = records.map((record) => normaliseAssignmentRecord(record))

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
  }, [normaliseAssignmentRecord, teacher.id, toast])

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

        const normalizedClasses = new Set(teacherClassNames.map((cls) => normalizeClassName(cls)))
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
  }, [teacherClassNames])

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
        const slots = await dbManager.getTimetable(selectedClass)
        if (!isMounted) {
          return
        }

        const normalized = normalizeTimetableCollection(slots).map(
          ({ id, day, time, subject, teacher, location }) => ({
            id,
            day,
            time,
            subject,
            teacher,
            location,
          }),
        )
        setTeacherTimetable(normalized)
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

    const handleTimetableUpdate = (payload: { className?: string } | undefined) => {
      if (!selectedClass) {
        return
      }

      const updatedClassName =
        typeof payload?.className === "string" ? payload.className : selectedClass

      if (normalizeClassName(updatedClassName) === normalizeClassName(selectedClass)) {
        void loadTimetable()
      }
    }

    dbManager.on("timetableUpdated", handleTimetableUpdate)

    return () => {
      isMounted = false
      dbManager.off("timetableUpdated", handleTimetableUpdate)
    }
  }, [selectedClass])

  const [marksData, setMarksData] = useState<MarksRecord[]>([])
  const suppressMarksRefreshRef = useRef(false)

  const loadRosterCandidates = useCallback(async () => {
    if (!selectedClass) {
      setRosterCandidates([])
      return
    }

    setIsRosterLoading(true)
    setRosterNotice(null)

    const existingIds = new Set(marksData.map((student) => String(student.studentId)))
    const candidateMap = new Map<string, AssignmentStudentInfo>()

    try {
      const roster = await dbManager.getStudentsByClass(selectedClass)
      if (Array.isArray(roster)) {
        roster.forEach((entry: any) => {
          const rawId = typeof entry?.id === "string" ? entry.id : String(entry?.id ?? "")
          const normalizedId = rawId.trim()
          if (!normalizedId || existingIds.has(normalizedId)) {
            return
          }

          const nameCandidate =
            typeof entry?.name === "string"
              ? entry.name
              : typeof entry?.fullName === "string"
                ? entry.fullName
                : null
          const classCandidate =
            typeof entry?.class === "string"
              ? entry.class
              : typeof entry?.className === "string"
                ? entry.className
                : selectedClass

          candidateMap.set(normalizedId, {
            id: normalizedId,
            name: nameCandidate,
            className: classCandidate ?? selectedClass,
          })
        })
      }
    } catch (error) {
      logger.warn("Unable to load class roster for grade entry", { error })
      setRosterNotice(
        "We couldn't load the class roster from the database. Please refresh or try again shortly.",
      )
    }

    if (candidateMap.size === 0) {
      const fallback = mockStudents
        .filter((student) =>
          selectedClass
            ? normalizeClassName(student.class) === normalizeClassName(selectedClass)
            : true,
        )
        .filter((student) => !existingIds.has(student.id))

      if (fallback.length > 0) {
        fallback.forEach((student) => {
          candidateMap.set(student.id, {
            id: student.id,
            name: student.name,
            className: student.class,
          })
        })

        setRosterNotice(
          "No school roster records were found. Showing sample students instead.",
        )
      }
    }

    if (candidateMap.size === 0) {
      setRosterNotice("No available students for this class.")
    }

    setRosterCandidates(Array.from(candidateMap.values()))
    setSelectedRosterId(null)
    setIsRosterLoading(false)
  }, [marksData, mockStudents, normalizeClassName, selectedClass])

  useEffect(() => {
    if (!isAddStudentDialogOpen) {
      return
    }

    void loadRosterCandidates()
  }, [isAddStudentDialogOpen, loadRosterCandidates])

  const handleOpenAddStudentDialog = useCallback(() => {
    if (!selectedClass || !selectedSubject) {
      toast({
        variant: "destructive",
        title: "Select class & subject",
        description: "Choose a class and subject before adding students to the grade sheet.",
      })
      return
    }

    setIsAddStudentDialogOpen(true)
  }, [selectedClass, selectedSubject, toast])

  const handleCloseAddStudentDialog = useCallback(() => {
    setIsAddStudentDialogOpen(false)
    setSelectedRosterId(null)
    setRosterNotice(null)
  }, [])

  const emitMarksStoreUpdate = useCallback(
    (payload: unknown) => {
      suppressMarksRefreshRef.current = true
      dbManager.triggerEvent(STUDENT_MARKS_STORAGE_KEY, payload)
      setTimeout(() => {
        suppressMarksRefreshRef.current = false
      }, 0)
    },
    [],
  )

  const calculatePositionsAndAverages = useCallback((data: MarksRecord[]) => {
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
        grade: deriveGradeFromScore(student.grandTotal),
      }
    })
  }, [])

  const calculateGrade = (total: number) => deriveGradeFromScore(total)

  const handleConfirmAddStudents = useCallback(() => {
    if (!selectedRosterId) {
      toast({
        variant: "destructive",
        title: "Select a student",
        description: "Choose a learner from the class list to continue.",
      })
      return
    }

    const candidate = rosterCandidates.find((entry) => entry.id === selectedRosterId)
    if (!candidate) {
      toast({
        variant: "destructive",
        title: "Student unavailable",
        description: "The selected learner could not be found. Please refresh and try again.",
      })
      return
    }

    if (marksData.some((student) => String(student.studentId) === String(candidate.id))) {
      toast({
        title: "Already added",
        description: "This learner is already on the grade sheet and ready for editing.",
      })
      handleCloseAddStudentDialog()
      return
    }

    const storedRecord = selectedSubject
      ? getStoredStudentMarksRecord(String(candidate.id), normalizedTermLabel, selectedSession)
      : null
    const storedSubject =
      storedRecord && selectedSubject ? storedRecord.subjects?.[selectedSubject] : null

    const initialFirstCA = storedSubject?.ca1 ?? 0
    const initialSecondCA = storedSubject?.ca2 ?? 0
    const initialAssignment = storedSubject?.assignment ?? 0
    const initialExam = storedSubject?.exam ?? 0
    const caTotal =
      storedSubject?.caTotal ??
      calculateContinuousAssessmentTotal(initialFirstCA, initialSecondCA, initialAssignment)
    const grandTotal = storedSubject?.total ??
      calculateGrandTotal(initialFirstCA, initialSecondCA, initialAssignment, initialExam)
    const totalObtainable = storedSubject?.totalObtainable ?? 100
    const totalObtained = storedSubject?.totalObtained ?? grandTotal
    const averageScore =
      typeof storedSubject?.averageScore === "number" && totalObtainable > 0
        ? Math.round((totalObtained / totalObtainable) * 100)
        : totalObtainable > 0
          ? Math.round((grandTotal / totalObtainable) * 100)
          : 0

    const newRecord: MarksRecord = {
      studentId: candidate.id,
      studentName: candidate.name ?? `Student ${candidate.id}`,
      firstCA: initialFirstCA,
      secondCA: initialSecondCA,
      noteAssignment: initialAssignment,
      caTotal,
      exam: initialExam,
      grandTotal,
      totalMarksObtainable: totalObtainable,
      totalMarksObtained: totalObtained,
      averageScore,
      position: typeof storedSubject?.position === "number" ? storedSubject.position : 0,
      grade: storedSubject?.grade ?? deriveGradeFromScore(grandTotal),
      teacherRemark: storedSubject?.remark ?? "",
    }

    setMarksData((prev) => calculatePositionsAndAverages([...prev, newRecord]))

    setAdditionalData((prev) => {
      const nextAffective = { ...prev.affectiveDomain }
      const nextPsychomotor = { ...prev.psychomotorDomain }
      const nextRemarks = { ...prev.classTeacherRemarks }
      const nextAttendance = { ...prev.attendance }
      const nextStatus = { ...prev.studentStatus }

      if (!nextAffective[newRecord.studentId]) {
        nextAffective[newRecord.studentId] = {}
      }
      if (!nextPsychomotor[newRecord.studentId]) {
        nextPsychomotor[newRecord.studentId] = {}
      }
      if (typeof nextRemarks[newRecord.studentId] === "undefined") {
        nextRemarks[newRecord.studentId] = ""
      }
      if (!nextAttendance[newRecord.studentId]) {
        nextAttendance[newRecord.studentId] = { present: 0, absent: 0, total: 0 }
      }
      if (!nextStatus[newRecord.studentId]) {
        nextStatus[newRecord.studentId] = storedRecord?.status ?? "promoted"
      }

      return {
        ...prev,
        affectiveDomain: nextAffective,
        psychomotorDomain: nextPsychomotor,
        classTeacherRemarks: nextRemarks,
        attendance: nextAttendance,
        studentStatus: nextStatus,
      }
    })

    setRosterCandidates((prev) => prev.filter((entry) => entry.id !== candidate.id))

    toast({
      title: `${candidate.name ?? `Student ${candidate.id}`} added`,
      description: "Update their scores and remarks, then save when you are done.",
    })

    handleCloseAddStudentDialog()
  }, [
    calculatePositionsAndAverages,
    handleCloseAddStudentDialog,
    marksData,
    normalizedTermLabel,
    rosterCandidates,
    selectedRosterId,
    selectedSession,
    selectedSubject,
    setAdditionalData,
    toast,
  ])

  const buildStudentPreview = useCallback(
    (student: MarksRecord, aggregatedRaw?: RawReportCardData | null): RawReportCardData => {
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
      const baseSummary = {
        totalMarksObtainable: student.totalMarksObtainable,
        totalMarksObtained: student.totalMarksObtained,
        averageScore: student.averageScore,
        position: student.position,
        numberOfStudents: marksData.length,
        grade: summaryGrade,
      }

      const basePreview: RawReportCardData = {
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
        summary: baseSummary,
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

      if (!aggregatedRaw) {
        return basePreview
      }

      const enrichedSummary = aggregatedRaw.summary
        ? {
            ...aggregatedRaw.summary,
            numberOfStudents:
              additionalData.termInfo.numberInClass ?? aggregatedRaw.summary.numberOfStudents,
          }
        : baseSummary

      return {
        ...aggregatedRaw,
        ...basePreview,
        student: {
          ...basePreview.student,
          ...aggregatedRaw.student,
          numberInClass: additionalData.termInfo.numberInClass,
          status: additionalData.studentStatus[student.studentId] ?? aggregatedRaw.student?.status,
        },
        subjects:
          Array.isArray(aggregatedRaw.subjects) && aggregatedRaw.subjects.length > 0
            ? aggregatedRaw.subjects
            : basePreview.subjects,
        summary: enrichedSummary,
        totalObtainable:
          aggregatedRaw.totalObtainable ?? enrichedSummary.totalMarksObtainable ?? basePreview.totalObtainable,
        totalObtained:
          aggregatedRaw.totalObtained ?? enrichedSummary.totalMarksObtained ?? basePreview.totalObtained,
        average: aggregatedRaw.average ?? enrichedSummary.averageScore ?? basePreview.average,
        position: aggregatedRaw.position ?? enrichedSummary.position ?? basePreview.position,
        affectiveDomain: basePreview.affectiveDomain,
        psychomotorDomain: basePreview.psychomotorDomain,
        classTeacherRemarks: basePreview.classTeacherRemarks,
        remarks: {
          classTeacher:
            basePreview.remarks?.classTeacher ?? aggregatedRaw.remarks?.classTeacher ?? student.teacherRemark,
          headTeacher: aggregatedRaw.remarks?.headTeacher ?? basePreview.remarks?.headTeacher,
        },
        attendance: basePreview.attendance,
        termInfo: basePreview.termInfo,
      }
    },
    [
      additionalData,
      marksData.length,
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      selectedSubject,
    ],
  )

  const handleMarksUpdate = (studentId: string, field: string, value: unknown) => {
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

  const persistAcademicMarksToStorage = useCallback(() => {
    if (!selectedClass || !selectedSubject || marksData.length === 0) {
      return
    }

    try {
      const timestamp = new Date().toISOString()
      const store = readStudentMarksStore()
      const updatedStore: Record<string, StoredStudentMarkRecord> = { ...store }

      let reportCards: ReportCardRecord[] = []
      try {
        const rawReportCards = safeStorage.getItem("reportCards")
        if (rawReportCards) {
          const parsed = JSON.parse(rawReportCards)
          if (Array.isArray(parsed)) {
            reportCards = parsed as ReportCardRecord[]
          }
        }
      } catch (parseError) {
        logger.warn("Unable to parse stored report cards", parseError)
      }

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${normalizedTermLabel}-${selectedSession}`
        const previousRecord = updatedStore[studentKey]
        const subjects: Record<string, StoredSubjectRecord> = { ...(previousRecord?.subjects ?? {}) }

        subjects[selectedSubject] = {
          subject: selectedSubject,
          className: selectedClass,
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: student.noteAssignment,
          caTotal: student.caTotal,
          exam: student.exam,
          total: student.grandTotal,
          grade: student.grade,
          remark: student.teacherRemark,
          position: student.position ?? previousRecord?.subjects?.[selectedSubject]?.position ?? null,
          totalObtainable: student.totalMarksObtainable,
          totalObtained: student.totalMarksObtained,
          averageScore: student.averageScore,
          teacherId: teacher.id,
          teacherName: teacher.name,
          updatedAt: timestamp,
        }

        const aggregatedSubjects = Object.values(subjects)
        const totalMarksObtainable = aggregatedSubjects.reduce(
          (sum, subject) => sum + (subject.totalObtainable ?? 100),
          0,
        )
        const totalMarksObtained = aggregatedSubjects.reduce((sum, subject) => sum + subject.total, 0)
        const overallAverage =
          totalMarksObtainable > 0
            ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2))
            : undefined

        const mergedRecord: StoredStudentMarkRecord = {
          studentId: String(student.studentId),
          studentName: student.studentName,
          className: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          subjects,
          lastUpdated: timestamp,
          status: additionalData.studentStatus[student.studentId] ?? previousRecord?.status,
          numberInClass: additionalData.termInfo.numberInClass || previousRecord?.numberInClass,
          overallAverage: overallAverage ?? previousRecord?.overallAverage,
          overallPosition: student.position ?? previousRecord?.overallPosition ?? null,
        }

        updatedStore[studentKey] = mergedRecord

        const subjectRecords: ReportCardSubjectRecord[] = Object.values(subjects).map((subject) => ({
          name: subject.subject,
          ca1: subject.ca1,
          ca2: subject.ca2,
          assignment: subject.assignment,
          exam: subject.exam,
          total: subject.total,
          grade: subject.grade,
          remark: subject.remark,
          position: subject.position ?? null,
        }))

        const existingIndex = reportCards.findIndex(
          (record) =>
            record.studentId === String(student.studentId) &&
            record.term === normalizedTermLabel &&
            record.session === selectedSession,
        )

        const existingRecord = existingIndex >= 0 ? reportCards[existingIndex] : null
        const reportCardId = existingRecord?.id ?? `report_${student.studentId}_${normalizedTermLabel}_${selectedSession}`
        const headTeacherRemark = existingRecord?.headTeacherRemark ?? null
        const classTeacherRemark =
          additionalData.classTeacherRemarks[student.studentId] ?? student.teacherRemark

        const aggregatedRaw = buildRawReportCardFromStoredRecord(mergedRecord)
        const previewPayload = buildStudentPreview(student, aggregatedRaw)

        const existingMetadata =
          existingRecord && typeof existingRecord.metadata === "object" && existingRecord.metadata !== null
            ? (existingRecord.metadata as Record<string, unknown>)
            : {}

        const updatedReportCard: ReportCardRecord = {
          id: reportCardId,
          studentId: String(student.studentId),
          studentName: student.studentName,
          className: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          subjects: subjectRecords,
          classTeacherRemark,
          headTeacherRemark,
          metadata: {
            ...existingMetadata,
            enhancedReportCard: previewPayload,
            enhancedUpdatedAt: timestamp,
            enhancedUpdatedBy: teacher.id,
          },
          createdAt: existingRecord?.createdAt ?? timestamp,
          updatedAt: timestamp,
        }

        if (existingIndex >= 0) {
          reportCards[existingIndex] = updatedReportCard
        } else {
          reportCards.push(updatedReportCard)
        }

        dbManager.triggerEvent("reportCardUpdated", updatedReportCard)
      })

      safeStorage.setItem(STUDENT_MARKS_STORAGE_KEY, JSON.stringify(updatedStore))
      emitMarksStoreUpdate(updatedStore)
      safeStorage.setItem("reportCards", JSON.stringify(reportCards))
    } catch (error) {
      logger.error("Failed to persist academic marks", { error })
    }
  }, [
    additionalData.classTeacherRemarks,
    additionalData.attendance,
    additionalData.studentStatus,
    additionalData.termInfo.numberInClass,
    buildStudentPreview,
    emitMarksStoreUpdate,
    marksData,
    normalizedTermLabel,
    selectedClass,
    selectedSession,
    selectedSubject,
    teacher.id,
    teacher.name,
  ])

  const loadStoredReportCardPreview = useCallback(
    (studentId: string): RawReportCardData | null => {
      try {
        const stored = safeStorage.getItem("reportCards")
        if (!stored) {
          return null
        }

        const parsed = JSON.parse(stored) as unknown
        if (!Array.isArray(parsed)) {
          return null
        }

        const normalizedId = String(studentId)
        for (const entry of parsed) {
          if (!entry || typeof entry !== "object") {
            continue
          }

          const candidate = entry as ReportCardRecord
          if (
            candidate.studentId === normalizedId &&
            mapTermKeyToLabel(candidate.term) === normalizedTermLabel &&
            candidate.session === selectedSession
          ) {
            return mapReportCardRecordToRaw(candidate)
          }
        }
      } catch (error) {
        logger.warn("Unable to load stored report card preview", error)
      }

      return null
    },
    [normalizedTermLabel, selectedSession],
  )

  const closePreviewDialog = useCallback(() => {
    setPreviewDialogOpen(false)
    setPreviewStudentId(null)
    setPreviewData(null)
    setIsPreviewDownloading(false)
  }, [])

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

      persistAcademicMarksToStorage()

      setPreviewStudentId(student.studentId)

      const storedPreview = loadStoredReportCardPreview(String(student.studentId))
      if (storedPreview) {
        setPreviewData(storedPreview)
        setPreviewDialogOpen(true)
        return
      }

      const storedRecord = getStoredStudentMarksRecord(
        String(student.studentId),
        normalizedTermLabel,
        selectedSession,
      )
      const aggregatedRaw = storedRecord
        ? buildRawReportCardFromStoredRecord(storedRecord)
        : null
      const previewPayload = buildStudentPreview(student, aggregatedRaw)

      setPreviewData(previewPayload)
      setPreviewDialogOpen(true)
    },
    [
      buildStudentPreview,
      loadStoredReportCardPreview,
      normalizedTermLabel,
      persistAcademicMarksToStorage,
      selectedClass,
      selectedSession,
      selectedSubject,
      toast,
    ],
  )

  const handlePreviewDownload = useCallback(() => {
    if (!previewData) {
      toast({
        title: "Preview unavailable",
        description: "Generate a report card preview before attempting to download.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsPreviewDownloading(true)
      const html = buildReportCardHtml(previewData)
      const blob = new Blob([html], { type: "text/html" })
      const studentName = previewData.student.name ?? "student"
      const termLabel = mapTermKeyToLabel(selectedTerm)
      const filename = `${sanitizeFileName(studentName)}-${sanitizeFileName(termLabel)}-${sanitizeFileName(selectedSession)}.html`

      const link = document.createElement("a")
      const downloadUrl = URL.createObjectURL(blob)
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      logger.error("Failed to download report card preview", { error })
      toast({
        title: "Download failed",
        description: "We couldn't generate the report card file. Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setIsPreviewDownloading(false)
    }
  }, [previewData, selectedSession, selectedTerm, toast])

  const generateCumulativeSummaries = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (marksData.length === 0) {
        setCumulativeSummaries({})
        if (!options.silent) {
          toast({
            title: "No students loaded",
            description: "Add students to the grade sheet before generating cumulative summaries.",
          })
        }
        return {}
      }

      try {
        setIsGeneratingCumulative(true)
        const summaries = await Promise.all(
          marksData.map(async (student) => {
            try {
              const report = await dbManager.getStudentCumulativeReport(
                String(student.studentId),
                selectedSession,
              )
              if (!report) {
                return { studentId: String(student.studentId), summary: undefined }
              }
              const summary: ReportCardCumulativeSummary = {
                average: report.cumulativeAverage,
                grade: report.cumulativeGrade,
                position: report.cumulativePosition,
                totalStudents: report.totalStudents ?? marksData.length,
              }
              return { studentId: String(student.studentId), summary }
            } catch (error) {
              logger.warn("Failed to resolve cumulative summary", {
                error,
                studentId: student.studentId,
              })
              return { studentId: String(student.studentId), summary: undefined }
            }
          }),
        )

        const nextSummaries: Record<string, ReportCardCumulativeSummary> = {}
        let generatedCount = 0
        summaries.forEach(({ studentId, summary }) => {
          if (summary) {
            nextSummaries[studentId] = summary
            generatedCount += 1
          }
        })

        setCumulativeSummaries(nextSummaries)

        if (!options.silent) {
          toast({
            title: generatedCount > 0 ? "Cumulative summary ready" : "Cumulative summary pending",
            description:
              generatedCount > 0
                ? `Updated cumulative snapshots for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
                : "No cumulative data is available yet. Sync exam results to generate summaries.",
          })
        }

        return nextSummaries
      } catch (error) {
        logger.error("Failed to generate cumulative summaries", { error })
        if (!options.silent) {
          toast({
            variant: "destructive",
            title: "Unable to generate cumulative summary",
            description: error instanceof Error ? error.message : "Please try again.",
          })
        }
        return {}
      } finally {
        setIsGeneratingCumulative(false)
      }
    },
    [marksData, selectedSession, toast],
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
      const summaries = await generateCumulativeSummaries({ silent: true })
      const generatedCount = Object.keys(summaries).length
      const cumulativeMessage =
        generatedCount > 0
          ? `Cumulative snapshots updated for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
          : "Cumulative summaries will refresh once the exam office confirms the remaining subject scores."

      toast({
        title: "Grades synced",
        description: `Marks are now available in the admin Exam Management portal for consolidation. ${cumulativeMessage}`,
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

  const refreshMarksForSelection = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }

    void (async () => {
      if (!selectedClass || !selectedSubject) {
        setMarksData([])
        return
      }

      try {
        const normalizedClass = normalizeClassName(selectedClass)
        const normalizedSubject = selectedSubject.toLowerCase()
        const liveRecords: MarksRecord[] = []

        try {
          const matchingExams = await dbManager.getExamSchedules({
            className: selectedClass,
            term: normalizedTermLabel,
            session: selectedSession,
          })
          const targetExam = matchingExams.find(
            (exam) => (exam.subject ?? "").toLowerCase() === normalizedSubject,
          )

          if (targetExam) {
            const examResults = await dbManager.getExamResults(targetExam.id)
            examResults
              .filter(
                (result) => normalizeClassName(result.className ?? "") === normalizedClass,
              )
              .forEach((result) => {
                const normalizedScores = normalizeAssessmentScores({
                  ca1: result.ca1 ?? 0,
                  ca2: result.ca2 ?? 0,
                  assignment: result.assignment ?? 0,
                  exam: result.exam ?? 0,
                })

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

                liveRecords.push({
                  studentId: result.studentId,
                  studentName:
                    typeof result.studentName === "string" && result.studentName.trim().length > 0
                      ? result.studentName
                      : `Student ${result.studentId}`,
                  firstCA: normalizedScores.ca1,
                  secondCA: normalizedScores.ca2,
                  noteAssignment: normalizedScores.assignment,
                  caTotal,
                  exam: normalizedScores.exam,
                  grandTotal,
                  totalMarksObtainable: 100,
                  totalMarksObtained: grandTotal,
                  averageScore: 0,
                  position:
                    typeof result.position === "number" && Number.isFinite(result.position)
                      ? result.position
                      : 0,
                  grade:
                    typeof result.grade === "string" && result.grade.trim().length > 0
                      ? result.grade.trim().toUpperCase()
                      : deriveGradeFromScore(grandTotal),
                  teacherRemark:
                    typeof result.remarks === "string" ? result.remarks : "",
                })
              })
          }
        } catch (examError) {
          logger.warn("Unable to load live exam results for teacher selection", {
            error: examError,
          })
        }

        let nextRecords = liveRecords

        if (nextRecords.length === 0) {
          const store = readStudentMarksStore()
          const storedRecords: MarksRecord[] = []

          Object.values(store).forEach((record) => {
            if (!record) {
              return
            }

            if (normalizeClassName(record.className ?? "") !== normalizedClass) {
              return
            }

            if (record.term !== normalizedTermLabel) {
              return
            }

            if (record.session !== selectedSession) {
              return
            }

            const subjects = record.subjects ?? {}
            const subjectRecord =
              subjects[selectedSubject] ??
              Object.values(subjects).find(
                (entry) =>
                  typeof entry.subject === "string" &&
                  entry.subject.toLowerCase() === normalizedSubject,
              )

            if (!subjectRecord) {
              return
            }

            const normalizedScores = normalizeAssessmentScores({
              ca1: subjectRecord.ca1 ?? 0,
              ca2: subjectRecord.ca2 ?? 0,
              assignment: subjectRecord.assignment ?? 0,
              exam: subjectRecord.exam ?? 0,
            })

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

            const totalMarksObtainable =
              typeof subjectRecord.totalObtainable === "number" &&
              Number.isFinite(subjectRecord.totalObtainable)
                ? subjectRecord.totalObtainable
                : 100
            const totalMarksObtained =
              typeof subjectRecord.totalObtained === "number" &&
              Number.isFinite(subjectRecord.totalObtained)
                ? subjectRecord.totalObtained
                : grandTotal

            const teacherRemark =
              typeof subjectRecord.remark === "string" ? subjectRecord.remark : ""

            storedRecords.push({
              studentId: record.studentId,
              studentName:
                typeof record.studentName === "string" && record.studentName.trim().length > 0
                  ? record.studentName
                  : `Student ${record.studentId}`,
              firstCA: normalizedScores.ca1,
              secondCA: normalizedScores.ca2,
              noteAssignment: normalizedScores.assignment,
              caTotal,
              exam: normalizedScores.exam,
              grandTotal,
              totalMarksObtainable,
              totalMarksObtained,
              averageScore:
                totalMarksObtainable > 0
                  ? Math.round((totalMarksObtained / totalMarksObtainable) * 100)
                  : 0,
              position:
                typeof subjectRecord.position === "number" && Number.isFinite(subjectRecord.position)
                  ? subjectRecord.position
                  : 0,
              grade:
                typeof subjectRecord.grade === "string" && subjectRecord.grade.trim().length > 0
                  ? subjectRecord.grade.trim().toUpperCase()
                  : deriveGradeFromScore(grandTotal),
              teacherRemark,
            })
          })

          nextRecords = storedRecords
        }

        setMarksData(nextRecords.length > 0 ? calculatePositionsAndAverages(nextRecords) : [])
      } catch (error) {
        logger.warn("Failed to refresh marks for selection", { error })
        setMarksData([])
      }
    })()
  }, [
    calculatePositionsAndAverages,
    normalizedTermLabel,
    normalizeClassName,
    selectedClass,
    selectedSession,
    selectedSubject,
  ])

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
      affectiveDomain: {} as BehavioralDomainState,
      psychomotorDomain: {} as BehavioralDomainState,
      classTeacherRemarks: {} as Record<string, string>,
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
            attendance?: { present?: number; absent?: number; total?: number }
            status?: string
            termInfo?: Partial<TermInfoState>
          }
        | undefined

      if (attendanceRecord) {
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
      affectiveDomain: nextState.affectiveDomain,
      psychomotorDomain: nextState.psychomotorDomain,
      classTeacherRemarks: nextState.classTeacherRemarks,
      attendance: nextState.attendance,
      studentStatus: nextState.studentStatus,
      termInfo: termInfoLoaded ? nextState.termInfo : createEmptyTermInfo(),
    }))
  }, [marksData, normalizedTermLabel, selectedSession])

  useEffect(() => {
    refreshMarksForSelection()
  }, [refreshMarksForSelection])

  useEffect(() => {
    const handleExamResultsUpdate = () => {
      refreshMarksForSelection()
    }

    dbManager.on("examResultsUpdated", handleExamResultsUpdate)

    return () => {
      dbManager.off("examResultsUpdated", handleExamResultsUpdate)
    }
  }, [refreshMarksForSelection])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleMarksUpdate = () => {
      if (suppressMarksRefreshRef.current) {
        return
      }
      refreshMarksForSelection()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STUDENT_MARKS_STORAGE_KEY) {
        if (suppressMarksRefreshRef.current) {
          return
        }
        refreshMarksForSelection()
      }
    }

    dbManager.on(STUDENT_MARKS_STORAGE_KEY, handleMarksUpdate)
    window.addEventListener("storage", handleStorage)

    return () => {
      dbManager.off(STUDENT_MARKS_STORAGE_KEY, handleMarksUpdate)
      window.removeEventListener("storage", handleStorage)
    }
  }, [refreshMarksForSelection])

  useEffect(() => {
    loadAdditionalData()
  }, [loadAdditionalData])

  useEffect(() => {
    persistAcademicMarksToStorage()
  }, [persistAcademicMarksToStorage])

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

  const handleSaveDraft = useCallback(async () => {
    if (!selectedClass || !selectedSubject) {
      toast({
        variant: "destructive",
        title: "Select class & subject",
        description: "Choose a class and subject before saving your progress.",
      })
      return
    }

    if (!marksData.length) {
      toast({
        variant: "destructive",
        title: "No student results",
        description: "Add student scores before saving progress.",
      })
      return
    }

    try {
      setIsSavingDraft(true)
      await Promise.resolve(persistAcademicMarksToStorage())
      toast({
        title: "Progress saved",
        description: "Your report card entries are stored until you're ready to submit for approval.",
      })
    } catch (error) {
      logger.error("Failed to save report card draft", { error })
      toast({
        variant: "destructive",
        title: "Unable to save progress",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsSavingDraft(false)
    }
  }, [
    marksData.length,
    persistAcademicMarksToStorage,
    selectedClass,
    selectedSubject,
    toast,
  ])

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
      persistAcademicMarksToStorage()
      setIsSubmittingForApproval(true)
      const cumulativeSnapshot = await generateCumulativeSummaries({ silent: true })
      const generatedCount = Object.keys(cumulativeSnapshot).length
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
        cumulativeSummaries: cumulativeSnapshot,
      })

      setWorkflowRecords(updated)
      toast({
        title: "Sent for approval",
        description:
          generatedCount > 0
            ? `Admin has been notified to review this result batch, including cumulative snapshots for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
            : "Admin has been notified to review this result batch. Cumulative summaries will update after the exam office finalises other subjects.",
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
    generateCumulativeSummaries,
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

  const handleDownloadSubmissionFile = (
    submission: AssignmentSubmissionRecord,
    file: NonNullable<AssignmentSubmissionRecord["files"]>[number],
  ) => {
    if (!file.url) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: "This submission file could not be downloaded.",
      })
      return
    }

    const runtime = getBrowserRuntime()

    if (!runtime?.document) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: "Submission files can only be downloaded in a browser environment.",
      })
      return
    }

    const link = runtime.document.createElement("a")
    link.href = file.url
    link.download = file.name || `${submission.studentId}-submission`
    runtime.document.body?.appendChild(link)
    link.click()
    runtime.document.body?.removeChild(link)
  }

  const resetAssignmentForm = useCallback(() => {
    setAssignmentForm({
      title: "",
      description: "",
      dueDate: "",
      subject: teacher.classes[0]?.subjects[0] ?? teacher.subjects[0] ?? "",
      classId: teacher.classes[0]?.id ?? "",
      className: teacher.classes[0]?.name ?? "",
      maximumScore: String(defaultAssignmentMaximum),
      file: null,
      resourceName: "",
      resourceType: "",
      resourceUrl: "",
      resourceSize: null,
    })
    setEditingAssignmentId(null)
    setAssignmentDialogMode("create")
  }, [defaultAssignmentMaximum, teacher.classes, teacher.subjects])

  const openCreateAssignmentDialog = () => {
    resetAssignmentForm()
    setShowCreateAssignment(true)
  }

  const handleEditAssignment = (assignment: TeacherAssignmentSummary) => {
    setAssignmentDialogMode("edit")
    setEditingAssignmentId(assignment.id)
    const matchedClass = assignment.classId
      ? teacher.classes.find((cls) => cls.id === assignment.classId)
      : teacher.classes.find((cls) => normalizeClassName(cls.name) === normalizeClassName(assignment.className))
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description ?? "",
      dueDate: assignment.dueDate,
      subject: assignment.subject,
      classId: matchedClass?.id ?? assignment.classId ?? "",
      className: matchedClass?.name ?? assignment.className,
      maximumScore: assignment.maximumScore ? String(assignment.maximumScore) : String(defaultAssignmentMaximum),
      file: null,
      resourceName: assignment.resourceName ?? "",
      resourceType: assignment.resourceType ?? "",
      resourceUrl: assignment.resourceUrl ?? "",
      resourceSize: typeof assignment.resourceSize === "number" ? assignment.resourceSize : null,
    })
    setShowCreateAssignment(true)
  }

  const handlePreviewAssignment = (assignment: TeacherAssignmentSummary) => {
    setPreviewAssignment(assignment)
  }

  const describeDueDate = (value: string) => {
    if (!value) return "No due date"
    const dueDate = new Date(value)
    if (Number.isNaN(dueDate.getTime())) {
      return value
    }

    const oneDay = 1000 * 60 * 60 * 24
    const diff = Math.ceil((dueDate.getTime() - Date.now()) / oneDay)

    if (diff > 1) return `Due in ${diff} days`
    if (diff === 1) return "Due tomorrow"
    if (diff === 0) return "Due today"
    return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`
  }

  useEffect(() => {
    if (!assignments.length || !teacher.id) {
      return
    }

    const reminderTasks = assignments.map(async (assignment) => {
      const assignmentId = assignment.id
      const dueDate = assignment.dueDate

      if (!assignmentId || !dueDate) {
        clearAssignmentReminderHistory("teacher", assignmentId)
        return
      }

      if (assignment.status === "draft") {
        clearAssignmentReminderHistory("teacher", assignmentId)
        return
      }

      const dueTimestamp = Date.parse(dueDate)
      if (Number.isNaN(dueTimestamp)) {
        return
      }

      const submittedCount = assignment.submissions.filter((submission) =>
        ["submitted", "graded"].includes(submission.status),
      ).length
      const gradedCount = assignment.submissions.filter((submission) => submission.status === "graded").length
      const pendingGradingCount = assignment.submissions.filter((submission) => submission.status === "submitted").length
      const totalAssigned = Array.isArray(assignment.assignedStudentIds)
        ? assignment.assignedStudentIds.length
        : assignment.submissions.length
      const missingSubmissions = Math.max(totalAssigned - submittedCount, 0)

      if (pendingGradingCount === 0 && missingSubmissions === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId)
        return
      }

      const audience = [teacher.id, "teacher"] as const
      const title = assignment.title || "Assignment"
      const className = assignment.className || assignment.classId || undefined
      const subject = assignment.subject

      if (pendingGradingCount > 0 && Date.now() > dueTimestamp) {
        if (shouldSendAssignmentReminder("teacher", assignmentId, "gradingPending", { dueDate })) {
          try {
            await dbManager.saveNotification({
              title: "Submissions awaiting grading",
              message: `You have ${pendingGradingCount} submission${pendingGradingCount === 1 ? "" : "s"} to grade for "${title}".`,
              type: "warning",
              category: "task",
              audience,
              targetAudience: audience,
              metadata: {
                assignmentId,
                dueDate,
                subject,
                className,
                pendingGrading: pendingGradingCount,
              },
            })
            markAssignmentReminderSent("teacher", assignmentId, "gradingPending", { dueDate })
          } catch (error) {
            logger.error("Failed to save grading reminder", { error, assignmentId })
          }
        }
      } else if (pendingGradingCount === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId, { types: ["gradingPending"] })
      }

      if (missingSubmissions > 0 && Date.now() > dueTimestamp) {
        if (shouldSendAssignmentReminder("teacher", assignmentId, "missingSubmissions", { dueDate })) {
          try {
            await dbManager.saveNotification({
              title: "Students missing submissions",
              message: `${missingSubmissions} student${missingSubmissions === 1 ? "" : "s"} have not submitted "${title}".`,
              type: "destructive",
              category: "task",
              audience,
              targetAudience: audience,
              metadata: {
                assignmentId,
                dueDate,
                subject,
                className,
                outstandingSubmissions: missingSubmissions,
                gradedCount,
              },
            })
            markAssignmentReminderSent("teacher", assignmentId, "missingSubmissions", { dueDate })
          } catch (error) {
            logger.error("Failed to save missing submission reminder", { error, assignmentId })
          }
        }
      } else if (missingSubmissions === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId, { types: ["missingSubmissions"] })
      }
    })

    void Promise.allSettled(reminderTasks)
  }, [assignments, teacher.id])

  const handleSaveAssignment = async (intent: "draft" | "sent") => {
    if (isSavingAssignment) {
      return
    }

    if (
      !assignmentForm.title ||
      !assignmentForm.subject ||
      !assignmentForm.className ||
      !assignmentForm.dueDate ||
      (teacher.classes.length > 0 && !assignmentForm.classId)
    ) {
      toast({
        variant: "destructive",
        title: "Incomplete details",
        description: "Please provide the title, subject, class, and due date for the assignment.",
      })
      return
    }

    const parsedMaximum = Number(assignmentForm.maximumScore)
    if (!Number.isFinite(parsedMaximum) || parsedMaximum <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid mark",
        description: "Please set a valid maximum score greater than zero for this assignment.",
      })
      return
    }

    const maximumScoreValue = Math.round(parsedMaximum)

    try {
      setIsSavingAssignment(true)

      const trimmedClassName = assignmentForm.className.trim()
      const trimmedClassId = assignmentForm.classId?.trim() ?? ""
      const resolvedClassId = trimmedClassId.length > 0 ? trimmedClassId : null

      let resourceUrl = assignmentForm.resourceUrl || ""
      let resourceType = assignmentForm.resourceType || ""
      let resourceSize = assignmentForm.resourceSize ?? null
      let resourceName = assignmentForm.resourceName || ""

      if (assignmentForm.file) {
        resourceUrl = await readFileAsDataUrl(assignmentForm.file)
        resourceType = assignmentForm.file.type || "application/octet-stream"
        resourceSize = assignmentForm.file.size
        resourceName = assignmentForm.file.name
      }

      const payload = {
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        subject: assignmentForm.subject,
        classId: resolvedClassId,
        className: trimmedClassName,
        teacherId: teacher.id,
        teacherName: teacher.name,
        dueDate: assignmentForm.dueDate,
        status: intent,
        maximumScore: maximumScoreValue,
        resourceName: resourceName || null,
        resourceType: resourceType || null,
        resourceUrl: resourceUrl || null,
        resourceSize,
      }

      if (assignmentDialogMode === "edit" && editingAssignmentId) {
        await dbManager.updateAssignment(editingAssignmentId, payload)
        toast({
          title: intent === "sent" ? "Assignment sent" : "Draft updated",
          description:
            intent === "sent"
              ? "Students can now access the refreshed assignment."
              : "Your changes have been saved successfully.",
        })
      } else {
        await dbManager.createAssignment(payload)

        toast({
          title: intent === "sent" ? "Assignment sent" : "Draft saved",
          description:
            intent === "sent"
              ? "Students have been notified about the new assignment."
              : "You can return later to finish and send this assignment.",
        })
      }

      setShowCreateAssignment(false)
      resetAssignmentForm()
      void loadAssignments()
    } catch (error) {
      logger.error("Failed to save assignment", { error })
      toast({
        variant: "destructive",
        title: "Unable to save assignment",
        description: error instanceof Error ? error.message : "Please try again or contact the administrator.",
      })
    } finally {
      setIsSavingAssignment(false)
    }
  }

  const handleAssignmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSavingAssignment) {
      return
    }

    const nativeEvent = event.nativeEvent
    let intent: "draft" | "sent" = "draft"

    if (nativeEvent && typeof (nativeEvent as SubmitEvent).submitter !== "undefined") {
      const submitter = (nativeEvent as SubmitEvent).submitter

      if (submitter instanceof HTMLElement) {
        const rawValue =
          submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
            ? submitter.value
            : submitter.getAttribute("value") ?? ""

        const fallbackIntent = submitter.getAttribute("data-intent")
        const normalized = (rawValue || fallbackIntent || "").toLowerCase()

        if (normalized === "sent" || normalized === "send") {
          intent = "sent"
        } else if (normalized === "draft" || normalized === "save") {
          intent = "draft"
        }
      }
    }

    await handleSaveAssignment(intent)
  }

  const handleSendAssignment = async (assignment: TeacherAssignmentSummary) => {
    try {
      setAssignmentActionId(assignment.id)
      await dbManager.updateAssignmentStatus(assignment.id, "sent")
      toast({
        title: "Assignment sent",
        description: "Students can now view and submit this assignment.",
      })
      void loadAssignments()
    } catch (error) {
      logger.error("Failed to send assignment", { error })
      toast({
        variant: "destructive",
        title: "Unable to send assignment",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setAssignmentActionId(null)
    }
  }

  const handleDeleteAssignment = async (assignment: TeacherAssignmentSummary) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete ${assignment.title}? This cannot be undone.`)
      if (!confirmed) {
        return
      }
    }

    try {
      setDeletingAssignmentId(assignment.id)
      await dbManager.deleteAssignment(assignment.id)
      toast({
        title: "Assignment deleted",
        description: "The assignment has been removed from your dashboard.",
      })
      void loadAssignments()
    } catch (error) {
      logger.error("Failed to delete assignment", { error })
      toast({
        variant: "destructive",
        title: "Unable to delete assignment",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setDeletingAssignmentId(null)
    }
  }

  const handleViewSubmissions = async (assignment: TeacherAssignmentSummary) => {
    setSelectedAssignment(assignment)
    setGradingDrafts(buildInitialGradingDrafts(assignment.submissions))
    setShowSubmissions(true)
    setIsLoadingSubmissions(true)
    setAssignmentRoster({})

    try {
      const initialRoster = await resolveAssignmentRoster(assignment)
      setAssignmentRoster(initialRoster)

      const records = await dbManager.getAssignments({
        teacherId: teacher.id,
        assignmentId: assignment.id,
      })

      const latest = records.find((record) => String(record.id) === assignment.id)

      if (latest) {
        const normalised = normaliseAssignmentRecord(latest)
        setSelectedAssignment(normalised)
        setGradingDrafts(buildInitialGradingDrafts(normalised.submissions))
        const updatedRoster = await resolveAssignmentRoster(normalised)
        setAssignmentRoster(updatedRoster)
      }
    } catch (error) {
      logger.error("Failed to load assignment submissions", { error })
      toast({
        variant: "destructive",
        title: "Unable to load submissions",
        description: "Please try again shortly.",
      })
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  const applyAssignmentScoreToMarksRecord = (
    studentId: string,
    score: number | null,
  ): MarksRecord | null => {
    if (score === null) {
      const existing = marksData.find((entry) => entry.studentId === studentId)
      return existing ?? null
    }

    let updatedRecord: MarksRecord | null = null

    setMarksData((prev) => {
      const updated = prev.map((student) => {
        if (student.studentId !== studentId) {
          return student
        }

        const normalizedScores = normalizeAssessmentScores({
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: score,
          exam: student.exam,
        })

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

        const recalculated: MarksRecord = {
          ...student,
          firstCA: normalizedScores.ca1,
          secondCA: normalizedScores.ca2,
          noteAssignment: normalizedScores.assignment,
          exam: normalizedScores.exam,
          caTotal,
          grandTotal,
          totalMarksObtained: grandTotal,
          grade: calculateGrade(grandTotal),
        }

        updatedRecord = recalculated
        return recalculated
      })

      return calculatePositionsAndAverages(updated)
    })

    return updatedRecord
  }

  const syncAssignmentScoreToReportCard = useCallback(
    ({
      studentId,
      studentName,
      className,
      subject,
      score,
      grade,
      maximumScore,
      marksRecord,
    }: {
      studentId: string
      studentName?: string | null
      className?: string | null
      subject: string
      score: number
      grade: string | null
      maximumScore: number
      marksRecord?: MarksRecord | null
    }) => {
      try {
        const store = readStudentMarksStore()
        const timestamp = new Date().toISOString()
        const normalizedTerm = normalizedTermLabel
        const key = `${studentId}-${normalizedTerm}-${selectedSession}`
        const previousRecord = store[key] ?? null

        const subjects = { ...(previousRecord?.subjects ?? {}) }
        const baseline = subjects[subject] ?? {
          subject,
          className: className ?? previousRecord?.className ?? selectedClass ?? "",
          ca1: previousRecord?.subjects?.[subject]?.ca1 ?? 0,
          ca2: previousRecord?.subjects?.[subject]?.ca2 ?? 0,
          assignment: previousRecord?.subjects?.[subject]?.assignment ?? 0,
          caTotal: previousRecord?.subjects?.[subject]?.caTotal ?? 0,
          exam: previousRecord?.subjects?.[subject]?.exam ?? 0,
          total: previousRecord?.subjects?.[subject]?.total ?? 0,
          grade: previousRecord?.subjects?.[subject]?.grade ?? "",
          remark: previousRecord?.subjects?.[subject]?.remark ?? "",
          position: previousRecord?.subjects?.[subject]?.position ?? null,
          totalObtainable: previousRecord?.subjects?.[subject]?.totalObtainable ?? 100,
          totalObtained:
            previousRecord?.subjects?.[subject]?.totalObtained ??
            previousRecord?.subjects?.[subject]?.total ??
            0,
          averageScore: previousRecord?.subjects?.[subject]?.averageScore,
          teacherId: previousRecord?.subjects?.[subject]?.teacherId,
          teacherName: previousRecord?.subjects?.[subject]?.teacherName,
          updatedAt: previousRecord?.subjects?.[subject]?.updatedAt,
        }

        const caTotal = calculateContinuousAssessmentTotal(baseline.ca1, baseline.ca2, score)
        const total = calculateGrandTotal(baseline.ca1, baseline.ca2, score, baseline.exam)
        const resolvedGrade =
          grade ?? (maximumScore > 0 ? deriveGradeFromScore((score / maximumScore) * 100) : baseline.grade)

        const updatedSubject: StoredSubjectRecord = {
          ...baseline,
          subject,
          className: className ?? baseline.className,
          assignment: score,
          caTotal,
          total,
          grade: resolvedGrade,
          totalObtained: total,
          teacherId: teacher.id,
          teacherName: teacher.name,
          updatedAt: timestamp,
        }

        subjects[subject] = updatedSubject

        const aggregatedSubjects = Object.values(subjects)
        const totalMarksObtainable = aggregatedSubjects.reduce(
          (sum, subjectRecord) => sum + (subjectRecord.totalObtainable ?? 100),
          0,
        )
        const totalMarksObtained = aggregatedSubjects.reduce(
          (sum, subjectRecord) => sum + (subjectRecord.total ?? 0),
          0,
        )
        const overallAverage =
          totalMarksObtainable > 0
            ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2))
            : undefined

        const mergedRecord: StoredStudentMarkRecord = {
          studentId,
          studentName:
            studentName ??
            marksRecord?.studentName ??
            previousRecord?.studentName ??
            `Student ${studentId}`,
          className: className ?? previousRecord?.className ?? selectedClass ?? "",
          term: normalizedTerm,
          session: selectedSession,
          subjects,
          lastUpdated: timestamp,
          status: additionalData.studentStatus[studentId] ?? previousRecord?.status,
          numberInClass: additionalData.termInfo.numberInClass || previousRecord?.numberInClass,
          overallAverage: overallAverage ?? previousRecord?.overallAverage,
          overallPosition: previousRecord?.overallPosition ?? null,
        }

        store[key] = mergedRecord

        let reportCards: ReportCardRecord[] = []
        try {
          const rawReportCards = safeStorage.getItem("reportCards")
          if (rawReportCards) {
            const parsed = JSON.parse(rawReportCards)
            if (Array.isArray(parsed)) {
              reportCards = parsed as ReportCardRecord[]
            }
          }
        } catch (parseError) {
          logger.warn("Unable to parse stored report cards", parseError)
        }

        const subjectRecords: ReportCardSubjectRecord[] = Object.values(subjects).map((subjectRecord) => ({
          name: subjectRecord.subject,
          ca1: subjectRecord.ca1,
          ca2: subjectRecord.ca2,
          assignment: subjectRecord.assignment,
          exam: subjectRecord.exam,
          total: subjectRecord.total,
          grade: subjectRecord.grade,
          remark: subjectRecord.remark,
          position: subjectRecord.position ?? null,
        }))

        const existingIndex = reportCards.findIndex(
          (record) =>
            record.studentId === studentId &&
            record.term === normalizedTerm &&
            record.session === selectedSession,
        )

        const existingRecord = existingIndex >= 0 ? reportCards[existingIndex] : null
        const reportCardId =
          existingRecord?.id ?? `report_${studentId}_${normalizedTerm}_${selectedSession}`
        const headTeacherRemark = existingRecord?.headTeacherRemark ?? null
        const classTeacherRemark =
          additionalData.classTeacherRemarks[studentId] ??
          marksRecord?.teacherRemark ??
          existingRecord?.classTeacherRemark ??
          ""

        const aggregatedRaw = buildRawReportCardFromStoredRecord(mergedRecord)

        const metadata =
          existingRecord && typeof existingRecord.metadata === "object" && existingRecord.metadata !== null
            ? { ...(existingRecord.metadata as Record<string, unknown>) }
            : {}

        if (aggregatedRaw) {
          metadata.enhancedReportCard = aggregatedRaw
        }

        const updatedReportCard: ReportCardRecord = {
          id: reportCardId,
          studentId,
          studentName: mergedRecord.studentName,
          className: mergedRecord.className,
          term: normalizedTerm,
          session: selectedSession,
          subjects: subjectRecords,
          classTeacherRemark,
          headTeacherRemark,
          metadata,
          createdAt: existingRecord?.createdAt ?? timestamp,
          updatedAt: timestamp,
        }

        if (existingIndex >= 0) {
          reportCards[existingIndex] = updatedReportCard
        } else {
          reportCards.push(updatedReportCard)
        }

        safeStorage.setItem(STUDENT_MARKS_STORAGE_KEY, JSON.stringify(store))
        safeStorage.setItem("reportCards", JSON.stringify(reportCards))
        emitMarksStoreUpdate(store)
        dbManager.triggerEvent("reportCardUpdated", updatedReportCard)
      } catch (error) {
        logger.error("Failed to sync assignment grade to report card", { error })
      }
    },
    [
      additionalData.classTeacherRemarks,
      additionalData.studentStatus,
      additionalData.termInfo.numberInClass,
      emitMarksStoreUpdate,
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      teacher.id,
      teacher.name,
    ],
  )

  const handleGradeSubmission = async (submission: AssignmentSubmissionRecord) => {
    if (!selectedAssignment) return

    const assignmentMaxScore = selectedAssignment.maximumScore ?? assignmentMaximum
    const draft = gradingDrafts[submission.id] ?? { score: "", comment: "" }
    const trimmedComment = draft.comment.trim()
    const trimmedScore = draft.score.trim()
    const hasScore = trimmedScore.length > 0
    const parsedScore = hasScore ? Number(trimmedScore) : null

    if (hasScore && (Number.isNaN(parsedScore) || parsedScore === null || parsedScore < 0)) {
      toast({
        variant: "destructive",
        title: "Invalid score",
        description: "Please enter a valid score or leave it blank.",
      })
      return
    }

    if (parsedScore !== null && parsedScore > assignmentMaxScore) {
      toast({
        variant: "destructive",
        title: "Score too high",
        description: `The maximum obtainable score is ${assignmentMaxScore}.`,
      })
      return
    }

    try {
      setGradingSubmissionId(submission.id)
      const normalizedScore = parsedScore === null ? null : Math.round(parsedScore * 100) / 100
      const grade =
        normalizedScore === null
          ? null
          : deriveGradeFromScore((normalizedScore / Math.max(assignmentMaxScore, 1)) * 100)

      const updatedSubmission = await dbManager.gradeAssignmentSubmission(selectedAssignment.id, submission.studentId, {
        score: normalizedScore,
        grade,
        comment: trimmedComment || null,
      })

      setSelectedAssignment((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          submissions: prev.submissions.map((entry) =>
            entry.id === submission.id ? { ...entry, ...updatedSubmission } : entry,
          ),
        }
      })

      setGradingDrafts((prev) => ({
        ...prev,
        [submission.id]: {
          score: normalizedScore === null ? "" : String(normalizedScore),
          comment: trimmedComment,
        },
      }))

      if (normalizedScore !== null) {
        const updatedMarksRecord = applyAssignmentScoreToMarksRecord(
          submission.studentId,
          normalizedScore,
        )
        const rosterEntry = assignmentRoster[submission.studentId]
        syncAssignmentScoreToReportCard({
          studentId: submission.studentId,
          studentName: rosterEntry?.name ?? updatedMarksRecord?.studentName ?? submission.studentId,
          className: rosterEntry?.className ?? selectedAssignment.className ?? null,
          subject: selectedAssignment.subject,
          score: normalizedScore,
          grade,
          maximumScore: assignmentMaxScore,
          marksRecord: updatedMarksRecord ?? undefined,
        })
      }

      toast({
        title: "Score saved",
        description:
          normalizedScore === null
            ? "Feedback saved without a score."
            : `Marked ${normalizedScore}/${assignmentMaxScore}${grade ? ` (${grade})` : ""}.`,
      })

      void loadAssignments()
    } catch (error) {
      logger.error("Failed to grade assignment submission", { error })
      toast({
        variant: "destructive",
        title: "Unable to save score",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setGradingSubmissionId(null)
    }
  }

  const handleSaveAcademicRecords = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Choose both a class and subject before saving academic entries.",
        })
        return
      }

      if (!marksData.length) {
        toast({
          variant: "destructive",
          title: "No marks recorded",
          description: "Add student scores before saving academic entries.",
        })
        return
      }

      setIsSavingAcademicRecords(true)
      await Promise.resolve(persistAcademicMarksToStorage())

      toast({
        title: "Academic entries saved",
        description: "Marks and subject remarks have been stored for the selected students.",
      })

      loadAdditionalData()
    } catch (error) {
      logger.error("Error saving academic entries", { error })
      toast({
        variant: "destructive",
        title: "Failed to save academic entries",
        description: "Please try again or contact the administrator if the issue persists.",
      })
    } finally {
      setIsSavingAcademicRecords(false)
    }
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

      persistAcademicMarksToStorage()

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

  const handleSaveAttendanceRecords = async () => {
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
          position: student.position ?? null,
          attendance: { present, absent, total },
          status: additionalData.studentStatus[student.studentId] ?? "promoted",
          termInfo: normalizedTermInfo,
          teacherId: teacher.id,
          timestamp,
        }
      })

      safeStorage.setItem("attendancePositions", JSON.stringify(existingData))

      persistAcademicMarksToStorage()

      toast({
        title: "Attendance saved",
        description: "Attendance records have been updated for the selected students.",
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

      persistAcademicMarksToStorage()

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max flex-nowrap gap-1 bg-green-50 p-1">
            <TabsTrigger
              value="overview"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="marks"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Enter Marks
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Students
            </TabsTrigger>
            <TabsTrigger
              value="timetable"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Timetable
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="noticeboard"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Noticeboard
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">My Classes</CardTitle>
              </CardHeader>
              <CardContent>
                {isContextLoading ? (
                  <p className="text-sm text-gray-600">Loading your class assignments...</p>
                ) : teacher.classes.length === 0 ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>{contextError ?? "You are not assigned to any class. Contact your administrator."}</p>
                    {onRefreshAssignments ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#2d682d]/30 text-[#2d682d]"
                        onClick={() => onRefreshAssignments()}
                      >
                        Refresh assignments
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teacher.classes.map((classItem, index) => (
                      <div key={classItem.id ?? index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{classItem.name}</span>
                        <Badge variant="outline">
                          {classItem.subjects.length > 0
                            ? classItem.subjects.slice(0, 2).join(", ")
                            : "Subjects not set"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

              <ExamScheduleOverview
                role="teacher"
                title="Upcoming Exams"
                description="Next scheduled assessments across your assigned classes."
                classNames={teacherClassNames}
                classIds={teacherClassIds}
                className="h-full"
                emptyState="No upcoming exams scheduled for your classes."
                limit={4}
              />
          </div>

          <SchoolCalendarViewer role="teacher" />

          <NotificationCenter userRole="teacher" userId={teacher.id} />
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
                      {teacher.classes.map((classItem, index) => (
                        <Badge key={classItem.id ?? index} variant="outline">
                          {classItem.name}
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
                      variant="outline"
                      onClick={() => void handleSaveDraft()}
                      disabled={isSavingDraft || isSubmittingForApproval}
                    >
                      {isSavingDraft ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Progress
                    </Button>
                    <Button
                      className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      onClick={() => void handleSubmitForApproval()}
                      disabled={
                        isSavingDraft ||
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
                        disabled={isSavingDraft || isSubmittingForApproval}
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label>Class</Label>
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                      disabled={noClassesAssigned || isContextLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {noClassesAssigned ? (
                          <SelectItem value="" disabled>
                            {isContextLoading ? "Loading..." : "No classes available"}
                          </SelectItem>
                        ) : (
                          teacher.classes.map((classItem) => (
                            <SelectItem key={classItem.id} value={classItem.name}>
                              {classItem.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {noClassesAssigned && !isContextLoading ? (
                      <p className="mt-2 text-sm text-gray-600">
                        {contextError ?? "You are not assigned to any class. Contact your administrator."}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                      disabled={
                        noClassesAssigned || subjectsForSelectedClass.length === 0 || isContextLoading
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsForSelectedClass.length === 0 ? (
                          <SelectItem value="" disabled>
                            {noClassesAssigned ? "No class assigned" : "No subjects available"}
                          </SelectItem>
                        ) : (
                          subjectsForSelectedClass.map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))
                        )}
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
                  <TabsList className="flex w-full flex-col gap-3 bg-transparent p-0 sm:grid sm:grid-cols-2 sm:gap-2 sm:bg-muted sm:p-[3px] xl:grid-cols-4">
                    <TabsTrigger
                      value="academic"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Academic Marks
                    </TabsTrigger>
                    <TabsTrigger
                      value="behavioral"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Behavioral Assessment
                    </TabsTrigger>
                    <TabsTrigger
                      value="attendance"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Attendance &amp; Position
                    </TabsTrigger>
                    <TabsTrigger
                      value="remarks"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Class Teacher Remarks
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="academic" className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-relaxed text-gray-500">
                        Grade Management weighting: 1st CA {CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1}, 2nd CA {CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2},
                        note/assignment {CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment}, exam {CONTINUOUS_ASSESSMENT_MAXIMUMS.exam}.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                          variant="outline"
                          className="border-dashed border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d]/10"
                          onClick={handleOpenAddStudentDialog}
                          disabled={!selectedClass || !selectedSubject}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add Student Entry
                        </Button>
                        <Button
                          variant="outline"
                          className="border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d]/10"
                          onClick={handleSaveAcademicRecords}
                          disabled={
                            isSavingAcademicRecords ||
                            currentStatus.status === "pending" ||
                            currentStatus.status === "approved"
                          }
                        >
                          {isSavingAcademicRecords ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Academic Entries
                        </Button>
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
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                      <Table className="min-w-[1100px] text-xs">
                        <TableHeader className="bg-muted/60">
                          <TableRow className="divide-x divide-gray-200">
                            <TableHead className="w-56 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Student Name
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              1st C.A. ({CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1})
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              2nd C.A. ({CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2})
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Note/Assign ({CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment})
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              C.A. Total ({
                                CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1 +
                                CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2 +
                                CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment
                              })
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Exam ({CONTINUOUS_ASSESSMENT_MAXIMUMS.exam})
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Grand Total (100)
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Total Obtainable
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Total Obtained
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Average %
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Position
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Grade
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Subject Remarks
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Preview
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marksData.map((student) => (
                            <TableRow key={student.studentId} className="divide-x divide-gray-100">
                              <TableCell className="font-medium text-gray-800">
                                {student.studentName}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  max={CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1}
                                  value={student.firstCA}
                                  onChange={(e) =>
                                    handleMarksUpdate(student.studentId, "firstCA", Number.parseInt(e.target.value) || 0)
                                  }
                                  className="h-9 w-full text-xs"
                                  disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  max={CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2}
                                  value={student.secondCA}
                                  onChange={(e) =>
                                    handleMarksUpdate(student.studentId, "secondCA", Number.parseInt(e.target.value) || 0)
                                  }
                                  className="h-9 w-full text-xs"
                                  disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                                />
                              </TableCell>
                              <TableCell>
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
                                  className="h-9 w-full text-xs"
                                  disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold text-[#2d682d]">
                                {student.caTotal}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  max={CONTINUOUS_ASSESSMENT_MAXIMUMS.exam}
                                  value={student.exam}
                                  onChange={(e) =>
                                    handleMarksUpdate(student.studentId, "exam", Number.parseInt(e.target.value) || 0)
                                  }
                                  className="h-9 w-full text-xs"
                                  disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold text-[#b29032]">
                                {student.grandTotal}
                              </TableCell>
                              <TableCell>
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
                                  className="h-9 w-full text-xs"
                                  disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold text-blue-600">
                                {student.totalMarksObtained}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-purple-600">
                                {student.averageScore}%
                              </TableCell>
                              <TableCell className="text-center font-semibold text-orange-600">
                                #{student.position}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={
                                    student.grade === "A" ? "default" : student.grade === "F" ? "destructive" : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {student.grade}
                                </Badge>
                              </TableCell>
                              <TableCell className="min-w-[200px]">
                                <RadioGroup
                                  value={student.teacherRemark}
                                  onValueChange={(value) => handleMarksUpdate(student.studentId, "teacherRemark", value)}
                                  className="flex flex-wrap gap-2"
                                >
                                  {SUBJECT_REMARK_OPTIONS.map((option) => {
                                    const optionId = `${student.studentId}-subject-remark-${option
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]+/g, "-")}`
                                    const isDisabled =
                                      currentStatus.status === "pending" || currentStatus.status === "approved"

                                    return (
                                      <div
                                        key={option}
                                        className="flex items-center gap-1.5 rounded-md border border-muted bg-muted/20 px-2.5 py-1.5"
                                      >
                                        <RadioGroupItem value={option} id={optionId} disabled={isDisabled} />
                                        <Label htmlFor={optionId} className="cursor-pointer text-xs font-medium">
                                          {option}
                                        </Label>
                                      </div>
                                    )
                                  })}
                                </RadioGroup>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => openPreviewForStudent(student)}
                                >
                                  Preview
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    {marksData.length > 0 && (
                      <Card className="mt-4">
                        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <CardTitle className="text-sm text-[#2d682d]">Cumulative Snapshots</CardTitle>
                            <CardDescription className="text-xs text-gray-500">
                              These summaries are bundled with your submission to help admins and parents review progress.
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start md:self-auto"
                            onClick={() => void generateCumulativeSummaries()}
                            disabled={isGeneratingCumulative}
                          >
                            {isGeneratingCumulative ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {isGeneratingCumulative ? "Generating" : "Refresh"}
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {marksData.map((student) => {
                            const summary = cumulativeSummaries[String(student.studentId)]
                            return (
                              <div
                                key={student.studentId}
                                className="flex flex-col gap-3 rounded-lg border border-dashed border-[#2d682d]/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#2d682d]">{student.studentName}</p>
                                  <p className="text-xs text-gray-500">ID: {student.studentId}</p>
                                </div>
                                {summary ? (
                                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                                    <span className="font-medium text-[#2d682d]">{summary.average}% Avg</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {summary.grade}
                                    </Badge>
                                    <span className="text-gray-600">
                                      Position {summary.position}/{summary.totalStudents}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {isGeneratingCumulative ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span>Pending update</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    )}
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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

                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveAttendanceRecords}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Attendance Records
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="remarks" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Class Teacher General Remarks</CardTitle>
                        <CardDescription>
                          Share a brief written comment for each student. The text you enter will appear on their
                          report card.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {marksData.map((student) => (
                          <div key={student.studentId} className="mb-4 rounded-lg border p-3">
                            <Label className="text-sm font-medium" htmlFor={`${student.studentId}-class-remark`}>
                              {student.studentName}
                            </Label>
                            <Textarea
                              id={`${student.studentId}-class-remark`}
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
                              rows={2}
                              className="mt-3 text-sm"
                              placeholder="Enter a short remark"
                              disabled={currentStatus.status === "pending" || currentStatus.status === "approved"}
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
                <Button onClick={openCreateAssignmentDialog} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
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
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-emerald-700">
                        <span>Active assignments</span>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-emerald-900">
                        {assignmentInsights.activeAssignments}
                      </p>
                      <p className="mt-2 text-xs text-emerald-700/80">
                        {assignmentInsights.draftCount} draft{assignmentInsights.draftCount === 1 ? "" : "s"} ready for later.
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-blue-700">
                        <span>Submission rate</span>
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-blue-900">
                        {assignmentInsights.submissionRate}%
                      </p>
                      <Progress value={assignmentInsights.submissionRate} className="mt-3 h-2 bg-blue-100" />
                      <p className="mt-2 text-xs text-blue-700/80">
                        {assignmentInsights.totalCapacity > 0
                          ? `${assignmentInsights.submissionCount} submissions from ${assignmentInsights.totalCapacity} expected.`
                          : assignmentInsights.submissionCount > 0
                            ? `${assignmentInsights.submissionCount} submissions received so far.`
                            : "Tracking submissions as they arrive."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-amber-700">
                        <span>Pending grading</span>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-amber-900">
                        {assignmentInsights.pendingGrading}
                      </p>
                      <p className="mt-2 text-xs text-amber-700/80">
                        Awaiting marks or feedback across all submissions.
                      </p>
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-purple-700">
                        <span>Average score</span>
                        <Trophy className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-purple-900">
                        {assignmentInsights.averageScore !== null ? assignmentInsights.averageScore : "--"}
                      </p>
                      <p className="mt-2 text-xs text-purple-700/80">
                        Calculated from graded submissions so far.
                      </p>
                    </div>
                  </div>

                  {assignments.map((assignment) => {
                    const submittedCount = assignment.submissions.filter((submission) =>
                      ["submitted", "graded"].includes(submission.status),
                    ).length
                    const gradedCount = assignment.submissions.filter((submission) => submission.status === "graded").length
                    const totalAssigned = assignment.assignedStudentIds.length || assignment.submissions.length
                    const progress = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0
                    const statusMeta = ASSIGNMENT_STATUS_META[assignment.status] ?? ASSIGNMENT_STATUS_META.draft

                    return (
                      <div
                        key={assignment.id}
                        className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${statusMeta.glow}`}
                      >
                        <div
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${statusMeta.accent} via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                        />
                        <div className="relative z-10 flex flex-col gap-6">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge className={`${statusMeta.badgeClass} px-2 py-1 font-medium uppercase tracking-wide`}>
                                  {statusMeta.label}
                                </Badge>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                  <BookOpen className="h-3.5 w-3.5" /> {assignment.subject}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                                  <Users className="h-3.5 w-3.5" /> {assignment.className}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 md:text-xl">
                                  <Sparkles className="h-5 w-5 text-emerald-500" />
                                  <span>{assignment.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 md:max-w-2xl">
                                  {assignment.description || "No description provided."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                  <CalendarClock className="h-4 w-4 text-amber-500" />
                                  Due {formatExamDate(assignment.dueDate)}
                                </span>
                                <span className="text-slate-500">{describeDueDate(assignment.dueDate)}</span>
                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                  <Trophy className="h-3.5 w-3.5 text-purple-500" />
                                  {assignment.maximumScore ?? assignmentMaximum} marks
                                </span>
                                {assignment.updatedAt ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    Updated {formatExamDate(assignment.updatedAt)}
                                  </span>
                                ) : null}
                              </div>
                              {assignment.resourceName ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                                  onClick={() => handleDownloadAssignmentAttachment(assignment)}
                                >
                                  <Download className="h-3.5 w-3.5" /> {assignment.resourceName}
                                </button>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-start gap-3 rounded-xl bg-slate-50/70 p-4 text-sm md:items-end">
                              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                  {submittedCount}/{totalAssigned || "--"} submitted
                                </Badge>
                                {gradedCount > 0 ? (
                                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                                    {gradedCount} graded
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500">Progress: {progress}%</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                              onClick={() => {
                                void handleViewSubmissions(assignment)
                              }}
                            >
                              <Users className="mr-1 h-4 w-4" /> View submissions
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 text-slate-700 transition hover:bg-slate-100"
                                  onClick={() => handlePreviewAssignment(assignment)}
                                >
                                  <Eye className="mr-1 h-4 w-4" /> Preview
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview what students will see</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 text-slate-700 transition hover:bg-slate-100"
                                  onClick={() => handleEditAssignment(assignment)}
                                >
                                  <Pencil className="mr-1 h-4 w-4" /> Edit
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit details or attachment</TooltipContent>
                            </Tooltip>
                            {assignment.status === "draft" ? (
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white transition hover:bg-emerald-700"
                                onClick={() => handleSendAssignment(assignment)}
                                disabled={assignmentActionId === assignment.id}
                              >
                                {assignmentActionId === assignment.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-4 w-4" />
                                )}
                                {assignmentActionId === assignment.id ? "Sending..." : "Send to students"}
                              </Button>
                            ) : null}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 transition hover:bg-red-50"
                                  onClick={() => handleDeleteAssignment(assignment)}
                                  disabled={deletingAssignmentId === assignment.id}
                                >
                                  {deletingAssignmentId === assignment.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-1 h-4 w-4" />
                                  )}
                                  {deletingAssignmentId === assignment.id ? "Removing" : "Delete"}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove this assignment</TooltipContent>
                            </Tooltip>
                          </div>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading timetable...
                </div>
              ) : (
                <TimetableWeeklyView
                  slots={teacherTimetable}
                  emptyMessage={`No timetable entries available for ${selectedClass}.`}
                  renderDetails={(slot) => {
                    const details: string[] = []
                    const facilitator = slot.teacher?.trim()
                    if (facilitator && facilitator.length > 0 && facilitator !== teacher.name) {
                      details.push(`Facilitator: ${facilitator}`)
                    }
                    if (slot.location && slot.location.trim().length > 0) {
                      details.push(`Location: ${slot.location}`)
                    }
                    if (details.length === 0) {
                      details.push("Get ready for this session.")
                    }
                    return <p className="text-sm text-emerald-700/80">{details.join(" • ")}</p>
                  }}
                />
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
                availableClasses={teacherClassNames}
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
        open={isAddStudentDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAddStudentDialogOpen(true)
          } else {
            handleCloseAddStudentDialog()
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add students to the grade sheet</DialogTitle>
            <DialogDescription>
              Select a learner from the class roster so their results appear on the report card and can be
              updated.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
            <p className="text-sm font-semibold text-emerald-800">Current selection</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Class
                </span>
                <span className="text-sm font-medium text-emerald-900">
                  {selectedClass || "Not selected"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Subject
                </span>
                <span className="text-sm font-medium text-emerald-900">
                  {selectedSubject || "Not selected"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Term
                </span>
                <span className="text-sm font-medium text-emerald-900">
                  {mapTermKeyToLabel(selectedTerm) || "Not selected"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Session
                </span>
                <span className="text-sm font-medium text-emerald-900">
                  {selectedSession || "Not selected"}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {rosterNotice && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{rosterNotice}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Class roster
              </Label>
              {isRosterLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-200 p-3 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2d682d]" /> Loading class roster…
                </div>
              ) : rosterCandidates.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 p-3 text-sm text-gray-600">
                  No students available for this class.
                </div>
              ) : (
                <ScrollArea className="h-56 rounded-md border border-gray-200">
                  <RadioGroup
                    value={selectedRosterId ?? ""}
                    onValueChange={(value) => setSelectedRosterId(value)}
                    className="divide-y divide-gray-100"
                  >
                    {rosterCandidates.map((candidate) => {
                      const displayName = candidate.name ?? `Student ${candidate.id}`
                      const inputId = `roster-${candidate.id}`
                      return (
                        <label
                          key={candidate.id}
                          className="flex cursor-pointer items-start gap-3 p-3 hover:bg-emerald-50/50"
                          htmlFor={inputId}
                        >
                          <RadioGroupItem value={candidate.id} id={inputId} />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">{displayName}</p>
                            <p className="text-xs text-gray-500">
                              {candidate.id}
                              {candidate.className ? ` • ${candidate.className}` : ""}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </RadioGroup>
                </ScrollArea>
              )}
              <p className="text-[11px] text-gray-500">Selected: {selectedRosterId ? 1 : 0}</p>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleCloseAddStudentDialog}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
              onClick={handleConfirmAddStudents}
            >
              <Save className="mr-2 h-4 w-4" />
              Add to Grade Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportCardPreviewOverlay
        isOpen={previewDialogOpen}
        onClose={closePreviewDialog}
        title="Report Card Preview"
        description={
          previewStudentId
            ? `${marksData.find((s) => s.studentId === previewStudentId)?.studentName ?? "Student"} • ${selectedClass} • ${mapTermKeyToLabel(selectedTerm)} (${selectedSession})`
            : "Select a student to preview their report card."
        }
        actions={
          previewData ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              onClick={handlePreviewDownload}
              disabled={isPreviewDownloading}
            >
              {isPreviewDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isPreviewDownloading ? "Preparing…" : "Download"}
            </Button>
          ) : null
        }
      >
        {previewData ? (
          <EnhancedReportCard data={previewData} />
        ) : (
          <p className="text-sm text-muted-foreground">No preview data available yet.</p>
        )}
      </ReportCardPreviewOverlay>

      {/* Create Assignment Dialog */}
      <Dialog
        open={showCreateAssignment}
        onOpenChange={(open) => {
          setShowCreateAssignment(open)
          if (!open) {
            resetAssignmentForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleAssignmentSubmit} className="space-y-5">
            <DialogHeader className="space-y-1">
              <DialogTitle>{assignmentDialogTitle}</DialogTitle>
              <DialogDescription>{assignmentDialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Tailor engaging assignments
                </p>
                <p className="mt-1 text-emerald-700/80">
                  Add clear instructions, set a due date, and attach helpful resources to guide your learners.
                </p>
              </div>
              <div className="space-y-3">
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
                    placeholder="Share instructions, expectations, and submission tips"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      value={assignmentForm.classId || ""}
                      onValueChange={(value) =>
                        setAssignmentForm((prev) => {
                          const match = teacher.classes.find((cls) => cls.id === value)
                          return {
                            ...prev,
                            classId: value,
                            className: match?.name ?? prev.className,
                          }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={assignmentForm.className || "Select class"} />
                      </SelectTrigger>
                      <SelectContent>
                        {teacher.classes.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="maximumScore">Maximum Score</Label>
                    <div className="relative mt-1">
                      <Input
                        id="maximumScore"
                        type="number"
                        min={1}
                        max={100}
                        value={assignmentForm.maximumScore}
                        onChange={(e) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            maximumScore: e.target.value,
                          }))
                        }
                        placeholder={`e.g. ${assignmentMaximum}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                        marks
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set how many marks this assignment contributes for your students.
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="file">Attachment (Optional)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                  />
                  {isEditingAssignment && assignmentForm.resourceName && !assignmentForm.file ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current attachment: <span className="font-medium text-slate-700">{assignmentForm.resourceName}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Tip: Assignment scores contribute up to {resolvedAssignmentMaximum} marks to continuous assessment this term.
              </p>
            </div>
            <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreateAssignment(false)
                  resetAssignmentForm()
                }}
              >
                Cancel
              </Button>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="submit"
                  name="action"
                  value="draft"
                  data-intent="draft"
                  variant="outline"
                  disabled={isSavingAssignment}
                  className="border-slate-300"
                >
                  {isSavingAssignment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSavingAssignment ? "Saving..." : isEditingAssignment ? "Save Draft" : "Save as Draft"}
                </Button>
                <Button
                  type="submit"
                  name="action"
                  value="sent"
                  data-intent="sent"
                  disabled={isSavingAssignment}
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                >
                  {isSavingAssignment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isSavingAssignment ? "Sending..." : isEditingAssignment ? "Update & Send" : "Send Assignment"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment Preview Dialog */}
      <Dialog
        open={Boolean(previewAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAssignment(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAssignment?.title ?? "Assignment Preview"}</DialogTitle>
            <DialogDescription>
              {previewAssignment
                ? `${previewAssignment.subject} • ${previewAssignment.className} • Worth ${
                    previewAssignment.maximumScore ?? assignmentMaximum
                  } marks • Due ${formatExamDate(previewAssignment.dueDate)}`
                : "Select an assignment to preview the student experience."}
            </DialogDescription>
          </DialogHeader>
          {previewAssignment ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${ASSIGNMENT_STATUS_META[previewAssignment.status].badgeClass} uppercase`}>
                  {ASSIGNMENT_STATUS_META[previewAssignment.status].label}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  {
                    previewAssignment.submissions.filter((submission) =>
                      ["submitted", "graded"].includes(submission.status),
                    ).length
                  }
                  {" "}submissions
                </Badge>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                <h4 className="font-semibold text-slate-800">Instructions</h4>
                <p className="mt-2 whitespace-pre-line">
                  {previewAssignment.description || "No description provided yet."}
                </p>
              </div>
              {previewAssignment.resourceName ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-4 text-sm text-emerald-700">
                  <p className="font-medium">Attached Resource</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadAssignmentAttachment(previewAssignment)}
                    className="mt-2 inline-flex items-center gap-2 text-emerald-700 transition hover:text-emerald-900"
                  >
                    <Download className="h-4 w-4" />
                    {previewAssignment.resourceName}
                  </button>
                </div>
              ) : null}
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Created: {previewAssignment.createdAt ? formatExamDate(previewAssignment.createdAt) : "—"}</div>
                <div>Last updated: {previewAssignment.updatedAt ? formatExamDate(previewAssignment.updatedAt) : "—"}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setPreviewAssignment(null)}>
              Close
            </Button>
            {previewAssignment ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleEditAssignment(previewAssignment)
                    setPreviewAssignment(null)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (previewAssignment) {
                      void handleViewSubmissions(previewAssignment)
                    }
                  }}
                >
                  <Users className="mr-2 h-4 w-4" /> View submissions
                </Button>
                {previewAssignment.status === "draft" ? (
                  <Button
                    className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
                    onClick={() => {
                      handleSendAssignment(previewAssignment)
                      setPreviewAssignment(null)
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" /> Send to students
                  </Button>
                ) : null}
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submissions Dialog */}
      <Dialog
        open={showSubmissions}
        onOpenChange={(open) => {
          setShowSubmissions(open)
          if (!open) {
            setSelectedAssignment(null)
            setGradingDrafts({})
            setIsLoadingSubmissions(false)
            setAssignmentRoster({})
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assignment Submissions - {selectedAssignment?.title}</DialogTitle>
            <DialogDescription>
              {selectedAssignment
                ? `${selectedAssignment.subject} • ${selectedAssignment.className} • Due ${formatExamDate(selectedAssignment.dueDate)}`
                : "Review the submissions you have received."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-500" /> Due {formatExamDate(selectedAssignment.dueDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-emerald-500" /> Assigned to {selectedAssignment.className ?? "assigned students"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-purple-500" />
                    {selectedAssignment.maximumScore ?? assignmentMaximum} marks
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  {selectedAssignment.description?.length
                    ? selectedAssignment.description
                    : "No additional description was provided for this assignment."}
                </p>
                {selectedAssignment.resourceName ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadAssignmentAttachment(selectedAssignment)}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                  >
                    <Download className="h-3.5 w-3.5" /> Download assignment attachment ({selectedAssignment.resourceName})
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No assignment attachment to download.</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {receivedSubmissionRecords.length} submitted
                  </Badge>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {pendingSubmissionRecords.length} not submitted
                  </Badge>
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                    {gradedSubmissionCount} graded
                  </Badge>
                </div>
              </div>
            ) : null}
            {isLoadingSubmissions ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading submissions...
              </div>
            ) : receivedSubmissionRecords.length > 0 ? (
              receivedSubmissionRecords.map(({ student, submission }) => {
                const assignmentMaxScore = selectedAssignment?.maximumScore ?? assignmentMaximum
                const draft = gradingDrafts[submission.id] ?? { score: "", comment: "" }
                const submissionStatusMeta =
                  submission.status === "graded"
                    ? ASSIGNMENT_STATUS_META.graded
                    : ASSIGNMENT_STATUS_META.submitted

                return (
                  <div
                    key={submission.id}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div>
                          <h3 className="font-medium text-slate-800">
                            {student.name ?? `Student ${submission.studentId}`}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {submission.studentId}
                            {student.className ? ` • ${student.className}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            Submitted {submission.submittedAt ? formatExamDate(submission.submittedAt) : "—"}
                          </p>
                        </div>
                        {submission.files && submission.files.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                            <span className="font-medium text-emerald-800">Attachments:</span>
                            {submission.files.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => handleDownloadSubmissionFile(submission, file)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <Download className="h-3.5 w-3.5" /> {file.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No attachments were included in this submission.</p>
                        )}
                      </div>
                      <Badge className={`${submissionStatusMeta.badgeClass} uppercase`}>
                        {submission.status}
                      </Badge>
                    </div>
                    <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-slate-500">Score</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={assignmentMaxScore}
                            value={draft.score}
                            onChange={(e) =>
                              setGradingDrafts((prev) => ({
                                ...prev,
                                [submission.id]: {
                                  score: e.target.value,
                                  comment: prev[submission.id]?.comment ?? "",
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">/ {assignmentMaxScore}</span>
                        </div>
                        {submission.grade || submission.score !== null ? (
                          <p className="text-xs text-slate-500">
                            Last score: {submission.score ?? "--"}/{assignmentMaxScore}
                            {submission.grade ? ` (${submission.grade})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-slate-500">Feedback</Label>
                        <Textarea
                          value={draft.comment}
                          onChange={(e) =>
                            setGradingDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                score: prev[submission.id]?.score ?? "",
                                comment: e.target.value,
                              },
                            }))
                          }
                          rows={3}
                          placeholder="Share personalised feedback"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {submission.comment
                          ? `Student note: ${submission.comment}`
                          : "No student comment provided."}
                      </p>
                      <Button
                        size="sm"
                        className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
                        onClick={() => handleGradeSubmission(submission)}
                        disabled={gradingSubmissionId === submission.id}
                      >
                        {gradingSubmissionId === submission.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        {gradingSubmissionId === submission.id
                          ? "Saving..."
                          : submission.status === "graded"
                            ? "Update Score"
                            : "Save Score"}
                      </Button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No submissions have been received for this assignment yet.
              </div>
            )}
            {pendingSubmissionRecords.length > 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-4">
                <h4 className="text-sm font-semibold text-amber-700">
                  Awaiting submissions ({pendingSubmissionRecords.length})
                </h4>
                <ul className="mt-3 space-y-2">
                  {pendingSubmissionRecords.map(({ student }) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-amber-800"
                    >
                      <div>
                        <p className="font-medium text-amber-900">
                          {student.name ?? `Student ${student.id}`}
                        </p>
                        <p className="text-xs text-amber-700/80">
                          {student.id}
                          {student.className ? ` • ${student.className}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                        Not submitted
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubmissions(false)
                setSelectedAssignment(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
