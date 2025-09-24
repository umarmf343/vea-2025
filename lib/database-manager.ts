import { calculateFinancialAnalytics, normaliseFinancialPeriodKey, normalisePaymentForAnalytics } from "./financial-analytics"
import type { AnalyticsPayment, FinancialAnalyticsPeriod, FinancialAnalyticsSnapshot } from "./financial-analytics"
import { deriveGradeFromScore } from "./grade-utils"
import { safeStorage } from "./safe-storage"

const serverSideStorage = new Map<string, string>()

const isBrowserEnvironment = (): boolean => typeof window !== "undefined"

const readStorageValue = (key: string): string | null => {
  if (isBrowserEnvironment()) {
    return safeStorage.getItem(key)
  }

  return serverSideStorage.get(key) ?? null
}

const writeStorageValue = (key: string, value: string): void => {
  if (isBrowserEnvironment()) {
    safeStorage.setItem(key, value)
  } else {
    serverSideStorage.set(key, value)
  }
}

const removeStorageValue = (key: string): void => {
  if (isBrowserEnvironment()) {
    safeStorage.removeItem(key)
  } else {
    serverSideStorage.delete(key)
  }
}

type AssignmentStatus = "draft" | "sent" | "submitted" | "graded" | "overdue"

interface AssignmentSubmissionRecord {
  id: string
  assignmentId: string
  studentId: string
  status: "pending" | "submitted" | "graded"
  submittedAt: string | null
  files: { id: string; name: string }[]
  comment?: string | null
  grade?: string | null
  score?: number | null
}

interface AssignmentRecord {
  id: string
  title: string
  description: string
  subject: string
  classId: string | null
  className?: string | null
  teacherId: string | null
  teacherName?: string | null
  dueDate: string
  status: AssignmentStatus
  maximumScore?: number | null
  assignedStudentIds: string[]
  submissions: AssignmentSubmissionRecord[]
  resourceName?: string | null
  resourceSize?: number | null
  resourceType?: string | null
  resourceUrl?: string | null
  createdAt: string
  updatedAt: string
}

interface AssignmentFilters {
  teacherId?: string
  studentId?: string
  classId?: string
}

interface CreateAssignmentInput {
  title: string
  description: string
  subject: string
  classId?: string | null
  className?: string | null
  teacherId?: string | null
  teacherName?: string | null
  dueDate: string
  status?: AssignmentStatus
  maximumScore?: number | null
  assignedStudentIds?: string[]
  resourceName?: string | null
  resourceSize?: number | null
  resourceType?: string | null
  resourceUrl?: string | null
}

interface StudyMaterialRecord {
  id: string
  title: string
  description: string
  subject: string
  className: string
  classId?: string | null
  teacherId?: string | null
  teacherName: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl?: string | null
  uploadDate: string
  downloadCount: number
  createdAt: string
  updatedAt: string
}

interface StudyMaterialFilters {
  className?: string
  subject?: string
  teacherId?: string
}

interface SaveStudyMaterialInput {
  title: string
  description: string
  subject: string
  className: string
  classId?: string | null
  teacherId?: string | null
  teacherName: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl?: string | null
}

type AssignmentFileInput = { id?: string; name: string } | string

interface CreateAssignmentSubmissionInput {
  assignmentId: string
  studentId: string
  files?: AssignmentFileInput[]
  status?: "pending" | "submitted" | "graded"
  comment?: string | null
  submittedAt?: string
  grade?: string | null
  score?: number | null
}

interface TimetableSlot {
  id: string
  day: string
  time: string
  subject: string
  teacher: string
  location?: string | null
}

type ExamScheduleStatus = "scheduled" | "completed" | "cancelled"

interface ExamScheduleRecord {
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
  status: ExamScheduleStatus
  createdBy?: string | null
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

interface CreateExamScheduleInput {
  subject: string
  classId: string
  className?: string
  term: string
  session: string
  examDate: string
  startTime: string
  endTime: string
  venue?: string | null
  invigilator?: string | null
  notes?: string | null
  createdBy?: string | null
}

type UpdateExamScheduleInput = Partial<
  Omit<ExamScheduleRecord, "id" | "createdAt" | "updatedAt" | "classId" | "className" | "subject">
> &
  Partial<Pick<ExamScheduleRecord, "classId" | "className" | "subject">>

interface ExamResultRecord {
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

interface ExamResultInput {
  studentId: string
  studentName: string
  ca1: number
  ca2: number
  assignment: number
  exam: number
  position?: number | null
  totalStudents?: number | null
  remarks?: string | null
  status?: "pending" | "published" | "withheld"
  grade?: string
}

interface CumulativeSubjectAverage {
  name: string
  average: number
  grade: string
  trend: "up" | "down" | "stable"
}

interface CumulativeTermRecord {
  term: string
  session: string
  subjects: Array<{
    name: string
    ca1: number
    ca2: number
    assignment: number
    exam: number
    total: number
    grade: string
    position: number | null
  }>
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
}

interface StudentCumulativeReportRecord {
  studentId: string
  studentName: string
  className: string
  session: string
  terms: CumulativeTermRecord[]
  cumulativeAverage: number
  cumulativeGrade: string
  cumulativePosition: number
  totalStudents: number
  subjectAverages: CumulativeSubjectAverage[]
  updatedAt: string
}

interface LibraryBookRecord {
  id: string
  title: string
  author: string
  issuedDate: string
  dueDate: string
  status: "issued" | "overdue" | "returned"
  coverImage?: string | null
  renewedAt?: string | null
}

type LibraryBorrowStatus = "active" | "overdue" | "returned"

interface LibraryInventoryRecord {
  id: string
  title: string
  author: string
  isbn: string
  copies: number
  available: number
  category: string
  tags?: string[]
  description?: string | null
  shelfLocation?: string | null
  coverImage?: string | null
  addedBy?: string | null
  createdAt: string
  updatedAt: string
}

type LibraryRequestStatus = "pending" | "approved" | "rejected" | "fulfilled"

interface LibraryBorrowRecord {
  id: string
  bookId: string
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  borrowDate: string
  dueDate: string
  status: LibraryBorrowStatus
  returnedDate: string | null
  returnedTo: string | null
  issuedBy: string | null
  createdAt: string
  updatedAt: string
  renewedAt?: string | null
  notes?: string | null
}

interface LibraryRequestRecord {
  id: string
  bookId: string | null
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  requestDate: string
  status: LibraryRequestStatus
  approvedBy?: string | null
  approvedDate?: string | null
  rejectedBy?: string | null
  rejectedDate?: string | null
  fulfilledBy?: string | null
  fulfilledAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

class DatabaseManager {
  private listeners: Map<string, Function[]> = new Map()
  private static instance: DatabaseManager
  private eventListeners: Map<string, Function[]> = new Map()
  private storageArea: any
  private readonly libraryStorageKeys = {
    CATALOG: "libraryCatalog",
    BORROWED: "libraryBorrowedRecords",
    REQUESTS: "libraryBookRequests",
  }
  private readonly examStorageKeys = {
    SCHEDULES: "examSchedules",
    RESULTS: "examResults",
    CUMULATIVES: "cumulativeReports",
  }

  constructor() {
    this.storageArea = safeStorage
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
  }

  private getTimetableStorageKey(className: string): string {
    return `timetable_${className.replace(/\s+/g, "_").toLowerCase()}`
  }

  private getLibraryStorageKey(studentId: string): string {
    return `libraryBooks_${studentId}`
  }

  private ensureAssignmentsStorage(): AssignmentRecord[] {
    const raw = safeStorage.getItem("assignments")

    if (!raw) {
      const seeded = this.seedAssignments()
      safeStorage.setItem("assignments", JSON.stringify(seeded))
      return seeded
    }

    try {
      const parsed = JSON.parse(raw) as AssignmentRecord[]
      return parsed.map((assignment) => ({
        ...assignment,
        submissions: Array.isArray(assignment.submissions) ? assignment.submissions : [],
        assignedStudentIds: Array.isArray(assignment.assignedStudentIds)
          ? assignment.assignedStudentIds
          : [],
        maximumScore:
          typeof assignment.maximumScore === "number"
            ? assignment.maximumScore
            : assignment.maximumScore
              ? Number(assignment.maximumScore)
              : null,
        resourceName: assignment.resourceName ?? null,
        resourceSize:
          typeof assignment.resourceSize === "number"
            ? assignment.resourceSize
            : assignment.resourceSize
              ? Number(assignment.resourceSize)
              : null,
        resourceType: assignment.resourceType ?? null,
        resourceUrl: assignment.resourceUrl ?? null,
      }))
    } catch (error) {
      console.error("Error parsing assignments from storage:", error)
      const seeded = this.seedAssignments()
      safeStorage.setItem("assignments", JSON.stringify(seeded))
      return seeded
    }
  }

  private persistAssignments(assignments: AssignmentRecord[]) {
    safeStorage.setItem("assignments", JSON.stringify(assignments))
  }

  private shouldUseAssignmentsApi(): boolean {
    return isBrowserEnvironment() && typeof fetch === "function"
  }

  private buildAssignmentsRequestUrl(filters: AssignmentFilters = {}): string {
    const params = new URLSearchParams()

    if (filters.teacherId) {
      params.set("teacherId", filters.teacherId)
    }

    if (filters.studentId) {
      params.set("studentId", filters.studentId)
    }

    if (filters.classId) {
      params.set("classId", filters.classId)
    }

    const query = params.toString()
    return query.length > 0 ? `/api/assignments?${query}` : "/api/assignments"
  }

  private normaliseAssignmentStatus(status: unknown): AssignmentStatus {
    const allowedStatuses: AssignmentStatus[] = ["draft", "sent", "submitted", "graded", "overdue"]

    if (typeof status === "string") {
      const normalised = status.toLowerCase() as AssignmentStatus
      if (allowedStatuses.includes(normalised)) {
        return normalised
      }
    }

    return "draft"
  }

  private normaliseNumericValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }

    if (typeof value === "string") {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }

  private normaliseAssignmentSubmission(
    payload: any,
    assignmentId: string,
  ): AssignmentSubmissionRecord | null {
    if (!payload || typeof payload !== "object") {
      return null
    }

    const studentIdCandidate = (payload as Record<string, any>).studentId
    if (typeof studentIdCandidate !== "string" || studentIdCandidate.trim().length === 0) {
      return null
    }

    const filesPayload = (payload as Record<string, any>).files
    const files = Array.isArray(filesPayload)
      ? filesPayload
          .map((file) => {
            if (typeof file === "string") {
              return { id: this.generateId("file"), name: file }
            }

            if (file && typeof file === "object" && typeof (file as Record<string, any>).name === "string") {
              const record = file as Record<string, any>
              return {
                id:
                  typeof record.id === "string" && record.id.trim().length > 0
                    ? record.id
                    : this.generateId("file"),
                name: record.name,
              }
            }

            return null
          })
          .filter((file): file is { id: string; name: string } => Boolean(file))
      : []

    const statusCandidate = (payload as Record<string, any>).status
    const allowedSubmissionStatuses = ["pending", "submitted", "graded"] as const
    const status =
      typeof statusCandidate === "string" &&
      allowedSubmissionStatuses.includes(statusCandidate as (typeof allowedSubmissionStatuses)[number])
        ? (statusCandidate as AssignmentSubmissionRecord["status"])
        : "submitted"

    return {
      id:
        typeof (payload as Record<string, any>).id === "string" &&
        (payload as Record<string, any>).id.trim().length > 0
          ? ((payload as Record<string, any>).id as string)
          : this.generateId("submission"),
      assignmentId,
      studentId: studentIdCandidate,
      status,
      submittedAt:
        typeof (payload as Record<string, any>).submittedAt === "string"
          ? ((payload as Record<string, any>).submittedAt as string)
          : null,
      files,
      comment:
        typeof (payload as Record<string, any>).comment === "string"
          ? ((payload as Record<string, any>).comment as string)
          : null,
      grade:
        typeof (payload as Record<string, any>).grade === "string"
          ? ((payload as Record<string, any>).grade as string)
          : null,
      score: this.normaliseNumericValue((payload as Record<string, any>).score),
    }
  }

  private normaliseAssignmentPayload(payload: any): AssignmentRecord | null {
    if (!payload || typeof payload !== "object") {
      return null
    }

    const record = payload as Record<string, any>
    const idCandidate = record.id
    const id = typeof idCandidate === "string" && idCandidate.trim().length > 0 ? idCandidate : null

    if (!id) {
      return null
    }

    const assignedStudentIds = Array.isArray(record.assignedStudentIds)
      ? record.assignedStudentIds
          .map((studentId) => (typeof studentId === "string" ? studentId : null))
          .filter((studentId): studentId is string => Boolean(studentId))
      : []

    const submissions = Array.isArray(record.submissions)
      ? record.submissions
          .map((submission) => this.normaliseAssignmentSubmission(submission, id))
          .filter((submission): submission is AssignmentSubmissionRecord => Boolean(submission))
      : []

    return {
      id,
      title: typeof record.title === "string" ? record.title : String(record.title ?? "Assignment"),
      description: typeof record.description === "string" ? record.description : "",
      subject: typeof record.subject === "string" ? record.subject : String(record.subject ?? ""),
      classId:
        typeof record.classId === "string"
          ? record.classId
          : typeof record.class === "string"
            ? record.class
            : null,
      className:
        typeof record.className === "string"
          ? record.className
          : typeof record.class === "string"
            ? record.class
            : null,
      teacherId:
        typeof record.teacherId === "string"
          ? record.teacherId
          : typeof record.teacher === "string"
            ? record.teacher
            : null,
      teacherName:
        typeof record.teacherName === "string"
          ? record.teacherName
          : typeof record.teacher === "string"
            ? record.teacher
            : null,
      dueDate:
        typeof record.dueDate === "string" && record.dueDate.trim().length > 0
          ? record.dueDate
          : new Date().toISOString(),
      status: this.normaliseAssignmentStatus(record.originalStatus ?? record.status),
      maximumScore: this.normaliseNumericValue(record.maximumScore),
      assignedStudentIds,
      submissions,
      resourceName: typeof record.resourceName === "string" ? record.resourceName : null,
      resourceSize: this.normaliseNumericValue(record.resourceSize),
      resourceType: typeof record.resourceType === "string" ? record.resourceType : null,
      resourceUrl: typeof record.resourceUrl === "string" ? record.resourceUrl : null,
      createdAt:
        typeof record.createdAt === "string" && record.createdAt.trim().length > 0
          ? record.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
          ? record.updatedAt
          : new Date().toISOString(),
    }
  }

  private replaceAssignmentsCache(assignments: AssignmentRecord[]) {
    this.persistAssignments(assignments)
  }

  private syncAssignmentCache(record: AssignmentRecord) {
    const assignments = this.ensureAssignmentsStorage()
    const index = assignments.findIndex((assignment) => assignment.id === record.id)

    if (index >= 0) {
      assignments[index] = {
        ...assignments[index],
        ...record,
        submissions: record.submissions,
        assignedStudentIds: record.assignedStudentIds,
      }
    } else {
      assignments.push(record)
    }

    this.persistAssignments(assignments)
  }

  private removeAssignmentFromCache(assignmentId: string) {
    const assignments = this.ensureAssignmentsStorage()
    const filtered = assignments.filter((assignment) => assignment.id !== assignmentId)
    this.persistAssignments(filtered)
  }

  private applySubmissionToCache(assignmentId: string, submission: AssignmentSubmissionRecord) {
    const assignments = this.ensureAssignmentsStorage()
    const index = assignments.findIndex((assignment) => assignment.id === assignmentId)

    if (index === -1) {
      return
    }

    const assignment = assignments[index]
    const submissions = Array.isArray(assignment.submissions) ? [...assignment.submissions] : []
    const submissionIndex = submissions.findIndex((entry) => entry.studentId === submission.studentId)

    if (submissionIndex >= 0) {
      submissions[submissionIndex] = submission
    } else {
      submissions.push(submission)
    }

    assignments[index] = {
      ...assignment,
      submissions,
      updatedAt: submission.submittedAt ?? new Date().toISOString(),
    }

    this.persistAssignments(assignments)
  }

  private ensureStudyMaterialsStorage(): StudyMaterialRecord[] {
    const raw = safeStorage.getItem("studyMaterials")

    if (!raw) {
      const seeded = this.seedStudyMaterials()
      safeStorage.setItem("studyMaterials", JSON.stringify(seeded))
      return seeded
    }

    try {
      const parsed = JSON.parse(raw) as StudyMaterialRecord[]
      return parsed.map((material) => ({
        ...material,
        classId: material.classId ?? null,
        teacherId: material.teacherId ?? null,
        fileUrl: material.fileUrl ?? null,
      }))
    } catch (error) {
      console.error("Error parsing study materials from storage:", error)
      const seeded = this.seedStudyMaterials()
      safeStorage.setItem("studyMaterials", JSON.stringify(seeded))
      return seeded
    }
  }

  private persistStudyMaterials(materials: StudyMaterialRecord[]) {
    safeStorage.setItem("studyMaterials", JSON.stringify(materials))
  }

