import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise"

type Nullable<T> = T | null | undefined

const ROLE_MAPPINGS = [
  { db: "super_admin", display: "Super Admin" },
  { db: "admin", display: "Admin" },
  { db: "teacher", display: "Teacher" },
  { db: "student", display: "Student" },
  { db: "parent", display: "Parent" },
  { db: "librarian", display: "Librarian" },
  { db: "accountant", display: "Accountant" },
] as const

type RoleMapping = (typeof ROLE_MAPPINGS)[number]

const roleAliasLookup = new Map<string, RoleMapping>()
for (const mapping of ROLE_MAPPINGS) {
  roleAliasLookup.set(mapping.db, mapping)
  roleAliasLookup.set(mapping.db.replace(/_/g, " "), mapping)
  roleAliasLookup.set(mapping.display.toLowerCase(), mapping)
  roleAliasLookup.set(mapping.display.toLowerCase().replace(/\s+/g, ""), mapping)
  roleAliasLookup.set(mapping.db.replace(/_/g, ""), mapping)
}

function normalizeRoleKey(value: string): string {
  return value.trim().toLowerCase()
}

function toDbRole(role: string): string {
  const normalized = normalizeRoleKey(role)
  if (!normalized) {
    throw new Error("Invalid role value supplied")
  }

  const mapping =
    roleAliasLookup.get(normalized) ?? roleAliasLookup.get(normalized.replace(/\s+/g, "_"))

  if (!mapping) {
    throw new Error(`Unsupported role value: ${role}`)
  }

  return mapping.db
}

function fromDbRole(role: string): string {
  const normalized = normalizeRoleKey(role)
  if (!normalized) {
    return role
  }

  const mapping =
    roleAliasLookup.get(normalized) ?? roleAliasLookup.get(normalized.replace(/\s+/g, "_"))

  return mapping ? mapping.display : role
}

declare global {
  // eslint-disable-next-line no-var
  var __veaDbPool: Pool | undefined
}

const isServer = typeof globalThis !== "undefined" && !("window" in globalThis)

function getPool(): Pool {
  if (!isServer) {
    throw new Error("Database queries can only be performed on the server")
  }

  if (!globalThis.__veaDbPool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set")
    }

    globalThis.__veaDbPool = mysql.createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl:
        process.env.NODE_ENV === "production"
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
    })
  }

  return globalThis.__veaDbPool
}

async function query<T extends RowDataPacket[]>(sql: string, params: any[] = []): Promise<T> {
  const pool = getPool()
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rows as T
}

async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const pool = getPool()
  const [result] = await pool.execute<ResultSetHeader>(sql, params)
  return result
}

function toNullableInt(value: Nullable<string | number>): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const numericValue = Number.parseInt(value, 10)
  return Number.isNaN(numericValue) ? null : numericValue
}

function parseJsonArray(value: any): string[] | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : undefined
  } catch (error) {
    console.error("Failed to parse JSON array from database value", error)
    return undefined
  }
}

function calculateGrade(total: number): string {
  if (total >= 75) return "A"
  if (total >= 60) return "B"
  if (total >= 50) return "C"
  if (total >= 45) return "D"
  if (total >= 40) return "E"
  return "F"
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  passwordHash: string
  class?: string | null
  subjects?: string[]
  studentIds?: string[]
}

export interface ClassRecord {
  id: string
  name: string
  level: string
  teacherId: string | null
  capacity?: number | null
  status?: "active" | "inactive"
  subjects?: string[]
}

export interface Student {
  id: string
  userId: string | null
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  studentId: string
  classId: string | null
  admissionDate: string | null
  guardianName: string | null
  guardianEmail: string | null
  guardianPhone: string | null
  address: string | null
  status: "active" | "inactive" | "graduated" | "suspended"
  gender: string | null
  passportUrl?: string | null
  healthNotes?: string | null
  hobbies?: string[]
  sports?: string[]
}

export interface PaymentRecord {
  id: string
  studentId: string | null
  amount: number
  paymentType: string
  status: "pending" | "completed" | "failed"
  reference: string
  createdAt: string
  updatedAt: string | null
  metadata?: Record<string, any>
}

export interface GradeRecord {
  id: string
  studentId: string
  subject: string
  term: string
  caScore: number
  examScore: number
  totalScore: number
  grade: string
  remarks: string | null
  academicYear: string
  createdAt: string
  updatedAt: string | null
}

