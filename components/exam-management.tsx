"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { dbManager } from "@/lib/database-manager"
import { BarChart3, Calendar, CheckCircle2, Clock, Edit, FileText, Loader2, Plus, Trash2 } from "lucide-react"

interface ExamSchedule {
  id: string
  subject: string
  classId: string
  className: string
  term: string
  session: string
  examDate: string
  startTime: string
  endTime: string
  durationMinutes: number
  venue?: string | null
  invigilator?: string | null
  notes?: string | null
  status: "scheduled" | "completed" | "cancelled"
  createdBy?: string | null
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

interface ExamResult {
  id: string
  examId: string
  studentId: string
  studentName: string
  classId: string
  className: string
  subject: string
  term: string
  session: string
  ca1: number
  ca2: number
  assignment: number
  exam: number
  total: number
  grade: string
  position?: number | null
  totalStudents?: number | null
  remarks?: string | null
  status: "pending" | "published" | "withheld"
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

interface ResultFormEntry {
  id: string
  studentId: string
  studentName: string
  ca1: string
  ca2: string
  assignment: string
  exam: string
  position: string
  remarks: string
}

const SUBJECT_OPTIONS = [
  "Mathematics",
  "English Language",
  "Physics",
  "Chemistry",
  "Biology",
  "Basic Science",
  "Computer Studies",
  "Geography",
  "Economics",
  "Civic Education",
]

const TERM_OPTIONS = ["First Term", "Second Term", "Third Term"]

const createEntryId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `entry_${Math.random().toString(36).slice(2, 10)}`)

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

const formatDuration = (minutes?: number) => {
  if (!minutes || Number.isNaN(minutes)) {
    return "--"
  }
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours === 0) {
    return `${remaining} mins`
  }
  if (remaining === 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`
  }
  return `${hours} hr${hours > 1 ? "s" : ""} ${remaining} mins`
}

const calculateTotal = (entry: ResultFormEntry) => {
  const ca1 = Number(entry.ca1) || 0
  const ca2 = Number(entry.ca2) || 0
  const assignment = Number(entry.assignment) || 0
  const exam = Number(entry.exam) || 0
  return ca1 + ca2 + assignment + exam
}

const gradeFromTotal = (total: number) => {
  if (total >= 85) return "A+"
  if (total >= 75) return "A"
  if (total >= 65) return "B"
  if (total >= 55) return "C"
  if (total >= 45) return "D"
  if (total >= 40) return "E"
  return "F"
}

const statusBadgeVariant = (status: ExamSchedule["status"]) => {
  switch (status) {
    case "completed":
      return "success" as const
    case "cancelled":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

const resultStatusBadgeVariant = (status: ExamResult["status"]) => {
  switch (status) {
    case "published":
      return "success" as const
    case "withheld":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

export default function ExamManagement() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("upcoming")
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([])
  const [scheduleForm, setScheduleForm] = useState({
    subject: SUBJECT_OPTIONS[0],
    classId: "",
    examDate: "",
    startTime: "09:00",
    endTime: "11:00",
    venue: "",
    invigilator: "",
    notes: "",
    term: TERM_OPTIONS[0],
    session: "",
  })
  const [scheduleDialogState, setScheduleDialogState] = useState<{
    mode: "create" | "edit"
    exam?: ExamSchedule
  } | null>(null)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  const [examSchedules, setExamSchedules] = useState<ExamSchedule[]>([])
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(true)

  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [isResultsLoading, setIsResultsLoading] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const [resultEntries, setResultEntries] = useState<ResultFormEntry[]>([])
  const [publishImmediately, setPublishImmediately] = useState(true)
  const [classSize, setClassSize] = useState("")
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; name: string }>>([])
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false)
  const [isPreparingResults, setIsPreparingResults] = useState(false)

  const loadMetaData = useCallback(async () => {
    try {
      const [classes, settings] = await Promise.all([dbManager.getClasses(), dbManager.getSystemSettings()])
      const normalizedClasses: Array<{ value: string; label: string }> = (Array.isArray(classes) ? classes : [])
        .map((cls: any) => {
          if (typeof cls === "string") {
            return { value: cls, label: cls }
          }
          return {
            value: String(cls.id ?? cls.name ?? ""),
            label: String(cls.name ?? cls.id ?? "Unknown Class"),
          }
        })
        .filter((option) => option.value)

      if (normalizedClasses.length > 0) {
        setClassOptions(normalizedClasses)
        setScheduleForm((prev) => ({
          ...prev,
          classId: prev.classId || normalizedClasses[0].value,
        }))
      } else {
        setClassOptions([])
      }

      if (settings) {
        setScheduleForm((prev) => ({
          ...prev,
          term: settings.currentTerm ?? prev.term,
          session: settings.academicYear ?? prev.session,
        }))
      }
    } catch (error) {
      console.error("Failed to load class metadata", error)
    }
  }, [])

  const loadSchedules = useCallback(async () => {
    try {
      setIsSchedulesLoading(true)
      const schedules = await dbManager.getExamSchedules()
      setExamSchedules(schedules)
      if (schedules.length > 0) {
        setSelectedExamId((current) => {
          if (current && schedules.some((exam) => exam.id === current)) {
            return current
          }
          const preferred = schedules.find((exam) => exam.status === "completed") ?? schedules[0]
          return preferred.id
        })
      } else {
        setSelectedExamId("")
      }
    } catch (error) {
      console.error("Unable to load exam schedules", error)
      toast({
        title: "Unable to load exam schedules",
        description: "Please try reloading the page.",
        variant: "destructive",
      })
    } finally {
      setIsSchedulesLoading(false)
    }
  }, [toast])

  const loadExamResults = useCallback(
    async (examId: string) => {
      if (!examId) {
        setExamResults([])
        return
      }
      try {
        setIsResultsLoading(true)
        const results = await dbManager.getExamResults(examId)
        setExamResults(results)
      } catch (error) {
        console.error("Failed to load exam results", error)
        toast({
          title: "Unable to load exam results",
          description: "Please try again shortly.",
          variant: "destructive",
        })
      } finally {
        setIsResultsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadMetaData()
    loadSchedules()

    const handleExamUpdate = () => {
      loadSchedules()
    }

    const handleResultsUpdate = (payload: { examId?: string }) => {
      if (payload?.examId && payload.examId !== selectedExamId) {
        return
      }
      loadSchedules()
      if (selectedExamId) {
        loadExamResults(selectedExamId)
      }
    }

    dbManager.on("examScheduleUpdated", handleExamUpdate)
    dbManager.on("examResultsUpdated", handleResultsUpdate)

    return () => {
      dbManager.off("examScheduleUpdated", handleExamUpdate)
      dbManager.off("examResultsUpdated", handleResultsUpdate)
    }
  }, [loadMetaData, loadSchedules, loadExamResults, selectedExamId])

  useEffect(() => {
    if (selectedExamId) {
      loadExamResults(selectedExamId)
    } else {
      setExamResults([])
    }
  }, [selectedExamId, loadExamResults])

  useEffect(() => {
    if (scheduleDialogState?.mode === "edit" && scheduleDialogState.exam) {
      const exam = scheduleDialogState.exam
      setScheduleForm({
        subject: exam.subject,
        classId: exam.classId,
        examDate: exam.examDate,
        startTime: exam.startTime,
        endTime: exam.endTime,
        venue: exam.venue ?? "",
        invigilator: exam.invigilator ?? "",
        notes: exam.notes ?? "",
        term: exam.term,
        session: exam.session,
      })

      if (!classOptions.some((option) => option.value === exam.classId)) {
        setClassOptions((options) => [...options, { value: exam.classId, label: exam.className }])
      }
    } else {
      setScheduleForm((prev) => ({
        ...prev,
        subject: prev.subject || SUBJECT_OPTIONS[0],
        classId: classOptions[0]?.value ?? prev.classId,
      }))
    }
  }, [scheduleDialogState, classOptions])

  const upcomingExams = useMemo(
    () => examSchedules.filter((exam) => exam.status === "scheduled"),
    [examSchedules],
  )

  const completedExams = useMemo(
    () => examSchedules.filter((exam) => exam.status === "completed"),
    [examSchedules],
  )

  const selectedExam = useMemo(
    () => examSchedules.find((exam) => exam.id === selectedExamId) ?? null,
    [examSchedules, selectedExamId],
  )

  const examResultsSummary = useMemo(() => {
    if (!examResults || examResults.length === 0) {
      return null
    }

    const totals = examResults.map((result) => result.total)
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length
    const highest = Math.max(...totals)
    const lowest = Math.min(...totals)
    const publishedCount = examResults.filter((result) => result.status === "published").length

    return {
      average: Math.round(average),
      highest,
      lowest,
      publishedCount,
    }
  }, [examResults])

  const allResultsPublished = useMemo(
    () => examResults.length > 0 && examResults.every((result) => result.status === "published"),
    [examResults],
  )

  const resetScheduleForm = () => {
    setScheduleForm({
      subject: SUBJECT_OPTIONS[0],
      classId: classOptions[0]?.value ?? "",
      examDate: "",
      startTime: "09:00",
      endTime: "11:00",
      venue: "",
      invigilator: "",
      notes: "",
      term: TERM_OPTIONS[0],
      session: scheduleForm.session,
    })
  }

  const handleScheduleSubmit = async () => {
    if (!scheduleForm.subject || !scheduleForm.classId || !scheduleForm.examDate) {
      toast({
        title: "Missing information",
        description: "Subject, class and exam date are required.",
        variant: "destructive",
      })
      return
    }

    setIsSavingSchedule(true)
    try {
      if (scheduleDialogState?.mode === "edit" && scheduleDialogState.exam) {
        await dbManager.updateExamSchedule(scheduleDialogState.exam.id, {
          subject: scheduleForm.subject,
          classId: scheduleForm.classId,
          className:
            classOptions.find((option) => option.value === scheduleForm.classId)?.label ||
            scheduleDialogState.exam.className,
          examDate: scheduleForm.examDate,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          venue: scheduleForm.venue || null,
          invigilator: scheduleForm.invigilator || null,
          notes: scheduleForm.notes || null,
          term: scheduleForm.term,
          session: scheduleForm.session,
        })
        toast({ title: "Exam schedule updated" })
      } else {
        await dbManager.createExamSchedule({
          subject: scheduleForm.subject,
          classId: scheduleForm.classId,
          className: classOptions.find((option) => option.value === scheduleForm.classId)?.label,
          examDate: scheduleForm.examDate,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          venue: scheduleForm.venue || null,
          invigilator: scheduleForm.invigilator || null,
          notes: scheduleForm.notes || null,
          term: scheduleForm.term,
          session: scheduleForm.session || new Date().getFullYear().toString(),
        })
        toast({ title: "Exam scheduled successfully" })
      }

      setScheduleDialogState(null)
      resetScheduleForm()
    } catch (error) {
      console.error("Failed to save exam schedule", error)
      toast({
        title: "Unable to save exam schedule",
        description: "Please review the details and try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const handleDeleteExam = async (exam: ExamSchedule) => {
    const confirmation = window.confirm(
      `Delete ${exam.subject} for ${exam.className} scheduled on ${formatDate(exam.examDate)}?`,
    )

    if (!confirmation) {
      return
    }

    try {
      await dbManager.deleteExamSchedule(exam.id)
      toast({ title: "Exam schedule removed" })
      if (selectedExamId === exam.id) {
        setSelectedExamId("")
      }
    } catch (error) {
      console.error("Unable to delete exam schedule", error)
      toast({
        title: "Failed to delete exam",
        description: "Please try again later.",
        variant: "destructive",
      })
    }
  }

  const prepareResultEntries = async (exam: ExamSchedule | null, existingResults: ExamResult[]) => {
    setIsPreparingResults(true)
    try {
      if (exam) {
        const students = await dbManager.getStudentsByClass(exam.className)
        setAvailableStudents(
          students.map((student: any) => ({
            id: String(student.id ?? student.studentId ?? ""),
            name: String(student.name ?? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()),
          })),
        )
      } else {
        setAvailableStudents([])
      }

      if (existingResults.length > 0) {
        setResultEntries(
          existingResults.map((result) => ({
            id: createEntryId(),
            studentId: result.studentId,
            studentName: result.studentName,
            ca1: String(result.ca1),
            ca2: String(result.ca2),
            assignment: String(result.assignment),
            exam: String(result.exam),
            position: result.position != null ? String(result.position) : "",
            remarks: result.remarks ?? "",
          })),
        )
        setClassSize(existingResults[0]?.totalStudents ? String(existingResults[0].totalStudents) : "")
        setPublishImmediately(existingResults.every((result) => result.status === "published"))
      } else {
        setResultEntries([
          {
            id: createEntryId(),
            studentId: "",
            studentName: "",
            ca1: "",
            ca2: "",
            assignment: "",
            exam: "",
            position: "",
            remarks: "",
          },
        ])
        setClassSize("")
        setPublishImmediately(true)
      }
    } catch (error) {
      console.error("Failed to prepare result entries", error)
      toast({
        title: "Unable to prepare result entry form",
        description: "Please try again shortly.",
        variant: "destructive",
      })
    } finally {
      setIsPreparingResults(false)
    }
  }

  const handleOpenResultsDialog = async () => {
    if (!selectedExam) {
      toast({
        title: "Select an exam",
        description: "Choose an exam from the dropdown to record results.",
        variant: "destructive",
      })
      return
    }

    await prepareResultEntries(selectedExam, examResults)
    setIsResultsDialogOpen(true)
  }

  const updateResultEntry = (entryId: string, updates: Partial<ResultFormEntry>) => {
    setResultEntries((entries) =>
      entries.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    )
  }

  const handleResultStudentSelect = (entryId: string, studentId: string) => {
    if (studentId === "__manual") {
      updateResultEntry(entryId, { studentId: "", studentName: "" })
      return
    }

    const selectedStudent = availableStudents.find((student) => student.id === studentId)
    if (selectedStudent) {
      updateResultEntry(entryId, { studentId: selectedStudent.id, studentName: selectedStudent.name })
    } else {
      updateResultEntry(entryId, { studentId, studentName: "" })
    }
  }

  const handleAddResultEntry = () => {
    setResultEntries((entries) => [
      ...entries,
      {
        id: createEntryId(),
        studentId: "",
        studentName: "",
        ca1: "",
        ca2: "",
        assignment: "",
        exam: "",
        position: "",
        remarks: "",
      },
    ])
  }

  const handleRemoveResultEntry = (entryId: string) => {
    setResultEntries((entries) => entries.filter((entry) => entry.id !== entryId))
  }

  const handleSaveResults = async () => {
    if (!selectedExamId) {
      toast({
        title: "No exam selected",
        description: "Select an exam before saving results.",
        variant: "destructive",
      })
      return
    }

    const normalizedResults = resultEntries
      .filter((entry) => entry.studentId && entry.studentName)
      .map((entry) => ({
        studentId: entry.studentId,
        studentName: entry.studentName,
        ca1: Number(entry.ca1) || 0,
        ca2: Number(entry.ca2) || 0,
        assignment: Number(entry.assignment) || 0,
        exam: Number(entry.exam) || 0,
        position: entry.position ? Number(entry.position) : undefined,
        remarks: entry.remarks.trim() ? entry.remarks.trim() : undefined,
        totalStudents: classSize ? Number(classSize) : undefined,
        status: publishImmediately ? "published" : "pending",
      }))

    if (normalizedResults.length === 0) {
      toast({
        title: "Add result entries",
        description: "Provide at least one student result before saving.",
        variant: "destructive",
      })
      return
    }

    const duplicateIds = normalizedResults.reduce((acc, result) => {
      acc[result.studentId] = (acc[result.studentId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    if (Object.values(duplicateIds).some((count) => count > 1)) {
      toast({
        title: "Duplicate students detected",
        description: "Each student should appear only once in the result list.",
        variant: "destructive",
      })
      return
    }

    try {
      await dbManager.saveExamResults(selectedExamId, normalizedResults, {
        autoPublish: publishImmediately,
      })
      toast({ title: "Exam results saved" })
      setIsResultsDialogOpen(false)
      loadExamResults(selectedExamId)
    } catch (error) {
      console.error("Failed to save exam results", error)
      toast({
        title: "Unable to save results",
        description: "Please verify the entries and try again.",
        variant: "destructive",
      })
    }
  }

  const handlePublishResults = async () => {
    if (!selectedExamId) {
      return
    }

    try {
      setIsPublishing(true)
      await dbManager.publishExamResults(selectedExamId)
      toast({ title: "Results published successfully" })
      loadExamResults(selectedExamId)
    } catch (error) {
      console.error("Failed to publish results", error)
      toast({
        title: "Unable to publish results",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const getStudentOptionDisabled = (studentId: string, entryId: string) => {
    if (!studentId) {
      return false
    }
    return resultEntries.some((entry) => entry.id !== entryId && entry.studentId === studentId)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Exam Management</h2>
          <p className="text-sm text-gray-600">
            Schedule examinations, track progress and consolidate performance in real time.
          </p>
        </div>
        <Button
          className="bg-[#b29032] hover:bg-[#9a7c2a] text-white"
          onClick={() => setScheduleDialogState({ mode: "create" })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule Exam
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming Exams</TabsTrigger>
          <TabsTrigger value="completed">Completed Exams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {isSchedulesLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading exam schedules...
            </div>
          ) : upcomingExams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                <Calendar className="w-6 h-6 mx-auto mb-3 text-[#b29032]" />
                No upcoming exams have been scheduled. Use the “Schedule Exam” button to add a new assessment.
              </CardContent>
            </Card>
          ) : (
            upcomingExams.map((exam) => (
              <Card key={exam.id}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#2d682d]">{exam.subject}</h3>
                        <Badge variant={statusBadgeVariant(exam.status)} className="uppercase">
                          {exam.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {exam.className} • {exam.term} • {exam.session}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-[#b29032]" />
                        {formatDate(exam.examDate)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-[#b29032]" />
                        {exam.startTime} - {exam.endTime}
                      </span>
                      <span>{formatDuration(exam.durationMinutes)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-600">Venue</p>
                      <p>{exam.venue || "To be confirmed"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Invigilator</p>
                      <p>{exam.invigilator || "To be assigned"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Notes</p>
                      <p>{exam.notes || "No additional instructions"}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setScheduleDialogState({ mode: "edit", exam })}>
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteExam(exam)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {isSchedulesLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading completed exams...
            </div>
          ) : completedExams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-3 text-[#2d682d]" />
                No completed exams recorded yet.
              </CardContent>
            </Card>
          ) : (
            completedExams.map((exam) => (
              <Card key={exam.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#2d682d]">{exam.subject}</h3>
                        <Badge variant={statusBadgeVariant(exam.status)} className="uppercase">
                          {exam.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {exam.className} • {exam.term} • {exam.session}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-[#b29032]" />
                        {formatDate(exam.examDate)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-[#b29032]" />
                        {exam.startTime} - {exam.endTime}
                      </span>
                      <span>{formatDuration(exam.durationMinutes)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setScheduleDialogState({ mode: "edit", exam })}>
                      <Edit className="w-4 h-4 mr-2" /> Update
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteExam(exam)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-[#2d682d]">Exam Results Consolidation</CardTitle>
              <CardDescription>Track cumulative performance and publish assessments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="exam-select" className="text-sm font-medium text-gray-700">
                    Select Exam
                  </Label>
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger id="exam-select">
                      <SelectValue placeholder="Choose an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {examSchedules.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.subject} • {exam.className} ({exam.term})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">Average Score</Label>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <BarChart3 className="w-4 h-4 text-[#2d682d]" />
                    {examResultsSummary ? `${examResultsSummary.average}%` : "--"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">Publication Status</Label>
                  <Badge variant={allResultsPublished ? "success" : "secondary"} className="uppercase">
                    {examResults.length === 0 ? "No results" : allResultsPublished ? "Published" : "Pending"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenResultsDialog}
                  disabled={!selectedExamId}
                >
                  <FileText className="w-4 h-4 mr-2" /> Record Results
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePublishResults}
                  disabled={!selectedExamId || examResults.length === 0 || allResultsPublished || isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Publish Results
                </Button>
              </div>

              {isResultsLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results...
                </div>
              ) : examResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
                  <FileText className="w-6 h-6 text-[#b29032]" />
                  No results recorded yet for this exam.
                </div>
              ) : (
                <div className="space-y-4">
                  {examResultsSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="bg-[#2d682d]/5">
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-600">Average Score</p>
                          <p className="text-2xl font-semibold text-[#2d682d]">
                            {examResultsSummary.average}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-600">Highest Score</p>
                          <p className="text-2xl font-semibold text-[#2d682d]">
                            {examResultsSummary.highest}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-600">Lowest Score</p>
                          <p className="text-2xl font-semibold text-[#b29032]">
                            {examResultsSummary.lowest}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-600">Published</p>
                          <p className="text-2xl font-semibold text-[#2d682d]">
                            {examResultsSummary.publishedCount}/{examResults.length}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead className="text-center">1st C.A.</TableHead>
                          <TableHead className="text-center">2nd C.A.</TableHead>
                          <TableHead className="text-center">Assignment</TableHead>
                          <TableHead className="text-center">Exam</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Grade</TableHead>
                          <TableHead className="text-center">Position</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examResults.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell>
                              <div className="font-medium text-[#2d682d]">{result.studentName}</div>
                              <div className="text-xs text-gray-500">{result.studentId}</div>
                            </TableCell>
                            <TableCell className="text-center">{result.ca1}</TableCell>
                            <TableCell className="text-center">{result.ca2}</TableCell>
                            <TableCell className="text-center">{result.assignment}</TableCell>
                            <TableCell className="text-center">{result.exam}</TableCell>
                            <TableCell className="text-center font-semibold">{result.total}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{result.grade}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{result.position ?? "-"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={resultStatusBadgeVariant(result.status)} className="uppercase">
                                {result.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!scheduleDialogState} onOpenChange={(open) => (!open ? setScheduleDialogState(null) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2d682d]">
              {scheduleDialogState?.mode === "edit" ? "Update Exam Schedule" : "Schedule New Exam"}
            </DialogTitle>
            <DialogDescription>
              Provide the exam details as they should appear on the timetable and results portal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Subject</Label>
              <Select
                value={scheduleForm.subject}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, subject: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Class</Label>
              <Select
                value={scheduleForm.classId}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, classId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Term</Label>
              <Select
                value={scheduleForm.term}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, term: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Session</Label>
              <Input
                value={scheduleForm.session}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, session: event.target.value }))}
                placeholder="e.g. 2024/2025"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Exam Date</Label>
              <Input
                type="date"
                value={scheduleForm.examDate}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, examDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Start Time</Label>
              <Input
                type="time"
                value={scheduleForm.startTime}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, startTime: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">End Time</Label>
              <Input
                type="time"
                value={scheduleForm.endTime}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, endTime: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Venue</Label>
              <Input
                value={scheduleForm.venue}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, venue: event.target.value }))}
                placeholder="Main Hall"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Invigilator</Label>
              <Input
                value={scheduleForm.invigilator}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, invigilator: event.target.value }))
                }
                placeholder="Mr. John Doe"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">Additional Notes</Label>
              <Textarea
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Add special instructions, materials or timing variations"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogState(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d682d] hover:bg-[#245224] text-white"
              onClick={handleScheduleSubmit}
              disabled={isSavingSchedule}
            >
              {isSavingSchedule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-[#2d682d]">Record Exam Results</DialogTitle>
            <DialogDescription>
              Capture the continuous assessment and examination scores for {selectedExam?.subject ?? "the selected exam"}.
            </DialogDescription>
          </DialogHeader>

          {isPreparingResults ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparing result sheet...
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700">Class Size</Label>
                    <Input
                      type="number"
                      min={1}
                      value={classSize}
                      onChange={(event) => setClassSize(event.target.value)}
                      placeholder="e.g. 35"
                    />
                    <p className="text-xs text-gray-500">
                      Used for position and cumulative analysis.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700">Publish Immediately</Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={publishImmediately} onCheckedChange={setPublishImmediately} />
                      <span className="text-sm text-gray-600">Make results visible to parents and students</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-gray-700">Students Loaded</Label>
                    <p className="text-lg font-semibold text-[#2d682d]">
                      {availableStudents.length > 0
                        ? `${availableStudents.length} from class list`
                        : "Manual entry"}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Student</TableHead>
                        <TableHead className="text-center">1st C.A.</TableHead>
                        <TableHead className="text-center">2nd C.A.</TableHead>
                        <TableHead className="text-center">Assignment</TableHead>
                        <TableHead className="text-center">Exam</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Position</TableHead>
                        <TableHead className="min-w-[160px]">Remarks</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultEntries.map((entry) => {
                        const total = calculateTotal(entry)
                        const grade = gradeFromTotal(total)

                        return (
                          <TableRow key={entry.id} className="align-top">
                            <TableCell>
                              <div className="space-y-2">
                                <Select
                                  value={entry.studentId || "__manual"}
                                  onValueChange={(value) => handleResultStudentSelect(entry.id, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select student" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__manual">Manual entry</SelectItem>
                                    {availableStudents.map((student) => (
                                      <SelectItem
                                        key={student.id}
                                        value={student.id}
                                        disabled={getStudentOptionDisabled(student.id, entry.id)}
                                      >
                                        {student.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={entry.studentName}
                                  onChange={(event) =>
                                    updateResultEntry(entry.id, { studentName: event.target.value })
                                  }
                                  placeholder="Student name"
                                />
                                <Input
                                  value={entry.studentId}
                                  onChange={(event) =>
                                    updateResultEntry(entry.id, { studentId: event.target.value })
                                  }
                                  placeholder="Student ID"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={20}
                                value={entry.ca1}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { ca1: event.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={20}
                                value={entry.ca2}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { ca2: event.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                value={entry.assignment}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { assignment: event.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={60}
                                value={entry.exam}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { exam: event.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center font-semibold text-[#2d682d]">
                              {total}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{grade}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={1}
                                value={entry.position}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { position: event.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={entry.remarks}
                                onChange={(event) =>
                                  updateResultEntry(entry.id, { remarks: event.target.value })
                                }
                                rows={3}
                                placeholder="Optional remark"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveResultEntry(entry.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Button variant="outline" onClick={handleAddResultEntry}>
                  <Plus className="w-4 h-4 mr-2" /> Add another student
                </Button>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResultsDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2d682d] hover:bg-[#245224] text-white" onClick={handleSaveResults}>
              Save Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