  private seedAssignments(): AssignmentRecord[] {
    const timestamp = new Date().toISOString()
    const dateFromNow = (days: number) => {
      const date = new Date()
      date.setDate(date.getDate() + days)
      return date.toISOString().split("T")[0]
    }

    return [
      {
        id: this.generateId("assignment"),
        title: "Mathematics Homework - Fractions Mastery",
        description:
          "Complete the exercises on page 32 covering proper, improper and mixed fractions. Ensure you show all workings.",
        subject: "Mathematics",
        classId: "class_jss1a",
        className: "JSS 1A",
        teacherId: "teacher_mathematics_default",
        teacherName: "Mr. John Smith",
        dueDate: dateFromNow(3),
        status: "sent",
        maximumScore: 20,
        assignedStudentIds: ["student_john_doe"],
        submissions: [],
        resourceName: "fraction-practice.pdf",
        resourceSize: 10240,
        resourceType: "application/pdf",
        resourceUrl: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("assignment"),
        title: "English Language - Reading Comprehension",
        description:
          "Read the comprehension passage on page 58 and answer the questions that follow. Focus on summarising the main ideas.",
        subject: "English Language",
        classId: "class_jss1a",
        className: "JSS 1A",
        teacherId: "teacher_english_default",
        teacherName: "Mrs. Sarah Johnson",
        dueDate: dateFromNow(5),
        status: "sent",
        maximumScore: 20,
        assignedStudentIds: ["student_john_doe"],
        submissions: [],
        resourceName: "reading-comprehension.docx",
        resourceSize: 20480,
        resourceType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        resourceUrl: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("assignment"),
        title: "Physics Practical - Measurement Accuracy",
        description:
          "Prepare a report on the measurement practical we conducted in the laboratory. Include observations and calculations.",
        subject: "Physics",
        classId: "class_jss2b",
        className: "JSS 2B",
        teacherId: "teacher_physics_default",
        teacherName: "Mr. Adewale Okoro",
        dueDate: dateFromNow(4),
        status: "sent",
        maximumScore: 20,
        assignedStudentIds: ["student_alice_smith"],
        submissions: [],
        resourceName: "physics-practical-guide.pdf",
        resourceSize: 16384,
        resourceType: "application/pdf",
        resourceUrl: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  }

  private ensureTimetable(className: string): TimetableSlot[] {
    const key = this.getTimetableStorageKey(className)
    const raw = readStorageValue(key)

    if (!raw) {
      const seeded = this.seedTimetable(className)
      writeStorageValue(key, JSON.stringify(seeded))
      return seeded
    }

    try {
      return JSON.parse(raw) as TimetableSlot[]
    } catch (error) {
      console.error("Error parsing timetable from storage:", error)
      const seeded = this.seedTimetable(className)
      writeStorageValue(key, JSON.stringify(seeded))
      return seeded
    }
  }

  private persistTimetable(className: string, slots: TimetableSlot[]) {
    const key = this.getTimetableStorageKey(className)
    writeStorageValue(key, JSON.stringify(slots))
  }

  private seedTimetable(className: string): TimetableSlot[] {
    const baseSlots: TimetableSlot[] = [
      {
        id: this.generateId("slot"),
        day: "Monday",
        time: "8:00 AM - 9:00 AM",
        subject: "Mathematics",
        teacher: "Mr. John Smith",
        location: "Room 12",
      },
      {
        id: this.generateId("slot"),
        day: "Monday",
        time: "10:00 AM - 11:00 AM",
        subject: "English Language",
        teacher: "Mrs. Sarah Johnson",
        location: "Room 8",
      },
      {
        id: this.generateId("slot"),
        day: "Tuesday",
        time: "9:00 AM - 10:00 AM",
        subject: "Basic Science",
        teacher: "Mr. Ibrahim Musa",
        location: "Laboratory 2",
      },
      {
        id: this.generateId("slot"),
        day: "Wednesday",
        time: "11:00 AM - 12:00 PM",
        subject: "Civic Education",
        teacher: "Mrs. Amaka Obi",
        location: "Room 5",
      },
      {
        id: this.generateId("slot"),
        day: "Thursday",
        time: "1:00 PM - 2:00 PM",
        subject: "Computer Studies",
        teacher: "Mr. David Uche",
        location: "ICT Lab",
      },
    ]

    if (className.trim().toLowerCase() === "jss 2b") {
      return baseSlots.map((slot, index) => ({
        ...slot,
        id: this.generateId("slot"),
        subject: index === 0 ? "Physics" : slot.subject,
        teacher: index === 0 ? "Mr. Adewale Okoro" : slot.teacher,
      }))
    }

    return baseSlots
  }

  private ensureExamSchedules(): ExamScheduleRecord[] {
    const raw = readStorageValue(this.examStorageKeys.SCHEDULES)

    if (!raw) {
      const seeded = this.seedExamSchedules()
      writeStorageValue(this.examStorageKeys.SCHEDULES, JSON.stringify(seeded))
      return seeded
    }

    try {
      return JSON.parse(raw) as ExamScheduleRecord[]
    } catch (error) {
      console.error("Error parsing exam schedules from storage:", error)
      const seeded = this.seedExamSchedules()
      writeStorageValue(this.examStorageKeys.SCHEDULES, JSON.stringify(seeded))
      return seeded
    }
  }

  private persistExamSchedules(records: ExamScheduleRecord[]): void {
    writeStorageValue(this.examStorageKeys.SCHEDULES, JSON.stringify(records))
  }

  private seedExamSchedules(): ExamScheduleRecord[] {
    const timestamp = new Date().toISOString()
    const addDays = (days: number) => {
      const date = new Date()
      date.setDate(date.getDate() + days)
      return date.toISOString().split("T")[0]
    }

    return [
      {
        id: this.generateId("exam"),
        subject: "Mathematics",
        classId: "class_jss2a",
        className: "JSS 2A",
        term: "First Term",
        session: "2024/2025",
        examDate: addDays(7),
        startTime: "09:00",
        endTime: "11:00",
        durationMinutes: 120,
        venue: "Main Examination Hall",
        invigilator: "Mrs. Sarah Johnson",
        notes: "Ensure calculators are fully charged.",
        status: "scheduled",
        createdBy: "system",
        updatedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("exam"),
        subject: "English Language",
        classId: "class_jss2a",
        className: "JSS 2A",
        term: "First Term",
        session: "2024/2025",
        examDate: addDays(9),
        startTime: "12:00",
        endTime: "14:00",
        durationMinutes: 120,
        venue: "Main Examination Hall",
        invigilator: "Mr. John Smith",
        notes: "Essay and comprehension sections included.",
        status: "scheduled",
        createdBy: "system",
        updatedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("exam"),
        subject: "Physics",
        classId: "class_ss1b",
        className: "SS 1B",
        term: "Third Term",
        session: "2023/2024",
        examDate: addDays(-14),
        startTime: "10:00",
        endTime: "12:00",
        durationMinutes: 120,
        venue: "Science Laboratory",
        invigilator: "Mrs. Ada Okafor",
        notes: "Practical section to hold a day before.",
        status: "completed",
        createdBy: "system",
        updatedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  }

  private ensureExamResults(): ExamResultRecord[] {
    const raw = readStorageValue(this.examStorageKeys.RESULTS)

    if (!raw) {
      const schedules = this.ensureExamSchedules()
      const seeded = this.seedExamResults(schedules)
      writeStorageValue(this.examStorageKeys.RESULTS, JSON.stringify(seeded))
      const cumulativeSeed = this.rebuildCumulativeReportsFromResults(seeded)
      writeStorageValue(this.examStorageKeys.CUMULATIVES, JSON.stringify(cumulativeSeed))
      return seeded
    }

    try {
      return JSON.parse(raw) as ExamResultRecord[]
    } catch (error) {
      console.error("Error parsing exam results from storage:", error)
      const schedules = this.ensureExamSchedules()
      const seeded = this.seedExamResults(schedules)
      writeStorageValue(this.examStorageKeys.RESULTS, JSON.stringify(seeded))
      const cumulativeSeed = this.rebuildCumulativeReportsFromResults(seeded)
      writeStorageValue(this.examStorageKeys.CUMULATIVES, JSON.stringify(cumulativeSeed))
      return seeded
    }
  }

  private persistExamResults(records: ExamResultRecord[]): void {
    writeStorageValue(this.examStorageKeys.RESULTS, JSON.stringify(records))
  }

  private seedExamResults(schedules: ExamScheduleRecord[]): ExamResultRecord[] {
    if (schedules.length === 0) {
      return []
    }

    const completedExam = schedules.find((schedule) => schedule.status === "completed")

    if (!completedExam) {
      return []
    }

    const timestamp = new Date().toISOString()
    const sampleStudents = [
      { id: "student_olamide_ade", name: "Olamide Ade", position: 1, totals: { ca1: 19, ca2: 18, assignment: 19, exam: 36 } },
      { id: "student_chinwe_okoro", name: "Chinwe Okoro", position: 3, totals: { ca1: 17, ca2: 16, assignment: 18, exam: 32 } },
      { id: "student_ibrahim_lawal", name: "Ibrahim Lawal", position: 5, totals: { ca1: 15, ca2: 14, assignment: 16, exam: 28 } },
    ]

    return sampleStudents.map((student) => {
      const total = student.totals.ca1 + student.totals.ca2 + student.totals.assignment + student.totals.exam
      return {
        id: this.generateId("exam_result"),
        examId: completedExam.id,
        studentId: student.id,
        studentName: student.name,
        classId: completedExam.classId,
        className: completedExam.className,
        subject: completedExam.subject,
        term: completedExam.term,
        session: completedExam.session,
        ca1: student.totals.ca1,
        ca2: student.totals.ca2,
        assignment: student.totals.assignment,
        exam: student.totals.exam,
        total,
        grade: this.calculateGradeFromTotal(total),
        position: student.position,
        totalStudents: 32,
        remarks: student.position <= 2 ? "Excellent performance" : "Keep improving",
        status: "published",
        publishedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    })
  }

  private ensureCumulativeReports(): StudentCumulativeReportRecord[] {
    const raw = readStorageValue(this.examStorageKeys.CUMULATIVES)

    if (!raw) {
      const rebuilt = this.rebuildCumulativeReportsFromResults(this.ensureExamResults())
      writeStorageValue(this.examStorageKeys.CUMULATIVES, JSON.stringify(rebuilt))
      return rebuilt
    }

    try {
      return JSON.parse(raw) as StudentCumulativeReportRecord[]
    } catch (error) {
      console.error("Error parsing cumulative reports from storage:", error)
      const rebuilt = this.rebuildCumulativeReportsFromResults(this.ensureExamResults())
      writeStorageValue(this.examStorageKeys.CUMULATIVES, JSON.stringify(rebuilt))
      return rebuilt
    }
  }

  private persistCumulativeReports(records: StudentCumulativeReportRecord[]): void {
    writeStorageValue(this.examStorageKeys.CUMULATIVES, JSON.stringify(records))
  }

  private calculateGradeFromTotal(total: number): string {
    return deriveGradeFromScore(total)
  }

  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const toMinutes = (value: string): number => {
      const normalised = value.trim().toUpperCase()

      const amPmMatch = normalised.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
      if (amPmMatch) {
        let hours = Number(amPmMatch[1]) % 12
        const minutes = Number(amPmMatch[2])
        if (amPmMatch[3] === "PM") {
          hours += 12
        }
        return hours * 60 + minutes
      }

      const parts = normalised.split(":")
      const hours = Number(parts[0])
      const minutes = Number(parts[1] ?? "0")

      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return 0
      }

      return hours * 60 + minutes
    }

    const start = toMinutes(startTime)
    const end = toMinutes(endTime)

    if (start === 0 && end === 0) {
      return 0
    }

    let duration = end - start
    if (duration <= 0) {
      duration += 24 * 60
    }

    return duration
  }

  private rebuildCumulativeReportsFromResults(results: ExamResultRecord[]): StudentCumulativeReportRecord[] {
    if (!Array.isArray(results) || results.length === 0) {
      return []
    }

    const studentSessionMap = new Map<
      string,
      {
        studentId: string
        studentName: string
        className: string
        session: string
        termMap: Map<
          string,
          {
            term: string
            session: string
            subjects: CumulativeTermRecord["subjects"]
            totalScore: number
            subjectCount: number
            positionTotal: number
            totalStudents: number
          }
        >
        subjectHistory: Map<string, Array<{ termIndex: number; total: number }>>
      }
    >()

    const termOrder = ["First Term", "Second Term", "Third Term"]
    const resolveTermIndex = (term: string) => {
      const index = termOrder.indexOf(term)
      return index === -1 ? termOrder.length : index
    }

    results.forEach((result) => {
      const key = `${result.studentId}_${result.session}`
      if (!studentSessionMap.has(key)) {
        studentSessionMap.set(key, {
          studentId: result.studentId,
          studentName: result.studentName,
          className: result.className,
          session: result.session,
          termMap: new Map(),
          subjectHistory: new Map(),
        })
      }

      const entry = studentSessionMap.get(key)!
      const termKey = result.term

      if (!entry.termMap.has(termKey)) {
        entry.termMap.set(termKey, {
          term: result.term,
          session: result.session,
          subjects: [],
          totalScore: 0,
          subjectCount: 0,
          positionTotal: 0,
          totalStudents: result.totalStudents ?? 0,
        })
      }

      const termEntry = entry.termMap.get(termKey)!
      termEntry.subjects.push({
        name: result.subject,
        ca1: result.ca1,
        ca2: result.ca2,
        assignment: result.assignment,
        exam: result.exam,
        total: result.total,
        grade: result.grade,
        position: result.position ?? null,
      })
      termEntry.totalScore += result.total
      termEntry.subjectCount += 1
      if (typeof result.position === "number") {
        termEntry.positionTotal += result.position
      }
      if (typeof result.totalStudents === "number") {
        termEntry.totalStudents = Math.max(termEntry.totalStudents, result.totalStudents)
      }

      const subjectHistory = entry.subjectHistory.get(result.subject) ?? []
      subjectHistory.push({ termIndex: resolveTermIndex(result.term), total: result.total })
      entry.subjectHistory.set(result.subject, subjectHistory)
    })

    const reports: StudentCumulativeReportRecord[] = []

    studentSessionMap.forEach((entry) => {
      const terms: CumulativeTermRecord[] = Array.from(entry.termMap.values())
        .map((term) => {
          const overallAverage = term.subjectCount > 0 ? Math.round(term.totalScore / term.subjectCount) : 0
          const classPosition =
            term.subjectCount > 0 && term.positionTotal > 0
              ? Math.max(1, Math.round(term.positionTotal / term.subjectCount))
              : 1
          const totalStudents = term.totalStudents && term.totalStudents > 0 ? term.totalStudents : Math.max(1, term.subjectCount)

          return {
            term: term.term,
            session: term.session,
            subjects: term.subjects.map((subject) => ({
              ...subject,
              total: Math.round(subject.total),
            })),
            overallAverage,
            overallGrade: this.calculateGradeFromTotal(overallAverage),
            classPosition,
            totalStudents,
          }
        })
        .sort((a, b) => resolveTermIndex(a.term) - resolveTermIndex(b.term))

      const cumulativeAverage =
        terms.length > 0 ? Math.round(terms.reduce((sum, term) => sum + term.overallAverage, 0) / terms.length) : 0
      const cumulativeGrade = this.calculateGradeFromTotal(cumulativeAverage)
      const cumulativePosition =
        terms.length > 0
          ? Math.max(1, Math.round(terms.reduce((sum, term) => sum + term.classPosition, 0) / terms.length))
          : 1
      const totalStudents = terms.reduce((max, term) => Math.max(max, term.totalStudents), 0) || (terms[0]?.totalStudents ?? 0)

      const subjectAverages: CumulativeSubjectAverage[] = Array.from(entry.subjectHistory.entries())
        .map(([name, history]) => {
          const sortedHistory = history.sort((a, b) => a.termIndex - b.termIndex)
          const average = Math.round(sortedHistory.reduce((sum, item) => sum + item.total, 0) / sortedHistory.length)
          const trendDelta = sortedHistory.length > 1 ? sortedHistory[sortedHistory.length - 1].total - sortedHistory[0].total : 0
          const trend: "up" | "down" | "stable" = trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "stable"

          return {
            name,
            average,
            grade: this.calculateGradeFromTotal(average),
            trend,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      reports.push({
        studentId: entry.studentId,
        studentName: entry.studentName,
        className: entry.className,
        session: entry.session,
        terms,
        cumulativeAverage,
        cumulativeGrade,
        cumulativePosition,
        totalStudents: totalStudents || terms.length,
        subjectAverages,
        updatedAt: new Date().toISOString(),
      })
    })

    return reports
  }

  private updateCumulativeReportsForStudents(studentIds: string[], session: string): void {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return
    }

    const results = this.ensureExamResults().filter(
      (result) => studentIds.includes(result.studentId) && (!session || result.session === session),
    )

    if (results.length === 0) {
      return
    }

    const recalculated = this.rebuildCumulativeReportsFromResults(results)
    const existing = this.ensureCumulativeReports()
    const filteredExisting = existing.filter(
      (record) => !studentIds.includes(record.studentId) || (session && record.session !== session),
    )
    const merged = [...filteredExisting, ...recalculated]

    this.persistCumulativeReports(merged)
    this.triggerEvent("cumulativeReportUpdated", { studentIds, session })
  }

  private ensureLibraryBooks(studentId: string): LibraryBookRecord[] {
    const key = this.getLibraryStorageKey(studentId)
    const raw = readStorageValue(key)

    if (!raw) {
      const borrowRecords = this.ensureBorrowRecords().filter((record) => record.studentId === studentId)

      if (borrowRecords.length > 0) {
        const inventory = this.ensureLibraryInventory()
        const derived = borrowRecords
          .filter((record) => this.resolveBorrowStatus(record) !== "returned")
          .map((record) => this.mapBorrowRecordToStudentBook(record, inventory))

        writeStorageValue(key, JSON.stringify(derived))
        return derived
      }

      const seeded = this.seedLibraryBooks(studentId)
      writeStorageValue(key, JSON.stringify(seeded))
      return seeded
    }

    try {
      return JSON.parse(raw) as LibraryBookRecord[]
    } catch (error) {
      console.error("Error parsing library books from storage:", error)
      const seeded = this.seedLibraryBooks(studentId)
      writeStorageValue(key, JSON.stringify(seeded))
      return seeded
    }
  }

  private persistLibraryBooks(studentId: string, books: LibraryBookRecord[]) {
    const key = this.getLibraryStorageKey(studentId)
    writeStorageValue(key, JSON.stringify(books))
  }

  private seedLibraryBooks(studentId: string): LibraryBookRecord[] {
    const today = new Date()
    const formatDate = (date: Date) => {
      const [isoDate] = date.toISOString().split("T")
      return isoDate ?? date.toISOString()
    }

    const issuedDate = new Date(today)
    issuedDate.setDate(today.getDate() - 7)
    const dueSoon = new Date(today)
    dueSoon.setDate(today.getDate() + 5)
    const overdueDate = new Date(today)
    overdueDate.setDate(today.getDate() - 3)

    if (studentId === "student_alice_smith") {
      return [
        {
          id: this.generateId("book"),
          title: "Advanced Physics Workbook",
          author: "Dr. Kemi Balogun",
          issuedDate: formatDate(issuedDate),
          dueDate: formatDate(dueSoon),
          status: "issued",
          coverImage: null,
        },
        {
          id: this.generateId("book"),
          title: "Understanding Electricity",
          author: "Engr. Peter Musa",
          issuedDate: formatDate(issuedDate),
          dueDate: formatDate(overdueDate),
          status: "overdue",
          coverImage: null,
        },
      ]
    }

    return [
      {
        id: this.generateId("book"),
        title: "Mathematics for Junior Secondary School",
        author: "Prof. Tunde Ajayi",
        issuedDate: formatDate(issuedDate),
        dueDate: formatDate(dueSoon),
        status: "issued",
        coverImage: null,
      },
      {
        id: this.generateId("book"),
        title: "English Grammar Essentials",
        author: "Grace Olorunfemi",
        issuedDate: formatDate(issuedDate),
        dueDate: formatDate(dueSoon),
        status: "issued",
        coverImage: null,
      },
      {
        id: this.generateId("book"),
        title: "Science Experiments Handbook",
        author: "Ibrahim Ahmed",
        issuedDate: formatDate(issuedDate),
        dueDate: formatDate(overdueDate),
        status: "overdue",
        coverImage: null,
      },
    ]
  }

  private ensureLibraryInventory(): LibraryInventoryRecord[] {
    const raw = readStorageValue(this.libraryStorageKeys.CATALOG)

    if (!raw) {
      const seeded = this.seedLibraryInventory()
      writeStorageValue(this.libraryStorageKeys.CATALOG, JSON.stringify(seeded))
      return seeded
    }

    try {
      const parsed = JSON.parse(raw) as LibraryInventoryRecord[]
      return parsed.map((record) => ({
        ...record,
        copies: Number.isFinite(record.copies) ? Number(record.copies) : 0,
        available: Number.isFinite(record.available) ? Number(record.available) : 0,
      }))
    } catch (error) {
      console.error("Error parsing library inventory from storage:", error)
      const seeded = this.seedLibraryInventory()
      writeStorageValue(this.libraryStorageKeys.CATALOG, JSON.stringify(seeded))
      return seeded
    }
  }

  private persistLibraryInventory(records: LibraryInventoryRecord[]): void {
    writeStorageValue(this.libraryStorageKeys.CATALOG, JSON.stringify(records))
  }

  private seedLibraryInventory(): LibraryInventoryRecord[] {
    const timestamp = new Date().toISOString()

    return [
      {
        id: this.generateId("lib_book"),
        title: "Mathematics Textbook",
        author: "John Smith",
        isbn: "978-123456789",
        copies: 50,
        available: 45,
        category: "Mathematics",
        tags: ["Mathematics", "Junior"],
        description: "Core mathematics textbook for junior secondary students.",
        shelfLocation: "A1",
        coverImage: null,
        addedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("lib_book"),
        title: "English Grammar",
        author: "Jane Doe",
        isbn: "978-987654321",
        copies: 30,
        available: 28,
        category: "English",
        tags: ["English", "Language"],
        description: "Comprehensive guide to English grammar and composition.",
        shelfLocation: "B4",
        coverImage: null,
        addedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("lib_book"),
        title: "Physics Fundamentals",
        author: "Dr. Brown",
        isbn: "978-456789123",
        copies: 25,
        available: 20,
        category: "Physics",
        tags: ["Science", "Physics"],
        description: "Fundamental physics concepts with practical experiments.",
        shelfLocation: "C2",
        coverImage: null,
        addedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  }

  private ensureBorrowRecords(): LibraryBorrowRecord[] {
    const inventory = this.ensureLibraryInventory()
    const raw = readStorageValue(this.libraryStorageKeys.BORROWED)

    if (!raw) {
      const seeded = this.seedBorrowRecords(inventory)
      writeStorageValue(this.libraryStorageKeys.BORROWED, JSON.stringify(seeded))
      this.syncStudentLibraryBooks(seeded, inventory)
      return seeded
    }

    try {
      const parsed = JSON.parse(raw) as LibraryBorrowRecord[]
      const now = new Date()
      let hasChanges = false

      const normalized = parsed.map((record) => {
        const status = this.resolveBorrowStatus(record, now)
        if (status !== record.status) {
          hasChanges = true
          return {
            ...record,
            status,
            updatedAt: record.updatedAt ?? record.createdAt,
          }
        }
        return record
      })

      if (hasChanges) {
        writeStorageValue(this.libraryStorageKeys.BORROWED, JSON.stringify(normalized))
        this.syncStudentLibraryBooks(normalized, inventory)
      }

      return normalized
    } catch (error) {
      console.error("Error parsing library borrow records from storage:", error)
      const seeded = this.seedBorrowRecords(inventory)
      writeStorageValue(this.libraryStorageKeys.BORROWED, JSON.stringify(seeded))
      this.syncStudentLibraryBooks(seeded, inventory)
      return seeded
    }
  }

  private persistBorrowRecords(records: LibraryBorrowRecord[]): void {
    writeStorageValue(this.libraryStorageKeys.BORROWED, JSON.stringify(records))
  }

  private seedBorrowRecords(inventory: LibraryInventoryRecord[]): LibraryBorrowRecord[] {
    const timestamp = new Date().toISOString()
    const today = new Date()
    const formatDate = (date: Date) => date.toISOString().split("T")[0]

    const borrowRecords: LibraryBorrowRecord[] = []

    if (inventory[0]) {
      const borrowDate = new Date(today)
      borrowDate.setDate(borrowDate.getDate() - 7)
      const dueDate = new Date(today)
      dueDate.setDate(dueDate.getDate() + 7)

      borrowRecords.push({
        id: this.generateId("borrow"),
        bookId: inventory[0].id,
        bookTitle: inventory[0].title,
        studentId: "student_john_doe",
        studentName: "John Doe",
        studentClass: "JSS 1A",
        borrowDate: formatDate(borrowDate),
        dueDate: formatDate(dueDate),
        status: "active",
        returnedDate: null,
        returnedTo: null,
        issuedBy: "librarian_default",
        createdAt: timestamp,
        updatedAt: timestamp,
        renewedAt: null,
        notes: null,
      })
    }

    if (inventory[1]) {
      const borrowDate = new Date(today)
      borrowDate.setDate(borrowDate.getDate() - 20)
      const dueDate = new Date(today)
      dueDate.setDate(dueDate.getDate() - 5)

      borrowRecords.push({
        id: this.generateId("borrow"),
        bookId: inventory[1].id,
        bookTitle: inventory[1].title,
        studentId: "student_jane_smith",
        studentName: "Jane Smith",
        studentClass: "JSS 2B",
        borrowDate: formatDate(borrowDate),
        dueDate: formatDate(dueDate),
        status: "overdue",
        returnedDate: null,
        returnedTo: null,
        issuedBy: "librarian_default",
        createdAt: timestamp,
        updatedAt: timestamp,
        renewedAt: null,
        notes: null,
      })
    }

    return borrowRecords
  }

  private ensureBookRequests(): LibraryRequestRecord[] {
    const inventory = this.ensureLibraryInventory()
    const raw = readStorageValue(this.libraryStorageKeys.REQUESTS)

    if (!raw) {
      const seeded = this.seedBookRequests(inventory)
      writeStorageValue(this.libraryStorageKeys.REQUESTS, JSON.stringify(seeded))
      return seeded
    }

    try {
      return JSON.parse(raw) as LibraryRequestRecord[]
    } catch (error) {
      console.error("Error parsing library request records from storage:", error)
      const seeded = this.seedBookRequests(inventory)
      writeStorageValue(this.libraryStorageKeys.REQUESTS, JSON.stringify(seeded))
      return seeded
    }
  }

  private persistBookRequests(records: LibraryRequestRecord[]): void {
    writeStorageValue(this.libraryStorageKeys.REQUESTS, JSON.stringify(records))
  }

  private seedBookRequests(inventory: LibraryInventoryRecord[]): LibraryRequestRecord[] {
    const timestamp = new Date().toISOString()
    const today = new Date()
    const formatDate = (date: Date) => date.toISOString().split("T")[0]

    return [
      {
        id: this.generateId("request"),
        bookId: inventory[2]?.id ?? null,
        bookTitle: inventory[2]?.title ?? "Chemistry Basics",
        studentId: "student_mike_johnson",
        studentName: "Mike Johnson",
        studentClass: "JSS 3A",
        requestDate: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
        status: "pending",
        approvedBy: null,
        approvedDate: null,
        rejectedBy: null,
        rejectedDate: null,
        fulfilledBy: null,
        fulfilledAt: null,
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("request"),
        bookId: inventory[0]?.id ?? null,
        bookTitle: inventory[0]?.title ?? "Biology Guide",
        studentId: "student_sarah_wilson",
        studentName: "Sarah Wilson",
        studentClass: "SS 1B",
        requestDate: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
        status: "approved",
        approvedBy: "librarian_default",
        approvedDate: timestamp,
        rejectedBy: null,
        rejectedDate: null,
        fulfilledBy: null,
        fulfilledAt: null,
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  }

  private resolveBorrowStatus(record: LibraryBorrowRecord, referenceDate = new Date()): LibraryBorrowStatus {
    if (record.status === "returned") {
      return "returned"
    }

    const dueDate = new Date(record.dueDate)

    if (Number.isNaN(dueDate.getTime())) {
      return record.status
    }

    return dueDate < referenceDate ? "overdue" : "active"
  }

  private mapBorrowRecordToStudentBook(
    record: LibraryBorrowRecord,
    inventory: LibraryInventoryRecord[],
  ): LibraryBookRecord {
    const catalogEntry = inventory.find((item) => item.id === record.bookId)
    const status = this.resolveBorrowStatus(record)

    return {
      id: record.id,
      title: catalogEntry?.title ?? record.bookTitle,
      author: catalogEntry?.author ?? "Library",
      issuedDate: record.borrowDate,
      dueDate: record.dueDate,
      status: status === "overdue" ? "overdue" : "issued",
      coverImage: catalogEntry?.coverImage ?? null,
      renewedAt: record.renewedAt ?? null,
    }
  }

  private syncStudentLibraryBooks(
    records: LibraryBorrowRecord[],
    inventory: LibraryInventoryRecord[],
  ): void {
    const grouped = new Map<string, LibraryBookRecord[]>()
    const now = new Date()

    records.forEach((record) => {
      const status = this.resolveBorrowStatus(record, now)
      if (status === "returned") {
        return
      }

      const entry = this.mapBorrowRecordToStudentBook(record, inventory)
      const list = grouped.get(record.studentId) ?? []
      list.push(entry)
      grouped.set(record.studentId, list)
    })

    const studentIds = new Set<string>()
    records.forEach((record) => studentIds.add(record.studentId))

    studentIds.forEach((studentId) => {
      const books = grouped.get(studentId) ?? []
      this.persistLibraryBooks(studentId, books)
    })
  }

  private issueBookFromRequest(
    request: LibraryRequestRecord,
    options: { issuedBy?: string | null; dueDate?: string | null; notes?: string | null } = {},
  ): LibraryBorrowRecord {
    const inventory = this.ensureLibraryInventory()
    const borrowRecords = this.ensureBorrowRecords()
    const timestamp = new Date().toISOString()
    const borrowDate = timestamp.split("T")[0]
    const computedDueDate = () => {
      const date = new Date()
      date.setDate(date.getDate() + 14)
      return date.toISOString().split("T")[0]
    }

    let catalogEntry = request.bookId ? inventory.find((item) => item.id === request.bookId) : undefined

    if (!catalogEntry) {
      catalogEntry = inventory.find(
        (item) => item.title.trim().toLowerCase() === request.bookTitle.trim().toLowerCase(),
      )
    }

    if (!catalogEntry) {
      catalogEntry = {
        id: request.bookId ?? this.generateId("lib_book"),
        title: request.bookTitle,
        author: "Library",
        isbn: "N/A",
        copies: 1,
        available: 0,
        category: "General",
        tags: [],
        description: null,
        shelfLocation: null,
        coverImage: null,
        addedBy: options.issuedBy ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      inventory.push(catalogEntry)
    } else {
      catalogEntry.available = Math.max(0, Math.min(catalogEntry.copies, catalogEntry.available - 1))
      catalogEntry.updatedAt = timestamp
    }

    const dueDate = options.dueDate ?? computedDueDate()

    const borrowRecord: LibraryBorrowRecord = {
      id: this.generateId("borrow"),
      bookId: catalogEntry.id,
      bookTitle: catalogEntry.title,
      studentId: request.studentId,
      studentName: request.studentName,
      studentClass: request.studentClass,
      borrowDate,
      dueDate,
      status: "active",
      returnedDate: null,
      returnedTo: null,
      issuedBy: options.issuedBy ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      renewedAt: null,
      notes: options.notes ?? request.notes ?? null,
    }

    borrowRecords.push(borrowRecord)
    this.persistLibraryInventory(inventory)
    this.persistBorrowRecords(borrowRecords)
    this.syncStudentLibraryBooks(borrowRecords, inventory)
    this.triggerEvent("libraryBorrowCreated", borrowRecord)

    return borrowRecord
  }

  async getAssignments(filters: AssignmentFilters = {}) {
    const filterAndDecorate = (records: AssignmentRecord[]) =>
      records
        .filter((assignment) => {
          if (filters.teacherId && assignment.teacherId !== filters.teacherId) {
            return false
          }

          if (filters.classId && assignment.classId !== filters.classId) {
            return false
          }

          if (filters.studentId) {
            const assignedStudents = Array.isArray(assignment.assignedStudentIds)
              ? assignment.assignedStudentIds
              : []
            const isAssigned = assignedStudents.length === 0 || assignedStudents.includes(filters.studentId)

            if (!isAssigned) {
              return false
            }

            // Hide drafts from students until the teacher sends them out
            if (assignment.status === "draft") {
              return false
            }
          }

          return true
        })
        .map((assignment) => {
          const submission = filters.studentId
            ? assignment.submissions.find((record) => record.studentId === filters.studentId)
            : undefined

          const baseStatus = submission ? submission.status : assignment.status
        let status: AssignmentStatus = baseStatus

        if (!submission && assignment.status === "sent") {
          const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null
          if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now()) {
            status = "overdue"
          }
        }

        return {
          ...assignment,
          originalStatus: assignment.status,
          teacher: assignment.teacherName ?? assignment.teacherId ?? "Subject Teacher",
          class: assignment.className ?? assignment.classId,
          status: submission ? (submission.status === "submitted" ? "submitted" : submission.status) : status,
          submittedAt: submission?.submittedAt ?? null,
          submittedFile: submission?.files?.[0]?.name ?? null,
          submittedComment: submission?.comment ?? "",
          grade: submission?.grade ?? null,
          score: submission?.score ?? null,
        }
        })

    let assignments = this.ensureAssignmentsStorage()

    if (this.shouldUseAssignmentsApi()) {
      try {
        const response = await fetch(this.buildAssignmentsRequestUrl(filters))

        if (response.ok) {
          const payload = (await response.json()) as { assignments?: unknown }
          const remoteAssignments = Array.isArray(payload.assignments) ? payload.assignments : []
          const normalised = remoteAssignments
            .map((record) => this.normaliseAssignmentPayload(record))
            .filter((record): record is AssignmentRecord => Boolean(record))

          if (normalised.length > 0) {
            const buildSignature = (record: AssignmentRecord) => {
              const teacherKey = (record.teacherId ?? record.teacherName ?? "")
                .toString()
                .trim()
                .toLowerCase()
              const titleKey = record.title.trim().toLowerCase()
              const dueDateKey = record.dueDate.trim()
              return `${teacherKey}__${titleKey}__${dueDateKey}`
            }

            const remoteById = new Map(normalised.map((record) => [record.id, record]))
            const remoteBySignature = new Set(normalised.map((record) => buildSignature(record)))
            const localExtras = assignments.filter((record) => {
              if (remoteById.has(record.id)) {
                return false
              }

              if (remoteBySignature.has(buildSignature(record))) {
                return false
              }

              return true
            })

            const merged = [...normalised, ...localExtras]
            this.replaceAssignmentsCache(merged)
            assignments = merged
          } else if (remoteAssignments.length === 0) {
            this.replaceAssignmentsCache(assignments)
          }

          return filterAndDecorate(assignments)
        }
      } catch (error) {
        console.error("Failed to load assignments from API:", error)
      }
    }

    return filterAndDecorate(assignments)
  }

  async createAssignment(payload: CreateAssignmentInput): Promise<AssignmentRecord> {
    if (this.shouldUseAssignmentsApi()) {
      try {
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          const data = (await response.json()) as { assignment?: unknown }
          const assignmentRecord = this.normaliseAssignmentPayload(data.assignment)

          if (assignmentRecord) {
            this.syncAssignmentCache(assignmentRecord)
            this.triggerEvent("assignmentsUpdate", assignmentRecord)
            return assignmentRecord
          }
        } else {
          console.error("Failed to create assignment via API:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("Unable to create assignment via API:", error)
      }
    }

    const assignments = this.ensureAssignmentsStorage()
    const timestamp = new Date().toISOString()

    const record: AssignmentRecord = {
      id: this.generateId("assignment"),
      title: payload.title,
      description: payload.description,
      subject: payload.subject,
      classId: payload.classId ?? null,
      className: payload.className ?? null,
      teacherId: payload.teacherId ?? null,
      teacherName: payload.teacherName ?? null,
      dueDate: payload.dueDate,
      status: payload.status ?? "draft",
      maximumScore: this.normaliseNumericValue(payload.maximumScore),
      assignedStudentIds: payload.assignedStudentIds ?? [],
      submissions: [],
      resourceName: payload.resourceName ?? null,
      resourceSize: payload.resourceSize ?? null,
      resourceType: payload.resourceType ?? null,
      resourceUrl: payload.resourceUrl ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    assignments.push(record)
    this.persistAssignments(assignments)
    this.triggerEvent("assignmentsUpdate", record)
    return record
  }

  async updateAssignment(
    assignmentId: string,
    updates: Partial<Omit<CreateAssignmentInput, "assignedStudentIds">> & {
      assignedStudentIds?: string[]
    },
  ): Promise<AssignmentRecord> {
    if (this.shouldUseAssignmentsApi()) {
      try {
        const response = await fetch("/api/assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, updates }),
        })

        if (response.ok) {
          const data = (await response.json()) as { assignment?: unknown }
          const assignmentRecord = this.normaliseAssignmentPayload(data.assignment)

          if (assignmentRecord) {
            this.syncAssignmentCache(assignmentRecord)
            this.triggerEvent("assignmentsUpdate", assignmentRecord)
            return assignmentRecord
          }
        } else {
          console.error("Failed to update assignment via API:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("Unable to update assignment via API:", error)
      }
    }

    const assignments = this.ensureAssignmentsStorage()
    const index = assignments.findIndex((item) => item.id === assignmentId)

    if (index === -1) {
      throw new Error("Assignment not found")
    }

    const existing = assignments[index]
    const timestamp = new Date().toISOString()

    const normalised: AssignmentRecord = {
      ...existing,
      title: updates.title ?? existing.title,
      description: updates.description ?? existing.description,
      subject: updates.subject ?? existing.subject,
      classId: updates.classId ?? existing.classId ?? null,
      className: updates.className ?? existing.className ?? null,
      teacherId: updates.teacherId ?? existing.teacherId ?? null,
      teacherName: updates.teacherName ?? existing.teacherName ?? null,
      dueDate: updates.dueDate ?? existing.dueDate,
      status: updates.status ?? existing.status,
      maximumScore:
        this.normaliseNumericValue(updates.maximumScore) ??
        (typeof existing.maximumScore === "number" ? existing.maximumScore : null),
      assignedStudentIds: Array.isArray(updates.assignedStudentIds)
        ? updates.assignedStudentIds
        : existing.assignedStudentIds,
      resourceName: updates.resourceName ?? existing.resourceName ?? null,
      resourceSize:
        typeof updates.resourceSize === "number"
          ? updates.resourceSize
          : typeof existing.resourceSize === "number"
            ? existing.resourceSize
            : null,
      resourceType: updates.resourceType ?? existing.resourceType ?? null,
      resourceUrl: updates.resourceUrl ?? existing.resourceUrl ?? null,
      updatedAt: timestamp,
    }

    assignments[index] = normalised
    this.persistAssignments(assignments)
    this.triggerEvent("assignmentsUpdate", normalised)
    return normalised
  }

  async updateAssignmentStatus(assignmentId: string, status: AssignmentStatus): Promise<AssignmentRecord> {
    return this.updateAssignment(assignmentId, { status })
  }

  async deleteAssignment(assignmentId: string): Promise<boolean> {
    if (this.shouldUseAssignmentsApi()) {
      try {
        const params = new URLSearchParams({ assignmentId })
        const response = await fetch(`/api/assignments?${params.toString()}`, { method: "DELETE" })

        if (response.ok) {
          this.removeAssignmentFromCache(assignmentId)
          this.triggerEvent("assignmentsUpdate", { id: assignmentId, deleted: true })
          return true
        }

        if (response.status === 404) {
          return false
        }

        console.error("Failed to delete assignment via API:", response.status, response.statusText)
      } catch (error) {
        console.error("Unable to delete assignment via API:", error)
      }
    }

    const assignments = this.ensureAssignmentsStorage()
    const index = assignments.findIndex((item) => item.id === assignmentId)

    if (index === -1) {
      return false
    }

    const [removed] = assignments.splice(index, 1)
    this.persistAssignments(assignments)
    this.triggerEvent("assignmentsUpdate", { id: removed.id, deleted: true })
    return true
  }

  async gradeAssignmentSubmission(
    assignmentId: string,
    studentId: string,
    updates: { grade?: string | null; score?: number | null; comment?: string | null },
  ): Promise<AssignmentSubmissionRecord> {
    const assignments = this.ensureAssignmentsStorage()
    const assignment = assignments.find((item) => item.id === assignmentId)

    if (!assignment) {
      throw new Error("Assignment not found")
    }

    const submissions = assignment.submissions ?? []
    const submissionIndex = submissions.findIndex((record) => record.studentId === studentId)

    if (submissionIndex === -1) {
      throw new Error("Submission not found")
    }

    const currentSubmission = submissions[submissionIndex]
    const gradedSubmission: AssignmentSubmissionRecord = {
      ...currentSubmission,
      comment:
        updates.comment !== undefined ? updates.comment : currentSubmission.comment ?? null,
      grade: updates.grade !== undefined ? updates.grade : currentSubmission.grade ?? null,
      score:
        updates.score !== undefined
          ? updates.score
          : typeof currentSubmission.score === "number"
            ? currentSubmission.score
            : null,
      status: "graded",
    }

    submissions[submissionIndex] = gradedSubmission
    assignment.submissions = submissions
    assignment.updatedAt = new Date().toISOString()
    this.persistAssignments(assignments)

    this.triggerEvent("assignmentsUpdate", {
      id: assignment.id,
      studentId,
      status: gradedSubmission.status,
      submittedAt: gradedSubmission.submittedAt,
      grade: gradedSubmission.grade ?? null,
      score: gradedSubmission.score ?? null,
      submittedFile: gradedSubmission.files[0]?.name ?? null,
      submittedComment: gradedSubmission.comment ?? "",
    })

    return gradedSubmission
  }

  async getStudyMaterials(filters: StudyMaterialFilters = {}) {
    const materials = this.ensureStudyMaterialsStorage()

    return materials
      .filter((material) => {
        if (filters.className && material.className.toLowerCase() !== filters.className.toLowerCase()) {
          return false
        }

        if (filters.subject && material.subject.toLowerCase() !== filters.subject.toLowerCase()) {
          return false
        }

        if (filters.teacherId && material.teacherId !== filters.teacherId) {
          return false
        }

        return true
      })
      .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate))
  }

  async saveStudyMaterial(input: SaveStudyMaterialInput) {
    const materials = this.ensureStudyMaterialsStorage()
    const timestamp = new Date().toISOString()

    const record: StudyMaterialRecord = {
      id: this.generateId("material"),
      title: input.title,
      description: input.description,
      subject: input.subject,
      className: input.className,
      classId: input.classId ?? null,
      teacherId: input.teacherId ?? null,
      teacherName: input.teacherName,
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileType: input.fileType,
      fileUrl: input.fileUrl ?? null,
      uploadDate: timestamp,
      downloadCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    materials.push(record)
    this.persistStudyMaterials(materials)
    this.triggerEvent("studyMaterialsUpdated", record)
    return record
  }

  async deleteStudyMaterial(materialId: string) {
    const materials = this.ensureStudyMaterialsStorage()
    const index = materials.findIndex((material) => material.id === materialId)

    if (index === -1) {
      throw new Error("Study material not found")
    }

    const [removed] = materials.splice(index, 1)
    this.persistStudyMaterials(materials)
    this.triggerEvent("studyMaterialsUpdated", { id: removed.id, deleted: true })
    return removed
  }

  async incrementDownloadCount(materialId: string) {
    const materials = this.ensureStudyMaterialsStorage()
    const index = materials.findIndex((material) => material.id === materialId)

    if (index === -1) {
      throw new Error("Study material not found")
    }

    materials[index].downloadCount = (materials[index].downloadCount ?? 0) + 1
    materials[index].updatedAt = new Date().toISOString()
    this.persistStudyMaterials(materials)
    this.triggerEvent("studyMaterialsUpdated", materials[index])
    return materials[index]
  }

  async createAssignmentSubmission(
    payload: CreateAssignmentSubmissionInput,
  ): Promise<AssignmentSubmissionRecord> {
    if (this.shouldUseAssignmentsApi()) {
      try {
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            files: payload.files ?? [],
            type: "submission",
          }),
        })

        if (response.ok) {
          const data = (await response.json()) as { submission?: unknown }
          const submissionRecord = this.normaliseAssignmentSubmission(data.submission, payload.assignmentId)

          if (submissionRecord) {
            this.applySubmissionToCache(payload.assignmentId, submissionRecord)

            const eventPayload = {
              id: payload.assignmentId,
              studentId: submissionRecord.studentId,
              status: submissionRecord.status === "submitted" ? "submitted" : submissionRecord.status,
              submittedAt: submissionRecord.submittedAt,
              submittedFile: submissionRecord.files[0]?.name ?? null,
              submittedComment: submissionRecord.comment ?? "",
              grade: submissionRecord.grade ?? null,
              score: submissionRecord.score ?? null,
            }

            this.triggerEvent("assignmentsUpdate", eventPayload)
            this.triggerEvent("assignmentSubmitted", eventPayload)

            return submissionRecord
          }
        } else {
          console.error("Failed to submit assignment via API:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("Unable to submit assignment via API:", error)
      }
    }

    const assignments = this.ensureAssignmentsStorage()
    const assignment = assignments.find((item) => item.id === payload.assignmentId)

    if (!assignment) {
      throw new Error("Assignment not found")
    }

    const submissions = assignment.submissions ?? []
    const existingIndex = submissions.findIndex((record) => record.studentId === payload.studentId)
    const existingSubmission = existingIndex >= 0 ? submissions[existingIndex] : undefined
    const timestamp = payload.submittedAt ?? new Date().toISOString()
    const normalisedFiles =
      payload.files?.map((file) =>
        typeof file === "string"
          ? { id: this.generateId("file"), name: file }
          : { id: file.id ?? this.generateId("file"), name: file.name },
      ) ?? []

    const submissionRecord: AssignmentSubmissionRecord = {
      id: existingSubmission?.id ?? this.generateId("submission"),
      assignmentId: assignment.id,
      studentId: payload.studentId,
      status: payload.status ?? "submitted",
      submittedAt: timestamp,
      files: normalisedFiles,
      comment: payload.comment ?? existingSubmission?.comment ?? null,
      grade: payload.grade ?? existingSubmission?.grade ?? null,
      score:
        typeof payload.score === "number"
          ? payload.score
          : typeof existingSubmission?.score === "number"
            ? existingSubmission.score
            : null,
    }

    if (existingIndex >= 0) {
      submissions[existingIndex] = submissionRecord
    } else {
      submissions.push(submissionRecord)
    }

    assignment.submissions = submissions
    assignment.updatedAt = new Date().toISOString()
    this.persistAssignments(assignments)

    const eventPayload = {
      id: assignment.id,
      studentId: payload.studentId,
      status: submissionRecord.status === "submitted" ? "submitted" : submissionRecord.status,
      submittedAt: submissionRecord.submittedAt,
      submittedFile: submissionRecord.files[0]?.name ?? null,
      submittedComment: submissionRecord.comment ?? "",
      grade: submissionRecord.grade ?? null,
      score: submissionRecord.score ?? null,
    }

    this.triggerEvent("assignmentsUpdate", eventPayload)
    this.triggerEvent("assignmentSubmitted", eventPayload)

    return submissionRecord
  }

  async getTimetable(className: string): Promise<TimetableSlot[]> {
    if (!className || !className.trim()) {
      return this.ensureTimetable("general")
    }

    return this.ensureTimetable(className)
  }

  async saveTimetable(className: string, slots: TimetableSlot[]): Promise<TimetableSlot[]> {
    this.persistTimetable(className, slots)
    this.triggerEvent("timetableUpdated", { className, slots })
    return slots
  }

  async addTimetableSlot(
    className: string,
    slot: Omit<TimetableSlot, "id">,
  ): Promise<TimetableSlot> {
    const slots = this.ensureTimetable(className)
    const newSlot: TimetableSlot = { id: this.generateId("slot"), ...slot }
    slots.push(newSlot)
    this.persistTimetable(className, slots)
    this.triggerEvent("timetableUpdated", { className, slots })
    return this.deepClone(newSlot)
  }

  async updateTimetableSlot(
    className: string,
    slotId: string,
    updates: Partial<Omit<TimetableSlot, "id">>,
  ): Promise<TimetableSlot | null> {
    const slots = this.ensureTimetable(className)
    const index = slots.findIndex((slot) => slot.id === slotId)

    if (index === -1) {
      return null
    }

    const updatedSlot: TimetableSlot = { ...slots[index], ...updates }
    slots[index] = updatedSlot
    this.persistTimetable(className, slots)
    this.triggerEvent("timetableUpdated", { className, slots })
    return this.deepClone(updatedSlot)
  }

  async deleteTimetableSlot(className: string, slotId: string): Promise<boolean> {
    const slots = this.ensureTimetable(className)
    const filtered = slots.filter((slot) => slot.id !== slotId)

    if (filtered.length === slots.length) {
      return false
    }

    this.persistTimetable(className, filtered)
    this.triggerEvent("timetableUpdated", { className, slots: filtered })
    return true
  }

  async getExamSchedules(
    filters: {
      status?: ExamScheduleStatus
      classId?: string
      className?: string
      session?: string
      term?: string
    } = {},
  ): Promise<ExamScheduleRecord[]> {
    const schedules = this.ensureExamSchedules()
    const filtered = schedules.filter((exam) => {
      if (filters.status && exam.status !== filters.status) {
        return false
      }
      if (filters.classId && exam.classId !== filters.classId) {
        return false
      }
      if (filters.className && exam.className !== filters.className) {
        return false
      }
      if (filters.session && exam.session !== filters.session) {
        return false
      }
      if (filters.term && exam.term !== filters.term) {
        return false
      }
      return true
    })

    return this.deepClone(
      filtered.sort((a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime)),
    )
  }

  async createExamSchedule(payload: CreateExamScheduleInput): Promise<ExamScheduleRecord> {
    const schedules = this.ensureExamSchedules()
    const now = new Date().toISOString()
    const classes = this.getClasses()
    const matchedClass = Array.isArray(classes)
      ? classes.find((cls: any) => cls?.id === payload.classId || cls?.name === payload.classId)
      : undefined
    const resolvedClassName = payload.className ?? matchedClass?.name ?? payload.classId

    const newExam: ExamScheduleRecord = {
      id: this.generateId("exam"),
      subject: payload.subject,
      classId: payload.classId,
      className: resolvedClassName,
      term: payload.term,
      session: payload.session,
      examDate: payload.examDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      durationMinutes: this.calculateDurationMinutes(payload.startTime, payload.endTime),
      venue: payload.venue ?? null,
      invigilator: payload.invigilator ?? null,
      notes: payload.notes ?? null,
      status: "scheduled",
      createdBy: payload.createdBy ?? null,
      updatedBy: payload.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }

    schedules.push(newExam)
    this.persistExamSchedules(schedules)
    this.triggerEvent("examScheduleUpdated", { action: "created", exam: newExam })

    return this.deepClone(newExam)
  }

  async updateExamSchedule(examId: string, updates: UpdateExamScheduleInput): Promise<ExamScheduleRecord> {
    const schedules = this.ensureExamSchedules()
    const index = schedules.findIndex((exam) => exam.id === examId)

    if (index === -1) {
      throw new Error("Exam schedule not found")
    }

    const now = new Date().toISOString()
    const existing = schedules[index]
    const startTime = updates.startTime ?? existing.startTime
    const endTime = updates.endTime ?? existing.endTime

    const updatedExam: ExamScheduleRecord = {
      ...existing,
      ...updates,
      classId: updates.classId ?? existing.classId,
      className: updates.className ?? existing.className,
      subject: updates.subject ?? existing.subject,
      startTime,
      endTime,
      durationMinutes:
        startTime && endTime ? this.calculateDurationMinutes(startTime, endTime) : existing.durationMinutes,
      updatedBy: updates.updatedBy ?? existing.updatedBy ?? null,
      updatedAt: now,
    }

    schedules[index] = updatedExam
    this.persistExamSchedules(schedules)
    this.triggerEvent("examScheduleUpdated", { action: "updated", exam: updatedExam })

    return this.deepClone(updatedExam)
  }

  async deleteExamSchedule(examId: string): Promise<boolean> {
    const schedules = this.ensureExamSchedules()
    const index = schedules.findIndex((exam) => exam.id === examId)

    if (index === -1) {
      return false
    }

    const [removed] = schedules.splice(index, 1)
    this.persistExamSchedules(schedules)

    const existingResults = this.ensureExamResults()
    const remainingResults = existingResults.filter((result) => result.examId !== examId)
    const removedResults = existingResults.filter((result) => result.examId === examId)

    if (remainingResults.length !== existingResults.length) {
      this.persistExamResults(remainingResults)
      const affectedStudents = Array.from(new Set(removedResults.map((result) => result.studentId)))
      if (affectedStudents.length > 0) {
        this.updateCumulativeReportsForStudents(affectedStudents, removed.session)
      }
    }

    this.triggerEvent("examScheduleUpdated", { action: "deleted", exam: removed })
    return true
  }

  async getExamResults(examId: string): Promise<ExamResultRecord[]> {
    const results = this.ensureExamResults().filter((result) => result.examId === examId)
    return this.deepClone(results)
  }

  async saveExamResults(
    examId: string,
    results: ExamResultInput[],
    options: { autoPublish?: boolean } = {},
  ): Promise<ExamResultRecord[]> {
    const schedules = this.ensureExamSchedules()
    const examIndex = schedules.findIndex((exam) => exam.id === examId)

    if (examIndex === -1) {
      throw new Error("Exam schedule not found")
    }

    const exam = schedules[examIndex]
    const existingResults = this.ensureExamResults()
    const remainingResults = existingResults.filter((result) => result.examId !== examId)
    const now = new Date().toISOString()

    const processedResults: ExamResultRecord[] = results.map((input) => {
      const total = input.ca1 + input.ca2 + input.assignment + input.exam
      const existing = existingResults.find(
        (record) => record.examId === examId && record.studentId === input.studentId,
      )

      const status = input.status ?? existing?.status ?? (options.autoPublish ? "published" : "pending")
      const publishedAt =
        status === "published" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null

      return {
        id: existing?.id ?? this.generateId("exam_result"),
        examId,
        studentId: input.studentId,
        studentName: input.studentName,
        classId: exam.classId,
        className: exam.className,
        subject: exam.subject,
        term: exam.term,
        session: exam.session,
        ca1: input.ca1,
        ca2: input.ca2,
        assignment: input.assignment,
        exam: input.exam,
        total,
        grade: input.grade ?? this.calculateGradeFromTotal(total),
        position: input.position ?? existing?.position ?? null,
        totalStudents: input.totalStudents ?? existing?.totalStudents ?? results.length,
        remarks: input.remarks ?? existing?.remarks ?? null,
        status,
        publishedAt,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
    })

    const combinedResults = [...remainingResults, ...processedResults]
    this.persistExamResults(combinedResults)

    const uniqueStudentIds = Array.from(new Set(processedResults.map((result) => result.studentId)))
    if (uniqueStudentIds.length > 0) {
      this.updateCumulativeReportsForStudents(uniqueStudentIds, exam.session)
    }

    const updatedExam: ExamScheduleRecord = {
      ...exam,
      status: processedResults.length > 0 ? "completed" : exam.status,
      updatedAt: now,
    }
    schedules[examIndex] = updatedExam
    this.persistExamSchedules(schedules)
    this.triggerEvent("examScheduleUpdated", { action: "updated", exam: updatedExam })
    this.triggerEvent("examResultsUpdated", { examId, results: processedResults })

    return this.deepClone(processedResults)
  }

  async publishExamResults(examId: string): Promise<ExamResultRecord[]> {
    const schedules = this.ensureExamSchedules()
    const exam = schedules.find((item) => item.id === examId)

    if (!exam) {
      throw new Error("Exam schedule not found")
    }

    const now = new Date().toISOString()
    const results = this.ensureExamResults()
    let hasChanges = false
    const updatedResults = results.map((record) => {
      if (record.examId !== examId) {
        return record
      }

      if (record.status === "published" && record.publishedAt) {
        return record
      }

      hasChanges = true
      return {
        ...record,
        status: "published",
        publishedAt: record.publishedAt ?? now,
        updatedAt: now,
      }
    })

    if (hasChanges) {
      this.persistExamResults(updatedResults)
      const affectedStudents = Array.from(
        new Set(updatedResults.filter((record) => record.examId === examId).map((record) => record.studentId)),
      )
      if (affectedStudents.length > 0) {
        this.updateCumulativeReportsForStudents(affectedStudents, exam.session)
      }
      this.triggerEvent("examResultsUpdated", { examId, published: true })
    }

    return this.deepClone(updatedResults.filter((record) => record.examId === examId))
  }

  async getStudentCumulativeReport(
    studentId: string,
    session?: string,
  ): Promise<StudentCumulativeReportRecord | null> {
    if (!studentId) {
      return null
    }

    const results = this.ensureExamResults().filter(
      (result) => result.studentId === studentId && (!session || result.session === session),
    )

    if (results.length === 0) {
      return null
    }

    if (session) {
      this.updateCumulativeReportsForStudents([studentId], session)
    } else {
      const sessions = Array.from(new Set(results.map((result) => result.session)))
      sessions.forEach((sessionKey) => this.updateCumulativeReportsForStudents([studentId], sessionKey))
    }

    const reports = this.ensureCumulativeReports().filter((report) => report.studentId === studentId)

    if (reports.length === 0) {
      return null
    }

    if (session) {
      const match = reports.find((report) => report.session === session)
      return match ? this.deepClone(match) : null
    }

    const sorted = reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return this.deepClone(sorted[0])
  }

  async getLibraryBooks(studentId: string): Promise<LibraryBookRecord[]> {
    const borrowRecords = this.ensureBorrowRecords().filter((record) => record.studentId === studentId)

    if (borrowRecords.length === 0) {
      return this.deepClone(this.ensureLibraryBooks(studentId))
    }

    const inventory = this.ensureLibraryInventory()
    const mapped = borrowRecords
      .filter((record) => this.resolveBorrowStatus(record) !== "returned")
      .map((record) => this.mapBorrowRecordToStudentBook(record, inventory))

    this.persistLibraryBooks(studentId, mapped)
    return this.deepClone(mapped)
  }

  async saveLibraryBooks(studentId: string, books: LibraryBookRecord[]): Promise<LibraryBookRecord[]> {
    const borrowRecords = this.ensureBorrowRecords()
    const inventory = this.ensureLibraryInventory()
    const timestamp = new Date().toISOString()
    let hasChanges = false

    const updatedRecords = borrowRecords.map((record) => {
      if (record.studentId !== studentId) {
        return record
      }

      const match = books.find((book) => book.id === record.id || book.id === record.bookId)
      if (!match) {
        return record
      }

      const normalizedStatus: LibraryBorrowStatus =
        match.status === "overdue" ? "overdue" : record.status === "returned" ? "returned" : "active"

      if (record.dueDate !== match.dueDate || record.status !== normalizedStatus) {
        hasChanges = true
        return {
          ...record,
          dueDate: match.dueDate,
          status: normalizedStatus,
          updatedAt: timestamp,
        }
      }

      return record
    })

    if (hasChanges) {
      this.persistBorrowRecords(updatedRecords)
      this.syncStudentLibraryBooks(updatedRecords, inventory)
    } else {
      this.persistLibraryBooks(studentId, books)
    }

    this.triggerEvent("libraryBooksUpdated", { studentId, books })
    return this.deepClone(books)
  }

  private seedStudyMaterials(): StudyMaterialRecord[] {
    const timestamp = new Date().toISOString()

    return [
      {
        id: this.generateId("material"),
        title: "Mathematics Formulas Revision Guide",
        description: "Comprehensive list of algebraic formulas covered this term.",
        subject: "Mathematics",
        className: "JSS 1A",
        classId: "class_jss1a",
        teacherId: "teacher_mathematics_default",
        teacherName: "Mr. John Smith",
        fileName: "mathematics-formulas.pdf",
        fileSize: 24576,
        fileType: "application/pdf",
        fileUrl: null,
        uploadDate: timestamp,
        downloadCount: 12,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: this.generateId("material"),
        title: "English Language Essay Writing Tips",
        description: "Key pointers and structure for writing compelling essays.",
        subject: "English Language",
        className: "JSS 2B",
        classId: "class_jss2b",
        teacherId: "teacher_english_default",
        teacherName: "Mrs. Sarah Johnson",
        fileName: "essay-writing-tips.docx",
        fileSize: 18432,
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileUrl: null,
        uploadDate: timestamp,
        downloadCount: 8,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  }

  async getBooks(): Promise<LibraryInventoryRecord[]> {
    const catalog = this.ensureLibraryInventory()
    return this.deepClone(catalog)
  }

  async addBook(bookData: {
    title: string
    author: string
    isbn: string
    copies: number
    category: string
    available?: number
    tags?: string[]
    description?: string | null
    shelfLocation?: string | null
    coverImage?: string | null
    addedBy?: string | null
  }): Promise<LibraryInventoryRecord> {
    const catalog = this.ensureLibraryInventory()
    const timestamp = new Date().toISOString()
    const copies = Math.max(1, Math.floor(Number(bookData.copies ?? 1)))
    const available = Math.min(copies, Math.max(0, Math.floor(Number(bookData.available ?? copies))))

    const record: LibraryInventoryRecord = {
      id: this.generateId("lib_book"),
      title: bookData.title,
      author: bookData.author,
      isbn: bookData.isbn,
      copies,
      available,
      category: bookData.category,
      tags: bookData.tags ?? [],
      description: bookData.description ?? null,
      shelfLocation: bookData.shelfLocation ?? null,
      coverImage: bookData.coverImage ?? null,
      addedBy: bookData.addedBy ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    catalog.push(record)
    this.persistLibraryInventory(catalog)
    this.triggerEvent("libraryInventoryUpdated", { action: "created", book: record })
    return this.deepClone(record)
  }

  async updateBook(
    bookId: string,
    updates: Partial<Omit<LibraryInventoryRecord, "id" | "createdAt" | "updatedAt">>,
  ): Promise<LibraryInventoryRecord | null> {
    const catalog = this.ensureLibraryInventory()
    const index = catalog.findIndex((book) => book.id === bookId)

    if (index === -1) {
      return null
    }

    const existing = { ...catalog[index] }

    if (updates.copies !== undefined) {
      const copies = Math.max(1, Math.floor(Number(updates.copies)))
      existing.copies = copies
      existing.available = Math.min(copies, existing.available)
    }

    if (updates.available !== undefined) {
      const available = Math.max(0, Math.floor(Number(updates.available)))
      existing.available = Math.min(existing.copies, available)
    }

    if (updates.title !== undefined) {
      existing.title = updates.title
    }

    if (updates.author !== undefined) {
      existing.author = updates.author
    }

    if (updates.isbn !== undefined) {
      existing.isbn = updates.isbn
    }

    if (updates.category !== undefined) {
      existing.category = updates.category
    }

    if (updates.tags !== undefined) {
      existing.tags = Array.isArray(updates.tags) ? [...updates.tags] : []
    }

    if (updates.description !== undefined) {
      existing.description = updates.description
    }

    if (updates.shelfLocation !== undefined) {
      existing.shelfLocation = updates.shelfLocation
    }

    if (updates.coverImage !== undefined) {
      existing.coverImage = updates.coverImage
    }

    if (updates.addedBy !== undefined) {
      existing.addedBy = updates.addedBy
    }

    existing.updatedAt = new Date().toISOString()
    catalog[index] = existing
    this.persistLibraryInventory(catalog)
    this.triggerEvent("libraryInventoryUpdated", { action: "updated", book: existing })
    return this.deepClone(existing)
  }

  async deleteBook(bookId: string): Promise<boolean> {
    const catalog = this.ensureLibraryInventory()
    const borrowRecords = this.ensureBorrowRecords()

    const hasActiveBorrow = borrowRecords.some(
      (record) => record.bookId === bookId && this.resolveBorrowStatus(record) !== "returned",
    )

    if (hasActiveBorrow) {
      throw new Error("Cannot delete a book with active borrow records")
    }

    const index = catalog.findIndex((book) => book.id === bookId)
    if (index === -1) {
      return false
    }

    const [removed] = catalog.splice(index, 1)
    this.persistLibraryInventory(catalog)
    this.triggerEvent("libraryInventoryUpdated", { action: "deleted", book: removed })
    return true
  }

  async getBorrowedBooks(): Promise<LibraryBorrowRecord[]> {
    const records = this.ensureBorrowRecords()
    const inventory = this.ensureLibraryInventory()
    const now = new Date()
    let hasChanges = false

    const normalized = records.map((record) => {
      const status = this.resolveBorrowStatus(record, now)
      if (status !== record.status) {
        hasChanges = true
        return { ...record, status, updatedAt: new Date().toISOString() }
      }
      return record
    })

    if (hasChanges) {
      this.persistBorrowRecords(normalized)
      this.syncStudentLibraryBooks(normalized, inventory)
      return this.deepClone(normalized)
    }

    return this.deepClone(records)
  }

  async returnBook(
    borrowId: string,
    payload: { returnedDate?: string; returnedTo?: string | null; notes?: string | null } = {},
  ): Promise<LibraryBorrowRecord> {
    const borrowRecords = this.ensureBorrowRecords()
    const index = borrowRecords.findIndex((record) => record.id === borrowId)

    if (index === -1) {
      throw new Error("Borrow record not found")
    }

    const record = borrowRecords[index]!
    if (record.status === "returned") {
      return this.deepClone(record)
    }

    const inventory = this.ensureLibraryInventory()
    const book = inventory.find((entry) => entry.id === record.bookId)
    const timestamp = new Date().toISOString()
    const [timestampDate] = timestamp.split("T")
    const returnedDate = payload.returnedDate ?? timestampDate ?? timestamp

    const updated: LibraryBorrowRecord = {
      ...record,
      status: "returned",
      returnedDate,
      returnedTo: payload.returnedTo ?? null,
      notes: payload.notes ?? record.notes ?? null,
      updatedAt: timestamp,
    }

    borrowRecords[index] = updated

    if (book) {
      book.available = Math.min(book.copies, book.available + 1)
      book.updatedAt = timestamp
      this.persistLibraryInventory(inventory)
    }

    this.persistBorrowRecords(borrowRecords)
    this.syncStudentLibraryBooks(borrowRecords, inventory)
    this.triggerEvent("libraryBorrowUpdated", { action: "returned", record: updated })
    this.triggerEvent("libraryBooksUpdated", {
      studentId: updated.studentId,
      books: this.ensureLibraryBooks(updated.studentId),
    })

    return this.deepClone(updated)
  }

  async getBookRequests(): Promise<LibraryRequestRecord[]> {
    const requests = this.ensureBookRequests()
    return this.deepClone(requests)
  }

  async createBookRequest(payload: {
    bookId?: string | null
    bookTitle: string
    studentId: string
    studentName: string
    studentClass: string
    requestDate?: string
    notes?: string | null
  }): Promise<LibraryRequestRecord> {
    const requests = this.ensureBookRequests()
    const timestamp = new Date().toISOString()

    const [datePart] = timestamp.split("T")

    const request: LibraryRequestRecord = {
      id: this.generateId("request"),
      bookId: payload.bookId ?? null,
      bookTitle: payload.bookTitle,
      studentId: payload.studentId,
      studentName: payload.studentName,
      studentClass: payload.studentClass,
      requestDate: payload.requestDate ?? datePart ?? timestamp,
      status: "pending",
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      fulfilledBy: null,
      fulfilledAt: null,
      notes: payload.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    requests.push(request)
    this.persistBookRequests(requests)
    this.triggerEvent("libraryRequestUpdated", { action: "created", request })
    return this.deepClone(request)
  }

  async updateBookRequest(
    requestId: string,
    updates: Partial<LibraryRequestRecord> & { status?: LibraryRequestStatus },
  ): Promise<LibraryRequestRecord> {
    const requests = this.ensureBookRequests()
    const index = requests.findIndex((request) => request.id === requestId)

    if (index === -1) {
      throw new Error("Request not found")
    }

    const existing = requests[index]!
    const previousStatus = existing.status
    const timestamp = new Date().toISOString()

    const updated = { ...existing, ...updates, updatedAt: timestamp } as LibraryRequestRecord

    if (updates.status === "approved" && previousStatus !== "approved") {
      updated.approvedBy = updates.approvedBy ?? updated.approvedBy ?? null
      updated.approvedDate = updates.approvedDate ?? timestamp
      updated.rejectedBy = null
      updated.rejectedDate = null

      const borrowRecord = this.issueBookFromRequest(updated, {
        issuedBy: updates.approvedBy ?? updated.approvedBy ?? null,
        notes: updates.notes ?? updated.notes ?? null,
      })

      updated.fulfilledBy = borrowRecord.issuedBy
      updated.fulfilledAt = timestamp
    }

    if (updates.status === "rejected" && previousStatus !== "rejected") {
      updated.rejectedBy = updates.rejectedBy ?? updated.rejectedBy ?? null
      updated.rejectedDate = updates.rejectedDate ?? timestamp
      updated.approvedBy = null
      updated.approvedDate = null
    }

    if (updates.status === "fulfilled") {
      updated.fulfilledBy = updates.fulfilledBy ?? updated.fulfilledBy ?? null
      updated.fulfilledAt = updates.fulfilledAt ?? timestamp
    }

    requests[index] = updated
    this.persistBookRequests(requests)
    this.triggerEvent("libraryRequestUpdated", { action: "updated", request: updated })
    return this.deepClone(updated)
  }

  addEventListener(key: string, callback: Function) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key)!.push(callback)
  }

  removeEventListener(key: string, callback?: Function) {
    if (callback) {
      const callbacks = this.listeners.get(key)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    } else {
      // Remove all listeners for this key
      this.listeners.delete(key)
    }
  }

  removeAllEventListeners() {
    this.listeners.clear()
  }

  on(event: string, callback: Function) {
    this.addEventListener(event, callback)
  }

  off(event: string, callback?: Function) {
    this.removeEventListener(event, callback)
  }

  emit(event: string, data?: any) {
    this.triggerEvent(event, data)
  }

  triggerEvent(key: string, data: any) {
    this.notifyListeners(key, data)

    // Also trigger storage event for cross-tab communication
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: JSON.stringify(data),
            storageArea: localStorage,
          }),
        )
      } catch (error) {
        console.error("[v0] Error dispatching storage event:", error)
      }
    }
  }

  private notifyListeners(key: string, data: any) {
    const callbacks = this.listeners.get(key)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  private getData(key: string): any[] {
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  private setData(key: string, data: any[]): void {
    safeStorage.setItem(key, JSON.stringify(data))
  }

  // Financial Methods
  getFeeCollection(): any[] {
    const key = "feeCollection"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  getClassWiseCollection(): any[] {
    const key = "classWiseCollection"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  getExpenseTracking(): any[] {
    const key = "expenseTracking"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  private parseFinancialAnalyticsSnapshot(): FinancialAnalyticsSnapshot | null {
    const stored = safeStorage.getItem("financialAnalytics")
    if (!stored) {
      return null
    }

    try {
      const parsed = JSON.parse(stored) as FinancialAnalyticsSnapshot
      if (!parsed || typeof parsed !== "object" || !parsed.periods) {
        return null
      }
      return parsed
    } catch (error) {
      console.error("Error parsing financial analytics snapshot:", error)
      return null
    }
  }

  private getFinancialAnalyticsPeriod(period: string): FinancialAnalyticsPeriod | null {
    const snapshot = this.parseFinancialAnalyticsSnapshot()
    if (!snapshot) {
      return null
    }

    const key = normaliseFinancialPeriodKey(period)
    const resolved = snapshot.periods?.[key]
    return resolved ?? null
  }

  async syncFinancialAnalytics(payments: unknown[]) {
    try {
      const normalised = payments
        .map((payment) => normalisePaymentForAnalytics(payment))
        .filter((payment): payment is AnalyticsPayment => Boolean(payment))

      const snapshot = calculateFinancialAnalytics(normalised)
      safeStorage.setItem("financialAnalytics", JSON.stringify(snapshot))
      this.triggerEvent("financialAnalyticsUpdated", snapshot)
      return snapshot
    } catch (error) {
      console.error("Error syncing financial analytics:", error)
      throw error
    }
  }

  async getFeeCollectionData(period: string) {
    try {
      const analytics = this.getFinancialAnalyticsPeriod(period)
      if (analytics?.feeCollection) {
        return analytics.feeCollection
      }

      const key = `feeCollection_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : [
            { month: "Jan", collected: 2500000, expected: 3000000, percentage: 83.3 },
            { month: "Feb", collected: 2800000, expected: 3000000, percentage: 93.3 },
            { month: "Mar", collected: 2200000, expected: 3000000, percentage: 73.3 },
            { month: "Apr", collected: 2900000, expected: 3000000, percentage: 96.7 },
          ]
    } catch (error) {
      console.error("Error getting fee collection data:", error)
      return []
    }
  }

  async getClassWiseCollection(period: string, classFilter: string) {
    try {
      const analytics = this.getFinancialAnalyticsPeriod(period)
      if (analytics?.classCollection) {
        const baseCollection = analytics.classCollection
        if (classFilter && classFilter !== "all") {
          return baseCollection.filter((item) => item.class === classFilter)
        }
        return baseCollection
      }

      const key = `classCollection_${period}`
      const data = safeStorage.getItem(key)
      let classData = data
        ? JSON.parse(data)
        : [
            { class: "JSS 1", collected: 850000, expected: 900000, students: 45, percentage: 94.4 },
            { class: "JSS 2", collected: 780000, expected: 900000, students: 42, percentage: 86.7 },
            { class: "JSS 3", collected: 920000, expected: 950000, students: 48, percentage: 96.8 },
            { class: "SS 1", collected: 1200000, expected: 1300000, students: 38, percentage: 92.3 },
            { class: "SS 2", collected: 1100000, expected: 1200000, students: 35, percentage: 91.7 },
            { class: "SS 3", collected: 980000, expected: 1100000, students: 32, percentage: 89.1 },
          ]

      if (classFilter && classFilter !== "all") {
        classData = classData.filter((item: any) => item.class === classFilter)
      }

      return classData
    } catch (error) {
      console.error("Error getting class-wise collection:", error)
      return []
    }
  }

  async getExpenseData(period: string) {
    try {
      const key = `expenses_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : [
            { category: "Staff Salaries", amount: 1500000, percentage: 45 },
            { category: "Utilities", amount: 300000, percentage: 9 },
            { category: "Maintenance", amount: 200000, percentage: 6 },
            { category: "Supplies", amount: 400000, percentage: 12 },
            { category: "Transport", amount: 250000, percentage: 7.5 },
            { category: "Others", amount: 683333, percentage: 20.5 },
          ]
    } catch (error) {
      console.error("Error getting expense data:", error)
      return []
    }
  }

  async getFeeDefaulters() {
    const snapshot = this.parseFinancialAnalyticsSnapshot()
    if (snapshot?.defaulters) {
      return snapshot.defaulters
    }

    const data = safeStorage.getItem("feeDefaulters")
    return data ? JSON.parse(data) : []
  }

  async getFinancialSummary(period: string) {
    try {
      const analytics = this.getFinancialAnalyticsPeriod(period)
      if (analytics?.summary) {
        return analytics.summary
      }

      const key = `financialSummary_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : {
            totalCollected: 10400000,
            collectionRate: 87.3,
            studentsPaid: 240,
            defaultersCount: 15,
            outstandingAmount: 1500000,
            avgCollectionTime: 15,
            onTimePaymentRate: 94.2,
          }
    } catch (error) {
      console.error("Error getting financial summary:", error)
      return {
        totalCollected: 0,
        collectionRate: 0,
        studentsPaid: 0,
        defaultersCount: 0,
        outstandingAmount: 0,
        avgCollectionTime: 0,
        onTimePaymentRate: 0,
      }
    }
  }

  getFinancialSummary(): any {
    const analytics = this.getFinancialAnalyticsPeriod("current-term")
    if (analytics?.summary) {
      return analytics.summary
    }

    const key = "financialSummary"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : {}
  }

  async saveFinancialReport(reportData: any) {
    try {
      const reports = await this.getAllFinancialReports()
      const newReport = {
        ...reportData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      reports.push(newReport)
      safeStorage.setItem("financialReports", JSON.stringify(reports))
      this.triggerEvent("financialReportSaved", newReport)
      return newReport
    } catch (error) {
      console.error("Error saving financial report:", error)
      throw error
    }
  }

  saveFinancialReport(report: any): void {
    const reports = this.getFinancialReports()
    reports.push({
      ...report,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    })
    safeStorage.setItem("financialReports", JSON.stringify(reports))
    this.emit("financialReportSaved", report)
  }

  async getAllFinancialReports() {
    const reports = safeStorage.getItem("financialReports")
    return reports ? JSON.parse(reports) : []
  }

  getFinancialReports(): any[] {
    const reports = safeStorage.getItem("financialReports")
    return reports ? JSON.parse(reports) : []
  }

  async sendPaymentReminder(defaulterId: string) {
    try {
      const defaulters = await this.getFeeDefaulters()
      const defaulter = defaulters.find((d: any) => d.id === defaulterId)

      if (defaulter) {
        // Simulate sending reminder
        const reminder = {
          id: Date.now().toString(),
          defaulterId,
          type: "payment_reminder",
          message: `Payment reminder sent to ${defaulter.name} for outstanding amount of ₦${defaulter.amount.toLocaleString()}`,
          sentAt: new Date().toISOString(),
        }

        await this.saveNotification({
          title: "Payment Reminder Sent",
          message: reminder.message,
          type: "financial",
          targetAudience: ["admin", "accountant"],
        })

        this.triggerEvent("paymentReminderSent", reminder)
        return reminder
      }

      throw new Error("Defaulter not found")
    } catch (error) {
      console.error("Error sending payment reminder:", error)
      throw error
    }
  }

  async contactParent(defaulterId: string) {
    try {
      const defaulters = await this.getFeeDefaulters()
      const defaulter = defaulters.find((d: any) => d.id === defaulterId)

      if (defaulter) {
        // Simulate contacting parent
        const contact = {
          id: Date.now().toString(),
          defaulterId,
          type: "parent_contact",
          message: `Parent contact initiated for ${defaulter.name} regarding outstanding fees`,
          contactedAt: new Date().toISOString(),
        }

        await this.saveNotification({
          title: "Parent Contacted",
          message: contact.message,
          type: "financial",
          targetAudience: ["admin", "accountant"],
        })

        this.triggerEvent("parentContacted", contact)
        return contact
      }

      throw new Error("Defaulter not found")
    } catch (error) {
      console.error("Error contacting parent:", error)
      throw error
    }
  }

  async updateFeeCollection(period: string, data: any) {
    try {
      const key = `feeCollection_${period}`
      safeStorage.setItem(key, JSON.stringify(data))
      this.triggerEvent("financialDataUpdated", { period, type: "feeCollection", data })
      return data
    } catch (error) {
      console.error("Error updating fee collection:", error)
      throw error
    }
  }

  async addExpense(period: string, expenseData: any) {
    try {
      const expenses = await this.getExpenseData(period)
      const newExpense = {
        ...expenseData,
        id: Date.now().toString(),
        addedAt: new Date().toISOString(),
      }
      expenses.push(newExpense)

      const key = `expenses_${period}`
      safeStorage.setItem(key, JSON.stringify(expenses))
      this.triggerEvent("expenseAdded", { period, expense: newExpense })
      return newExpense
    } catch (error) {
      console.error("Error adding expense:", error)
      throw error
    }
  }

  async saveUser(userData: any) {
    try {
      const users = await this.getAllUsers()
      const existingIndex = users.findIndex((u) => u.id === userData.id)

      if (existingIndex >= 0) {
        users[existingIndex] = { ...users[existingIndex], ...userData, updatedAt: new Date().toISOString() }
      } else {
        users.push({ ...userData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      }

      safeStorage.setItem("users", JSON.stringify(users))
      this.triggerEvent("userUpdated", userData)

      return userData
    } catch (error) {
      console.error("Error saving user:", error)
      throw error
    }
  }

  async deleteUser(userId: number) {
    try {
      const users = await this.getAllUsers()
      const filteredUsers = users.filter((u) => u.id !== userId)

      safeStorage.setItem("users", JSON.stringify(filteredUsers))
      this.triggerEvent("userDeleted", { userId })

      return true
    } catch (error) {
      console.error("Error deleting user:", error)
      throw error
    }
  }

  async getAllUsers() {
    const users = safeStorage.getItem("users")
    return users
      ? JSON.parse(users)
      : [
          {
            id: 1,
            name: "John Doe",
            email: "john@vea.edu.ng",
            role: "Student",
            status: "Active",
            lastLogin: "2024-03-10",
            class: "JSS 1A",
            admissionNo: "VEA2025001",
          },
          {
            id: 2,
            name: "Jane Smith",
            email: "jane@vea.edu.ng",
            role: "Teacher",
            status: "Active",
            lastLogin: "2024-03-10",
            subjects: ["Mathematics", "Physics"],
          },
          {
            id: 3,
            name: "Mike Johnson",
            email: "mike@vea.edu.ng",
            role: "Parent",
            status: "Active",
            lastLogin: "2024-03-09",
            children: [1],
          },
        ]
  }

  // User Management
  createUser(userData: any): void {
    const users = this.getUsers()
    const newUser = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    users.push(newUser)
    safeStorage.setItem("users", JSON.stringify(users))
    this.emit("userCreated", newUser)
  }

  updateUser(userId: string, userData: any): void {
    const users = this.getUsers()
    const index = users.findIndex((user) => user.id === userId)
    if (index !== -1) {
      users[index] = { ...users[index], ...userData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("users", JSON.stringify(users))
      this.emit("userUpdated", users[index])
    }
  }

  deleteUser(userId: string): void {
    const users = this.getUsers()
    const filteredUsers = users.filter((user) => user.id !== userId)
    safeStorage.setItem("users", JSON.stringify(filteredUsers))
    this.emit("userDeleted", userId)
  }

  getUsers(): any[] {
    const users = safeStorage.getItem("users")
    return users ? JSON.parse(users) : []
  }

  async saveBranding(brandingData: any) {
    try {
      const enhancedBrandingData = {
        ...brandingData,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem("schoolBranding", JSON.stringify(enhancedBrandingData))
      this.triggerEvent("brandingUpdated", enhancedBrandingData)
      return enhancedBrandingData
    } catch (error) {
      console.error("Error saving branding:", error)
      throw error
    }
  }

  // Branding Management
  saveBranding(brandingData: any): void {
    const enhancedBrandingData = {
      ...brandingData,
      updatedAt: new Date().toISOString(),
    }
    safeStorage.setItem("schoolBranding", JSON.stringify(enhancedBrandingData))
    this.emit("brandingUpdated", enhancedBrandingData)
  }

  async getBranding() {
    try {
      const branding = safeStorage.getItem("schoolBranding")
      return branding
        ? JSON.parse(branding)
        : {
            schoolLogo: null,
            headmasterSignature: null,
            schoolAddress:
              "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
            educationZone: "Municipal Education Zone",
            councilArea: "Bwari Area Council",
            contactPhone: "+234 (0) 700-832-2025",
            contactEmail: "info@victoryacademy.edu.ng",
            headmasterName: "Dr. Emmanuel Adebayo",
            defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
            logoUrl: "",
            signatureUrl: "",
          }
    } catch (error) {
      console.error("Error getting branding:", error)
      return null
    }
  }

  getBranding(): any {
    const branding = safeStorage.getItem("schoolBranding")
    return branding ? JSON.parse(branding) : {}
  }

  async saveReportCard(reportData: any) {
    try {
      const reportCards = await this.getAllReportCards()
      const existingIndex = reportCards.findIndex((r) => r.studentId === reportData.studentId)

      const enhancedReportData = {
        ...reportData,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }

      if (existingIndex >= 0) {
        reportCards[existingIndex] = enhancedReportData
      } else {
        reportCards.push(enhancedReportData)
      }

      safeStorage.setItem("reportCards", JSON.stringify(reportCards))
      this.triggerEvent("reportCardUpdated", enhancedReportData)

      return enhancedReportData
    } catch (error) {
      console.error("Error saving report card:", error)
      throw error
    }
  }

  // Report Card Management
  saveReportCard(reportCardData: any): void {
    const reportCards = this.getReportCards()
    const existingIndex = reportCards.findIndex(
      (rc) => rc.studentId === reportCardData.studentId && rc.term === reportCardData.term,
    )

    if (existingIndex !== -1) {
      reportCards[existingIndex] = { ...reportCards[existingIndex], ...reportCardData }
    } else {
      reportCards.push({ ...reportCardData, id: Date.now().toString() })
    }

    safeStorage.setItem("reportCards", JSON.stringify(reportCards))
    this.emit("reportCardSaved", reportCardData)
  }

  async getAllReportCards() {
    const reportCards = safeStorage.getItem("reportCards")
    return reportCards ? JSON.parse(reportCards) : []
  }

  getReportCards(): any[] {
    const reportCards = safeStorage.getItem("reportCards")
    return reportCards ? JSON.parse(reportCards) : []
  }

  async getReportCard(studentId: string) {
    const reportCards = await this.getAllReportCards()
    return reportCards.find((r: any) => r.studentId === studentId) || null
  }

  async getSystemHealth() {
    return {
      database: "healthy",
      paymentGateway: "online",
      emailService: "active",
      cpuUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
      memoryUsage: Math.floor(Math.random() * 20) + 50, // 50-70%
      uptime: "99.9%",
      lastChecked: new Date().toISOString(),
    }
  }

  async saveTeacherData(teacherId: string, dataType: string, data: any) {
    try {
      const key = `teacher_${teacherId}_${dataType}`
      const enhancedData = {
        ...data,
        teacherId,
        dataType,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem(key, JSON.stringify(enhancedData))
      this.triggerEvent(`teacherDataUpdated_${dataType}`, { teacherId, data: enhancedData })
      return enhancedData
    } catch (error) {
      console.error("Error saving teacher data:", error)
      throw error
    }
  }

  // Teacher Data Management
  saveTeacherData(key: string, data: any): void {
    const enhancedData = {
      ...data,
      savedAt: new Date().toISOString(),
    }
    safeStorage.setItem(key, JSON.stringify(enhancedData))
    this.emit("teacherDataSaved", { key, data: enhancedData })
  }

  async getTeacherData(teacherId: string, dataType: string) {
    try {
      const key = `teacher_${teacherId}_${dataType}`
      const data = safeStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Error getting teacher data:", error)
      return null
    }
  }

  getTeacherData(key: string): any {
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }

  async getAllTeacherData() {
    const teacherData = safeStorage.getItem("teacherData")
    return teacherData ? JSON.parse(teacherData) : {}
  }

  getAllTeacherData(): any {
    const teacherData = safeStorage.getItem("teacherData")
    return teacherData ? JSON.parse(teacherData) : {}
  }

  async saveMessage(messageData: any) {
    try {
      const messages = await this.getAllMessages()
      const newMessage = {
        ...messageData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: "sent",
        reactions: [],
        attachments: messageData.attachments || [],
      }

      messages.push(newMessage)
      safeStorage.setItem("messages", JSON.stringify(messages))
      this.triggerEvent("messageReceived", newMessage)

      return newMessage
    } catch (error) {
      console.error("Error saving message:", error)
      throw error
    }
  }

  // Messaging System
  saveMessage(message: any): void {
    const messages = this.getMessages()
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    }
    messages.push(newMessage)
    safeStorage.setItem("messages", JSON.stringify(messages))
    this.emit("messageSaved", newMessage)
  }

  async getAllMessages() {
    const messages = safeStorage.getItem("messages")
    return messages ? JSON.parse(messages) : []
  }

  getMessages(): any[] {
    const messages = safeStorage.getItem("messages")
    return messages ? JSON.parse(messages) : []
  }

  async getMessagesByConversation(participants: string[]) {
    const allMessages = await this.getAllMessages()
    return allMessages.filter((msg: any) => participants.every((p) => [msg.senderId, msg.receiverId].includes(p)))
  }

  async saveApprovalStatus(studentId: string, status: string, feedback?: string, adminId?: string) {
    try {
      const approvals = await this.getAllApprovals()
      const key = `approval_${studentId}`

      approvals[key] = {
        studentId,
        status,
        feedback: feedback || "",
        adminId: adminId || "system",
        updatedAt: new Date().toISOString(),
        history: approvals[key]?.history || [],
      }

      // Add to history
      approvals[key].history.push({
        status,
        feedback,
        adminId,
        timestamp: new Date().toISOString(),
      })

      safeStorage.setItem("reportCardApprovals", JSON.stringify(approvals))
      this.triggerEvent("approvalStatusUpdated", { studentId, status, feedback })

      return approvals[key]
    } catch (error) {
      console.error("Error saving approval status:", error)
      throw error
    }
  }

  // Approval Workflow
  saveApprovalWorkflow(approval: any): void {
    const approvals = this.getApprovalWorkflows()
    approvals.push({
      ...approval,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    })
    safeStorage.setItem("reportCardApprovals", JSON.stringify(approvals))
    this.emit("approvalSaved", approval)
  }

  async getAllApprovals() {
    const approvals = safeStorage.getItem("reportCardApprovals")
    return approvals ? JSON.parse(approvals) : {}
  }

  getApprovalWorkflows(): any[] {
    const approvals = safeStorage.getItem("reportCardApprovals")
    return approvals ? JSON.parse(approvals) : []
  }

  async getApprovalStatus(studentId: string) {
    const approvals = await this.getAllApprovals()
    return approvals[`approval_${studentId}`] || null
  }

  async saveSystemSettings(settings: any) {
    try {
      const enhancedSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem("systemSettings", JSON.stringify(enhancedSettings))
      this.triggerEvent("settingsUpdated", enhancedSettings)
      return enhancedSettings
    } catch (error) {
      console.error("Error saving system settings:", error)
      throw error
    }
  }

  // System Settings
  saveSystemSettings(settings: any): void {
    const enhancedSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    safeStorage.setItem("systemSettings", JSON.stringify(enhancedSettings))
    this.emit("systemSettingsUpdated", enhancedSettings)
  }

  async getSystemSettings() {
    try {
      const settings = safeStorage.getItem("systemSettings")
      return settings
        ? JSON.parse(settings)
        : {
            academicYear: "2024/2025",
            currentTerm: "First Term",
            reportCardDeadline: "",
            schoolName: "Victory Educational Academy",
            schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
          }
    } catch (error) {
      console.error("Error getting system settings:", error)
      return null
    }
  }

  getSystemSettings(): any {
    const settings = safeStorage.getItem("systemSettings")
    return settings ? JSON.parse(settings) : {}
  }

  async getAllClasses() {
    const classes = safeStorage.getItem("classes")
    return classes
      ? JSON.parse(classes)
      : [
          "JSS 1A",
          "JSS 1B",
          "JSS 1C",
          "JSS 2A",
          "JSS 2B",
          "JSS 2C",
          "JSS 3A",
          "JSS 3B",
          "JSS 3C",
          "SS 1A",
          "SS 1B",
          "SS 1C",
          "SS 2A",
          "SS 2B",
          "SS 2C",
          "SS 3A",
          "SS 3B",
          "SS 3C",
        ]
  }

  // Class Management
  getClasses(): any[] {
    const classes = safeStorage.getItem("classes")
    return classes
      ? JSON.parse(classes)
      : [
          { id: "1", name: "JSS1A", students: 25, teacher: "Mrs. Johnson" },
          { id: "2", name: "JSS1B", students: 23, teacher: "Mr. Smith" },
          { id: "3", name: "JSS2A", students: 27, teacher: "Mrs. Brown" },
          { id: "4", name: "JSS2B", students: 24, teacher: "Mr. Davis" },
          { id: "5", name: "JSS3A", students: 26, teacher: "Mrs. Wilson" },
        ]
  }

  async addClass(className: string) {
    try {
      const classes = await this.getAllClasses()
      if (!classes.includes(className)) {
        classes.push(className)
        safeStorage.setItem("classes", JSON.stringify(classes))
        this.triggerEvent("classAdded", { className })
      }
      return classes
    } catch (error) {
      console.error("Error adding class:", error)
      throw error
    }
  }

  createClass(classData: any): void {
    const classes = this.getClasses()
    const newClass = {
      ...classData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    classes.push(newClass)
    safeStorage.setItem("classes", JSON.stringify(classes))
    this.emit("classCreated", newClass)
  }

  async deleteClass(className: string) {
    try {
      const classes = await this.getAllClasses()
      const filteredClasses = classes.filter((c: string) => c !== className)
      safeStorage.setItem("classes", JSON.stringify(filteredClasses))
      this.triggerEvent("classDeleted", { className })
      return filteredClasses
    } catch (error) {
      console.error("Error deleting class:", error)
      throw error
    }
  }

  updateClass(classId: string, classData: any): void {
    const classes = this.getClasses()
    const index = classes.findIndex((cls) => cls.id === classId)
    if (index !== -1) {
      classes[index] = { ...classes[index], ...classData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("classes", JSON.stringify(classes))
      this.emit("classUpdated", classes[index])
    }
  }

  deleteClass(classId: string): void {
    const classes = this.getClasses()
    const filteredClasses = classes.filter((cls) => cls.id !== classId)
    safeStorage.setItem("classes", JSON.stringify(filteredClasses))
    this.emit("classDeleted", classId)
  }

  async savePayment(paymentData: any) {
    try {
      const payments = await this.getAllPayments()
      const newPayment = {
        ...paymentData,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: "completed",
      }
      payments.push(newPayment)
      safeStorage.setItem("payments", JSON.stringify(payments))
      this.triggerEvent("paymentCompleted", newPayment)
      return newPayment
    } catch (error) {
      console.error("Error saving payment:", error)
      throw error
    }
  }

  async getAllPayments() {
    const payments = safeStorage.getItem("payments")
    return payments ? JSON.parse(payments) : []
  }

  async getPayments() {
    try {
      const payments = safeStorage.getItem("payments")
      return payments
        ? JSON.parse(payments)
        : [
            {
              id: "1",
              studentName: "John Doe",
              parentName: "Jane Doe",
              amount: 50000,
              status: "paid",
              method: "online",
              date: "2025-01-08",
              reference: "PAY_123456789",
              hasAccess: true,
            },
            {
              id: "2",
              studentName: "Alice Smith",
              parentName: "Bob Smith",
              amount: 50000,
              status: "pending",
              method: "offline",
              date: "2025-01-07",
              hasAccess: false,
            },
            {
              id: "3",
              studentName: "Michael Johnson",
              parentName: "Sarah Johnson",
              amount: 50000,
              status: "failed",
              method: "online",
              date: "2025-01-06",
              reference: "PAY_987654321",
              hasAccess: false,
            },
          ]
    } catch (error) {
      console.error("Error getting payments:", error)
      return []
    }
  }

  async updatePaymentAccess(paymentId: string, hasAccess: boolean) {
    try {
      const payments = await this.getPayments()
      const updatedPayments = payments.map((payment: any) =>
        payment.id === paymentId ? { ...payment, hasAccess, status: hasAccess ? "paid" : payment.status } : payment,
      )
      safeStorage.setItem("payments", JSON.stringify(updatedPayments))
      this.triggerEvent("paymentsUpdated", updatedPayments)
      return updatedPayments.find((p: any) => p.id === paymentId)
    } catch (error) {
      console.error("Error updating payment access:", error)
      throw error
    }
  }

  async createPayment(paymentData: any) {
    try {
      const payments = await this.getPayments()
      const newPayment = {
        ...paymentData,
        id: Date.now().toString(),
        date: new Date().toISOString().split("T")[0],
        hasAccess: paymentData.status === "paid",
      }
      payments.push(newPayment)
      safeStorage.setItem("payments", JSON.stringify(payments))
      this.triggerEvent("paymentsUpdated", payments)
      return newPayment
    } catch (error) {
      console.error("Error creating payment:", error)
      throw error
    }
  }

  async updatePaymentStatus(paymentId: string, status: "paid" | "pending" | "failed") {
    try {
      const payments = await this.getPayments()
      const updatedPayments = payments.map((payment: any) =>
        payment.id === paymentId ? { ...payment, status, hasAccess: status === "paid" } : payment,
      )
      safeStorage.setItem("payments", JSON.stringify(updatedPayments))
      this.triggerEvent("paymentsUpdated", updatedPayments)
      return updatedPayments.find((p: any) => p.id === paymentId)
    } catch (error) {
      console.error("Error updating payment status:", error)
      throw error
    }
  }

  async saveNotification(notificationData: any) {
    try {
      const notifications = await this.getAllNotifications()
      const newNotification = {
        ...notificationData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      }
      notifications.push(newNotification)
      safeStorage.setItem("notifications", JSON.stringify(notifications))
      this.triggerEvent("notificationReceived", newNotification)
      return newNotification
    } catch (error) {
      console.error("Error saving notification:", error)
      throw error
    }
  }

  // Notification System
  createNotification(notification: any): void {
    const notifications = this.getNotifications()
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    notifications.push(newNotification)
    safeStorage.setItem("notifications", JSON.stringify(notifications))
    this.emit("notificationCreated", newNotification)
  }

  async getAllNotifications() {
    const notifications = safeStorage.getItem("notifications")
    return notifications ? JSON.parse(notifications) : []
  }

  getNotifications(): any[] {
    const notifications = safeStorage.getItem("notifications")
    return notifications ? JSON.parse(notifications) : []
  }

  async markNotificationAsRead(notificationId: string) {
    try {
      const notifications = await this.getAllNotifications()
      const notification = notifications.find((n: any) => n.id === notificationId)
      if (notification) {
        notification.read = true
        safeStorage.setItem("notifications", JSON.stringify(notifications))
        this.triggerEvent("notificationRead", { notificationId })
      }
      return notification
    } catch (error) {
      console.error("Error marking notification as read:", error)
      throw error
    }
  }

  async deleteNotification(notificationId: string) {
    try {
      const notifications = await this.getAllNotifications()
      const index = notifications.findIndex((notification: any) => notification.id === notificationId)

      if (index === -1) {
        return false
      }

      const [removed] = notifications.splice(index, 1)
      safeStorage.setItem("notifications", JSON.stringify(notifications))
      this.triggerEvent("notificationDeleted", { notificationId, notification: removed })

      return true
    } catch (error) {
      console.error("Error deleting notification:", error)
      throw error
    }
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.getNotifications()
    const index = notifications.findIndex((n) => n.id === notificationId)
    if (index !== -1) {
      notifications[index].read = true
      safeStorage.setItem("notifications", JSON.stringify(notifications))
      this.emit("notificationRead", notifications[index])
    }
  }

  async syncData() {
    try {
      // Trigger sync events for all data types
      const dataTypes = [
        "users",
        "reportCards",
        "messages",
        "approvals",
        "branding",
        "systemSettings",
        "classes",
        "payments",
        "notifications",
      ]

      for (const dataType of dataTypes) {
        this.triggerEvent(`${dataType}Synced`, { timestamp: new Date().toISOString() })
      }

      return true
    } catch (error) {
      console.error("Error syncing data:", error)
      throw error
    }
  }

  async validateData() {
    try {
      const validationResults = {
        users: await this.validateUsers(),
        reportCards: await this.validateReportCards(),
        systemHealth: await this.getSystemHealth(),
      }

      this.triggerEvent("dataValidated", validationResults)
      return validationResults
    } catch (error) {
      console.error("Error validating data:", error)
      throw error
    }
  }

  private async validateUsers() {
    const users = await this.getAllUsers()
    return {
      total: users.length,
      valid: users.filter((u: any) => u.name && u.email && u.role).length,
      invalid: users.filter((u: any) => !u.name || !u.email || !u.role).length,
    }
  }

  private async validateReportCards() {
    const reportCards = await this.getAllReportCards()
    return {
      total: reportCards.length,
      valid: reportCards.filter((r: any) => r.studentId && r.marks).length,
      invalid: reportCards.filter((r: any) => !r.studentId || !r.marks).length,
    }
  }

  async getNotices() {
    const notices = safeStorage.getItem("notices")
    return notices ? JSON.parse(notices) : []
  }

  async createNotice(noticeData: any) {
    try {
      const notices = await this.getNotices()
      const newNotice = {
        ...noticeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      notices.unshift(newNotice) // Add to beginning for chronological order
      safeStorage.setItem("notices", JSON.stringify(notices))
      this.triggerEvent("noticeCreated", newNotice)
      return newNotice
    } catch (error) {
      console.error("Error creating notice:", error)
      throw error
    }
  }

  // Notice Management
  getNotices(): any[] {
    const notices = safeStorage.getItem("notices")
    return notices ? JSON.parse(notices) : []
  }

  async updateNotice(noticeId: string, updateData: any) {
    try {
      const notices = await this.getNotices()
      const index = notices.findIndex((n: any) => n.id === noticeId)
      if (index > -1) {
        notices[index] = {
          ...notices[index],
          ...updateData,
          updatedAt: new Date().toISOString(),
        }
        safeStorage.setItem("notices", JSON.stringify(notices))
        this.triggerEvent("noticeUpdated", notices[index])
        return notices[index]
      }
      throw new Error("Notice not found")
    } catch (error) {
      console.error("Error updating notice:", error)
      throw error
    }
  }

  createNotice(noticeData: any): void {
    const notices = this.getNotices()
    const newNotice = {
      ...noticeData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    notices.push(newNotice)
    safeStorage.setItem("notices", JSON.stringify(notices))
    this.emit("noticeCreated", newNotice)
  }

  updateNotice(noticeId: string, noticeData: any): void {
    const notices = this.getNotices()
    const index = notices.findIndex((notice) => notice.id === noticeId)
    if (index !== -1) {
      notices[index] = { ...notices[index], ...noticeData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("notices", JSON.stringify(notices))
      this.emit("noticeUpdated", notices[index])
    }
  }

  async deleteNotice(noticeId: string) {
    try {
      const notices = await this.getNotices()
      const filteredNotices = notices.filter((n: any) => n.id !== noticeId)
      safeStorage.setItem("notices", JSON.stringify(filteredNotices))
      this.triggerEvent("noticeDeleted", { noticeId })
      return true
    } catch (error) {
      console.error("Error deleting notice:", error)
      throw error
    }
  }

  deleteNotice(noticeId: string): void {
    const notices = this.getNotices()
    const filteredNotices = notices.filter((notice) => notice.id !== noticeId)
    safeStorage.setItem("notices", JSON.stringify(filteredNotices))
    this.emit("noticeDeleted", noticeId)
  }

  async getNoticesByAudience(audience: string) {
    try {
      const notices = await this.getNotices()
      return notices.filter((notice: any) => notice.targetAudience.includes(audience) || audience === "admin")
    } catch (error) {
      console.error("Error getting notices by audience:", error)
      return []
    }
  }

  async getPinnedNotices(audience?: string) {
    try {
      const notices = await this.getNotices()
      let filteredNotices = notices.filter((notice: any) => notice.isPinned)

      if (audience && audience !== "admin") {
        filteredNotices = filteredNotices.filter((notice: any) => notice.targetAudience.includes(audience))
      }

      return filteredNotices
    } catch (error) {
      console.error("Error getting pinned notices:", error)
      return []
    }
  }

  async getAcademicAnalytics(term = "current", classFilter = "all") {
    try {
      // Get all teacher data and report cards
      const teacherData = await this.getAllTeacherData()
      const reportCards = await this.getAllReportCards()
      const users = await this.getAllUsers()

      // Calculate class performance
      const classPerformance = this.calculateClassPerformance(teacherData, reportCards, classFilter)

      // Calculate subject performance
      const subjectPerformance = this.calculateSubjectPerformance(teacherData, classFilter)

      // Calculate term comparison
      const termComparison = this.calculateTermComparison(teacherData, term)

      // Get top performers
      const topPerformers = this.getTopPerformers(teacherData, reportCards, users, classFilter)

      // Generate radar chart data
      const performanceRadarData = this.generateRadarData(subjectPerformance)

      // Calculate summary statistics
      const summaryStats = this.calculateSummaryStats(classPerformance, teacherData)

      return {
        classPerformance,
        subjectPerformance,
        termComparison,
        topPerformers,
        performanceRadarData,
        summaryStats,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error getting academic analytics:", error)
      return {
        classPerformance: [],
        subjectPerformance: [],
        termComparison: [],
        topPerformers: [],
        performanceRadarData: [],
        summaryStats: {
          overallAverage: 0,
          totalStudents: 0,
          passRate: 0,
          excellenceRate: 0,
        },
      }
    }
  }

  private calculateClassPerformance(teacherData: any[], reportCards: any[], classFilter: string) {
    const classMap = new Map()

    // Process teacher marks data
    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      if (data.marks) {
        Object.entries(data.marks).forEach(([studentId, marks]: [string, any]) => {
          const studentClass = this.getStudentClass(studentId)
          if (classFilter === "all" || this.matchesClassFilter(studentClass, classFilter)) {
            if (!classMap.has(studentClass)) {
              classMap.set(studentClass, { scores: [], students: new Set() })
            }

            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100

            classMap.get(studentClass).scores.push(percentage)
            classMap.get(studentClass).students.add(studentId)
          }
        })
      }
    })

    return Array.from(classMap.entries()).map(([className, data]: [string, any]) => {
      const scores = data.scores
      const average = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
      const topScore = scores.length > 0 ? Math.max(...scores) : 0
      const lowScore = scores.length > 0 ? Math.min(...scores) : 0

      return {
        class: className,
        average: Math.round(average * 10) / 10,
        students: data.students.size,
        topScore: Math.round(topScore),
        lowScore: Math.round(lowScore),
      }
    })
  }

  private calculateSubjectPerformance(teacherData: any[], classFilter: string) {
    const subjectMap = new Map()

    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      const [className, subject] = key.split("-")

      if (classFilter === "all" || this.matchesClassFilter(className, classFilter)) {
        if (data.marks) {
          const scores: number[] = []

          Object.values(data.marks).forEach((marks: any) => {
            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100
            scores.push(percentage)
          })

          if (scores.length > 0) {
            const average = scores.reduce((a, b) => a + b, 0) / scores.length
            const passCount = scores.filter((score) => score >= 50).length
            const excellentCount = scores.filter((score) => score >= 80).length

            if (!subjectMap.has(subject)) {
              subjectMap.set(subject, {
                subject,
                scores: [],
                passCount: 0,
                excellentCount: 0,
                totalStudents: 0,
                teacher: data.teacherName || "Unknown",
              })
            }

            const subjectData = subjectMap.get(subject)
            subjectData.scores.push(...scores)
            subjectData.passCount += passCount
            subjectData.excellentCount += excellentCount
            subjectData.totalStudents += scores.length
          }
        }
      }
    })

    return Array.from(subjectMap.values()).map((data: any) => ({
      subject: data.subject,
      average: Math.round((data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length) * 10) / 10,
      passRate: Math.round((data.passCount / data.totalStudents) * 100),
      excellentRate: Math.round((data.excellentCount / data.totalStudents) * 100),
      teacher: data.teacher,
    }))
  }

  private calculateTermComparison(teacherData: any[], currentTerm: string) {
    // Simulate term comparison data based on current data
    const currentAverage = this.calculateOverallAverage(teacherData)

    return [
      { term: "First Term", average: Math.max(currentAverage - 5, 70), passRate: 85, attendance: 92 },
      { term: "Second Term", average: Math.max(currentAverage - 2, 75), passRate: 88, attendance: 89 },
      { term: "Third Term", average: currentAverage, passRate: 91, attendance: 94 },
    ]
  }

  private getTopPerformers(teacherData: any[], reportCards: any[], users: any[], classFilter: string) {
    const studentPerformance = new Map()

    // Calculate student averages from teacher data
    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      if (data.marks) {
        Object.entries(data.marks).forEach(([studentId, marks]: [string, any]) => {
          const studentClass = this.getStudentClass(studentId)
          if (classFilter === "all" || this.matchesClassFilter(studentClass, classFilter)) {
            if (!studentPerformance.has(studentId)) {
              studentPerformance.set(studentId, { scores: [], subjects: 0, class: studentClass })
            }

            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100

            studentPerformance.get(studentId).scores.push(percentage)
            studentPerformance.get(studentId).subjects++
          }
        })
      }
    })

    // Calculate averages and sort
    const performers = Array.from(studentPerformance.entries())
      .map(([studentId, data]: [string, any]) => {
        const average = data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length
        const student = users.find((u: any) => u.id === studentId)

        return {
          name: student?.name || `Student ${studentId}`,
          class: data.class,
          average: Math.round(average * 10) / 10,
          subjects: data.subjects,
        }
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5)

    return performers
  }

  private generateRadarData(subjectPerformance: any[]) {
    return subjectPerformance.slice(0, 6).map((subject) => ({
      subject: subject.subject,
      A: subject.average,
      B: Math.max(subject.average - 5, 60), // Simulate previous term data
    }))
  }

  private calculateSummaryStats(classPerformance: any[], teacherData: any[]) {
    const totalStudents = classPerformance.reduce((sum, cls) => sum + cls.students, 0)
    const overallAverage =
      classPerformance.length > 0
        ? classPerformance.reduce((sum, cls) => sum + cls.average * cls.students, 0) / totalStudents
        : 0

    // Calculate pass rate and excellence rate from all scores
    const totalScores: number[] = []
    Object.values(teacherData).forEach((data: any) => {
      if (data.marks) {
        Object.values(data.marks).forEach((marks: any) => {
          const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
          const percentage = (total / (marks.totalObtainable || 100)) * 100
          totalScores.push(percentage)
        })
      }
    })

    const passCount = totalScores.filter((score) => score >= 50).length
    const excellentCount = totalScores.filter((score) => score >= 80).length
    const passRate = totalScores.length > 0 ? (passCount / totalScores.length) * 100 : 0
    const excellenceRate = totalScores.length > 0 ? (excellentCount / totalScores.length) * 100 : 0

    return {
      overallAverage: Math.round(overallAverage * 10) / 10,
      totalStudents,
      passRate: Math.round(passRate * 10) / 10,
      excellenceRate: Math.round(excellenceRate * 10) / 10,
    }
  }

  private calculateOverallAverage(teacherData: any[]) {
    const totalScores: number[] = []

    Object.values(teacherData).forEach((data: any) => {
      if (data.marks) {
        Object.values(data.marks).forEach((marks: any) => {
          const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
          const percentage = (total / (marks.totalObtainable || 100)) * 100
          totalScores.push(percentage)
        })
      }
    })

    return totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0
  }

  private getStudentClass(studentId: string) {
    // Extract class from student ID or use a default mapping
    const classMapping: { [key: string]: string } = {
      student1: "JSS 1A",
      student2: "JSS 1B",
      student3: "JSS 2A",
      student4: "JSS 2B",
      student5: "JSS 3A",
      student6: "SS 1A",
      student7: "SS 2A",
      student8: "SS 3A",
    }

    return classMapping[studentId] || "JSS 1A"
  }

  private matchesClassFilter(studentClass: string, classFilter: string) {
    if (classFilter === "all") return true

    const filterMap: { [key: string]: string[] } = {
      jss1: ["JSS 1A", "JSS 1B"],
      jss2: ["JSS 2A", "JSS 2B"],
      jss3: ["JSS 3A", "JSS 3B"],
      ss1: ["SS 1A", "SS 1B"],
      ss2: ["SS 2A", "SS 2B"],
      ss3: ["SS 3A", "SS 3B"],
    }

    return filterMap[classFilter]?.includes(studentClass) || false
  }

  private normaliseClassIdentifier(value: unknown): string {
    if (typeof value !== "string") {
      return ""
    }

    return value.replace(/\s+/g, "").toLowerCase()
  }

  private resolveStudentClass(user: any): string | null {
    const candidates = [
      user?.class,
      user?.className,
      user?.classname,
      user?.classroom,
      user?.metadata?.className,
      user?.metadata?.class,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate
      }
    }

    return null
  }

  private normaliseAttendanceRecord(record: any) {
    const present = Number(record?.present ?? record?.presentDays ?? 0)
    const total = Number(record?.total ?? record?.totalDays ?? 0)
    const absent = Number(record?.absent ?? record?.absentDays ?? Math.max(total - present, 0))
    const percentage = Number.isFinite(record?.percentage)
      ? Number(record.percentage)
      : total > 0
        ? Math.round((present / total) * 100)
        : 0

    return {
      presentDays: present,
      totalDays: total,
      absentDays: absent,
      percentage,
      present,
      total,
      absent,
    }
  }

  private deriveAcademicPercentage(record: any): number | null {
    const directValues = [
      record?.totalPercentage,
      record?.percentage,
      record?.total,
      record?.totalScore,
      record?.grandTotal,
    ].filter((value) => typeof value === "number" && Number.isFinite(value)) as number[]

    if (directValues.length > 0) {
      return directValues[0]
    }

    const ca1 = Number(record?.firstCA ?? record?.ca1 ?? 0)
    const ca2 = Number(record?.secondCA ?? record?.ca2 ?? 0)
    const assignment = Number(record?.noteAssignment ?? record?.assignment ?? 0)
    const exam = Number(record?.exam ?? 0)
    const earned = ca1 + ca2 + assignment + exam

    const obtainable = Number(record?.totalObtainable ?? record?.totalMarksObtainable ?? 100)

    if (!Number.isFinite(earned) || earned <= 0) {
      return null
    }

    const safeObtainable = Number.isFinite(obtainable) && obtainable > 0 ? obtainable : 100
    return (earned / safeObtainable) * 100
  }

  private normaliseAcademicRecord(record: any) {
    if (!record) {
      return null
    }

    const subjectCandidate =
      record.subject ?? record.subjectName ?? record.name ?? record.title ?? "Subject"
    const subject = typeof subjectCandidate === "string" ? subjectCandidate : "Subject"
    const percentage = this.deriveAcademicPercentage(record)

    if (percentage === null) {
      return null
    }

    return {
      subject,
      totalPercentage: Math.max(0, Math.min(100, Math.round(percentage))),
    }
  }

  async saveAnalyticsReport(reportData: any) {
    try {
      const reports = await this.getAllAnalyticsReports()
      const newReport = {
        ...reportData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      reports.push(newReport)
      safeStorage.setItem("analyticsReports", JSON.stringify(reports))
      this.triggerEvent("analyticsReportSaved", newReport)
      return newReport
    } catch (error) {
      console.error("Error saving analytics report:", error)
      throw error
    }
  }

  // Academic Analytics
  saveAnalyticsReport(report: any): void {
    const reports = this.getAnalyticsReports()
    reports.push({
      ...report,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    })
    safeStorage.setItem("analyticsReports", JSON.stringify(reports))
    this.emit("analyticsReportSaved", report)
  }

  async getAllAnalyticsReports() {
    const reports = safeStorage.getItem("analyticsReports")
    return reports ? JSON.parse(reports) : []
  }

  getAnalyticsReports(): any[] {
    const reports = safeStorage.getItem("analyticsReports")
    return reports ? JSON.parse(reports) : []
  }

  async getStudentsByClass(className: string) {
    try {
      const users = await this.getAllUsers()
      const target = this.normaliseClassIdentifier(className)

      if (!target) {
        return []
      }

      return users
        .filter((user: any) => {
          const role = typeof user.role === "string" ? user.role.toLowerCase() : ""
          if (role !== "student") {
            return false
          }

          const resolvedClass = this.resolveStudentClass(user)
          if (!resolvedClass) {
            return false
          }

          return this.normaliseClassIdentifier(resolvedClass) === target
        })
        .map((user: any) => ({
          ...user,
          id: String(user.id ?? this.generateId("student")),
          class: this.resolveStudentClass(user) ?? className,
        }))
    } catch (error) {
      console.error("Error getting students by class:", error)
      throw error
    }
  }

  async getStudentAcademicData(studentId: string) {
    try {
      const marksKey = `marks_${studentId}`
      const marks = safeStorage.getItem(marksKey)
      const normalisedRecords: Array<{ subject: string; totalPercentage: number }> = []

      if (marks) {
        try {
          const parsed = JSON.parse(marks)
          const values = Array.isArray(parsed) ? parsed : Object.values(parsed ?? {})
          for (const entry of values) {
            const normalised = this.normaliseAcademicRecord(entry)
            if (normalised) {
              normalisedRecords.push(normalised)
            }
          }
        } catch (error) {
          console.warn("Unable to parse stored academic data", error)
        }
      }

      if (normalisedRecords.length === 0) {
        const examResults = this.ensureExamResults().filter((result) => result.studentId === studentId)
        for (const result of examResults) {
          const normalised = this.normaliseAcademicRecord({
            subject: result.subject,
            total: result.total ?? result.ca1 + result.ca2 + result.assignment + result.exam,
            totalObtainable: 100,
          })
          if (normalised) {
            normalisedRecords.push(normalised)
          }
        }
      }

      if (normalisedRecords.length > 0) {
        return normalisedRecords
      }

      return [
        { subject: "Mathematics", totalPercentage: 75 },
        { subject: "English", totalPercentage: 82 },
        { subject: "Science", totalPercentage: 68 },
        { subject: "Social Studies", totalPercentage: 79 },
        { subject: "French", totalPercentage: 71 },
      ]
    } catch (error) {
      console.error("Error getting student academic data:", error)
      throw error
    }
  }

  async getStudentAttendance(studentId: string) {
    try {
      const attendanceKey = `attendance_${studentId}`
      const attendance = safeStorage.getItem(attendanceKey)

      if (!attendance) {
        // Generate realistic attendance data
        const present = Math.floor(Math.random() * 20) + 160 // 160-180 days
        const total = 180
        const percentage = Math.round((present / total) * 100)

        const attendanceData = this.normaliseAttendanceRecord({
          present,
          total,
          percentage,
          absent: total - present,
        })

        safeStorage.setItem(attendanceKey, JSON.stringify(attendanceData))
        return attendanceData
      }

      const parsed = JSON.parse(attendance)
      const normalised = this.normaliseAttendanceRecord(parsed)
      safeStorage.setItem(attendanceKey, JSON.stringify(normalised))
      return normalised
    } catch (error) {
      console.error("Error getting student attendance:", error)
      return this.normaliseAttendanceRecord({ present: 0, total: 0 })
    }
  }

  // Student Data Management
  getStudentMarks(studentId: string, term: string): any {
    const marksKey = `marks_${studentId}_${term}`
    const marks = safeStorage.getItem(marksKey)
    return marks ? JSON.parse(marks) : null
  }

  async getUpcomingEvents(className: string) {
    try {
      const eventsKey = `events_${className}`
      const events = safeStorage.getItem(eventsKey)

      if (!events) {
        // Generate sample events for the class
        const sampleEvents = [
          {
            id: 1,
            title: "Mathematics Test",
            date: "March 20, 2024",
            description: "Chapter 5-7 coverage",
            type: "exam",
            class: className,
          },
          {
            id: 2,
            title: "Science Fair",
            date: "March 25, 2024",
            description: "Present your science projects",
            type: "event",
            class: className,
          },
          {
            id: 3,
            title: "Parent-Teacher Meeting",
            date: "March 30, 2024",
            description: "Discuss student progress",
            type: "meeting",
            class: className,
          },
        ]

        safeStorage.setItem(eventsKey, JSON.stringify(sampleEvents))
        return sampleEvents
      }

      return JSON.parse(events)
    } catch (error) {
      console.error("Error getting upcoming events:", error)
      throw error
    }
  }

  async getStudentAttendance(studentId: string): any {
    const attendanceKey = `attendance_${studentId}`
    const attendance = safeStorage.getItem(attendanceKey)

    if (!attendance) {
      const present = Math.floor(Math.random() * 20) + 80
      const total = 100
      const attendanceData = this.normaliseAttendanceRecord({
        present,
        total,
        percentage: Math.round((present / total) * 100),
      })
      safeStorage.setItem(attendanceKey, JSON.stringify(attendanceData))
      return attendanceData
    }

    try {
      const parsed = JSON.parse(attendance)
      const normalised = this.normaliseAttendanceRecord(parsed)
      safeStorage.setItem(attendanceKey, JSON.stringify(normalised))
      return normalised
    } catch (error) {
      console.error("Error parsing attendance record", error)
      return this.normaliseAttendanceRecord({ present: 0, total: 0 })
    }
  }

  async getUpcomingEvents(): any[] {
    const eventsKey = "upcomingEvents"
    const events = safeStorage.getItem(eventsKey)

    if (!events) {
      const sampleEvents = [
        {
          id: "1",
          title: "Mid-Term Examination",
          date: "2024-02-15",
          type: "exam",
        },
        {
          id: "2",
          title: "Parent-Teacher Meeting",
          date: "2024-02-20",
          type: "meeting",
        },
        {
          id: "3",
          title: "Sports Day",
          date: "2024-02-25",
          type: "event",
        },
      ]
      safeStorage.setItem(eventsKey, JSON.stringify(sampleEvents))
      return sampleEvents
    }

    return JSON.parse(events)
  }

  async getStudentProfile(studentId: string) {
    try {
      const profileKey = `profile_${studentId}`
      const profile = safeStorage.getItem(profileKey)

      if (!profile) {
        // Return basic profile from users data
        const users = await this.getAllUsers()
        const user = users.find((u: any) => u.id === studentId)
        return user || null
      }

      return JSON.parse(profile)
    } catch (error) {
      console.error("Error getting student profile:", error)
      throw error
    }
  }

  async updateStudentProfile(studentId: string, profileData: any) {
    try {
      const profileKey = `profile_${studentId}`
      const updatedProfile = {
        ...profileData,
        id: studentId,
        updatedAt: new Date().toISOString(),
      }

      safeStorage.setItem(profileKey, JSON.stringify(updatedProfile))

      // Also update in users array
      const users = await this.getAllUsers()
      const userIndex = users.findIndex((u: any) => u.id === studentId)
      if (userIndex >= 0) {
        users[userIndex] = { ...users[userIndex], ...updatedProfile }
        safeStorage.setItem("users", JSON.stringify(users))
      }

      this.triggerEvent("profileUpdate", updatedProfile)
      return updatedProfile
    } catch (error) {
      console.error("Error updating student profile:", error)
      throw error
    }
  }

  getStudentProfile(studentId: string): any {
    const profileKey = `profile_${studentId}`
    const profile = safeStorage.getItem(profileKey)
    return profile ? JSON.parse(profile) : null
  }

  async renewLibraryBook(bookId: string, studentId: string) {
    try {
      const books = this.ensureLibraryBooks(studentId)
      const index = books.findIndex((book) => book.id === bookId)

      if (index === -1) {
        throw new Error("Book not found for renewal")
      }

      let currentDue = books[index].dueDate ? new Date(books[index].dueDate) : new Date()
      if (Number.isNaN(currentDue.getTime())) {
        currentDue = new Date()
      }

      currentDue.setDate(currentDue.getDate() + 14)

      books[index] = {
        ...books[index],
        dueDate: currentDue.toISOString().split("T")[0],
        status: "issued",
        renewedAt: new Date().toISOString(),
      }

      this.persistLibraryBooks(studentId, books)
      this.triggerEvent("libraryBooksUpdated", { studentId, books })
      this.triggerEvent("libraryBookRenewed", { bookId, studentId })

      return books[index]
    } catch (error) {
      console.error("Error renewing library book:", error)
      throw error
    }
  }

  async submitAssignment(submissionData: any) {
    try {
      const files = submissionData.submittedFile
        ? [{ id: this.generateId("file"), name: submissionData.submittedFile }]
        : []

      const submissionRecord = await this.createAssignmentSubmission({
        assignmentId: submissionData.assignmentId,
        studentId: submissionData.studentId,
        files,
        status: submissionData.status ?? "submitted",
        comment: submissionData.submittedComment ?? null,
        submittedAt: submissionData.submittedAt,
      })

      const submissionsKey = `submissions_${submissionData.studentId}`
      const legacyStore = safeStorage.getItem(submissionsKey)
      const legacyList = legacyStore ? JSON.parse(legacyStore) : []
      const legacyIndex = legacyList.findIndex((entry: any) => entry.assignmentId === submissionData.assignmentId)

      const legacyPayload = {
        ...submissionData,
        id: submissionRecord.id,
        submittedAt: submissionRecord.submittedAt,
        submittedFile: submissionRecord.files[0]?.name ?? submissionData.submittedFile ?? null,
        status: submissionRecord.status === "submitted" ? "submitted" : submissionRecord.status,
        grade: submissionRecord.grade ?? submissionData.grade ?? null,
        score: submissionRecord.score ?? submissionData.score ?? null,
      }

      if (legacyIndex >= 0) {
        legacyList[legacyIndex] = { ...legacyList[legacyIndex], ...legacyPayload }
      } else {
        legacyList.push(legacyPayload)
      }

      safeStorage.setItem(submissionsKey, JSON.stringify(legacyList))
      return legacyPayload
    } catch (error) {
      console.error("Error submitting assignment:", error)
      throw error
    }
  }

  async promoteStudent(studentId: string, promotionData: any) {
    try {
      const users = await this.getAllUsers()
      const studentIndex = users.findIndex((u: any) => u.id === studentId)

      if (studentIndex >= 0) {
        const currentRecord = users[studentIndex]
        const previousClass = this.resolveStudentClass(currentRecord)
        if (previousClass) {
          users[studentIndex].previousClass = previousClass
        }

        users[studentIndex].class = promotionData.toClass
        if ("className" in users[studentIndex]) {
          users[studentIndex].className = promotionData.toClass
        }

        if (typeof users[studentIndex].metadata === "object" && users[studentIndex].metadata !== null) {
          users[studentIndex].metadata = {
            ...users[studentIndex].metadata,
            className: promotionData.toClass,
            class: promotionData.toClass,
            lastPromotion: promotionData.promotedAt ?? new Date().toISOString(),
          }
        }

        users[studentIndex].session = promotionData.session
        users[studentIndex].promotedAt = promotionData.promotedAt

        safeStorage.setItem("users", JSON.stringify(users))
        this.triggerEvent("studentPromoted", { studentId, promotionData })
      }

      return true
    } catch (error) {
      console.error("Error promoting student:", error)
      throw error
    }
  }

  async saveBatchPromotion(batchData: any) {
    try {
      const batches = JSON.parse(safeStorage.getItem("batchPromotions") || "[]")
      batches.push(batchData)
      safeStorage.setItem("batchPromotions", JSON.stringify(batches))
      this.triggerEvent("batchPromotionCompleted", batchData)
      return batchData
    } catch (error) {
      console.error("Error saving batch promotion:", error)
      throw error
    }
  }

  private ensurePromotionAnalysesStorage() {
    const raw = safeStorage.getItem("promotionAnalyses")
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error("Error parsing promotion analyses from storage:", error)
      return []
    }
  }

  async getPromotionAnalyses(filters: { className?: string; session?: string } = {}) {
    const analyses = this.ensurePromotionAnalysesStorage()
    const normalisedClass = filters.className ? this.normaliseClassIdentifier(filters.className) : ""

    return analyses.filter((entry: any) => {
      const matchesClass =
        !normalisedClass || this.normaliseClassIdentifier(entry.class ?? entry.className ?? "") === normalisedClass
      const matchesSession = !filters.session || entry.session === filters.session
      return matchesClass && matchesSession
    })
  }

  async savePromotionAnalysis(analysisData: any) {
    const analyses = this.ensurePromotionAnalysesStorage()
    const now = new Date().toISOString()
    const classLabel = analysisData.class ?? analysisData.className ?? analysisData.selectedClass ?? ""
    const normalisedClass = this.normaliseClassIdentifier(classLabel)
    const session = analysisData.session ?? analysisData.criteria?.currentSession ?? null

    const existingIndex = analyses.findIndex(
      (entry: any) =>
        this.normaliseClassIdentifier(entry.class ?? entry.className ?? "") === normalisedClass &&
        (!session || entry.session === session),
    )

    const record = {
      ...analysisData,
      id: existingIndex >= 0 ? analyses[existingIndex].id : this.generateId("promotion_analysis"),
      class: classLabel,
      session,
      savedAt: existingIndex >= 0 ? analyses[existingIndex].savedAt ?? now : now,
      updatedAt: now,
    }

    if (existingIndex >= 0) {
      analyses[existingIndex] = { ...analyses[existingIndex], ...record }
    } else {
      analyses.push(record)
    }

    safeStorage.setItem("promotionAnalyses", JSON.stringify(analyses))
    this.triggerEvent("promotionAnalysisSaved", record)
    return record
  }
}

const databaseManagerInstance = DatabaseManager.getInstance()
export { databaseManagerInstance as DatabaseManager }
export { databaseManagerInstance as dbManager }
export default databaseManagerInstance