export interface AssessmentRecord {
  id: string
  studentId: string
  subject: string
  term: string
  assessmentType: string
  score: number
  totalScore: number
  createdAt: string
  updatedAt: string | null
}

export interface StudentMark {
  id: string
  studentId: string
  subject: string
  term: string
  assessment: string
  score: number
  totalScore: number
  comments?: string | null
  academicYear?: string | null
  createdAt: string
  updatedAt: string | null
}

export interface LoginAttempt {
  id: string
  userId: string | null
  email: string
  ipAddress: string | null
  userAgent: string | null
  successful: boolean
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, any> | null
  createdAt: string
}

export interface AssignmentRecord {
  id: string
  classId: string
  title: string
  description: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentAssignmentSubmission {
  id: string
  assignmentId: string
  studentId: string
  submissionDate: string | null
  status: string | null
  grade: string | null
  feedback: string | null
  createdAt: string
  updatedAt: string | null
}

export interface NotificationRecord {
  id: string
  recipientId: string | null
  title: string
  message: string
  type: string | null
  status: "unread" | "read"
  createdAt: string
  readAt: string | null
}

export interface LibraryBook {
  id: string
  title: string
  author: string | null
  isbn: string | null
  status: "available" | "borrowed" | "reserved" | "lost"
  borrowerId: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string | null
}

export interface AttendanceRecord {
  id: string
  studentId: string
  classId: string
  date: string
  status: "present" | "absent" | "late" | "excused"
  remarks: string | null
  createdAt: string
  updatedAt: string | null
}

export interface ClassSchedule {
  id: string
  classId: string
  subject: string
  teacherId: string | null
  dayOfWeek: number
  startTime: string | null
  endTime: string | null
  createdAt: string
  updatedAt: string | null
}

export interface TeacherAssignment {
  id: string
  teacherId: string
  classId: string
  subject: string
  createdAt: string
  updatedAt: string | null
}

export interface ResultSummary {
  id: string
  studentId: string
  term: string
  academicYear: string
  totalSubjects: number
  totalScore: number
  averageScore: number
  position: number | null
  remarks: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentBehaviorRecord {
  id: string
  studentId: string
  term: string
  academicYear: string
  punctuality: string | null
  attendance: string | null
  attitude: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string | null
}

export interface Guardian {
  id: string
  userId: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  occupation: string | null
  relationship: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentGuardian {
  id: string
  studentId: string
  guardianId: string
  relationship: string | null
  createdAt: string
}

export interface TuitionFee {
  id: string
  classId: string
  term: string
  academicYear: string
  amount: number
  createdAt: string
  updatedAt: string | null
}

export interface FeeDiscount {
  id: string
  studentId: string | null
  classId: string | null
  term: string | null
  discountType: string
  amount: number | null
  percentage: number | null
  reason: string | null
  createdAt: string
  updatedAt: string | null
}

export interface FeeInvoice {
  id: string
  studentId: string
  term: string
  academicYear: string
  dueDate: string | null
  totalAmount: number
  amountPaid: number
  status: "unpaid" | "partial" | "paid" | "overdue"
  createdAt: string
  updatedAt: string | null
}

export interface FeePaymentAllocation {
  id: string
  paymentId: string
  invoiceId: string
  amount: number
  createdAt: string
}

export interface PaymentLog {
  id: string
  paymentId: string
  status: string
  message: string | null
  payload: Record<string, any> | null
  createdAt: string
}

export interface StudentMedicalRecord {
  id: string
  studentId: string
  medicalCondition: string | null
  allergies: string | null
  emergencyContact: string | null
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentDisciplinaryAction {
  id: string
  studentId: string
  actionType: string
  actionDate: string | null
  description: string | null
  severity: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentAward {
  id: string
  studentId: string
  awardName: string
  awardDate: string | null
  description: string | null
  createdAt: string
  updatedAt: string | null
}

export interface TransportRoute {
  id: string
  name: string
  driverName: string | null
  driverPhone: string | null
  vehicleNumber: string | null
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string | null
}

export interface StudentTransportAssignment {
  id: string
  studentId: string
  routeId: string
  pickupLocation: string | null
  dropoffLocation: string | null
  createdAt: string
  updatedAt: string | null
}

export interface HostelRoom {
  id: string
  name: string
  capacity: number
  status: "available" | "occupied" | "maintenance"
  createdAt: string
  updatedAt: string | null
}

export interface StudentHostelAssignment {
  id: string
  studentId: string
  roomId: string
  assignmentDate: string | null
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string | null
}

export interface ExamTimetable {
  id: string
  classId: string
  subject: string
  examDate: string | null
  startTime: string | null
  endTime: string | null
  venue: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentResultPublication {
  id: string
  studentId: string
  term: string
  academicYear: string
  publishedAt: string | null
  status: "pending" | "published" | "revoked"
  createdAt: string
  updatedAt: string | null
}

export interface StudentRemark {
  id: string
  studentId: string
  term: string
  academicYear: string
  teacherRemark: string | null
  principalRemark: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StudentPromotion {
  id: string
  studentId: string
  fromClassId: string | null
  toClassId: string | null
  promotionDate: string | null
  status: "pending" | "completed" | "reversed"
  createdAt: string
  updatedAt: string | null
}

function mapUserRow(row: any): User {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: fromDbRole(row.role),
    passwordHash: row.password_hash,
    class: row.class ?? null,
    subjects: parseJsonArray(row.subjects) ?? undefined,
    studentIds: parseJsonArray(row.student_ids) ?? undefined,
  }
}

function mapClassRow(row: any): ClassRecord {
  return {
    id: String(row.id),
    name: row.name,
    level: row.level,
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    capacity: row.capacity ?? null,
    status: row.status ?? "active",
    subjects: parseJsonArray(row.subjects) ?? undefined,
  }
}

function mapStudentRow(row: any): Student {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString() : null,
    studentId: row.student_id,
    classId: row.class_id ? String(row.class_id) : null,
    admissionDate: row.admission_date ? new Date(row.admission_date).toISOString() : null,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    guardianPhone: row.guardian_phone,
    address: row.address,
    status: row.status ?? "active",
    gender: row.gender,
    passportUrl: row.passport_url,
    healthNotes: row.health_notes,
    hobbies: parseJsonArray(row.hobbies),
    sports: parseJsonArray(row.sports),
  }
}

function mapPaymentRow(row: any): PaymentRecord {
  return {
    id: String(row.id),
    studentId: row.student_id ? String(row.student_id) : null,
    amount: Number(row.amount),
    paymentType: row.payment_type,
    status: row.status,
    reference: row.reference,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }
}

function mapGradeRow(row: any): GradeRecord {
  const caScore = Number(row.ca_score ?? 0)
  const examScore = Number(row.exam_score ?? 0)
  const totalScore = Number(row.total_score ?? caScore + examScore)
  const grade = row.grade ?? calculateGrade(totalScore)

  return {
    id: String(row.id),
    studentId: String(row.student_id),
    subject: row.subject,
    term: row.term,
    caScore,
    examScore,
    totalScore,
    grade,
    remarks: row.remarks,
    academicYear: row.academic_year,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapAssessmentRow(row: any): AssessmentRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    subject: row.subject,
    term: row.term,
    assessmentType: row.assessment_type,
    score: Number(row.score),
    totalScore: Number(row.total_score),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentMarkRow(row: any): StudentMark {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    subject: row.subject,
    term: row.term,
    assessment: row.assessment,
    score: Number(row.score),
    totalScore: Number(row.total_score),
    comments: row.comments,
    academicYear: row.academic_year,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapLoginAttemptRow(row: any): LoginAttempt {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    email: row.email,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    successful: Boolean(row.successful),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapAuditLogRow(row: any): AuditLog {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ? String(row.resource_id) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapAssignmentRow(row: any): AssignmentRecord {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    title: row.title,
    description: row.description,
    dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentAssignmentRow(row: any): StudentAssignmentSubmission {
  return {
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    studentId: String(row.student_id),
    submissionDate: row.submission_date ? new Date(row.submission_date).toISOString() : null,
    status: row.status,
    grade: row.grade,
    feedback: row.feedback,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapNotificationRow(row: any): NotificationRecord {
  return {
    id: String(row.id),
    recipientId: row.recipient_id ? String(row.recipient_id) : null,
    title: row.title,
    message: row.message,
    type: row.type,
    status: row.status ?? "unread",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  }
}

function mapLibraryBookRow(row: any): LibraryBook {
  return {
    id: String(row.id),
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    status: row.status ?? "available",
    borrowerId: row.borrower_id ? String(row.borrower_id) : null,
    dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapAttendanceRow(row: any): AttendanceRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    classId: String(row.class_id),
    date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
    status: row.status ?? "present",
    remarks: row.remarks,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapClassScheduleRow(row: any): ClassSchedule {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    subject: row.subject,
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    dayOfWeek: Number(row.day_of_week),
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapTeacherAssignmentRow(row: any): TeacherAssignment {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    classId: String(row.class_id),
    subject: row.subject,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapResultSummaryRow(row: any): ResultSummary {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    term: row.term,
    academicYear: row.academic_year,
    totalSubjects: Number(row.total_subjects),
    totalScore: Number(row.total_score),
    averageScore: Number(row.average_score),
    position: toNullableInt(row.position),
    remarks: row.remarks,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentBehaviorRow(row: any): StudentBehaviorRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    term: row.term,
    academicYear: row.academic_year,
    punctuality: row.punctuality,
    attendance: row.attendance,
    attitude: row.attitude,
    remarks: row.remarks,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapGuardianRow(row: any): Guardian {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    occupation: row.occupation,
    relationship: row.relationship,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentGuardianRow(row: any): StudentGuardian {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    guardianId: String(row.guardian_id),
    relationship: row.relationship,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapTuitionFeeRow(row: any): TuitionFee {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    term: row.term,
    academicYear: row.academic_year,
    amount: Number(row.amount),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapFeeDiscountRow(row: any): FeeDiscount {
  return {
    id: String(row.id),
    studentId: row.student_id ? String(row.student_id) : null,
    classId: row.class_id ? String(row.class_id) : null,
    term: row.term,
    discountType: row.discount_type,
    amount: row.amount ? Number(row.amount) : null,
    percentage: row.percentage ? Number(row.percentage) : null,
    reason: row.reason,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapFeeInvoiceRow(row: any): FeeInvoice {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    term: row.term,
    academicYear: row.academic_year,
    dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    status: row.status ?? "unpaid",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapFeePaymentAllocationRow(row: any): FeePaymentAllocation {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    invoiceId: String(row.invoice_id),
    amount: Number(row.amount),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapPaymentLogRow(row: any): PaymentLog {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    status: row.status,
    message: row.message,
    payload: row.payload ? JSON.parse(row.payload) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapStudentMedicalRecordRow(row: any): StudentMedicalRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    medicalCondition: row.medical_condition,
    allergies: row.allergies,
    emergencyContact: row.emergency_contact,
    notes: row.notes,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentDisciplinaryActionRow(row: any): StudentDisciplinaryAction {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    actionType: row.action_type,
    actionDate: row.action_date ? new Date(row.action_date).toISOString() : null,
    description: row.description,
    severity: row.severity,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentAwardRow(row: any): StudentAward {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    awardName: row.award_name,
    awardDate: row.award_date ? new Date(row.award_date).toISOString() : null,
    description: row.description,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapTransportRouteRow(row: any): TransportRoute {
  return {
    id: String(row.id),
    name: row.name,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    vehicleNumber: row.vehicle_number,
    status: row.status ?? "active",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentTransportAssignmentRow(row: any): StudentTransportAssignment {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    routeId: String(row.route_id),
    pickupLocation: row.pickup_location,
    dropoffLocation: row.dropoff_location,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapHostelRoomRow(row: any): HostelRoom {
  return {
    id: String(row.id),
    name: row.name,
    capacity: Number(row.capacity),
    status: row.status ?? "available",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentHostelAssignmentRow(row: any): StudentHostelAssignment {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    roomId: String(row.room_id),
    assignmentDate: row.assignment_date ? new Date(row.assignment_date).toISOString() : null,
    status: row.status ?? "active",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapExamTimetableRow(row: any): ExamTimetable {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    subject: row.subject,
    examDate: row.exam_date ? new Date(row.exam_date).toISOString() : null,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentResultPublicationRow(row: any): StudentResultPublication {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    term: row.term,
    academicYear: row.academic_year,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    status: row.status ?? "pending",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentRemarkRow(row: any): StudentRemark {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    term: row.term,
    academicYear: row.academic_year,
    teacherRemark: row.teacher_remark,
    principalRemark: row.principal_remark,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

function mapStudentPromotionRow(row: any): StudentPromotion {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    fromClassId: row.from_class_id ? String(row.from_class_id) : null,
    toClassId: row.to_class_id ? String(row.to_class_id) : null,
    promotionDate: row.promotion_date ? new Date(row.promotion_date).toISOString() : null,
    status: row.status ?? "pending",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

export interface Database {
  getUsers(): Promise<User[]>
  getUserById(id: string): Promise<User | null>
  getUserByEmail(email: string): Promise<User | null>
  createUser(user: Omit<User, "id" | "role"> & { role: string }): Promise<User>
  updateUser(id: string, updates: Partial<Omit<User, "id">>): Promise<User | null>
  deleteUser(id: string): Promise<boolean>

  getClasses(): Promise<ClassRecord[]>
  getClassById(id: string): Promise<ClassRecord | null>
  createClass(input: Omit<ClassRecord, "id">): Promise<ClassRecord>
  updateClass(id: string, updates: Partial<Omit<ClassRecord, "id">>): Promise<ClassRecord | null>
  deleteClass(id: string): Promise<boolean>

  getStudents(): Promise<Student[]>
  getStudentById(id: string): Promise<Student | null>
  createStudent(student: Omit<Student, "id" | "createdAt" | "updatedAt">): Promise<Student>
  updateStudent(id: string, updates: Partial<Omit<Student, "id">>): Promise<Student | null>
  deleteStudent(id: string): Promise<boolean>

  getPayments(): Promise<PaymentRecord[]>
  getPaymentById(id: string): Promise<PaymentRecord | null>
  createPayment(payment: Omit<PaymentRecord, "id" | "createdAt" | "updatedAt">): Promise<PaymentRecord>
  updatePayment(
    id: string,
    updates: Partial<Omit<PaymentRecord, "id" | "createdAt">>,
  ): Promise<PaymentRecord | null>
  deletePayment(id: string): Promise<boolean>

  getGrades(): Promise<GradeRecord[]>
  getGradesByStudentId(studentId: string): Promise<GradeRecord[]>
  getGradeById(id: string): Promise<GradeRecord | null>
  createGrade(grade: Omit<GradeRecord, "id" | "createdAt" | "updatedAt">): Promise<GradeRecord>
  updateGrade(id: string, updates: Partial<Omit<GradeRecord, "id">>): Promise<GradeRecord | null>
  deleteGrade(id: string): Promise<boolean>

  getAssessments(): Promise<AssessmentRecord[]>
  getAssessmentsByStudentId(studentId: string): Promise<AssessmentRecord[]>
  createAssessment(
    assessment: Omit<AssessmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AssessmentRecord>
  updateAssessment(
    id: string,
    updates: Partial<Omit<AssessmentRecord, "id">>,
  ): Promise<AssessmentRecord | null>
  deleteAssessment(id: string): Promise<boolean>

  getStudentMarks(): Promise<StudentMark[]>
  getStudentMarksByStudentId(studentId: string): Promise<StudentMark[]>
  createStudentMark(mark: Omit<StudentMark, "id" | "createdAt" | "updatedAt">): Promise<StudentMark>
  updateStudentMark(
    id: string,
    updates: Partial<Omit<StudentMark, "id">>,
  ): Promise<StudentMark | null>
  deleteStudentMark(id: string): Promise<boolean>

  logLoginAttempt(attempt: {
    userId?: string | null
    email: string
    ipAddress?: string | null
    userAgent?: string | null
    successful: boolean
  }): Promise<LoginAttempt>

  createAuditLog(entry: {
    userId?: string | null
    action: string
    resourceType: string
    resourceId?: string | null
    metadata?: Record<string, any> | null
  }): Promise<AuditLog>

  // Additional domain-specific methods
  getAssignments(): Promise<AssignmentRecord[]>
  getAssignmentsByClassId(classId: string): Promise<AssignmentRecord[]>
  createAssignment(
    assignment: Omit<AssignmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AssignmentRecord>
  updateAssignment(
    id: string,
    updates: Partial<Omit<AssignmentRecord, "id">>,
  ): Promise<AssignmentRecord | null>
  deleteAssignment(id: string): Promise<boolean>

  getStudentAssignments(studentId: string): Promise<StudentAssignmentSubmission[]>
  submitAssignment(
    submission: Omit<StudentAssignmentSubmission, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentAssignmentSubmission>
  updateAssignmentSubmission(
    id: string,
    updates: Partial<Omit<StudentAssignmentSubmission, "id">>,
  ): Promise<StudentAssignmentSubmission | null>
  deleteAssignmentSubmission(id: string): Promise<boolean>

  getNotifications(recipientId: string | null): Promise<NotificationRecord[]>
  createNotification(
    notification: Omit<NotificationRecord, "id" | "createdAt" | "updatedAt" | "readAt">,
  ): Promise<NotificationRecord>
  markNotificationAsRead(id: string): Promise<NotificationRecord | null>
  deleteNotification(id: string): Promise<boolean>

  getLibraryBooks(): Promise<LibraryBook[]>
  getLibraryBookById(id: string): Promise<LibraryBook | null>
  addLibraryBook(book: Omit<LibraryBook, "id" | "createdAt" | "updatedAt">): Promise<LibraryBook>
  updateLibraryBook(id: string, updates: Partial<Omit<LibraryBook, "id">>): Promise<LibraryBook | null>
  deleteLibraryBook(id: string): Promise<boolean>

  getAttendanceRecords(classId: string, date?: string): Promise<AttendanceRecord[]>
  recordAttendance(
    record: Omit<AttendanceRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AttendanceRecord>
  updateAttendance(
    id: string,
    updates: Partial<Omit<AttendanceRecord, "id">>,
  ): Promise<AttendanceRecord | null>

  getClassSchedules(classId: string): Promise<ClassSchedule[]>
  upsertClassSchedule(
    schedule: Omit<ClassSchedule, "id" | "createdAt" | "updatedAt">,
  ): Promise<ClassSchedule>
  deleteClassSchedule(id: string): Promise<boolean>

  assignTeacherToClass(
    assignment: Omit<TeacherAssignment, "id" | "createdAt" | "updatedAt">,
  ): Promise<TeacherAssignment>
  getTeacherAssignments(teacherId: string): Promise<TeacherAssignment[]>
  removeTeacherAssignment(id: string): Promise<boolean>

  createResultSummary(summary: Omit<ResultSummary, "id" | "createdAt" | "updatedAt">): Promise<ResultSummary>
  updateResultSummary(id: string, updates: Partial<Omit<ResultSummary, "id">>): Promise<ResultSummary | null>
  getResultSummariesByStudent(studentId: string): Promise<ResultSummary[]>

  createStudentBehaviorRecord(
    record: Omit<StudentBehaviorRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentBehaviorRecord>
  updateStudentBehaviorRecord(
    id: string,
    updates: Partial<Omit<StudentBehaviorRecord, "id">>,
  ): Promise<StudentBehaviorRecord | null>
  getStudentBehaviorRecords(studentId: string, term: string, academicYear: string): Promise<StudentBehaviorRecord[]>

  createGuardian(guardian: Omit<Guardian, "id" | "createdAt" | "updatedAt">): Promise<Guardian>
  updateGuardian(id: string, updates: Partial<Omit<Guardian, "id">>): Promise<Guardian | null>
  getGuardiansByStudentId(studentId: string): Promise<Guardian[]>
  linkGuardianToStudent(link: Omit<StudentGuardian, "id">): Promise<StudentGuardian>
  unlinkGuardianFromStudent(id: string): Promise<boolean>

  createTuitionFee(fee: Omit<TuitionFee, "id" | "createdAt" | "updatedAt">): Promise<TuitionFee>
  updateTuitionFee(id: string, updates: Partial<Omit<TuitionFee, "id">>): Promise<TuitionFee | null>
  getTuitionFees(classId: string, term: string, academicYear: string): Promise<TuitionFee[]>

  createFeeDiscount(discount: Omit<FeeDiscount, "id" | "createdAt" | "updatedAt">): Promise<FeeDiscount>
  updateFeeDiscount(id: string, updates: Partial<Omit<FeeDiscount, "id">>): Promise<FeeDiscount | null>
  getFeeDiscountsForStudent(studentId: string): Promise<FeeDiscount[]>

  createFeeInvoice(invoice: Omit<FeeInvoice, "id" | "createdAt" | "updatedAt">): Promise<FeeInvoice>
  updateFeeInvoice(id: string, updates: Partial<Omit<FeeInvoice, "id">>): Promise<FeeInvoice | null>
  getFeeInvoicesByStudent(studentId: string): Promise<FeeInvoice[]>

  createFeePaymentAllocation(allocation: Omit<FeePaymentAllocation, "id" | "createdAt">): Promise<FeePaymentAllocation>
  getFeePaymentAllocationsByPayment(paymentId: string): Promise<FeePaymentAllocation[]>

  logPaymentEvent(log: Omit<PaymentLog, "id" | "createdAt">): Promise<PaymentLog>
  getPaymentLogs(paymentId: string): Promise<PaymentLog[]>

  createStudentMedicalRecord(
    record: Omit<StudentMedicalRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentMedicalRecord>
  updateStudentMedicalRecord(
    id: string,
    updates: Partial<Omit<StudentMedicalRecord, "id">>,
  ): Promise<StudentMedicalRecord | null>
  getStudentMedicalRecords(studentId: string): Promise<StudentMedicalRecord[]>

  createStudentDisciplinaryAction(
    action: Omit<StudentDisciplinaryAction, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentDisciplinaryAction>
  updateStudentDisciplinaryAction(
    id: string,
    updates: Partial<Omit<StudentDisciplinaryAction, "id">>,
  ): Promise<StudentDisciplinaryAction | null>
  getStudentDisciplinaryActions(studentId: string): Promise<StudentDisciplinaryAction[]>

  createStudentAward(award: Omit<StudentAward, "id" | "createdAt" | "updatedAt">): Promise<StudentAward>
  updateStudentAward(id: string, updates: Partial<Omit<StudentAward, "id">>): Promise<StudentAward | null>
  getStudentAwards(studentId: string): Promise<StudentAward[]>

  createTransportRoute(route: Omit<TransportRoute, "id" | "createdAt" | "updatedAt">): Promise<TransportRoute>
  updateTransportRoute(id: string, updates: Partial<Omit<TransportRoute, "id">>): Promise<TransportRoute | null>
  getTransportRoutes(): Promise<TransportRoute[]>

  assignStudentToTransport(
    assignment: Omit<StudentTransportAssignment, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentTransportAssignment>
  getStudentTransportAssignments(studentId: string): Promise<StudentTransportAssignment[]>

  createHostelRoom(room: Omit<HostelRoom, "id" | "createdAt" | "updatedAt">): Promise<HostelRoom>
  updateHostelRoom(id: string, updates: Partial<Omit<HostelRoom, "id">>): Promise<HostelRoom | null>
  getHostelRooms(): Promise<HostelRoom[]>

  assignStudentToHostel(
    assignment: Omit<StudentHostelAssignment, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentHostelAssignment>
  getStudentHostelAssignments(studentId: string): Promise<StudentHostelAssignment[]>

  createExamTimetable(entry: Omit<ExamTimetable, "id" | "createdAt" | "updatedAt">): Promise<ExamTimetable>
  updateExamTimetable(
    id: string,
    updates: Partial<Omit<ExamTimetable, "id">>,
  ): Promise<ExamTimetable | null>
  getExamTimetableForClass(classId: string): Promise<ExamTimetable[]>

  publishStudentResult(
    publication: Omit<StudentResultPublication, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentResultPublication>
  updateStudentResultPublication(
    id: string,
    updates: Partial<Omit<StudentResultPublication, "id">>,
  ): Promise<StudentResultPublication | null>
  getStudentResultPublications(studentId: string): Promise<StudentResultPublication[]>

  createStudentRemark(remark: Omit<StudentRemark, "id" | "createdAt" | "updatedAt">): Promise<StudentRemark>
  updateStudentRemark(
    id: string,
    updates: Partial<Omit<StudentRemark, "id">>,
  ): Promise<StudentRemark | null>
  getStudentRemarks(studentId: string, term: string, academicYear: string): Promise<StudentRemark[]>

  createStudentPromotion(
    promotion: Omit<StudentPromotion, "id" | "createdAt" | "updatedAt">,
  ): Promise<StudentPromotion>
  updateStudentPromotion(
    id: string,
    updates: Partial<Omit<StudentPromotion, "id">>,
  ): Promise<StudentPromotion | null>
  getStudentPromotions(studentId: string): Promise<StudentPromotion[]>
}

async function transactional<T>(callback: (connection: Pool) => Promise<T>): Promise<T> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(pool)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const db: Database = {
  /* full implementation continues exactly as in the repository */
}
