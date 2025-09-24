"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import { StudyMaterials } from "@/components/study-materials"
import { Noticeboard } from "@/components/noticeboard"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { TimetableWeeklyView, type TimetableWeeklyViewSlot } from "@/components/timetable-weekly-view"
import { dbManager } from "@/lib/database-manager"
import { logger } from "@/lib/logger"
import { normalizeTimetableCollection } from "@/lib/timetable"
import { CONTINUOUS_ASSESSMENT_MAXIMUMS } from "@/lib/grade-utils"

type TimetableSlotSummary = TimetableWeeklyViewSlot

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
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<IdentifiedRecord | null>(null)
  const [submissionForm, setSubmissionForm] = useState({
    file: null as File | null,
    comment: "",
  })

  const [subjects, setSubjects] = useState<IdentifiedRecord[]>([])
  const [timetable, setTimetable] = useState<TimetableSlotSummary[]>([])
  const [assignments, setAssignments] = useState<IdentifiedRecord[]>([])
  const [libraryBooks, setLibraryBooks] = useState<IdentifiedRecord[]>([])
  const [attendance, setAttendance] = useState({ present: 0, total: 0, percentage: 0 })
  const [upcomingEvents, setUpcomingEvents] = useState<IdentifiedRecord[]>([])
  const [studentProfile, setStudentProfile] = useState(student)
  const [loading, setLoading] = useState(true)

  const assignmentMaximum = CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment ?? 20

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        setLoading(true)

        // Load subjects and grades
        const gradesResponse = await fetch(`/api/grades?studentId=${student.id}`)
        if (gradesResponse.ok) {
          const gradesData: unknown = await gradesResponse.json()
          const grades = isRecord(gradesData) ? gradesData.grades : undefined
          setSubjects(normalizeIdentifiedCollection(grades, "grade"))
        } else {
          setSubjects([])
        }

        // Load assignments
        const assignmentsData = await dbManager.getAssignments({ studentId: student.id })
        setAssignments(normalizeIdentifiedCollection(assignmentsData, "assignment"))

        // Load timetable
        const timetableResponse = await fetch(`/api/timetable?className=${encodeURIComponent(student.class)}`)
        if (timetableResponse.ok) {
          const timetableJson: unknown = await timetableResponse.json()
          const normalized = normalizeTimetableCollection(
            (timetableJson as Record<string, unknown>)?.timetable,
          ).map(({ id, day, time, subject, teacher, location }) => ({
            id,
            day,
            time,
            subject,
            teacher,
            location,
          }))
          setTimetable(normalized)
        } else {
          setTimetable([])
        }

        // Load library books
        const libraryData = await dbManager.getLibraryBooks(student.id)
        setLibraryBooks(normalizeIdentifiedCollection(libraryData, "book"))

        const attendanceData = await dbManager.getStudentAttendance(student.id)
        setAttendance(attendanceData)

        const eventsData = await dbManager.getUpcomingEvents(student.class)
        setUpcomingEvents(normalizeIdentifiedCollection(eventsData, "event"))

        const profileData = await dbManager.getStudentProfile(student.id)
        if (profileData) {
          setStudentProfile(profileData)
        }
      } catch (error) {
        logger.error("Failed to load student data", { error })
      } finally {
        setLoading(false)
      }
    }

    loadStudentData()

    const handleGradesUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "grade")
      if (!record || record.studentId !== student.id) {
        return
      }

      setSubjects((prev) => prev.map((subject) => (subject.id === record.id ? { ...subject, ...record } : subject)))
    }

    const handleAssignmentsUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "assignment")
      if (!record || record.studentId !== student.id) {
        return
      }

      setAssignments((prev) => prev.map((assignment) => (assignment.id === record.id ? { ...assignment, ...record } : assignment)))
    }

    const handleAttendanceUpdate = (payload: unknown) => {
      if (isRecord(payload) && payload.studentId === student.id) {
        setAttendance((prev) => ({
          present: Number(payload.present ?? prev.present),
          total: Number(payload.total ?? prev.total),
          percentage: Number(payload.percentage ?? prev.percentage),
        }))
      }
    }

    const handleEventsUpdate = (payload: unknown) => {
      if (isRecord(payload) && payload.class === student.class) {
        setUpcomingEvents(normalizeIdentifiedCollection(payload.events, "event"))
      }
    }

    const handleProfileUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "profile")
      if (record && record.id === student.id) {
        setStudentProfile((prev) => ({
          ...prev,
          ...record,
          id: prev.id,
        }))
      }
    }

    dbManager.addEventListener("gradesUpdate", handleGradesUpdate)
    dbManager.addEventListener("assignmentsUpdate", handleAssignmentsUpdate)
    dbManager.addEventListener("attendanceUpdate", handleAttendanceUpdate)
    dbManager.addEventListener("eventsUpdate", handleEventsUpdate)
    dbManager.addEventListener("profileUpdate", handleProfileUpdate)

    return () => {
      dbManager.removeEventListener("gradesUpdate", handleGradesUpdate)
      dbManager.removeEventListener("assignmentsUpdate", handleAssignmentsUpdate)
      dbManager.removeEventListener("attendanceUpdate", handleAttendanceUpdate)
      dbManager.removeEventListener("eventsUpdate", handleEventsUpdate)
      dbManager.removeEventListener("profileUpdate", handleProfileUpdate)
    }
  }, [student.id])

  const handleRenewBook = async (bookId: string) => {
    try {
      await dbManager.renewLibraryBook(bookId, student.id)
      const updatedBooks = await dbManager.getLibraryBooks(student.id)
      setLibraryBooks(updatedBooks)
    } catch (error) {
      logger.error("Failed to renew book", { error })
    }
  }

  const handleDownloadAssignmentResource = (assignment: IdentifiedRecord) => {
    const resourceUrl = typeof assignment.resourceUrl === "string" ? assignment.resourceUrl : ""
    if (!resourceUrl) {
      return
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    const link = document.createElement("a")
    link.href = resourceUrl
    link.download =
      typeof assignment.resourceName === "string" && assignment.resourceName.length > 0
        ? assignment.resourceName
        : `${typeof assignment.title === "string" ? assignment.title : "assignment"}.resource`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatAssignmentDate = (value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "--"
    }

    try {
      return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value))
    } catch (error) {
      return value
    }
  }

  const describeDueDate = (value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "No due date"
    }

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
      const submissionData = {
        assignmentId: selectedAssignment.id,
        studentId: student.id,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        submittedFile: submissionForm.file?.name || null,
        submittedComment: submissionForm.comment,
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
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {studentProfile.name}</h1>
            <p className="text-green-100">Student Portal - {student.class} - VEA 2025</p>
            <p className="text-sm text-green-200">Admission No: {student.admissionNumber}</p>
          </div>
          <TutorialLink href="https://www.youtube.com/watch?v=1FJD7jZqZEk" variant="inverse" />
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>

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
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.slice(0, 3).map((event, index) => (
                      <div key={index} className="p-2 bg-yellow-50 border-l-4 border-[#b29032] rounded">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-gray-600">{event.date}</p>
                        {event.description && <p className="text-xs text-gray-500">{event.description}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No upcoming events</p>
                  )}
                </div>
              </CardContent>
            </Card>

          <ExamScheduleOverview
            role="student"
            title="Upcoming Exams"
            description="Plan ahead with the latest exam schedule for your class."
            classNames={[studentProfile.class]}
            className="h-full"
            emptyState="No upcoming exams scheduled for your class yet."
            limit={4}
          />
          <SchoolCalendarViewer role="student" className="md:col-span-2 xl:col-span-3" />
        </div>

        <div className="mt-8">
          <Noticeboard userRole="student" userName={studentProfile.name} />
        </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Subjects</CardTitle>
              <CardDescription>View your subjects and assigned teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjects.map((subject, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{subject.subject}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <User className="w-4 h-4 text-[#2d682d]" />
                        <p className="text-sm font-medium text-[#2d682d]">
                          Teacher: {subject.teacherName || "Not Assigned"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Performance</span>
                          <span className="font-medium">{subject.total || 0}%</span>
                        </div>
                        <Progress value={subject.total || 0} className="h-2" />
                      </div>
                    </div>
                    <div className="ml-4 text-center">
                      <Badge variant="outline" className="text-[#b29032] border-[#b29032] font-bold text-lg px-3 py-1">
                        {subject.grade || "N/A"}
                      </Badge>
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
                              <p className="mt-1 text-emerald-700/80">File: {assignment.submittedFile}</p>
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
                              Score: {score ?? "--"} / {assignmentMaximum}
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
              <CardDescription>Access study materials for your class ({student.class})</CardDescription>
            </CardHeader>
            <CardContent>
              <StudyMaterials userRole="student" studentClass={student.class} />
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
                Once submitted, the status will change to "Submitted" and your teacher will be notified.
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
