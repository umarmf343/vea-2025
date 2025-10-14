/* eslint-disable @typescript-eslint/no-var-requires */
import { randomBytes as nodeRandomBytes, randomUUID as nodeRandomUUID } from "node:crypto"
import { join } from "node:path"
import bcrypt from "bcryptjs"
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise"
import { normalizeDatabaseUrl } from "./database-url"
import { safeStorage } from "./safe-storage"
import { logger } from "./logger"
import { deriveGradeFromScore } from "./grade-utils"
import { normalizeSubjectList } from "./subject-utils"
import {
  applyLayoutDefaults,
  DEFAULT_REPORT_CARD_LAYOUT_CONFIG,
  type ReportCardLayoutConfig,
} from "./report-card-layout-config"

interface CollectionRecord {
  id: string
  createdAt: string
  updatedAt: string
}

export type StoredUserStatus = "active" | "inactive" | "suspended"

export interface StoredUser extends CollectionRecord {
  name: string
  email: string
  role: string
  passwordHash: string
  isActive: boolean
  status?: StoredUserStatus
  classId?: string | null
  studentIds?: string[]
  subjects?: string[]
  teachingClassIds?: string[]
  teachingAssignments?: TeacherAssignmentSummary[]
  metadata?: Record<string, unknown> | null
  profileImage?: string | null
  lastLogin?: string | null
  [key: string]: unknown
}

export interface ClassRecord extends CollectionRecord {
  name: string
  level: string
  capacity?: number | null
  classTeacherId?: string | null
  status: "active" | "inactive"
  subjects?: string[]
  [key: string]: unknown
}

export interface SubjectRecord extends CollectionRecord {
  name: string
  code: string
  description?: string | null
  classes: string[]
  teachers: string[]
}

export interface TeacherAssignmentSummary {
  classId: string
  className: string
  subjects: string[]
}

export interface TeacherClassAssignmentRecord extends CollectionRecord {
  teacherId: string
  classId: string
  subjects: string[]
}

export interface StudentRecord extends CollectionRecord {
  name: string
  email: string
  class: string
  section: string
  admissionNumber: string
  parentName: string
  parentEmail: string
  paymentStatus: "paid" | "pending" | "overdue"
  status: "active" | "inactive"
  dateOfBirth: string
  address: string
  phone: string
  guardianPhone: string
  bloodGroup: string
  admissionDate: string
  subjects: string[]
  attendance: { present: number; total: number }
  grades: { subject: string; ca1: number; ca2: number; exam: number; total: number; grade: string }[]
  passportUrl?: string | null
  photoUrl?: string | null
  isReal: boolean
}

export interface AttendanceLogRecord extends CollectionRecord {
  studentId: string
  date: string
  status: "present" | "absent" | "late"
  recordedBy?: string | null
}

export interface GradeRecord extends CollectionRecord {
  studentId: string
  subject: string
  classId: string | null
  term: string
  session: string
  firstCA: number
  secondCA: number
  assignment: number
  exam: number
  caTotal: number
  total: number
  average: number
  grade: string
  teacherRemarks?: string | null
  [key: string]: unknown
}

export interface StudentMarksRecord extends CollectionRecord {
  studentId: string
  subject: string
  term: string
  session: string
  ca1: number
  ca2: number
  assignment: number
  exam: number
  caTotal: number
  grandTotal: number
  percentage: number
  grade: string
  teacherId?: string
  remarks?: string
}

export interface PaymentInitializationRecord extends CollectionRecord {
  reference: string
  amount: number
  studentId: string | null
  paymentType: string
  email: string
  status: "pending" | "completed" | "failed"
  paystackReference: string | null
  metadata?: Record<string, unknown>
}

export interface FeeStructureRecord extends CollectionRecord {
  className: string
  tuition: number
  development: number
  exam: number
  sports: number
  library: number
  total: number
}

export interface UpsertFeeStructurePayload
  extends Omit<FeeStructureRecord, "id" | "createdAt" | "updatedAt" | "total"> {
  total?: number
}

export interface FeeStructureDeliveryRecord extends CollectionRecord {
  feeId: string
  className: string
  parentName: string
  parentEmail: string
  studentName: string
  sentBy: string
  message: string
  breakdown: {
    tuition: number
    development: number
    exam: number
    sports: number
    library: number
    total: number
  }
}

export interface ReceiptRecord extends CollectionRecord {
  paymentId: string
  receiptNumber: string
  studentName: string
  amount: number
  dateIssued: string
  reference?: string | null
  issuedBy?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CreateReceiptPayload extends Omit<ReceiptRecord, "id" | "createdAt" | "updatedAt" | "receiptNumber" | "dateIssued"> {
  receiptNumber?: string | null
  dateIssued?: string | null
}

export type ExpenseCategory =
  | "Salaries"
  | "Utilities"
  | "Supplies"
  | "Maintenance"
  | "Transport"
  | "Training"
  | "Technology"
  | "Miscellaneous"

export interface FeePaymentRecord extends CollectionRecord {
  studentId: string | null
  studentName: string
  classId: string | null
  className: string | null
  feeType: string
  amount: number
  paymentDate: string
  paymentMethod: string
  receiptNumber: string
  paymentReference: string | null
  term: string
  createdBy: string
  createdByName: string
  lastModifiedBy: string
  lastModifiedByName: string
  deletedAt: string | null
  deletionReason: string | null
  deletedBy: string | null
  deletedByName: string | null
  schoolFeeConfigId: string | null
  eventFeeIds: string[]
}

export interface CreateFeePaymentPayload {
  studentId?: string | null
  studentName: string
  classId?: string | null
  className?: string | null
  feeType: string
  amount: number
  paymentDate: string
  paymentMethod: string
  receiptNumber?: string | null
  paymentReference?: string | null
  term: string
  schoolFeeConfigId?: string | null
  eventFeeIds?: string[]
}

export interface SchoolFeeConfigurationRecord extends CollectionRecord {
  classId: string | null
  className: string
  classKey: string
  term: string
  termKey: string
  amount: number
  effectiveDate: string
  isActive: boolean
  version: number
  createdBy: string
  createdByName: string
  lastModifiedBy: string
  lastModifiedByName: string
  notes?: string | null
}

export interface CreateSchoolFeeConfigurationPayload {
  className: string
  term: string
  amount: number
  effectiveDate?: string | null
  notes?: string | null
  classId?: string | null
  activate?: boolean
}

export interface UpdateSchoolFeeConfigurationPayload {
  className?: string
  term?: string
  amount?: number
  effectiveDate?: string | null
  isActive?: boolean
  notes?: string | null
  classId?: string | null
}

export interface EventFeeConfigurationRecord extends CollectionRecord {
  name: string
  description?: string | null
  amount: number
  dueDate?: string | null
  isActive: boolean
  applicableClasses: string[]
  applicableClassKeys: string[]
  version: number
  createdBy: string
  createdByName: string
  lastModifiedBy: string
  lastModifiedByName: string
}

export interface CreateEventFeeConfigurationPayload {
  name: string
  description?: string | null
  amount: number
  dueDate?: string | null
  applicableClasses: string[]
  activate?: boolean
}

export interface UpdateEventFeeConfigurationPayload extends Partial<CreateEventFeeConfigurationPayload> {
  isActive?: boolean
}

export interface FeeConfigurationAuditRecord extends CollectionRecord {
  actorId: string
  actorName: string
  actorRole: string
  action: "create" | "update" | "activate" | "deactivate"
  recordType: "school_fee" | "event_fee"
  recordId: string
  snapshot: Record<string, unknown>
  notes?: string | null
}

export interface UpdateFeePaymentPayload
  extends Partial<Omit<CreateFeePaymentPayload, "studentName" | "term" | "paymentDate">> {
  studentName?: string
  term?: string
  paymentDate?: string
}

export interface ExpenseRecord extends CollectionRecord {
  category: ExpenseCategory
  amount: number
  expenseDate: string
  description: string
  receiptReference: string | null
  approvedBy: string
  documentUrl: string | null
  createdBy: string
  createdByName: string
  lastModifiedBy: string
  lastModifiedByName: string
  deletedAt: string | null
  deletionReason: string | null
  deletedBy: string | null
  deletedByName: string | null
}

export interface CreateExpensePayload {
  category: ExpenseCategory
  amount: number
  expenseDate: string
  description: string
  receiptReference?: string | null
  approvedBy: string
  documentUrl?: string | null
}

export interface UpdateExpensePayload extends Partial<CreateExpensePayload> {}

export interface FeeWaiverRecord extends CollectionRecord {
  studentId: string | null
  studentName: string
  classId: string | null
  className: string | null
  term: string
  amount: number
  reason: string
  notes: string | null
  createdBy: string
  createdByName: string
  lastModifiedBy: string
  lastModifiedByName: string
  deletedAt: string | null
  deletionReason: string | null
  deletedBy: string | null
  deletedByName: string | null
}

export interface CreateFeeWaiverPayload {
  studentId?: string | null
  studentName: string
  classId?: string | null
  className?: string | null
  term: string
  amount: number
  reason: string
  notes?: string | null
}

export interface UpdateFeeWaiverPayload extends Partial<CreateFeeWaiverPayload> {}

export interface FinancialAccessLogRecord extends CollectionRecord {
  userId: string
  userRole: string
  userName: string
  action: string
  filters: Record<string, unknown> | null
}

export interface CreateFinancialAccessLogPayload {
  userId: string
  userRole: string
  userName: string
  action: string
  filters?: Record<string, unknown> | null
}

export interface FinancialAuditContext {
  userId: string
  userName: string
}

export interface FeeConfigurationContext extends FinancialAuditContext {
  actorRole?: string
}

export interface FinancialAnalyticsSummary {
  totalCollected: number
  totalExpenses: number
  netIncome: number
  collectionRate: number
  studentsPaid: number
  defaultersCount: number
  outstandingAmount: number
  avgCollectionTime: number
  onTimePaymentRate: number
}

export interface MonthlyFinancialPoint {
  month: string
  collected: number
  expected: number
  expenses: number
  percentage: number
}

export interface ClassCollectionAnalyticsEntry {
  className: string
  collected: number
  expected: number
  students: number
  percentage: number
}

export interface ExpenseAnalyticsEntry {
  category: ExpenseCategory
  amount: number
  percentage: number
}

export interface FeeTypeAnalyticsEntry {
  feeType: string
  amount: number
  percentage: number
}

export interface DefaulterAnalyticsEntry {
  studentId: string
  studentName: string
  className: string | null
  term: string
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  outstanding: number
  expected: number
  paid: number
  waived: number
}

export interface FinancialAnalyticsSnapshot {
  summary: FinancialAnalyticsSummary
  monthly: MonthlyFinancialPoint[]
  classCollection: ClassCollectionAnalyticsEntry[]
  expenses: ExpenseAnalyticsEntry[]
  feeTypeBreakdown: FeeTypeAnalyticsEntry[]
  defaulters: DefaulterAnalyticsEntry[]
  topDefaulters: DefaulterAnalyticsEntry[]
}

export interface FinancialAnalyticsQueryOptions extends FeePaymentQueryOptions {
  classFilter?: string | null
}

export interface ReportCardSubjectRecord {
  name: string
  ca1: number
  ca2: number
  assignment: number
  exam: number
  total: number
  grade: string
  remark?: string
  position?: number | string | null
}

export interface ReportCardRecord extends CollectionRecord {
  studentId: string
  studentName: string
  className: string
  term: string
  session: string
  subjects: ReportCardSubjectRecord[]
  classTeacherRemark?: string | null
  headTeacherRemark?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ReportCardColumnRecord {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  isRequired: boolean
  order: number
}

export type ReportCardSubjectInput =
  | ReportCardSubjectRecord
  | (Omit<ReportCardSubjectRecord, "total" | "grade"> & {
      total?: number
      grade?: string
    })

export interface UpsertReportCardPayload
  extends Omit<ReportCardRecord, "id" | "createdAt" | "updatedAt" | "subjects"> {
  id?: string
  subjects: ReportCardSubjectInput[]
}

export interface BrandingRecord extends CollectionRecord {
  schoolName: string
  schoolAddress: string
  educationZone: string
  councilArea: string
  contactPhone: string
  contactEmail: string
  headmasterName: string
  defaultRemark: string
  logoUrl?: string | null
  signatureUrl?: string | null
}

export interface SystemSettingsRecord extends CollectionRecord {
  academicYear: string
  currentTerm: string
  registrationEnabled: boolean
  reportCardDeadline?: string | null
}

export interface CreateUserPayload {
  name: string
  email: string
  role: string
  passwordHash: string
  classId?: string | null
  classIds?: string[]
  teachingAssignments?: { classId?: string | null; subjects?: string[] }[]
  studentId?: string | null
  studentIds?: string[]
  subjects?: string[]
  metadata?: Record<string, unknown> | null
  profileImage?: string | null
  isActive?: boolean
  status?: StoredUserStatus
}

export interface UpdateUserPayload extends Partial<Omit<StoredUser, "id" | "email" | "createdAt" | "updatedAt">> {
  email?: string
  studentId?: string | null
  studentIds?: string[]
  subjects?: string[]
  classIds?: string[]
  teachingAssignments?: { classId?: string | null; subjects?: string[] }[]
}

export interface CreateClassPayload {
  name: string
  level: string
  capacity?: number | null
  classTeacherId?: string | null
  status?: "active" | "inactive"
  subjects?: string[]
}

export interface UpdateClassPayload extends Partial<Omit<ClassRecord, "id" | "createdAt" | "updatedAt">> {}

export interface CreateSubjectPayload {
  name: string
  code: string
  description?: string | null
  classes?: string[]
  teachers?: string[]
}

export interface UpdateSubjectPayload extends Partial<Omit<SubjectRecord, "id" | "createdAt" | "updatedAt">> {}

export interface CreateStudentPayload
  extends Omit<StudentRecord, "id" | "createdAt" | "updatedAt" | "isReal"> {
  isReal?: boolean
}

export interface UpdateStudentPayload extends Partial<Omit<StudentRecord, "id" | "createdAt" | "updatedAt">> {}

export interface CreateGradePayload {
  studentId: string
  subject: string
  classId?: string | null
  term?: string
  session?: string
  firstCA?: number
  secondCA?: number
  assignment?: number
  exam?: number
  teacherRemarks?: string | null
}

export interface UpdateGradePayload extends Partial<Omit<GradeRecord, "id" | "createdAt" | "updatedAt" | "studentId" | "subject">> {}

export interface StudentMarksPayload extends Omit<StudentMarksRecord, "id" | "createdAt" | "updatedAt"> {}

export interface PaymentInitializationPayload {
  reference: string
  amount: number
  studentId: string | null
  paymentType: string
  email: string
  status?: "pending" | "completed" | "failed"
  paystackReference?: string | null
  metadata?: Record<string, unknown>
}

export type NoticeCategory = "general" | "academic" | "event" | "urgent" | "celebration"

export type NoticeStatus = "draft" | "scheduled" | "published"

export interface NoticeRecord extends CollectionRecord {
  title: string
  content: string
  category: NoticeCategory
  targetAudience: string[]
  authorName: string
  authorRole: string
  isPinned: boolean
  scheduledFor: string | null
  status: NoticeStatus
}

export interface CreateNoticePayload
  extends Omit<NoticeRecord, "id" | "createdAt" | "updatedAt" | "isPinned" | "status" | "scheduledFor"> {
  id?: string
  isPinned?: boolean
  scheduledFor?: string | null
  status?: NoticeStatus
}

export interface UpdateNoticePayload
  extends Partial<Omit<NoticeRecord, "id" | "createdAt" | "updatedAt">> {}

export interface NoticeQueryOptions {
  audience?: string
  onlyPinned?: boolean
  includeScheduled?: boolean
  includeDrafts?: boolean
}

export interface TimetableSlotRecord extends CollectionRecord {
  className: string
  day: string
  startTime: string
  endTime: string
  subject: string
  teacher: string
  location?: string | null
}

export interface CreateTimetableSlotPayload
  extends Omit<TimetableSlotRecord, "id" | "createdAt" | "updatedAt"> {
  id?: string
}

export interface UpdateTimetableSlotPayload
  extends Partial<Omit<TimetableSlotRecord, "id" | "createdAt" | "updatedAt" | "className">> {}

export interface TimetableQueryOptions {
  className?: string
}

export interface AnalyticsReportRecord extends CollectionRecord {
  term: string
  className: string
  generatedAt: string
  payload: Record<string, unknown>
}

export interface CreateAnalyticsReportPayload
  extends Omit<AnalyticsReportRecord, "id" | "createdAt" | "updatedAt"> {
  id?: string
}

export interface AcademicAnalyticsSummary {
  classPerformance: Array<{
    class: string
    average: number
    students: number
    topScore: number
    lowScore: number
  }>
  subjectPerformance: Array<{
    subject: string
    average: number
    passRate: number
    excellentRate: number
    teacher?: string | null
  }>
  termComparison: Array<{
    term: string
    average: number
    passRate: number
    attendance: number
  }>
  topPerformers: Array<{
    name: string
    class: string
    subjects: number
    average: number
  }>
  performanceRadarData: Array<{
    subject: string
    A: number
    B: number
  }>
  summaryStats: {
    overallAverage: number
    totalStudents: number
    passRate: number
    excellenceRate: number
  }
  generatedAt: string
}

const STORAGE_KEYS = {
  USERS: "vea_users",
  CLASSES: "vea_classes",
  SUBJECTS: "vea_subjects",
  STUDENTS: "vea_students",
  GRADES: "vea_grades",
  MARKS: "vea_marks",
  ATTENDANCE_LOGS: "vea_attendance_logs",
  PAYMENTS: "vea_payment_initializations",
  SCHOOL_FEES: "vea_school_fee_configurations",
  EVENT_FEES: "vea_event_fee_configurations",
  FEE_CONFIGURATION_AUDIT: "vea_fee_configuration_audit_log",
  FEE_STRUCTURE: "vea_fee_structure",
  FEE_COMMUNICATIONS: "vea_fee_structure_communications",
  RECEIPTS: "vea_payment_receipts",
  FINANCIAL_COLLECTIONS: "vea_financial_collections",
  FINANCIAL_EXPENSES: "vea_financial_expenses",
  FINANCIAL_WAIVERS: "vea_financial_waivers",
  FINANCIAL_ACCESS_LOGS: "vea_financial_access_logs",
  NOTICES: "vea_noticeboard",
  TIMETABLES: "vea_class_timetables",
  TEACHER_CLASS_ASSIGNMENTS: "vea_teacher_class_assignments",
  ANALYTICS_REPORTS: "vea_analytics_reports",
  REPORT_CARDS: "reportCards",
  REPORT_CARD_CONFIG: "reportCardConfig",
  BRANDING: "schoolBranding",
  SYSTEM_SETTINGS: "systemSettings",
} as const

type FsModule = typeof import("node:fs")

let fsModule: FsModule | null = null

function getFsModule(): FsModule | null {
  if (!isServer()) {
    return null
  }

  if (fsModule) {
    return fsModule
  }

  try {
    fsModule = require("node:fs") as FsModule
  } catch (error) {
    fsModule = null
    if (process.env.NODE_ENV !== "production") {
      logger.warn("Failed to load Node fs module on server", { error })
    }
  }

  return fsModule
}

const serverCollections = new Map<string, unknown[]>()
const DATA_DIRECTORY = join(process.cwd(), ".vea-data")

let hasEnsuredDataDirectory = false

const EXPENSE_CATEGORY_VALUES: ExpenseCategory[] = [
  "Salaries",
  "Utilities",
  "Supplies",
  "Maintenance",
  "Transport",
  "Training",
  "Technology",
  "Miscellaneous",
]

const EXPENSE_CATEGORY_SET = new Set(EXPENSE_CATEGORY_VALUES.map((category) => category.toLowerCase()))

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = EXPENSE_CATEGORY_VALUES

function ensureDataDirectoryExists(): void {
  if (hasEnsuredDataDirectory || !isServer()) {
    return
  }

  const fs = getFsModule()
  if (!fs) {
    return
  }

  try {
    if (!fs.existsSync(DATA_DIRECTORY)) {
      fs.mkdirSync(DATA_DIRECTORY, { recursive: true })
    }
    hasEnsuredDataDirectory = true
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn("Unable to prepare local data directory", { error })
    }
  }
}

function getCollectionFilePath(key: string): string {
  return join(DATA_DIRECTORY, `${key}.json`)
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isServer(): boolean {
  return typeof globalThis === "undefined" || typeof (globalThis as Record<string, unknown>).window === "undefined"
}

function readCollection<T>(key: string): T[] | undefined {
  if (isServer()) {
    const data = serverCollections.get(key)
    if (data) {
      return deepClone(data)
    }

    try {
      ensureDataDirectoryExists()
      const fs = getFsModule()
      if (!fs) {
        return undefined
      }
      const filePath = getCollectionFilePath(key)
      if (fs.existsSync(filePath)) {
        const contents = fs.readFileSync(filePath, "utf8")
        if (contents.trim().length > 0) {
          const parsed = JSON.parse(contents) as T[]
          serverCollections.set(key, deepClone(parsed))
          return deepClone(parsed)
        }
      }
    } catch (error) {
      logger.error(`Failed to restore persisted data for ${key}`, { error })
    }

    return undefined
  }

  const stored = safeStorage.getItem(key)
  if (!stored) {
    return undefined
  }

  try {
    return JSON.parse(stored) as T[]
  } catch (error) {
    logger.error(`Failed to parse data for ${key}`, { error })
    return undefined
  }
}

function persistCollection<T>(key: string, data: T[]): void {
  const cloned = deepClone(data)

  if (isServer()) {
    serverCollections.set(key, cloned)

    try {
      ensureDataDirectoryExists()
      const fs = getFsModule()
      if (!fs) {
        return
      }
      const filePath = getCollectionFilePath(key)
      fs.writeFileSync(filePath, JSON.stringify(cloned, null, 2), "utf8")
    } catch (error) {
      logger.error(`Failed to persist ${key} to local data directory`, { error })
    }
  }

  try {
    safeStorage.setItem(key, JSON.stringify(cloned))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn(`Unable to persist ${key} to storage`, { error })
    }
  }
}

const normaliseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim()

function normaliseStringInput(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  return normaliseWhitespace(value)
}

function normaliseOptionalString(value: unknown): string | null {
  const normalized = normaliseStringInput(value)
  return normalized.length > 0 ? normalized : null
}

function ensurePositiveAmount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Amount must be a positive number")
  }

  return Number(numeric.toFixed(2))
}

function normaliseDateInput(value: unknown, fallback: Date = new Date()): string {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  return fallback.toISOString()
}

function canonicalReceiptNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const cleaned = value.replace(/[^0-9a-z/\-]/gi, "").trim()
  return cleaned.length > 0 ? cleaned.toUpperCase() : null
}

function canonicalTermKey(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function canonicalClassKey(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  const cleaned = value.trim().toLowerCase().replace(/\s+/g, " ")
  if (!cleaned) {
    return ""
  }

  return cleaned.replace(/\b([a-z])$/i, "").trim()
}

function ensureExpenseCategory(category: unknown): ExpenseCategory {
  if (typeof category !== "string") {
    throw new Error("Expense category is required")
  }

  const normalized = category.trim()
  if (normalized.length === 0) {
    throw new Error("Expense category is required")
  }

  const lookup = normalized.toLowerCase()
  if (!EXPENSE_CATEGORY_SET.has(lookup)) {
    throw new Error(`Invalid expense category: ${normalized}`)
  }

  return EXPENSE_CATEGORY_VALUES.find((entry) => entry.toLowerCase() === lookup) as ExpenseCategory
}


function ensureCollection<T>(key: string, seed: () => T[]): T[] {
  const existing = readCollection<T>(key)
  if (existing) {
    return existing
  }

  const seeded = seed()
  persistCollection(key, seeded)
  return deepClone(seeded)
}

function ensureFeePaymentRecords(): FeePaymentRecord[] {
  return ensureCollection<FeePaymentRecord>(STORAGE_KEYS.FINANCIAL_COLLECTIONS, defaultEmptyCollection)
}

function ensureExpenseRecords(): ExpenseRecord[] {
  return ensureCollection<ExpenseRecord>(STORAGE_KEYS.FINANCIAL_EXPENSES, defaultEmptyCollection)
}

function ensureFeeWaiverRecords(): FeeWaiverRecord[] {
  return ensureCollection<FeeWaiverRecord>(STORAGE_KEYS.FINANCIAL_WAIVERS, defaultEmptyCollection)
}

function ensureSchoolFeeConfigurations(): SchoolFeeConfigurationRecord[] {
  return ensureCollection<SchoolFeeConfigurationRecord>(STORAGE_KEYS.SCHOOL_FEES, defaultEmptyCollection)
}

function ensureEventFeeConfigurations(): EventFeeConfigurationRecord[] {
  return ensureCollection<EventFeeConfigurationRecord>(STORAGE_KEYS.EVENT_FEES, defaultEmptyCollection)
}

function ensureFeeConfigurationAuditLog(): FeeConfigurationAuditRecord[] {
  return ensureCollection<FeeConfigurationAuditRecord>(
    STORAGE_KEYS.FEE_CONFIGURATION_AUDIT,
    defaultEmptyCollection,
  )
}

function resolveActorRole(context: FeeConfigurationContext | undefined): string {
  if (!context?.actorRole) {
    return "accountant"
  }

  return normaliseStringInput(context.actorRole).toLowerCase() || "accountant"
}

function recordFeeConfigurationAuditEntry(
  recordType: FeeConfigurationAuditRecord["recordType"],
  action: FeeConfigurationAuditRecord["action"],
  record: SchoolFeeConfigurationRecord | EventFeeConfigurationRecord,
  context: FeeConfigurationContext,
  notes?: string | null,
): void {
  const auditLog = ensureFeeConfigurationAuditLog()
  const timestamp = new Date().toISOString()

  const entry: FeeConfigurationAuditRecord = {
    id: generateId("fee_cfg_audit"),
    actorId: context.userId,
    actorName: context.userName,
    actorRole: resolveActorRole(context),
    action,
    recordType,
    recordId: record.id,
    snapshot: deepClone(record),
    notes: notes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  auditLog.push(entry)
  persistCollection(STORAGE_KEYS.FEE_CONFIGURATION_AUDIT, auditLog)
}

function normaliseTermDetails(value: unknown): { label: string; key: string } {
  const label = normaliseStringInput(value)
  if (!label) {
    throw new Error("Term is required")
  }

  const key = canonicalTermKey(label)
  if (!key) {
    throw new Error("Term is required")
  }

  return { label, key }
}

function normaliseClassDetails(value: unknown): { label: string; key: string } {
  const label = normaliseStringInput(value)
  if (!label) {
    throw new Error("Class name is required")
  }

  const key = canonicalClassKey(label)
  if (!key) {
    throw new Error("Class name is required")
  }

  return { label, key }
}

function normaliseClassListInput(values: unknown): { names: string[]; keys: string[] } {
  if (!Array.isArray(values)) {
    return { names: [], keys: [] }
  }

  const names: string[] = []
  const keys: string[] = []
  const seen = new Set<string>()

  for (const entry of values) {
    const { label, key } = normaliseClassDetails(entry)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    names.push(label)
    keys.push(key)
  }

  return { names, keys }
}

function ensureFinancialAccessLogs(): FinancialAccessLogRecord[] {
  return ensureCollection<FinancialAccessLogRecord>(
    STORAGE_KEYS.FINANCIAL_ACCESS_LOGS,
    defaultEmptyCollection,
  )
}

function ensureSingletonRecord<T extends CollectionRecord>(key: string, factory: () => T): T {
  const records = ensureCollection<T>(key, () => [factory()])

  if (records.length === 0) {
    const value = factory()
    persistCollection(key, [value])
    return deepClone(value)
  }

  if (records.length > 1) {
    const [value] = records
    persistCollection(key, [value])
    return deepClone(value)
  }

  return deepClone(records[0])
}

function generateId(prefix: string): string {
  const globalCrypto =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined

  if (globalCrypto?.randomUUID) {
    return `${prefix}_${globalCrypto.randomUUID()}`
  }

  if (typeof nodeRandomUUID === "function") {
    return `${prefix}_${nodeRandomUUID()}`
  }

  return `${prefix}_${nodeRandomBytes(12).toString("hex")}`
}

interface DefaultUserSeed {
  id: string
  name: string
  email: string
  role: string
  password: string
  classId?: string | null
  className?: string | null
  studentIds?: string[]
  subjects?: string[]
  metadata?: Record<string, unknown> | null
}

function createDefaultUsers(): StoredUser[] {
  const timestamp = new Date().toISOString()

  const seeds: DefaultUserSeed[] = [
    {
      id: "user_super_admin",
      name: "System Super Admin",
      email: "superadmin@vea.edu.ng",
      role: "super_admin",
      password: "SuperAdmin2025!",
      metadata: {
        permissions: ["portal:full_access"],
      },
    },
    {
      id: "user_admin",
      name: "Admin User",
      email: "admin@vea.edu.ng",
      role: "admin",
      password: "Admin2025!",
      metadata: {
        department: "Administration",
      },
    },
    {
      id: "user_teacher",
      name: "Class Teacher",
      email: "teacher@vea.edu.ng",
      role: "teacher",
      password: "Teacher2025!",
      classId: "class_jss1a",
      subjects: ["Mathematics", "English"],
    },
    {
      id: "student_john_doe",
      name: "John Student",
      email: "student@vea.edu.ng",
      role: "student",
      password: "Student2025!",
      classId: "class_jss1a",
      className: "JSS 1A",
      metadata: {
        className: "JSS 1A",
        admissionNumber: "VEA2025001",
      },
    },
    {
      id: "user_parent",
      name: "Parent Guardian",
      email: "parent@vea.edu.ng",
      role: "parent",
      password: "Parent2025!",
      metadata: {
        linkedStudentId: "student_john_doe",
        phone: "+2348012345670",
      },
      studentIds: ["student_john_doe"],
    },
    {
      id: "user_librarian",
      name: "Library Manager",
      email: "librarian@vea.edu.ng",
      role: "librarian",
      password: "Librarian2025!",
    },
    {
      id: "user_accountant",
      name: "Account Officer",
      email: "accountant@vea.edu.ng",
      role: "accountant",
      password: "Accountant2025!",
    },
  ]

  return seeds.map((seed) => ({
    id: seed.id,
    name: seed.name,
    email: seed.email,
    role: seed.role,
    passwordHash: bcrypt.hashSync(seed.password, 12),
    isActive: true,
    status: "active",
    classId: seed.classId ?? null,
    className: seed.className ?? null,
    studentIds: seed.studentIds ?? [],
    subjects: seed.subjects ?? [],
    metadata: seed.metadata ?? null,
    profileImage: null,
    lastLogin: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
}

function createDefaultFeeStructures(): FeeStructureRecord[] {
  const timestamp = new Date().toISOString()

  const seedData: Array<Omit<FeeStructureRecord, "id" | "createdAt" | "updatedAt">> = [
    { className: "JSS 1", tuition: 40000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 50000 },
    { className: "JSS 2", tuition: 42000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 52000 },
    { className: "JSS 3", tuition: 44000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 54000 },
    { className: "SS 1", tuition: 46000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 59000 },
    { className: "SS 2", tuition: 48000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 61000 },
    { className: "SS 3", tuition: 50000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 63000 },
  ]

  return seedData.map((entry) => ({
    id: generateId("fee"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...entry,
  }))
}

function createDefaultFeeStructureDeliveries(): FeeStructureDeliveryRecord[] {
  return []
}

function createDefaultReceipts(): ReceiptRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: generateId("receipt"),
      paymentId: "payment_seed_1",
      receiptNumber: "VEA/2025/0001",
      studentName: "John Doe",
      amount: 50000,
      reference: "PAY001",
      issuedBy: "System",
      dateIssued: timestamp,
      metadata: { className: "JSS 1A" },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultNotices(): NoticeRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: generateId("notice"),
      title: "Welcome to VEA 2025",
      content: "We are excited to kick off the new academic session with refreshed classrooms and updated learning resources.",
      category: "general",
      targetAudience: ["student", "teacher", "parent"],
      authorName: "School Administrator",
      authorRole: "admin",
      isPinned: true,
      scheduledFor: null,
      status: "published",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: generateId("notice"),
      title: "Continuous Assessment Schedule",
      content: "First continuous assessment for all classes begins next Monday. Ensure all students are prepared and have submitted their assignments.",
      category: "academic",
      targetAudience: ["student", "teacher"],
      authorName: "Academic Coordinator",
      authorRole: "teacher",
      isPinned: false,
      scheduledFor: null,
      status: "published",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultTimetableSlots(): TimetableSlotRecord[] {
  const timestamp = new Date().toISOString()

  const baseEntries: Array<Omit<TimetableSlotRecord, "id" | "createdAt" | "updatedAt">> = [
    {
      className: "JSS 1A",
      day: "Monday",
      startTime: "08:00",
      endTime: "08:45",
      subject: "Mathematics",
      teacher: "Mr. Adewale",
      location: "Room 101",
    },
    {
      className: "JSS 1A",
      day: "Monday",
      startTime: "08:45",
      endTime: "09:30",
      subject: "English Language",
      teacher: "Mrs. Okafor",
      location: "Room 101",
    },
    {
      className: "JSS 1A",
      day: "Tuesday",
      startTime: "09:30",
      endTime: "10:15",
      subject: "Basic Science",
      teacher: "Mr. Bello",
      location: "Science Lab",
    },
  ]

  return baseEntries.map((entry) => ({
    id: generateId("slot"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...entry,
  }))
}

function createDefaultAnalyticsReports(): AnalyticsReportRecord[] {
  return []
}

function createDefaultClasses(): ClassRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "class_jss1a",
      name: "JSS 1A",
      level: "Junior Secondary",
      capacity: 35,
      classTeacherId: null,
      status: "active",
      subjects: ["Mathematics", "English", "Basic Science"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultSubjects(): SubjectRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "subject_mathematics",
      name: "Mathematics",
      code: "MATH",
      description: "Core Mathematics curriculum",
      classes: ["JSS 1A"],
      teachers: ["Mr. John Smith"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "subject_english",
      name: "English Language",
      code: "ENG",
      description: "English Language and Literature",
      classes: ["JSS 1A"],
      teachers: ["Mrs. Sarah Johnson"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultStudents(): StudentRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "student_john_doe",
      name: "John Doe",
      email: "john.doe@student.vea.edu.ng",
      class: "JSS 1A",
      section: "A",
      admissionNumber: "VEA2025001",
      parentName: "Jane Doe",
      parentEmail: "jane.doe@example.com",
      paymentStatus: "paid",
      status: "active",
      dateOfBirth: "2008-05-15",
      address: "123 Main Street, Lagos, Nigeria",
      phone: "+2348012345678",
      guardianPhone: "+2348012345670",
      bloodGroup: "O+",
      admissionDate: "2021-09-10",
      subjects: ["Mathematics", "English", "Basic Science"],
      attendance: { present: 115, total: 120 },
      grades: [
        { subject: "Mathematics", ca1: 18, ca2: 19, exam: 55, total: 92, grade: "A" },
        { subject: "English", ca1: 16, ca2: 17, exam: 42, total: 75, grade: "B" },
      ],
      passportUrl: null,
      photoUrl: null,
      isReal: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "student_alice_smith",
      name: "Alice Smith",
      email: "alice.smith@student.vea.edu.ng",
      class: "JSS 2B",
      section: "B",
      admissionNumber: "VEA2025002",
      parentName: "Robert Smith",
      parentEmail: "robert.smith@example.com",
      paymentStatus: "pending",
      status: "active",
      dateOfBirth: "2007-11-23",
      address: "45 School Road, Abuja, Nigeria",
      phone: "+2348023456789",
      guardianPhone: "+2348023456780",
      bloodGroup: "A-",
      admissionDate: "2020-09-12",
      subjects: ["Mathematics", "English", "Physics"],
      attendance: { present: 110, total: 120 },
      grades: [
        { subject: "Mathematics", ca1: 15, ca2: 17, exam: 48, total: 80, grade: "B" },
        { subject: "Physics", ca1: 14, ca2: 16, exam: 50, total: 80, grade: "B" },
      ],
      passportUrl: null,
      photoUrl: null,
      isReal: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

interface ReportCardConfigState extends CollectionRecord {
  columns: ReportCardColumnRecord[]
  layout: ReportCardLayoutConfig
}

function createDefaultReportCardConfigRecord(): ReportCardConfigState {
  const timestamp = new Date().toISOString()

  return {
    id: "report_card_config_default",
    columns: [
      { id: "column_ca1", name: "1st Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 1 },
      { id: "column_ca2", name: "2nd Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 2 },
      { id: "column_exam", name: "Exam", type: "exam", maxScore: 60, weight: 60, isRequired: true, order: 3 },
    ],
    layout: applyLayoutDefaults(DEFAULT_REPORT_CARD_LAYOUT_CONFIG),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createDefaultBrandingRecord(): BrandingRecord {
  const timestamp = new Date().toISOString()

  return {
    id: "branding_default",
    schoolName: "Victory Educational Academy",
    schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
    educationZone: "Municipal Education Zone",
    councilArea: "Bwari Area Council",
    contactPhone: "+234 (0) 700-832-2025",
    contactEmail: "info@victoryacademy.edu.ng",
    headmasterName: "Dr. Emmanuel Adebayo",
    defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
    logoUrl: null,
    signatureUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createDefaultSystemSettingsRecord(): SystemSettingsRecord {
  const timestamp = new Date().toISOString()

  return {
    id: "system_settings_default",
    academicYear: "2024/2025",
    currentTerm: "First Term",
    registrationEnabled: true,
    reportCardDeadline: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function defaultEmptyCollection<T>(): T[] {
  return []
}

function calculateFeeTotal(entry: {
  tuition: number
  development: number
  exam: number
  sports: number
  library: number
}): number {
  return [entry.tuition, entry.development, entry.exam, entry.sports, entry.library].reduce((sum, value) => sum + Number(value || 0), 0)
}

function determineGrade(total: number): string {
  if (total >= 75) return "A"
  if (total >= 60) return "B"
  if (total >= 50) return "C"
  if (total >= 45) return "D"
  if (total >= 40) return "E"
  return "F"
}

function normalizeUserStatusValue(
  status: unknown,
  fallback: StoredUserStatus = "active",
): StoredUserStatus {
  if (typeof status !== "string") {
    return fallback
  }

  const normalized = status.trim().toLowerCase()

  if (normalized === "inactive") {
    return "inactive"
  }

  if (normalized === "suspended") {
    return "suspended"
  }

  if (normalized === "active") {
    return "active"
  }

  return fallback
}

function resolveUserState(options: {
  statusInput?: unknown
  isActiveInput?: unknown
  currentStatus?: StoredUserStatus
}): { status: StoredUserStatus; isActive: boolean } {
  const { statusInput, isActiveInput, currentStatus } = options
  const fallbackStatus = currentStatus ?? "active"

  if (typeof statusInput === "string") {
    const status = normalizeUserStatusValue(statusInput, fallbackStatus)
    return { status, isActive: status === "active" }
  }

  if (typeof isActiveInput === "boolean") {
    if (isActiveInput) {
      return { status: "active", isActive: true }
    }

    const derivedStatus = fallbackStatus === "suspended" ? "suspended" : "inactive"
    return { status: derivedStatus, isActive: false }
  }

  const normalizedFallback = normalizeUserStatusValue(fallbackStatus, "active")
  return { status: normalizedFallback, isActive: normalizedFallback === "active" }
}

// User helpers
function isDatabaseConfigured(): boolean {
  return isServer() && Boolean(process.env.DATABASE_URL)
}

function normalizeRoleForStorage(role: string): string {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_")

  switch (normalized) {
    case "super_admin":
      return "super_admin"
    case "admin":
      return "admin"
    case "teacher":
      return "teacher"
    case "student":
      return "student"
    case "parent":
      return "parent"
    case "librarian":
      return "librarian"
    case "accountant":
      return "accountant"
    default:
      return "teacher"
  }
}

function ensureTeacherClassAssignmentsCollection(): TeacherClassAssignmentRecord[] {
  const assignments = ensureCollection<TeacherClassAssignmentRecord>(
    STORAGE_KEYS.TEACHER_CLASS_ASSIGNMENTS,
    defaultEmptyCollection,
  )

  return assignments.map((assignment) => ({
    ...assignment,
    subjects: Array.isArray(assignment.subjects)
      ? assignment.subjects.map((subject) => String(subject))
      : [],
  }))
}

type NormalizedTeacherAssignment = {
  classRecord: ClassRecord
  subjects: string[]
}

function normalizeTeacherAssignmentRequests(
  assignmentRequests: { classId?: string | null; className?: string | null; subjects?: unknown }[] | undefined,
  fallbackClassIds: string[],
  classes: ClassRecord[],
): NormalizedTeacherAssignment[] {
  const normalized: NormalizedTeacherAssignment[] = []
  const seen = new Set<string>()

  const resolveClass = (identifier: string): ClassRecord => {
    const classRecord = resolveClassRecordByIdentifier(classes, identifier)
    if (!classRecord) {
      throw new Error(`Class not found for identifier: ${identifier}`)
    }
    return classRecord
  }

  const toToken = (value: string) => value.replace(/\s+/g, "").toLowerCase()

  const registerAssignment = (classRecord: ClassRecord, requestedSubjects: unknown) => {
    if (seen.has(classRecord.id)) {
      return
    }

    const classSubjects = normalizeSubjectList(classRecord.subjects)
    if (classSubjects.length === 0) {
      throw new Error(`Cannot assign teacher to ${classRecord.name} because it has no subjects`)
    }

    const classSubjectTokens = classSubjects.map((subject) => ({
      token: toToken(subject),
      value: subject,
    }))

    const requestedList = normalizeSubjectList(requestedSubjects)
    let effectiveSubjects: string[] = classSubjects

    if (requestedList.length > 0) {
      const matched = requestedList
        .map((subject) => {
          const token = toToken(subject)
          const match = classSubjectTokens.find((entry) => entry.token === token)
          return match?.value ?? null
        })
        .filter((subject): subject is string => Boolean(subject))

      if (matched.length === 0) {
        throw new Error(`None of the selected subjects are offered in ${classRecord.name}`)
      }

      effectiveSubjects = Array.from(new Set(matched))
    }

    if (effectiveSubjects.length === 0) {
      throw new Error(`Unable to resolve subjects for ${classRecord.name}`)
    }

    seen.add(classRecord.id)
    normalized.push({ classRecord, subjects: effectiveSubjects })
  }

  const assignments = Array.isArray(assignmentRequests) ? assignmentRequests : []

  assignments.forEach((assignment) => {
    const classId = normalizeClassIdentifier(assignment.classId)
    const className = normalizeClassIdentifier(assignment.className)
    const identifier = classId || className

    if (!identifier) {
      return
    }

    const classRecord = resolveClassRecordByIdentifier(classes, identifier)
    if (!classRecord) {
      throw new Error(`Class not found for identifier: ${identifier}`)
    }

    registerAssignment(classRecord, assignment.subjects)
  })

  const fallbackIdentifiers = fallbackClassIds
    .map((identifier) => normalizeClassIdentifier(identifier))
    .filter((identifier): identifier is string => Boolean(identifier))

  fallbackIdentifiers.forEach((identifier) => {
    const classRecord = resolveClass(identifier)
    registerAssignment(classRecord, undefined)
  })

  if (normalized.length === 0) {
    throw new Error("At least one valid class assignment with subjects is required for teachers")
  }

  return normalized
}

function buildTeacherAssignmentAugmentorFromCollections(
  assignments: TeacherClassAssignmentRecord[],
  classes: ClassRecord[],
): (user: StoredUser) => StoredUser {
  const classMap = new Map(classes.map((entry) => [entry.id, entry]))
  const assignmentsByTeacher = new Map<string, TeacherClassAssignmentRecord[]>()
  const toToken = (value: string) => value.replace(/\s+/g, "").toLowerCase()

  for (const assignment of assignments) {
    if (!assignment.teacherId || !classMap.has(assignment.classId)) {
      continue
    }

    const existing = assignmentsByTeacher.get(assignment.teacherId)
    if (existing) {
      existing.push(assignment)
    } else {
      assignmentsByTeacher.set(assignment.teacherId, [assignment])
    }
  }

  return (user: StoredUser) => {
    const normalizedRole = normalizeRoleForStorage(user.role)
    if (normalizedRole !== "teacher") {
      const clone = deepClone(user)
      if (!Array.isArray(clone.subjects)) {
        clone.subjects = []
      }
      return clone
    }

    const clone = deepClone(user)
    const teacherAssignments = assignmentsByTeacher.get(clone.id) ?? []
    const seenClassIds = new Set<string>()
    const subjects = new Set<string>()
    const summaries: TeacherAssignmentSummary[] = []

    const addSubject = (value: unknown) => {
      if (typeof value !== "string") {
        return
      }

      const trimmed = value.trim()
      if (trimmed.length > 0) {
        subjects.add(trimmed)
      }
    }

    if (Array.isArray(clone.subjects)) {
      for (const subject of clone.subjects) {
        addSubject(subject)
      }
    }

    for (const assignment of teacherAssignments) {
      if (seenClassIds.has(assignment.classId)) {
        continue
      }

      const classRecord = classMap.get(assignment.classId)
      if (!classRecord) {
        continue
      }

      seenClassIds.add(classRecord.id)

      const classSubjects = normalizeSubjectList(classRecord.subjects)
      const classSubjectTokens = classSubjects.map((subject) => ({
        token: toToken(subject),
        value: subject,
      }))
      const assignedSubjects = normalizeSubjectList(assignment.subjects)
      const matchedSubjects =
        assignedSubjects.length > 0
          ? assignedSubjects
              .map((subject) => {
                const token = toToken(subject)
                const match = classSubjectTokens.find((entry) => entry.token === token)
                return match?.value ?? null
              })
              .filter((subject): subject is string => Boolean(subject))
          : classSubjects
      const effectiveSubjects = matchedSubjects.length > 0 ? matchedSubjects : classSubjects

      for (const subject of effectiveSubjects) {
        addSubject(subject)
      }

      summaries.push({
        classId: classRecord.id,
        className: classRecord.name,
        subjects: effectiveSubjects,
      })
    }

    if (summaries.length === 0) {
      const fallbackIdentifiers = new Set<string>()

      const normalizedClassId = normalizeClassIdentifier(clone.classId)
      if (normalizedClassId) {
        fallbackIdentifiers.add(normalizedClassId)
      }

      if (typeof clone.className === "string" && clone.className.trim().length > 0) {
        fallbackIdentifiers.add(clone.className.trim())
      }

      for (const identifier of fallbackIdentifiers) {
        const classRecord = resolveClassRecordByIdentifier(classes, identifier)
        if (!classRecord) {
          continue
        }

        if (seenClassIds.has(classRecord.id)) {
          continue
        }

        seenClassIds.add(classRecord.id)

        const classSubjects = normalizeSubjectList(classRecord.subjects)

        for (const subject of classSubjects) {
          addSubject(subject)
        }

        summaries.push({
          classId: classRecord.id,
          className: classRecord.name,
          subjects: classSubjects,
        })
      }

      if (summaries.length === 0 && typeof clone.className === "string" && clone.className.trim().length > 0) {
        const fallbackClassId = normalizedClassId ?? clone.className.trim()
        const fallbackSubjects = Array.from(subjects)
        seenClassIds.add(fallbackClassId)
        summaries.push({
          classId: fallbackClassId,
          className: clone.className.trim(),
          subjects: fallbackSubjects,
        })
      }
    }

    clone.classId = null
    clone.teachingClassIds = Array.from(seenClassIds)
    clone.subjects = Array.from(subjects)
    clone.teachingAssignments = summaries

    return clone
  }
}

async function buildTeacherAssignmentAugmentor(teacherIds?: string[]): Promise<(user: StoredUser) => StoredUser> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)

  if (isDatabaseConfigured()) {
    const assignments = await getTeacherClassAssignmentsFromDatabase(teacherIds)
    return buildTeacherAssignmentAugmentorFromCollections(assignments, classes)
  }

  const assignments = ensureTeacherClassAssignmentsCollection()

  if (teacherIds && teacherIds.length > 0) {
    const identifiers = new Set(teacherIds)
    return buildTeacherAssignmentAugmentorFromCollections(
      assignments.filter((assignment) => identifiers.has(assignment.teacherId)),
      classes,
    )
  }

  return buildTeacherAssignmentAugmentorFromCollections(assignments, classes)
}

async function augmentUserWithTeachingAssignments(user: StoredUser): Promise<StoredUser> {
  const teacherIds = normalizeRoleForStorage(user.role) === "teacher" ? [user.id] : undefined
  const augment = await buildTeacherAssignmentAugmentor(teacherIds)
  return augment(user)
}

async function augmentUsersWithTeachingAssignments(users: StoredUser[]): Promise<StoredUser[]> {
  const teacherIds = users
    .filter((user) => normalizeRoleForStorage(user.role) === "teacher")
    .map((user) => user.id)

  const augment = await buildTeacherAssignmentAugmentor(teacherIds.length > 0 ? teacherIds : undefined)
  return users.map((user) => augment(user))
}

function normalizeClassIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function collectTeacherClassIds(options: { classIds?: unknown; classId?: unknown }): string[] {
  const identifiers = new Set<string>()

  if (Array.isArray(options.classIds)) {
    for (const entry of options.classIds) {
      const normalized = normalizeClassIdentifier(entry)
      if (normalized) {
        identifiers.add(normalized)
      }
    }
  }

  const single = normalizeClassIdentifier(options.classId)
  if (single) {
    identifiers.add(single)
  }

  return Array.from(identifiers)
}

function resolveClassRecordByIdentifier(classes: ClassRecord[], identifier: string): ClassRecord | null {
  const directMatch = classes.find((record) => record.id === identifier)
  if (directMatch) {
    return directMatch
  }

  const normalized = identifier.trim().toLowerCase()
  const fallback = classes.find((record) => record.name.trim().toLowerCase() === normalized)
  return fallback ?? null
}

function parseStringArray(value: unknown): string[] {
  if (!value && value !== 0) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((entry: unknown) => String(entry)) : []
    } catch (error) {
      logger.error("Failed to parse JSON array column", { error })
      return []
    }
  }

  return []
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null
    } catch (error) {
      logger.error("Failed to parse JSON object column", { error })
      return null
    }
  }

  return null
}

type DbUserRow = RowDataPacket & {
  id: number
  name: string
  email: string
  role: string
  password_hash: string
  status?: string | null
  is_active?: number | null
  class_id?: string | null
  student_ids?: unknown
  subjects?: unknown
  metadata?: unknown
  profile_image?: string | null
  last_login?: string | Date | null
  created_at: string | Date
  updated_at: string | Date
}

const DB_USER_COLUMNS = [
  "id",
  "name",
  "email",
  "role",
  "password_hash",
  "status",
  "is_active",
  "class_id",
  "student_ids",
  "subjects",
  "metadata",
  "profile_image",
  "last_login",
  "created_at",
  "updated_at",
].join(", ")

function mapDatabaseUser(row: DbUserRow): StoredUser {
  const createdAt = typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString()
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString()
  const lastLogin =
    row.last_login === null || row.last_login === undefined
      ? null
      : typeof row.last_login === "string"
        ? new Date(row.last_login).toISOString()
        : row.last_login.toISOString()

  const normalizedStatus = normalizeUserStatusValue(row.status ?? undefined, "active")
  const isActive = row.is_active === null || row.is_active === undefined ? normalizedStatus === "active" : Boolean(row.is_active)

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    status: normalizedStatus,
    isActive,
    classId: row.class_id ?? null,
    studentIds: parseStringArray(row.student_ids),
    subjects: parseStringArray(row.subjects),
    metadata: parseJsonObject(row.metadata) ?? null,
    profileImage: row.profile_image ?? null,
    lastLogin,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  }
}

async function fetchUsersFromDatabase<T extends StoredUser | null>(
  query: string,
  params: Array<string | number>,
  expectSingle: true,
): Promise<T>
async function fetchUsersFromDatabase<T extends StoredUser[]>(
  query: string,
  params: Array<string | number>,
  expectSingle?: false,
): Promise<T>
async function fetchUsersFromDatabase(
  query: string,
  params: Array<string | number>,
  expectSingle = false,
): Promise<StoredUser[] | StoredUser | null> {
  const pool = getPool()
  const [rows] = await pool.query<DbUserRow[]>(query, params)

  if (expectSingle) {
    if (!rows || rows.length === 0) {
      return null
    }
    return mapDatabaseUser(rows[0])
  }

  return rows.map(mapDatabaseUser)
}

type DbTeacherClassAssignmentRow = RowDataPacket & {
  id: string
  teacher_id: string
  class_id: string
  subjects: string | null
  created_at: string | Date
  updated_at: string | Date
}

const TEACHER_CLASS_ASSIGNMENTS_TABLE = "teacher_class_assignments"

let teacherClassAssignmentsTableEnsured = false

async function ensureTeacherClassAssignmentsTable(executor?: SqlExecutor | null) {
  if (teacherClassAssignmentsTableEnsured) {
    return
  }

  const pool = executor ?? getPoolSafe()
  if (!pool) {
    return
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${TEACHER_CLASS_ASSIGNMENTS_TABLE} (
      id VARCHAR(64) PRIMARY KEY,
      teacher_id VARCHAR(64) NOT NULL,
      class_id VARCHAR(64) NOT NULL,
      subjects TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY unique_teacher_class (teacher_id, class_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  )

  try {
    await pool.query(
      `ALTER TABLE ${TEACHER_CLASS_ASSIGNMENTS_TABLE} ADD COLUMN subjects TEXT NULL AFTER class_id`,
    )
  } catch (error) {
    if (
      !(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ER_DUP_FIELDNAME")
    ) {
      throw error
    }
  }

  teacherClassAssignmentsTableEnsured = true
}

async function getTeacherClassAssignmentsFromDatabase(teacherIds?: string[]): Promise<TeacherClassAssignmentRecord[]> {
  await ensureTeacherClassAssignmentsTable()

  const pool = getPool()
  const params: string[] = []
  let query = `SELECT id, teacher_id, class_id, subjects, created_at, updated_at FROM ${TEACHER_CLASS_ASSIGNMENTS_TABLE}`

  if (teacherIds && teacherIds.length > 0) {
    const filtered = teacherIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    if (filtered.length === 0) {
      return []
    }

    query += ` WHERE teacher_id IN (${filtered.map(() => "?").join(", ")})`
    params.push(...filtered)
  }

  const [rows] = await pool.query<DbTeacherClassAssignmentRow[]>(query, params)

  return rows.map((row) => ({
    id: String(row.id),
    teacherId: String(row.teacher_id),
    classId: String(row.class_id),
    subjects: parseStringArray(row.subjects),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }))
}

async function getUserByEmailFromDatabase(email: string): Promise<StoredUser | null> {
  return (await fetchUsersFromDatabase(
    `SELECT ${DB_USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
    [email.trim().toLowerCase()],
    true,
  )) as StoredUser | null
}

async function getUserByIdFromDatabase(id: string): Promise<StoredUser | null> {
  const numericId = Number(id)
  if (Number.isNaN(numericId)) {
    return null
  }

  return (await fetchUsersFromDatabase(
    `SELECT ${DB_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [numericId],
    true,
  )) as StoredUser | null
}

async function getUsersByRoleFromDatabase(role: string): Promise<StoredUser[]> {
  const normalizedRole = normalizeRoleForStorage(role)
  return (await fetchUsersFromDatabase(
    `SELECT ${DB_USER_COLUMNS} FROM users WHERE role = ? ORDER BY created_at DESC`,
    [normalizedRole],
  )) as StoredUser[]
}

async function getAllUsersFromDatabase(): Promise<StoredUser[]> {
  return (await fetchUsersFromDatabase(`SELECT ${DB_USER_COLUMNS} FROM users ORDER BY created_at DESC`, [])) as StoredUser[]
}

function formatJsonColumn(value: string[] | undefined): string | null {
  if (!value) {
    return null
  }

  return JSON.stringify(value.map((entry) => String(entry)))
}

function formatMetadataColumn(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) {
    return null
  }

  try {
    return JSON.stringify(value)
  } catch (error) {
    logger.error("Failed to stringify metadata column", { error })
    return null
  }
}

function mapMysqlError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code)
    if (code === "ER_DUP_ENTRY") {
      throw new Error("User with this email already exists")
    }
  }

  throw error instanceof Error ? error : new Error("Database operation failed")
}

async function createUserInDatabase(
  payload: CreateUserPayload,
  options?: { normalizedRole?: string; teacherAssignments?: { classId: string; subjects: string[] }[] },
): Promise<StoredUser> {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const normalizedRole = options?.normalizedRole ?? normalizeRoleForStorage(payload.role)
  const { status, isActive } = resolveUserState({
    statusInput: payload.status,
    isActiveInput: payload.isActive,
    currentStatus: "active",
  })

  const connection = await getPool().getConnection()

  try {
    if (normalizedRole === "teacher") {
      await ensureTeacherClassAssignmentsTable(connection)
    }

    await connection.beginTransaction()

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (name, email, role, password_hash, status, is_active, class_id, student_ids, subjects, metadata, profile_image, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        payload.name,
        normalizedEmail,
        normalizedRole,
        payload.passwordHash,
        status,
        isActive ? 1 : 0,
        normalizedRole === "teacher" ? null : payload.classId ?? null,
        formatJsonColumn(payload.studentIds ?? (payload.studentId ? [String(payload.studentId)] : undefined)),
        normalizedRole === "teacher" ? JSON.stringify([]) : formatJsonColumn(payload.subjects),
        formatMetadataColumn(payload.metadata ?? null),
        payload.profileImage ?? null,
        payload.lastLogin ?? null,
      ],
    )

    const insertedId = String((result as ResultSetHeader).insertId)

    if (normalizedRole === "teacher") {
      const assignments = options?.teacherAssignments ?? []
      if (assignments.length === 0) {
        throw new Error("Assign at least one class to the teacher account")
      }

      const timestamp = new Date().toISOString()
      const placeholders: string[] = []
      const values: Array<string | null> = []

      for (const assignment of assignments) {
        placeholders.push("(?, ?, ?, ?, ?, ?)")
        values.push(
          generateId("teacher_class"),
          insertedId,
          String(assignment.classId),
          JSON.stringify(assignment.subjects ?? []),
          timestamp,
          timestamp,
        )
      }

      await connection.query(
        `INSERT INTO ${TEACHER_CLASS_ASSIGNMENTS_TABLE} (id, teacher_id, class_id, subjects, created_at, updated_at) VALUES ${placeholders.join(", ")}`,
        values,
      )
    }

    await connection.commit()

    const created = await getUserByIdFromDatabase(insertedId)
    if (!created) {
      throw new Error("Unable to load created user")
    }

    return created
  } catch (error) {
    await connection.rollback()
    throw mapMysqlError(error)
  } finally {
    connection.release()
  }
}

async function updateUserInDatabase(id: string, updates: UpdateUserPayload): Promise<StoredUser | null> {
  const existing = await getUserByIdFromDatabase(id)
  if (!existing) {
    return null
  }

  const previousRole = normalizeRoleForStorage(existing.role)
  const nextRole = updates.role !== undefined ? normalizeRoleForStorage(String(updates.role)) : previousRole

  const fields: string[] = []
  const values: Array<string | number | null> = []

  if (updates.name !== undefined) {
    fields.push("name = ?")
    values.push(String(updates.name))
  }

  if (updates.email !== undefined) {
    fields.push("email = ?")
    values.push(String(updates.email).trim().toLowerCase())
  }

  if (updates.role !== undefined) {
    fields.push("role = ?")
    values.push(nextRole)
  }

  if (updates.passwordHash !== undefined) {
    fields.push("password_hash = ?")
    values.push(String(updates.passwordHash))
  }

  if (nextRole === "teacher") {
    fields.push("class_id = ?")
    values.push(null)
  } else if (updates.classId !== undefined) {
    fields.push("class_id = ?")
    values.push(updates.classId ? String(updates.classId) : null)
  }

  if (updates.studentIds !== undefined) {
    fields.push("student_ids = ?")
    values.push(formatJsonColumn(updates.studentIds))
  } else if (updates.studentId !== undefined) {
    fields.push("student_ids = ?")
    values.push(updates.studentId ? JSON.stringify([String(updates.studentId)]) : null)
  }

  if (updates.subjects !== undefined && nextRole !== "teacher") {
    fields.push("subjects = ?")
    values.push(formatJsonColumn(updates.subjects))
  }

  if (updates.metadata !== undefined) {
    fields.push("metadata = ?")
    values.push(formatMetadataColumn(updates.metadata))
  }

  if (updates.profileImage !== undefined) {
    fields.push("profile_image = ?")
    values.push(updates.profileImage ?? null)
  }

  if (updates.lastLogin !== undefined) {
    fields.push("last_login = ?")
    values.push(updates.lastLogin ?? null)
  }

  if (updates.status !== undefined || updates.isActive !== undefined) {
    const resolvedState = resolveUserState({
      statusInput: updates.status,
      isActiveInput: updates.isActive,
      currentStatus: existing.status,
    })
    fields.push("status = ?")
    values.push(resolvedState.status)
    fields.push("is_active = ?")
    values.push(resolvedState.isActive ? 1 : 0)
  }

  const requiresClassValidation = nextRole === "teacher" || previousRole === "teacher"
  const classes = requiresClassValidation
    ? ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
    : []

  let teacherAssignmentsPayload: { classId: string; subjects: string[] }[] | null = null
  let shouldReplaceAssignments = false
  let shouldClearAssignments = false

  if (nextRole === "teacher") {
    const hasAssignmentUpdates =
      updates.teachingAssignments !== undefined || updates.classIds !== undefined || updates.classId !== undefined

    if (!hasAssignmentUpdates && previousRole !== "teacher") {
      throw new Error("Provide classes when converting a user to a teacher")
    }

    const assignmentRequests = Array.isArray(updates.teachingAssignments)
      ? updates.teachingAssignments.map((assignment) => ({
          classId: (assignment as { classId?: unknown }).classId ?? null,
          className: (assignment as { className?: unknown }).className ?? null,
          subjects: assignment?.subjects,
        }))
      : undefined

    const fallbackClassIdsFromAssignments = Array.isArray(updates.teachingAssignments)
      ? updates.teachingAssignments
          .map((assignment) => normalizeClassIdentifier(assignment?.classId ?? assignment?.className))
          .filter((identifier): identifier is string => Boolean(identifier))
      : []

    const fallbackClassIdsToUse =
      fallbackClassIdsFromAssignments.length > 0
        ? fallbackClassIdsFromAssignments
        : collectTeacherClassIds({ classIds: updates.classIds, classId: updates.classId })

    if (fallbackClassIdsToUse.length === 0) {
      throw new Error("Teachers must be assigned to at least one class")
    }

    const normalizedAssignments = normalizeTeacherAssignmentRequests(
      assignmentRequests,
      fallbackClassIdsToUse,
      classes,
    )

    teacherAssignmentsPayload = normalizedAssignments.map((assignment) => ({
      classId: assignment.classRecord.id,
      subjects: assignment.subjects,
    }))

    shouldReplaceAssignments = true
  } else {
    if (previousRole === "teacher") {
      shouldClearAssignments = true
    }
  }

  const connection = await getPool().getConnection()

  try {
    if (nextRole === "teacher" || shouldClearAssignments || shouldReplaceAssignments) {
      await ensureTeacherClassAssignmentsTable(connection)
    }

    await connection.beginTransaction()

    const numericId = Number(id)
    if (Number.isNaN(numericId)) {
      throw new Error("Invalid user identifier")
    }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP")
      await connection.execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, numericId])
    }

    if (shouldClearAssignments || shouldReplaceAssignments || nextRole !== "teacher") {
      if (previousRole === "teacher" || shouldClearAssignments || shouldReplaceAssignments) {
        await connection.execute(`DELETE FROM ${TEACHER_CLASS_ASSIGNMENTS_TABLE} WHERE teacher_id = ?`, [String(numericId)])
      }
    }

    if (nextRole === "teacher" && teacherAssignmentsPayload && teacherAssignmentsPayload.length > 0) {
      const timestamp = new Date().toISOString()
      const placeholders: string[] = []
      const assignmentValues: Array<string | null> = []

      for (const assignment of teacherAssignmentsPayload) {
        placeholders.push("(?, ?, ?, ?, ?, ?)")
        assignmentValues.push(
          generateId("teacher_class"),
          String(numericId),
          String(assignment.classId),
          JSON.stringify(assignment.subjects ?? []),
          timestamp,
          timestamp,
        )
      }

      await connection.query(
        `INSERT INTO ${TEACHER_CLASS_ASSIGNMENTS_TABLE} (id, teacher_id, class_id, subjects, created_at, updated_at) VALUES ${placeholders.join(", ")}`,
        assignmentValues,
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw mapMysqlError(error)
  } finally {
    connection.release()
  }

  return await getUserByIdFromDatabase(id)
}

async function deleteUserFromDatabase(id: string): Promise<boolean> {
  const numericId = Number(id)
  if (Number.isNaN(numericId)) {
    return false
  }

  const connection = await getPool().getConnection()

  try {
    await ensureTeacherClassAssignmentsTable(connection)
    await connection.beginTransaction()

    await connection.execute(`DELETE FROM ${TEACHER_CLASS_ASSIGNMENTS_TABLE} WHERE teacher_id = ?`, [String(numericId)])
    const [result] = await connection.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [numericId])

    await connection.commit()
    return (result as ResultSetHeader).affectedRows > 0
  } catch (error) {
    await connection.rollback()
    throw mapMysqlError(error)
  } finally {
    connection.release()
  }
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  if (isDatabaseConfigured()) {
    try {
      const databaseUser = await getUserByEmailFromDatabase(email)
      if (databaseUser) {
        return await augmentUserWithTeachingAssignments(databaseUser)
      }
    } catch (error) {
      logger.error("Failed to fetch user by email from database", { email, error })
    }
  }

  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const match = users.find((user) => user.email.toLowerCase() === normalized)
  return match ? await augmentUserWithTeachingAssignments(match) : null
}

export async function getUserByIdFromDb(id: string): Promise<StoredUser | null> {
  if (isDatabaseConfigured()) {
    const record = await getUserByIdFromDatabase(id)
    if (record) {
      return await augmentUserWithTeachingAssignments(record)
    }
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const match = users.find((user) => user.id === id)
  return match ? await augmentUserWithTeachingAssignments(match) : null
}

export async function getAllUsersFromDb(): Promise<StoredUser[]> {
  if (isDatabaseConfigured()) {
    const databaseUsers = await getAllUsersFromDatabase()
    return await augmentUsersWithTeachingAssignments(databaseUsers)
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  return await augmentUsersWithTeachingAssignments(users)
}

export async function getUsersByRoleFromDb(role: string): Promise<StoredUser[]> {
  if (isDatabaseConfigured()) {
    const databaseUsers = await getUsersByRoleFromDatabase(role)
    return await augmentUsersWithTeachingAssignments(databaseUsers)
  }

  const normalizedRole = role.trim().toLowerCase()
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const filtered = users.filter((user) => user.role.trim().toLowerCase() === normalizedRole)
  return await augmentUsersWithTeachingAssignments(filtered)
}

export async function createUserRecord(payload: CreateUserPayload): Promise<StoredUser> {
  const normalizedRole = normalizeRoleForStorage(payload.role)
  const classes: ClassRecord[] = normalizedRole === "teacher"
    ? ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
    : []
  let teacherAssignments: NormalizedTeacherAssignment[] = []

  if (normalizedRole === "teacher") {
    const fallbackClassIds = collectTeacherClassIds({ classIds: payload.classIds, classId: payload.classId })
    teacherAssignments = normalizeTeacherAssignmentRequests(
      payload.teachingAssignments,
      fallbackClassIds,
      classes,
    )
  }

  if (isDatabaseConfigured()) {
    const created = await createUserInDatabase(payload, {
      normalizedRole,
      teacherAssignments: teacherAssignments.map((assignment) => ({
        classId: assignment.classRecord.id,
        subjects: assignment.subjects,
      })),
    })

    return await augmentUserWithTeachingAssignments(created)
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const normalizedEmail = payload.email.trim().toLowerCase()

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error("User with this email already exists")
  }

  const timestamp = new Date().toISOString()
  const { status, isActive } = resolveUserState({
    statusInput: payload.status,
    isActiveInput: payload.isActive,
    currentStatus: "active",
  })

  const userId = generateId("user")
  let storedClassId: string | null = payload.classId ?? null
  let storedSubjects: string[] = Array.isArray(payload.subjects) ? [...payload.subjects] : []
  const storedStudentIds = payload.studentIds ?? (payload.studentId ? [String(payload.studentId)] : [])
  const metadata = payload.metadata ?? null

  let assignmentsToPersist: TeacherClassAssignmentRecord[] = []

  if (normalizedRole === "teacher") {
    assignmentsToPersist = teacherAssignments.map((assignment) => ({
      id: generateId("teacher_class"),
      teacherId: userId,
      classId: assignment.classRecord.id,
      subjects: assignment.subjects,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    storedClassId = null
    storedSubjects = []
  }

  const newUser: StoredUser = {
    id: userId,
    name: payload.name,
    email: normalizedEmail,
    role: normalizedRole,
    passwordHash: payload.passwordHash,
    isActive,
    status,
    classId: storedClassId,
    studentIds: storedStudentIds,
    subjects: storedSubjects,
    metadata,
    profileImage: payload.profileImage ?? null,
    lastLogin: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  users.push(newUser)
  persistCollection(STORAGE_KEYS.USERS, users)

  if (assignmentsToPersist.length > 0) {
    const assignments = ensureTeacherClassAssignmentsCollection()
    persistCollection(STORAGE_KEYS.TEACHER_CLASS_ASSIGNMENTS, [...assignments, ...assignmentsToPersist])
  }

  return await augmentUserWithTeachingAssignments(newUser)
}

export async function updateUserRecord(id: string, updates: UpdateUserPayload): Promise<StoredUser | null> {
  if (isDatabaseConfigured()) {
    const updated = await updateUserInDatabase(id, updates)
    return updated ? await augmentUserWithTeachingAssignments(updated) : null
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const index = users.findIndex((user) => user.id === id)

  if (index === -1) {
    return null
  }

  const existing = users[index]
  const timestamp = new Date().toISOString()

  const {
    studentId,
    studentIds,
    subjects,
    email,
    status,
    isActive,
    classIds,
    classId,
    role,
    teachingAssignments,
    ...otherUpdates
  } = updates as UpdateUserPayload & {
    [key: string]: unknown
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase()
    if (
      normalizedEmail !== existing.email &&
      users.some((user, idx) => idx !== index && user.email.toLowerCase() === normalizedEmail)
    ) {
      throw new Error("Email already in use")
    }
    existing.email = normalizedEmail
  }

  const previousRole = normalizeRoleForStorage(existing.role)
  let nextRole = previousRole

  if (role !== undefined) {
    nextRole = normalizeRoleForStorage(String(role))
    existing.role = nextRole
  }

  let assignmentsToPersist: TeacherClassAssignmentRecord[] | null = null
  let normalizedTeachingAssignments: NormalizedTeacherAssignment[] | null = null
  const classesForAssignments: ClassRecord[] = nextRole === "teacher" || previousRole === "teacher"
    ? ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
    : []

  if (nextRole === "teacher") {
    existing.classId = null

    const hasAssignmentUpdates =
      teachingAssignments !== undefined || classIds !== undefined || classId !== undefined || previousRole !== "teacher"

    if (hasAssignmentUpdates) {
      const assignmentRequests = Array.isArray(teachingAssignments)
        ? teachingAssignments.map((assignment) => ({
            classId: (assignment as { classId?: unknown }).classId ?? null,
            className: (assignment as { className?: unknown }).className ?? null,
            subjects: assignment?.subjects,
          }))
        : undefined

      const fallbackClassIdsFromAssignments = Array.isArray(teachingAssignments)
        ? teachingAssignments
            .map((assignment) => normalizeClassIdentifier(assignment?.classId ?? assignment?.className))
            .filter((identifier): identifier is string => Boolean(identifier))
        : []

      const fallbackClassIdsToUse =
        fallbackClassIdsFromAssignments.length > 0
          ? fallbackClassIdsFromAssignments
          : collectTeacherClassIds({ classIds, classId })

      normalizedTeachingAssignments = normalizeTeacherAssignmentRequests(
        assignmentRequests,
        fallbackClassIdsToUse,
        classesForAssignments,
      )

      const currentAssignments = ensureTeacherClassAssignmentsCollection()
      const filtered = currentAssignments.filter((assignment) => assignment.teacherId !== existing.id)
      assignmentsToPersist = [
        ...filtered,
        ...normalizedTeachingAssignments.map((assignment) => ({
          id: generateId("teacher_class"),
          teacherId: existing.id,
          classId: assignment.classRecord.id,
          subjects: assignment.subjects,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      ]
    } else if (previousRole !== "teacher") {
      throw new Error("Provide classes when converting a user to a teacher")
    }

    existing.subjects = []
  } else {
    if (classId !== undefined) {
      existing.classId = classId ? String(classId) : null
    }

    if (previousRole === "teacher") {
      const currentAssignments = ensureTeacherClassAssignmentsCollection()
      const filtered = currentAssignments.filter((assignment) => assignment.teacherId !== existing.id)
      assignmentsToPersist = filtered
    }
  }

  for (const [key, value] of Object.entries(otherUpdates)) {
    if (value !== undefined) {
      ;(existing as Record<string, unknown>)[key] = value
    }
  }

  const currentStatus = existing.status ?? (existing.isActive === false ? "inactive" : "active")
  const resolvedState = resolveUserState({
    statusInput: status,
    isActiveInput: isActive,
    currentStatus,
  })

  existing.status = resolvedState.status
  existing.isActive = resolvedState.isActive

  if (studentIds !== undefined) {
    existing.studentIds = Array.isArray(studentIds) ? studentIds.map(String) : []
  } else if (studentId !== undefined) {
    existing.studentIds = studentId ? [String(studentId)] : []
  }

  if (subjects !== undefined && nextRole !== "teacher") {
    existing.subjects = Array.isArray(subjects) ? subjects.map(String) : []
  }

  existing.updatedAt = timestamp
  users[index] = existing
  persistCollection(STORAGE_KEYS.USERS, users)

  if (assignmentsToPersist !== null) {
    persistCollection(STORAGE_KEYS.TEACHER_CLASS_ASSIGNMENTS, assignmentsToPersist)
  }

  const updatedUser = await augmentUserWithTeachingAssignments(existing)

  if (normalizedTeachingAssignments && normalizedTeachingAssignments.length > 0) {
    updatedUser.teachingAssignments = normalizedTeachingAssignments.map((assignment) => ({
      classId: assignment.classRecord.id,
      className: assignment.classRecord.name,
      subjects: assignment.subjects,
    }))
  }

  return updatedUser
}

export async function deleteUserRecord(id: string): Promise<boolean> {
  if (isDatabaseConfigured()) {
    return await deleteUserFromDatabase(id)
  }

  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const index = users.findIndex((user) => user.id === id)

  if (index === -1) {
    return false
  }

  const [removed] = users.splice(index, 1)
  persistCollection(STORAGE_KEYS.USERS, users)

  if (removed && normalizeRoleForStorage(removed.role) === "teacher") {
    const assignments = ensureTeacherClassAssignmentsCollection()
    const filtered = assignments.filter((assignment) => assignment.teacherId !== removed.id)
    if (filtered.length !== assignments.length) {
      persistCollection(STORAGE_KEYS.TEACHER_CLASS_ASSIGNMENTS, filtered)
    }
  }

  return true
}

// Class helpers
export async function getAllClassesFromDb(): Promise<ClassRecord[]> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  return deepClone(classes)
}

const normaliseClassIdentifier = (value: string): string =>
  value.replace(/\s+/g, "").toLowerCase()

export async function getClassRecordById(id: string): Promise<ClassRecord | null> {
  if (!id) {
    return null
  }

  const trimmedId = id.trim()
  if (!trimmedId) {
    return null
  }

  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  const exactMatch = classes.find((record) => record.id === trimmedId)
  if (exactMatch) {
    return deepClone(exactMatch)
  }

  const normalisedTarget = normaliseClassIdentifier(trimmedId)
  const fallbackMatch =
    classes.find((record) => normaliseClassIdentifier(record.id) === normalisedTarget) ??
    classes.find((record) => normaliseClassIdentifier(record.name) === normalisedTarget) ??
    null

  return fallbackMatch ? deepClone(fallbackMatch) : null
}

export async function createClassRecord(payload: CreateClassPayload): Promise<ClassRecord> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  const timestamp = new Date().toISOString()

  const newClass: ClassRecord = {
    id: generateId("class"),
    name: payload.name,
    level: payload.level,
    capacity: payload.capacity ?? null,
    classTeacherId: payload.classTeacherId ?? null,
    status: payload.status ?? "active",
    subjects: payload.subjects ? [...payload.subjects] : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  classes.push(newClass)
  persistCollection(STORAGE_KEYS.CLASSES, classes)
  return deepClone(newClass)
}

export async function updateClassRecord(id: string, updates: UpdateClassPayload): Promise<ClassRecord | null> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  const index = classes.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = classes[index]
  const timestamp = new Date().toISOString()

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === "subjects" && Array.isArray(value)) {
        existing.subjects = value.map(String)
      } else {
        ;(existing as Record<string, unknown>)[key] = value
      }
    }
  }

  existing.updatedAt = timestamp
  classes[index] = existing
  persistCollection(STORAGE_KEYS.CLASSES, classes)
  return deepClone(existing)
}

export async function deleteClassRecord(id: string): Promise<boolean> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  const index = classes.findIndex((record) => record.id === id)

  if (index === -1) {
    return false
  }

  classes.splice(index, 1)
  persistCollection(STORAGE_KEYS.CLASSES, classes)
  return true
}

export async function listSubjectRecords(): Promise<SubjectRecord[]> {
  const subjects = ensureCollection<SubjectRecord>(STORAGE_KEYS.SUBJECTS, createDefaultSubjects)
  return deepClone(subjects)
}

export async function createSubjectRecord(payload: CreateSubjectPayload): Promise<SubjectRecord> {
  const subjects = ensureCollection<SubjectRecord>(STORAGE_KEYS.SUBJECTS, createDefaultSubjects)

  if (subjects.some((subject) => subject.code.toLowerCase() === payload.code.toLowerCase())) {
    throw new Error("Subject with this code already exists")
  }

  const timestamp = new Date().toISOString()
  const record: SubjectRecord = {
    id: generateId("subject"),
    name: payload.name,
    code: payload.code,
    description: payload.description ?? null,
    classes: payload.classes ? payload.classes.map(String) : [],
    teachers: payload.teachers ? payload.teachers.map(String) : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  subjects.push(record)
  persistCollection(STORAGE_KEYS.SUBJECTS, subjects)
  return deepClone(record)
}

export async function updateSubjectRecord(
  id: string,
  updates: UpdateSubjectPayload,
): Promise<SubjectRecord | null> {
  const subjects = ensureCollection<SubjectRecord>(STORAGE_KEYS.SUBJECTS, createDefaultSubjects)
  const index = subjects.findIndex((subject) => subject.id === id)

  if (index === -1) {
    return null
  }

  const existing = subjects[index]

  if (updates.code) {
    const normalizedCode = updates.code.toLowerCase()
    if (subjects.some((subject, idx) => idx !== index && subject.code.toLowerCase() === normalizedCode)) {
      throw new Error("Subject with this code already exists")
    }
    existing.code = updates.code
  }

  if (updates.name !== undefined) {
    existing.name = updates.name
  }

  if (updates.description !== undefined) {
    existing.description = updates.description ?? null
  }

  if (updates.classes !== undefined) {
    existing.classes = Array.isArray(updates.classes) ? updates.classes.map(String) : []
  }

  if (updates.teachers !== undefined) {
    existing.teachers = Array.isArray(updates.teachers) ? updates.teachers.map(String) : []
  }

  existing.updatedAt = new Date().toISOString()
  subjects[index] = existing
  persistCollection(STORAGE_KEYS.SUBJECTS, subjects)
  return deepClone(existing)
}

export async function deleteSubjectRecord(id: string): Promise<boolean> {
  const subjects = ensureCollection<SubjectRecord>(STORAGE_KEYS.SUBJECTS, createDefaultSubjects)
  const index = subjects.findIndex((subject) => subject.id === id)

  if (index === -1) {
    return false
  }

  subjects.splice(index, 1)
  persistCollection(STORAGE_KEYS.SUBJECTS, subjects)
  return true
}

export async function listStudentRecords(): Promise<StudentRecord[]> {
  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)
  let mutated = false

  for (const student of students) {
    if (typeof student.isReal !== "boolean") {
      student.isReal = true
      mutated = true
    }
  }

  if (mutated) {
    persistCollection(STORAGE_KEYS.STUDENTS, students)
  }

  return deepClone(students).map((student) => ({
    ...student,
    passportUrl: student.passportUrl ?? student.photoUrl ?? null,
    photoUrl: student.photoUrl ?? student.passportUrl ?? null,
    isReal: student.isReal !== false,
  }))
}

export async function getStudentRecordById(id: string): Promise<StudentRecord | null> {
  if (!id) {
    return null
  }

  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)
  const record = students.find((student) => student.id === id)

  if (!record) {
    return null
  }

  if (typeof record.isReal !== "boolean") {
    record.isReal = true
    persistCollection(STORAGE_KEYS.STUDENTS, students)
  }

  return deepClone({
    ...record,
    passportUrl: record.passportUrl ?? record.photoUrl ?? null,
    photoUrl: record.photoUrl ?? record.passportUrl ?? null,
    isReal: record.isReal !== false,
  })
}

export async function createStudentRecord(payload: CreateStudentPayload): Promise<StudentRecord> {
  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)

  if (students.some((student) => student.admissionNumber === payload.admissionNumber)) {
    throw new Error("Student with this admission number already exists")
  }

  const timestamp = new Date().toISOString()
  const normalizedPassport =
    normaliseOptionalString(payload.passportUrl) ?? normaliseOptionalString(payload.photoUrl)

  const record: StudentRecord = {
    id: generateId("student"),
    ...payload,
    subjects: payload.subjects ? payload.subjects.map(String) : [],
    attendance: payload.attendance ?? { present: 0, total: 0 },
    grades: payload.grades ? payload.grades.map((grade) => ({ ...grade })) : [],
    passportUrl: normalizedPassport ?? null,
    photoUrl: normalizedPassport ?? null,
    isReal: payload.isReal !== false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  students.push(record)
  persistCollection(STORAGE_KEYS.STUDENTS, students)
  return deepClone(record)
}

export async function updateStudentRecord(
  id: string,
  updates: UpdateStudentPayload,
): Promise<StudentRecord | null> {
  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)
  const index = students.findIndex((student) => student.id === id)

  if (index === -1) {
    return null
  }

  const existing = students[index]

  if (updates.admissionNumber && updates.admissionNumber !== existing.admissionNumber) {
    if (students.some((student, idx) => idx !== index && student.admissionNumber === updates.admissionNumber)) {
      throw new Error("Student with this admission number already exists")
    }
    existing.admissionNumber = updates.admissionNumber
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || key === "admissionNumber") {
      continue
    }

    if (key === "subjects" && Array.isArray(value)) {
      existing.subjects = value.map(String)
    } else if (key === "grades" && Array.isArray(value)) {
      existing.grades = value.map((grade) => ({ ...grade }))
    } else if (key === "attendance" && value && typeof value === "object") {
      existing.attendance = { ...(value as StudentRecord["attendance"]) }
    } else if (key === "photoUrl" || key === "passportUrl") {
      const normalized = value ?? null
      existing.photoUrl = normalized
      existing.passportUrl = normalized
    } else if (key === "status") {
      existing.status = String(value).toLowerCase() === "inactive" ? "inactive" : "active"
    } else if (key === "isReal") {
      existing.isReal = value !== false
    } else if (key !== "id" && key !== "createdAt" && key !== "updatedAt") {
      ;(existing as Record<string, unknown>)[key] = value
    }
  }

  existing.updatedAt = new Date().toISOString()
  students[index] = existing
  persistCollection(STORAGE_KEYS.STUDENTS, students)
  return deepClone(existing)
}

export async function deleteStudentRecord(id: string): Promise<boolean> {
  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)
  const index = students.findIndex((student) => student.id === id)

  if (index === -1) {
    return false
  }

  students.splice(index, 1)
  persistCollection(STORAGE_KEYS.STUDENTS, students)
  return true
}

export async function getReportCardConfigColumns(): Promise<ReportCardColumnRecord[]> {
  const record = ensureSingletonRecord<ReportCardConfigState>(
    STORAGE_KEYS.REPORT_CARD_CONFIG,
    createDefaultReportCardConfigRecord,
  )

  return deepClone(record.columns)
}

export async function updateReportCardConfigColumns(
  columns: ReportCardColumnRecord[],
): Promise<ReportCardColumnRecord[]> {
  const existing = ensureSingletonRecord<ReportCardConfigState>(
    STORAGE_KEYS.REPORT_CARD_CONFIG,
    createDefaultReportCardConfigRecord,
  )

  const timestamp = new Date().toISOString()
  const normalized = columns
    .map((column, index) => ({
      ...column,
      id: column.id ?? generateId("column"),
      order: typeof column.order === "number" ? column.order : index + 1,
    }))
    .sort((a, b) => a.order - b.order)
    .map((column, index) => ({ ...column, order: index + 1 }))

  const normalizedLayout = applyLayoutDefaults(existing.layout, generateId)

  const updated: ReportCardConfigState = {
    ...existing,
    columns: normalized,
    layout: normalizedLayout,
    updatedAt: timestamp,
  }

  persistCollection(STORAGE_KEYS.REPORT_CARD_CONFIG, [updated])
  return deepClone(updated.columns)
}

export async function getReportCardLayoutConfig(): Promise<ReportCardLayoutConfig> {
  const existing = ensureSingletonRecord<ReportCardConfigState>(
    STORAGE_KEYS.REPORT_CARD_CONFIG,
    createDefaultReportCardConfigRecord,
  )

  const normalizedLayout = applyLayoutDefaults(existing.layout, generateId)

  if (JSON.stringify(existing.layout) !== JSON.stringify(normalizedLayout)) {
    const timestamp = new Date().toISOString()
    const updated: ReportCardConfigState = {
      ...existing,
      layout: normalizedLayout,
      updatedAt: timestamp,
    }

    persistCollection(STORAGE_KEYS.REPORT_CARD_CONFIG, [updated])
    return deepClone(updated.layout)
  }

  return deepClone(existing.layout)
}

export async function updateReportCardLayoutConfig(
  layout: Partial<ReportCardLayoutConfig>,
): Promise<ReportCardLayoutConfig> {
  const existing = ensureSingletonRecord<ReportCardConfigState>(
    STORAGE_KEYS.REPORT_CARD_CONFIG,
    createDefaultReportCardConfigRecord,
  )

  const timestamp = new Date().toISOString()
  const normalizedLayout = applyLayoutDefaults(layout, generateId)

  const updated: ReportCardConfigState = {
    ...existing,
    layout: normalizedLayout,
    updatedAt: timestamp,
  }

  persistCollection(STORAGE_KEYS.REPORT_CARD_CONFIG, [updated])
  return deepClone(updated.layout)
}

// Branding helpers
export async function getBrandingSettings(): Promise<BrandingRecord> {
  return ensureSingletonRecord(STORAGE_KEYS.BRANDING, createDefaultBrandingRecord)
}

export async function updateBrandingSettings(
  updates: Partial<Omit<BrandingRecord, "id" | "createdAt" | "updatedAt" | "logoUrl" | "signatureUrl">> & {
    logoUrl?: string | null
    signatureUrl?: string | null
  },
): Promise<BrandingRecord> {
  const records = ensureCollection<BrandingRecord>(STORAGE_KEYS.BRANDING, () => [createDefaultBrandingRecord()])
  const timestamp = new Date().toISOString()
  const existing = records[0] ?? createDefaultBrandingRecord()

  const updated: BrandingRecord = {
    ...existing,
    ...updates,
    id: existing.id || generateId("branding"),
    createdAt: existing.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  records[0] = updated
  persistCollection(STORAGE_KEYS.BRANDING, records)
  return deepClone(updated)
}

// System settings helpers
export async function getSystemSettingsRecord(): Promise<SystemSettingsRecord> {
  return ensureSingletonRecord(STORAGE_KEYS.SYSTEM_SETTINGS, createDefaultSystemSettingsRecord)
}

export async function updateSystemSettingsRecord(
  updates: Partial<Omit<SystemSettingsRecord, "id" | "createdAt" | "updatedAt">>,
): Promise<SystemSettingsRecord> {
  const records = ensureCollection<SystemSettingsRecord>(STORAGE_KEYS.SYSTEM_SETTINGS, () => [
    createDefaultSystemSettingsRecord(),
  ])
  const timestamp = new Date().toISOString()
  const existing = records[0] ?? createDefaultSystemSettingsRecord()

  const updated: SystemSettingsRecord = {
    ...existing,
    ...updates,
    id: existing.id || generateId("system_settings"),
    createdAt: existing.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  records[0] = updated
  persistCollection(STORAGE_KEYS.SYSTEM_SETTINGS, records)
  return deepClone(updated)
}

// Report card helpers
function normalizeReportSubject(subject: ReportCardSubjectInput): ReportCardSubjectRecord {
  const ca1 = Number(subject.ca1 ?? 0)
  const ca2 = Number(subject.ca2 ?? 0)
  const assignment = Number(subject.assignment ?? 0)
  const exam = Number(subject.exam ?? 0)
  const computedTotal = ca1 + ca2 + assignment + exam
  const total = Number(
    typeof (subject as ReportCardSubjectRecord).total === "number"
      ? (subject as ReportCardSubjectRecord).total
      : computedTotal,
  )

  let position: ReportCardSubjectRecord["position"] = undefined

  if (typeof (subject as ReportCardSubjectRecord).position === "number") {
    position = (subject as ReportCardSubjectRecord).position
  } else if (typeof (subject as ReportCardSubjectRecord).position === "string") {
    const trimmed = (subject as ReportCardSubjectRecord).position?.trim()
    position = trimmed && trimmed.length > 0 ? trimmed : undefined
  }

  return {
    name: subject.name,
    ca1,
    ca2,
    assignment,
    exam,
    total,
    grade: (subject as ReportCardSubjectRecord).grade ?? determineGrade(total),
    remark: "remark" in subject ? (subject as ReportCardSubjectRecord).remark ?? undefined : undefined,
    position: position ?? null,
  }
}

export async function listReportCards(filter?: {
  studentId?: string
  className?: string
  term?: string
  session?: string
}): Promise<ReportCardRecord[]> {
  const reportCards = ensureCollection<ReportCardRecord>(STORAGE_KEYS.REPORT_CARDS, defaultEmptyCollection)

  const filtered = reportCards.filter((record) => {
    if (filter?.studentId && record.studentId !== filter.studentId) {
      return false
    }
    if (filter?.className && record.className !== filter.className) {
      return false
    }
    if (filter?.term && record.term !== filter.term) {
      return false
    }
    if (filter?.session && record.session !== filter.session) {
      return false
    }
    return true
  })

  return deepClone(filtered)
}

export async function upsertReportCardRecord(payload: UpsertReportCardPayload): Promise<ReportCardRecord> {
  const reportCards = ensureCollection<ReportCardRecord>(STORAGE_KEYS.REPORT_CARDS, defaultEmptyCollection)
  const timestamp = new Date().toISOString()

  const normalizedSubjects = payload.subjects.map((subject) => normalizeReportSubject(subject))

  const findIndex = reportCards.findIndex((record) => {
    if (payload.id) {
      return record.id === payload.id
    }
    return (
      record.studentId === payload.studentId &&
      record.term === payload.term &&
      record.session === payload.session
    )
  })

  if (findIndex >= 0) {
    const existing = reportCards[findIndex]
    const updated: ReportCardRecord = {
      ...existing,
      ...payload,
      subjects: normalizedSubjects,
      classTeacherRemark: payload.classTeacherRemark ?? existing.classTeacherRemark ?? null,
      headTeacherRemark: payload.headTeacherRemark ?? existing.headTeacherRemark ?? null,
      metadata: payload.metadata ?? existing.metadata ?? null,
      updatedAt: timestamp,
    }
    reportCards[findIndex] = updated
    persistCollection(STORAGE_KEYS.REPORT_CARDS, reportCards)
    return deepClone(updated)
  }

  const created: ReportCardRecord = {
    id: payload.id ?? generateId("report_card"),
    studentId: payload.studentId,
    studentName: payload.studentName,
    className: payload.className,
    term: payload.term,
    session: payload.session,
    subjects: normalizedSubjects,
    classTeacherRemark: payload.classTeacherRemark ?? null,
    headTeacherRemark: payload.headTeacherRemark ?? null,
    metadata: payload.metadata ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  reportCards.push(created)
  persistCollection(STORAGE_KEYS.REPORT_CARDS, reportCards)
  return deepClone(created)
}

export async function deleteReportCardRecord(id: string): Promise<boolean> {
  const reportCards = ensureCollection<ReportCardRecord>(STORAGE_KEYS.REPORT_CARDS, defaultEmptyCollection)
  const index = reportCards.findIndex((record) => record.id === id)

  if (index === -1) {
    return false
  }

  reportCards.splice(index, 1)
  persistCollection(STORAGE_KEYS.REPORT_CARDS, reportCards)
  return true
}

// Grade helpers
export async function getAllGradesFromDb(): Promise<GradeRecord[]> {
  const grades = ensureCollection<GradeRecord>(STORAGE_KEYS.GRADES, defaultEmptyCollection)
  return deepClone(grades)
}

export async function getGradesForStudentFromDb(studentId: string): Promise<GradeRecord[]> {
  const grades = ensureCollection<GradeRecord>(STORAGE_KEYS.GRADES, defaultEmptyCollection)
  const filtered = grades.filter((record) => record.studentId === studentId)
  return deepClone(filtered)
}

export async function getGradesForClassFromDb(classId: string): Promise<GradeRecord[]> {
  const grades = ensureCollection<GradeRecord>(STORAGE_KEYS.GRADES, defaultEmptyCollection)
  const normalized = String(classId)
  const filtered = grades.filter((record) => record.classId === normalized)
  return deepClone(filtered)
}

export async function createGradeRecord(payload: CreateGradePayload): Promise<GradeRecord> {
  const grades = ensureCollection<GradeRecord>(STORAGE_KEYS.GRADES, defaultEmptyCollection)

  const firstCA = Number(payload.firstCA ?? 0)
  const secondCA = Number(payload.secondCA ?? 0)
  const assignment = Number(payload.assignment ?? 0)
  const exam = Number(payload.exam ?? 0)

  const caTotal = firstCA + secondCA + assignment
  const total = caTotal + exam
  const grade = determineGrade(total)

  const timestamp = new Date().toISOString()
  const record: GradeRecord = {
    id: generateId("grade"),
    studentId: payload.studentId,
    subject: payload.subject,
    classId: payload.classId ?? null,
    term: payload.term ?? "",
    session: payload.session ?? "",
    firstCA,
    secondCA,
    assignment,
    exam,
    caTotal,
    total,
    average: total,
    grade,
    teacherRemarks: payload.teacherRemarks ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  grades.push(record)
  persistCollection(STORAGE_KEYS.GRADES, grades)
  return deepClone(record)
}

export async function updateGradeRecord(id: string, updates: UpdateGradePayload): Promise<GradeRecord | null> {
  const grades = ensureCollection<GradeRecord>(STORAGE_KEYS.GRADES, defaultEmptyCollection)
  const index = grades.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = grades[index]

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      ;(existing as Record<string, unknown>)[key] = value
    }
  }

  existing.firstCA = Number(existing.firstCA ?? 0)
  existing.secondCA = Number(existing.secondCA ?? 0)
  existing.assignment = Number(existing.assignment ?? 0)
  existing.exam = Number(existing.exam ?? 0)

  existing.caTotal = existing.firstCA + existing.secondCA + existing.assignment
  existing.total = existing.caTotal + existing.exam
  existing.average = existing.total
  existing.grade = determineGrade(existing.total)
  existing.updatedAt = new Date().toISOString()

  grades[index] = existing
  persistCollection(STORAGE_KEYS.GRADES, grades)
  return deepClone(existing)
}

// Marks helpers
export async function saveStudentMarks(payload: StudentMarksPayload): Promise<StudentMarksRecord> {
  const marks = ensureCollection<StudentMarksRecord>(STORAGE_KEYS.MARKS, defaultEmptyCollection)
  const keyMatcher = (record: StudentMarksRecord) =>
    record.studentId === payload.studentId &&
    record.subject === payload.subject &&
    record.term === payload.term &&
    record.session === payload.session

  const index = marks.findIndex(keyMatcher)
  const timestamp = new Date().toISOString()

  if (index === -1) {
    const record: StudentMarksRecord = {
      id: generateId("mark"),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...payload,
    }
    marks.push(record)
    persistCollection(STORAGE_KEYS.MARKS, marks)
    return deepClone(record)
  }

  const updatedRecord: StudentMarksRecord = {
    ...marks[index],
    ...payload,
    updatedAt: timestamp,
  }

  marks[index] = updatedRecord
  persistCollection(STORAGE_KEYS.MARKS, marks)
  return deepClone(updatedRecord)
}

export async function getStudentMarks(
  studentId: string,
  term?: string | null,
  session?: string | null,
): Promise<StudentMarksRecord[]> {
  const marks = ensureCollection<StudentMarksRecord>(STORAGE_KEYS.MARKS, defaultEmptyCollection)
  const filtered = marks.filter((record) => {
    if (record.studentId !== studentId) {
      return false
    }

    if (term && record.term !== term) {
      return false
    }

    if (session && record.session !== session) {
      return false
    }

    return true
  })

  return deepClone(filtered)
}

export async function listAllStudentMarks(): Promise<StudentMarksRecord[]> {
  const marks = ensureCollection<StudentMarksRecord>(STORAGE_KEYS.MARKS, defaultEmptyCollection)
  return deepClone(marks)
}

type AttendanceStatus = AttendanceLogRecord["status"]

function sortAttendanceLogs(logs: AttendanceLogRecord[]): AttendanceLogRecord[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

async function ensureAttendanceHistory(student: StudentRecord): Promise<AttendanceLogRecord[]> {
  const logs = ensureCollection<AttendanceLogRecord>(STORAGE_KEYS.ATTENDANCE_LOGS, defaultEmptyCollection)
  const existing = logs.filter((log) => log.studentId === student.id)

  if (existing.length > 0) {
    return sortAttendanceLogs(existing)
  }

  const totalDays = Number(student.attendance?.total ?? 0)
  const presentDays = Number(student.attendance?.present ?? 0)

  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return []
  }

  const entriesToGenerate = Math.max(1, Math.min(totalDays, 30))
  const presentTarget = Math.max(
    0,
    Math.min(entriesToGenerate, Math.round((presentDays / Math.max(totalDays, 1)) * entriesToGenerate)),
  )
  const lateTarget = Math.min(presentTarget, Math.max(Math.round(entriesToGenerate * 0.1), presentTarget > 0 ? 1 : 0))
  const regularPresentTarget = Math.max(presentTarget - lateTarget, 0)
  const absentTarget = Math.max(entriesToGenerate - presentTarget, 0)

  const pool: AttendanceStatus[] = []
  for (let index = 0; index < regularPresentTarget; index += 1) {
    pool.push("present")
  }
  for (let index = 0; index < lateTarget; index += 1) {
    pool.push("late")
  }
  for (let index = 0; index < absentTarget; index += 1) {
    pool.push("absent")
  }

  while (pool.length < entriesToGenerate) {
    pool.push("present")
  }

  const distributed: AttendanceStatus[] = []
  let cursor = 0
  const step = 3
  const poolCopy = [...pool]
  while (poolCopy.length > 0) {
    const index = poolCopy.length === 1 ? 0 : cursor % poolCopy.length
    distributed.push(poolCopy.splice(index, 1)[0])
    cursor += step
  }

  const generated: AttendanceLogRecord[] = distributed.map((status, index) => {
    const date = new Date()
    date.setDate(date.getDate() - index)
    const isoDate = date.toISOString()
    return {
      id: generateId("attendance"),
      studentId: student.id,
      date: isoDate.split("T")[0],
      status,
      recordedBy: null,
      createdAt: isoDate,
      updatedAt: isoDate,
    }
  })

  const combined = [...logs, ...generated]
  persistCollection(STORAGE_KEYS.ATTENDANCE_LOGS, combined)
  return sortAttendanceLogs(generated)
}

export interface ParentDashboardAcademicSubjectSummary {
  name: string
  score: number
  grade: string
  position: number | null
  totalStudents: number
}

export interface ParentDashboardAcademicSummary {
  subjects: ParentDashboardAcademicSubjectSummary[]
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
}

export interface ParentDashboardAttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateArrivals: number
  attendancePercentage: number
  recentAttendance: Array<{ date: string; status: AttendanceStatus }>
}

export interface ParentDashboardSnapshot {
  student: {
    id: string
    name: string
    class: string
    section: string
    admissionNumber: string
    dateOfBirth: string
    address: string
    phone: string
    email: string
    status: "active" | "inactive"
    avatar?: string | null
  }
  academic: ParentDashboardAcademicSummary
  attendance: ParentDashboardAttendanceSummary
}

interface DashboardSnapshotOptions {
  term?: string | null
  session?: string | null
}

export async function getParentDashboardSnapshot(
  studentId: string,
  options: DashboardSnapshotOptions = {},
): Promise<ParentDashboardSnapshot | null> {
  const student = await getStudentRecordById(studentId)
  if (!student) {
    return null
  }

  const systemSettings = await getSystemSettingsRecord()
  const resolvedTerm = options.term && options.term.trim().length > 0 ? options.term : systemSettings.currentTerm
  const resolvedSession =
    options.session && options.session.trim().length > 0
      ? options.session
      : systemSettings.academicYear ?? String(new Date().getFullYear())

  let marks = await getStudentMarks(studentId, resolvedTerm, resolvedSession)
  if (marks.length === 0) {
    marks = await getStudentMarks(studentId)
  }

  const classStudents = (await listStudentRecords()).filter((record) => {
    if (!student.class || !record.class) {
      return false
    }
    return record.class.trim().toLowerCase() === student.class.trim().toLowerCase()
  })

  const marksByStudent = new Map<string, StudentMarksRecord[]>()
  marksByStudent.set(studentId, marks)

  await Promise.all(
    classStudents
      .map((record) => record.id)
      .filter((id) => id !== studentId)
      .map(async (id) => {
        const peerMarks = await getStudentMarks(id, resolvedTerm, resolvedSession)
        if (peerMarks.length > 0) {
          marksByStudent.set(id, peerMarks)
          return
        }
        const fallback = await getStudentMarks(id)
        marksByStudent.set(id, fallback)
      }),
  )

  const subjectSummaries: ParentDashboardAcademicSubjectSummary[] = marks.map((mark) => {
    const subjectScores: Array<{ studentId: string; score: number }> = []

    for (const [peerId, records] of marksByStudent.entries()) {
      const matching = records.find((entry) => entry.subject === mark.subject)
      if (!matching) {
        continue
      }

      const peerScore = Number.isFinite(matching.percentage)
        ? Number(matching.percentage)
        : Number(matching.grandTotal ?? 0)
      subjectScores.push({ studentId: peerId, score: peerScore })
    }

    subjectScores.sort((a, b) => b.score - a.score)
    const rankIndex = subjectScores.findIndex((entry) => entry.studentId === studentId)
    const subjectScore = Number.isFinite(mark.percentage)
      ? Number(mark.percentage)
      : Number(mark.grandTotal ?? 0)
    const normalizedScore = Number.isFinite(subjectScore) ? Number(subjectScore.toFixed(1)) : 0
    const grade = mark.grade ?? deriveGradeFromScore(normalizedScore)

    return {
      name: mark.subject,
      score: normalizedScore,
      grade,
      position: rankIndex === -1 ? null : rankIndex + 1,
      totalStudents: subjectScores.length || Math.max(classStudents.length, 1),
    }
  })

  const overallAverage =
    subjectSummaries.length > 0
      ? Number(
          (
            subjectSummaries.reduce((total, subject) => total + subject.score, 0) / subjectSummaries.length
          ).toFixed(1),
        )
      : 0
  const overallGrade = deriveGradeFromScore(overallAverage)

  const classAverages = Array.from(marksByStudent.entries()).map(([peerId, records]) => {
    if (!records || records.length === 0) {
      return { studentId: peerId, average: 0 }
    }

    const average =
      records.reduce((total, record) => {
        const value = Number.isFinite(record.percentage)
          ? Number(record.percentage)
          : Number(record.grandTotal ?? 0)
        return total + (Number.isFinite(value) ? value : 0)
      }, 0) / records.length

    return { studentId: peerId, average: Number(Number.isFinite(average) ? average.toFixed(1) : 0) }
  })

  classAverages.sort((a, b) => b.average - a.average)
  const classPositionIndex = classAverages.findIndex((entry) => entry.studentId === studentId)
  const totalStudents = Math.max(classStudents.length || classAverages.length || 1, 1)
  const classPosition = classPositionIndex === -1 ? totalStudents : classPositionIndex + 1

  const attendanceLogs = await ensureAttendanceHistory(student)
  const sortedAttendance = sortAttendanceLogs(attendanceLogs)
  const recentAttendance = sortedAttendance
    .slice(-10)
    .reverse()
    .map((entry) => ({ date: entry.date, status: entry.status }))

  const presentDays = Number(student.attendance?.present ?? 0)
  const totalDays = Number(student.attendance?.total ?? 0)
  const absentDays = Math.max(totalDays - presentDays, 0)
  const attendancePercentage =
    totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0
  const lateArrivals = attendanceLogs.filter((entry) => entry.status === "late").length

  return {
    student: {
      id: student.id,
      name: student.name,
      class: student.class,
      section: student.section,
      admissionNumber: student.admissionNumber,
      dateOfBirth: student.dateOfBirth,
      address: student.address,
      phone: student.phone,
      email: student.email,
      status: student.status,
      avatar: student.photoUrl ?? null,
    },
    academic: {
      subjects: subjectSummaries,
      overallAverage,
      overallGrade,
      classPosition,
      totalStudents,
    },
    attendance: {
      totalDays,
      presentDays,
      absentDays,
      lateArrivals,
      attendancePercentage,
      recentAttendance,
    },
  }
}

// Payment helpers
export async function recordPaymentInitialization(
  payload: PaymentInitializationPayload,
): Promise<PaymentInitializationRecord> {
  const payments = ensureCollection<PaymentInitializationRecord>(STORAGE_KEYS.PAYMENTS, defaultEmptyCollection)
  const timestamp = new Date().toISOString()

  const index = payments.findIndex(
    (record) =>
      record.reference === payload.reference ||
      (payload.paystackReference && record.paystackReference === payload.paystackReference),
  )

  if (index === -1) {
    const record: PaymentInitializationRecord = {
      id: generateId("payment_init"),
      reference: payload.reference,
      amount: Number(payload.amount),
      studentId: payload.studentId,
      paymentType: payload.paymentType,
      email: payload.email,
      status: payload.status ?? "pending",
      paystackReference: payload.paystackReference ?? null,
      metadata: payload.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    payments.push(record)
    persistCollection(STORAGE_KEYS.PAYMENTS, payments)
    return deepClone(record)
  }

  const existing = payments[index]
  const updated: PaymentInitializationRecord = {
    ...existing,
    amount: Number(payload.amount ?? existing.amount),
    studentId: payload.studentId,
    paymentType: payload.paymentType,
    email: payload.email,
    status: payload.status ?? existing.status,
    paystackReference: payload.paystackReference ?? existing.paystackReference,
    metadata: payload.metadata ?? existing.metadata,
    updatedAt: timestamp,
  }

  payments[index] = updated
  persistCollection(STORAGE_KEYS.PAYMENTS, payments)
  return deepClone(updated)
}

export async function findPaymentByReference(reference: string): Promise<PaymentInitializationRecord | null> {
  if (!reference || reference.trim().length === 0) {
    return null
  }

  const payments = ensureCollection<PaymentInitializationRecord>(STORAGE_KEYS.PAYMENTS, defaultEmptyCollection)
  const normalized = reference.trim().toLowerCase()

  const match = payments.find((payment) => {
    if (payment.reference && payment.reference.trim().toLowerCase() === normalized) {
      return true
    }

    if (payment.paystackReference && payment.paystackReference.trim().toLowerCase() === normalized) {
      return true
    }

    return false
  })

  return match ? deepClone(match) : null
}

export async function listPaymentInitializations(): Promise<PaymentInitializationRecord[]> {
  const payments = ensureCollection<PaymentInitializationRecord>(STORAGE_KEYS.PAYMENTS, defaultEmptyCollection)
  return deepClone(payments)
}

export async function listFeeStructures(): Promise<FeeStructureRecord[]> {
  const feeStructures = ensureCollection<FeeStructureRecord>(STORAGE_KEYS.FEE_STRUCTURE, createDefaultFeeStructures)
  return deepClone(feeStructures)
}

export async function upsertFeeStructure(payload: UpsertFeeStructurePayload): Promise<FeeStructureRecord> {
  const feeStructures = ensureCollection<FeeStructureRecord>(STORAGE_KEYS.FEE_STRUCTURE, createDefaultFeeStructures)
  const timestamp = new Date().toISOString()
  const normalizedName = payload.className.trim()
  const total = payload.total ?? calculateFeeTotal(payload)

  const index = feeStructures.findIndex((entry) => entry.className.toLowerCase() === normalizedName.toLowerCase())

  if (index === -1) {
    const record: FeeStructureRecord = {
      id: generateId("fee"),
      className: normalizedName,
      tuition: Number(payload.tuition),
      development: Number(payload.development),
      exam: Number(payload.exam),
      sports: Number(payload.sports),
      library: Number(payload.library),
      total: Number(total),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    feeStructures.push(record)
    persistCollection(STORAGE_KEYS.FEE_STRUCTURE, feeStructures)
    return deepClone(record)
  }

  const existing = feeStructures[index]
  const updated: FeeStructureRecord = {
    ...existing,
    className: normalizedName,
    tuition: Number(payload.tuition),
    development: Number(payload.development),
    exam: Number(payload.exam),
    sports: Number(payload.sports),
    library: Number(payload.library),
    total: Number(total),
    updatedAt: timestamp,
  }

  feeStructures[index] = updated
  persistCollection(STORAGE_KEYS.FEE_STRUCTURE, feeStructures)
  return deepClone(updated)
}

export async function deleteFeeStructureRecord(identifier: string): Promise<boolean> {
  const feeStructures = ensureCollection<FeeStructureRecord>(STORAGE_KEYS.FEE_STRUCTURE, createDefaultFeeStructures)
  const index = feeStructures.findIndex(
    (entry) => entry.id === identifier || entry.className.toLowerCase() === identifier.toLowerCase(),
  )

  if (index === -1) {
    return false
  }

  feeStructures.splice(index, 1)
  persistCollection(STORAGE_KEYS.FEE_STRUCTURE, feeStructures)
  return true
}

export async function recordFeeStructureDelivery(payload: {
  feeId: string
  className: string
  parentName: string
  parentEmail: string
  studentName: string
  sentBy: string
  breakdown: {
    tuition: number
    development: number
    exam: number
    sports: number
    library: number
    total: number
  }
  message?: string
}): Promise<FeeStructureDeliveryRecord> {
  const deliveries = ensureCollection<FeeStructureDeliveryRecord>(
    STORAGE_KEYS.FEE_COMMUNICATIONS,
    createDefaultFeeStructureDeliveries,
  )

  const timestamp = new Date().toISOString()
  const normalisedBreakdown = {
    tuition: Number(payload.breakdown.tuition ?? 0),
    development: Number(payload.breakdown.development ?? 0),
    exam: Number(payload.breakdown.exam ?? 0),
    sports: Number(payload.breakdown.sports ?? 0),
    library: Number(payload.breakdown.library ?? 0),
    total: Number(payload.breakdown.total ?? 0),
  }

  const record: FeeStructureDeliveryRecord = {
    id: generateId("fee_delivery"),
    feeId: payload.feeId,
    className: payload.className.trim(),
    parentName: payload.parentName.trim(),
    parentEmail: payload.parentEmail.trim().toLowerCase(),
    studentName: payload.studentName.trim(),
    sentBy: payload.sentBy.trim(),
    message:
      (payload.message ?? `Fee structure for ${payload.className} sent to ${payload.parentName}.`).trim() ||
      `Fee structure for ${payload.className} sent to ${payload.parentName}.`,
    breakdown: normalisedBreakdown,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  deliveries.push(record)
  persistCollection(STORAGE_KEYS.FEE_COMMUNICATIONS, deliveries)
  return deepClone(record)
}

function generateReceiptNumber(timestamp: string): string {
  const datePart = timestamp.slice(0, 10).replace(/-/g, "")
  const randomPart = nodeRandomBytes(3).toString("hex").toUpperCase()
  return `VEA/${datePart}/${randomPart}`
}

export async function listReceipts(): Promise<ReceiptRecord[]> {
  const receipts = ensureCollection<ReceiptRecord>(STORAGE_KEYS.RECEIPTS, createDefaultReceipts)
  return deepClone(receipts)
}

export async function createOrUpdateReceipt(payload: CreateReceiptPayload): Promise<ReceiptRecord> {
  const receipts = ensureCollection<ReceiptRecord>(STORAGE_KEYS.RECEIPTS, createDefaultReceipts)
  const timestamp = new Date().toISOString()

  const index = receipts.findIndex((receipt) => receipt.paymentId === payload.paymentId)

  if (index === -1) {
    const receiptNumber = payload.receiptNumber && payload.receiptNumber.trim().length > 0
      ? payload.receiptNumber
      : generateReceiptNumber(timestamp)

    const record: ReceiptRecord = {
      id: generateId("receipt"),
      paymentId: payload.paymentId,
      receiptNumber,
      studentName: payload.studentName,
      amount: Number(payload.amount),
      reference: payload.reference ?? null,
      issuedBy: payload.issuedBy ?? null,
      metadata: payload.metadata ?? null,
      dateIssued: payload.dateIssued ?? timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    receipts.push(record)
    persistCollection(STORAGE_KEYS.RECEIPTS, receipts)
    return deepClone(record)
  }

  const existing = receipts[index]
  const updated: ReceiptRecord = {
    ...existing,
    studentName: payload.studentName || existing.studentName,
    amount: Number(payload.amount ?? existing.amount),
    reference: payload.reference ?? existing.reference ?? null,
    issuedBy: payload.issuedBy ?? existing.issuedBy ?? null,
    metadata: payload.metadata ?? existing.metadata ?? null,
    dateIssued: payload.dateIssued ?? existing.dateIssued,
    updatedAt: timestamp,
  }

  if (!updated.receiptNumber || updated.receiptNumber.trim().length === 0) {
    updated.receiptNumber = generateReceiptNumber(timestamp)
  }

  receipts[index] = updated
  persistCollection(STORAGE_KEYS.RECEIPTS, receipts)
  return deepClone(updated)
}

export interface UpdatePaymentRecordPayload
  extends Partial<Omit<PaymentInitializationRecord, "id" | "createdAt" | "updatedAt">> {
  metadata?: Record<string, unknown>
}

export async function updatePaymentRecord(
  id: string,
  updates: UpdatePaymentRecordPayload,
): Promise<PaymentInitializationRecord | null> {
  const payments = ensureCollection<PaymentInitializationRecord>(STORAGE_KEYS.PAYMENTS, defaultEmptyCollection)
  const index = payments.findIndex((payment) => payment.id === id)

  if (index === -1) {
    return null
  }

  const existing = payments[index]

  if (updates.reference !== undefined) {
    existing.reference = String(updates.reference)
  }

  if (updates.amount !== undefined) {
    existing.amount = Number(updates.amount)
  }

  if (updates.studentId !== undefined) {
    existing.studentId = updates.studentId ? String(updates.studentId) : null
  }

  if (updates.paymentType !== undefined) {
    existing.paymentType = String(updates.paymentType)
  }

  if (updates.email !== undefined) {
    existing.email = String(updates.email)
  }

  if (updates.status !== undefined) {
    existing.status = updates.status as PaymentInitializationRecord["status"]
  }

  if (updates.paystackReference !== undefined) {
    existing.paystackReference = updates.paystackReference ? String(updates.paystackReference) : null
  }

  if (updates.metadata !== undefined) {
    const currentMetadata = existing.metadata ?? {}
    existing.metadata = { ...currentMetadata, ...updates.metadata }
  }

  existing.updatedAt = new Date().toISOString()
  payments[index] = existing
  persistCollection(STORAGE_KEYS.PAYMENTS, payments)
  return deepClone(existing)
}

function generateCollectionReceiptNumber(timestamp: string): string {
  const datePart = timestamp.slice(0, 10).replace(/-/g, "")
  const randomPart = nodeRandomBytes(3).toString("hex").toUpperCase()
  return `COL-${datePart}-${randomPart}`
}

export interface FeePaymentQueryOptions {
  term?: string
  startDate?: string
  endDate?: string
  includeDeleted?: boolean
}

export async function listFeePaymentRecords(
  options: FeePaymentQueryOptions = {},
): Promise<FeePaymentRecord[]> {
  const payments = ensureFeePaymentRecords()
  const startDate = options.startDate ? new Date(options.startDate) : null
  const endDate = options.endDate ? new Date(options.endDate) : null
  const hasValidStart = startDate instanceof Date && !Number.isNaN(startDate.getTime())
  const hasValidEnd = endDate instanceof Date && !Number.isNaN(endDate.getTime())
  const termKey = canonicalTermKey(options.term ?? "")

  const filtered = payments.filter((record) => {
    if (!options.includeDeleted && record.deletedAt) {
      return false
    }

    if (termKey && canonicalTermKey(record.term) !== termKey) {
      return false
    }

    const paymentTimestamp = new Date(record.paymentDate || record.createdAt)
    if (hasValidStart && paymentTimestamp < startDate!) {
      return false
    }

    if (hasValidEnd && paymentTimestamp > endDate!) {
      return false
    }

    return true
  })

  filtered.sort((a, b) => {
    const left = new Date(a.paymentDate || a.createdAt).getTime()
    const right = new Date(b.paymentDate || b.createdAt).getTime()
    return right - left
  })

  return deepClone(filtered)
}

export async function createFeePaymentRecord(
  payload: CreateFeePaymentPayload,
  context: FinancialAuditContext,
): Promise<FeePaymentRecord> {
  const payments = ensureFeePaymentRecords()
  const timestamp = new Date().toISOString()

  const studentName = normaliseStringInput(payload.studentName)
  if (!studentName) {
    throw new Error("Student name is required")
  }

  const feeType = normaliseStringInput(payload.feeType) || "General"
  const paymentMethod = normaliseStringInput(payload.paymentMethod)
  if (!paymentMethod) {
    throw new Error("Payment method is required")
  }

  const term = normaliseStringInput(payload.term)
  if (!term) {
    throw new Error("Term is required")
  }

  const amount = ensurePositiveAmount(payload.amount)
  const paymentDate = normaliseDateInput(payload.paymentDate, new Date(timestamp))
  const receiptCandidate = canonicalReceiptNumber(payload.receiptNumber)
  const schoolFeeConfigId = normaliseOptionalString(payload.schoolFeeConfigId)
  const eventFeeIds = Array.isArray(payload.eventFeeIds)
    ? Array.from(
        new Set(
          payload.eventFeeIds
            .map((value) => normaliseOptionalString(value))
            .filter((value): value is string => Boolean(value)),
        ),
      )
    : []

  if (receiptCandidate) {
    const conflict = payments.find(
      (record) =>
        canonicalReceiptNumber(record.receiptNumber) === receiptCandidate &&
        (!record.deletedAt || record.deletedAt.length === 0),
    )

    if (conflict) {
      throw new Error("Receipt number already exists")
    }
  }

  const record: FeePaymentRecord = {
    id: generateId("fee_payment"),
    studentId: normaliseOptionalString(payload.studentId) ?? null,
    studentName,
    classId: normaliseOptionalString(payload.classId) ?? null,
    className: normaliseOptionalString(payload.className),
    feeType,
    amount,
    paymentDate,
    paymentMethod,
    receiptNumber: receiptCandidate ?? generateCollectionReceiptNumber(paymentDate),
    paymentReference: normaliseOptionalString(payload.paymentReference),
    term,
    createdBy: context.userId,
    createdByName: normaliseStringInput(context.userName) || context.userName,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
    deletedAt: null,
    deletionReason: null,
    deletedBy: null,
    deletedByName: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    schoolFeeConfigId: schoolFeeConfigId ?? null,
    eventFeeIds,
  }

  payments.push(record)
  persistCollection(STORAGE_KEYS.FINANCIAL_COLLECTIONS, payments)
  return deepClone(record)
}

export async function updateFeePaymentRecordById(
  id: string,
  updates: UpdateFeePaymentPayload,
  context: FinancialAuditContext,
): Promise<FeePaymentRecord | null> {
  const payments = ensureFeePaymentRecords()
  const index = payments.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const existing = payments[index]
  if (existing.deletedAt) {
    throw new Error("Cannot update a deleted payment record")
  }

  const updated: FeePaymentRecord = { ...existing }

  if (updates.studentName !== undefined) {
    const name = normaliseStringInput(updates.studentName)
    if (!name) {
      throw new Error("Student name is required")
    }
    updated.studentName = name
  }

  if (updates.amount !== undefined) {
    updated.amount = ensurePositiveAmount(updates.amount)
  }

  if (updates.feeType !== undefined) {
    const value = normaliseStringInput(updates.feeType)
    updated.feeType = value || updated.feeType
  }

  if (updates.paymentMethod !== undefined) {
    const method = normaliseStringInput(updates.paymentMethod)
    if (!method) {
      throw new Error("Payment method is required")
    }
    updated.paymentMethod = method
  }

  if (updates.paymentDate !== undefined) {
    updated.paymentDate = normaliseDateInput(updates.paymentDate, new Date(updated.paymentDate))
  }

  if (updates.term !== undefined) {
    const value = normaliseStringInput(updates.term)
    if (!value) {
      throw new Error("Term is required")
    }
    updated.term = value
  }

  if (updates.receiptNumber !== undefined) {
    const candidate = canonicalReceiptNumber(updates.receiptNumber)
    if (candidate) {
      const conflict = payments.find(
        (record) =>
          record.id !== id &&
          canonicalReceiptNumber(record.receiptNumber) === candidate &&
          (!record.deletedAt || record.deletedAt.length === 0),
      )

      if (conflict) {
        throw new Error("Receipt number already exists")
      }

      updated.receiptNumber = candidate
    }
  }

  if (updates.classId !== undefined) {
    updated.classId = normaliseOptionalString(updates.classId)
  }

  if (updates.className !== undefined) {
    updated.className = normaliseOptionalString(updates.className)
  }

  if (updates.studentId !== undefined) {
    updated.studentId = normaliseOptionalString(updates.studentId)
  }

  if (updates.paymentReference !== undefined) {
    updated.paymentReference = normaliseOptionalString(updates.paymentReference)
  }

  if (updates.schoolFeeConfigId !== undefined) {
    updated.schoolFeeConfigId = normaliseOptionalString(updates.schoolFeeConfigId)
  }

  if (updates.eventFeeIds !== undefined) {
    updated.eventFeeIds = Array.isArray(updates.eventFeeIds)
      ? Array.from(
          new Set(
            updates.eventFeeIds
              .map((value) => normaliseOptionalString(value))
              .filter((value): value is string => Boolean(value)),
          ),
        )
      : []
  }

  const timestamp = new Date().toISOString()
  updated.updatedAt = timestamp
  updated.lastModifiedBy = context.userId
  updated.lastModifiedByName = normaliseStringInput(context.userName) || context.userName

  payments[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_COLLECTIONS, payments)
  return deepClone(updated)
}

export async function softDeleteFeePaymentRecord(
  id: string,
  reason: string,
  context: FinancialAuditContext,
): Promise<FeePaymentRecord | null> {
  const payments = ensureFeePaymentRecords()
  const index = payments.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const resolvedReason = normaliseStringInput(reason)
  if (!resolvedReason) {
    throw new Error("Deletion reason is required")
  }

  const timestamp = new Date().toISOString()
  const existing = payments[index]
  const updated: FeePaymentRecord = {
    ...existing,
    deletedAt: timestamp,
    deletionReason: resolvedReason,
    deletedBy: context.userId,
    deletedByName: normaliseStringInput(context.userName) || context.userName,
    updatedAt: timestamp,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
  }

  payments[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_COLLECTIONS, payments)
  return deepClone(updated)
}

export async function listSchoolFeeConfigurations(): Promise<SchoolFeeConfigurationRecord[]> {
  const records = ensureSchoolFeeConfigurations()
  const sorted = [...records].sort((a, b) => {
    if (a.classKey === b.classKey) {
      if (a.termKey === b.termKey) {
        return b.version - a.version
      }
      return a.term.localeCompare(b.term, undefined, { sensitivity: "base" })
    }

    return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" })
  })

  return deepClone(sorted)
}

export async function listEventFeeConfigurations(): Promise<EventFeeConfigurationRecord[]> {
  const records = ensureEventFeeConfigurations()
  const sorted = [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return deepClone(sorted)
}

export async function listFeeConfigurationAuditLog(
  limit?: number,
): Promise<FeeConfigurationAuditRecord[]> {
  const entries = ensureFeeConfigurationAuditLog()
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const sliced = typeof limit === "number" && limit > 0 ? sorted.slice(0, limit) : sorted
  return deepClone(sliced)
}

export async function getSchoolFeeConfigurationById(
  id: string,
): Promise<SchoolFeeConfigurationRecord | null> {
  if (!id) {
    return null
  }

  const records = ensureSchoolFeeConfigurations()
  const match = records.find((entry) => entry.id === id)
  return match ? deepClone(match) : null
}

export async function getEventFeeConfigurationById(
  id: string,
): Promise<EventFeeConfigurationRecord | null> {
  if (!id) {
    return null
  }

  const records = ensureEventFeeConfigurations()
  const match = records.find((entry) => entry.id === id)
  return match ? deepClone(match) : null
}

export async function getActiveSchoolFeeConfigurationForClass(
  className: string,
  term: string,
): Promise<SchoolFeeConfigurationRecord | null> {
  let classKey = ""
  let termKey = ""

  try {
    classKey = normaliseClassDetails(className).key
    termKey = normaliseTermDetails(term).key
  } catch (error) {
    return null
  }

  const records = ensureSchoolFeeConfigurations()
  const match = records.find(
    (entry) => entry.classKey === classKey && entry.termKey === termKey && entry.isActive,
  )

  return match ? deepClone(match) : null
}

export async function listActiveEventFeesForClass(
  className: string,
): Promise<EventFeeConfigurationRecord[]> {
  let classKey = ""
  try {
    classKey = normaliseClassDetails(className).key
  } catch (error) {
    return []
  }

  const records = ensureEventFeeConfigurations()
  const now = Date.now()
  const filtered = records.filter((entry) => {
    if (!entry.isActive) {
      return false
    }

    if (entry.applicableClassKeys.length > 0 && !entry.applicableClassKeys.includes(classKey)) {
      return false
    }

    if (entry.dueDate) {
      const due = new Date(entry.dueDate).getTime()
      if (!Number.isNaN(due) && due < now) {
        return false
      }
    }

    return true
  })

  filtered.sort((a, b) => {
    const left = new Date(a.dueDate ?? a.createdAt).getTime()
    const right = new Date(b.dueDate ?? b.createdAt).getTime()
    return left - right
  })

  return deepClone(filtered)
}

export async function createSchoolFeeConfiguration(
  payload: CreateSchoolFeeConfigurationPayload,
  context: FeeConfigurationContext,
): Promise<SchoolFeeConfigurationRecord> {
  const records = ensureSchoolFeeConfigurations()
  const timestamp = new Date().toISOString()

  const { label: className, key: classKey } = normaliseClassDetails(payload.className)
  const { label: term, key: termKey } = normaliseTermDetails(payload.term)
  const amount = ensurePositiveAmount(payload.amount)
  const effectiveDate = normaliseDateInput(payload.effectiveDate, new Date(timestamp))
  const classId = normaliseOptionalString(payload.classId)
  const notes = normaliseOptionalString(payload.notes)

  const version =
    records
      .filter((entry) => entry.classKey === classKey && entry.termKey === termKey)
      .reduce((max, entry) => Math.max(max, entry.version), 0) + 1

  const shouldActivate = payload.activate !== false

  const record: SchoolFeeConfigurationRecord = {
    id: generateId("school_fee_cfg"),
    classId: classId ?? null,
    className,
    classKey,
    term,
    termKey,
    amount,
    effectiveDate,
    isActive: shouldActivate,
    version,
    createdBy: context.userId,
    createdByName: normaliseStringInput(context.userName) || context.userName,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  if (shouldActivate) {
    for (const existing of records) {
      if (existing.id === record.id) {
        continue
      }

      if (existing.classKey === classKey && existing.termKey === termKey && existing.isActive) {
        existing.isActive = false
        existing.updatedAt = timestamp
        existing.lastModifiedBy = context.userId
        existing.lastModifiedByName = normaliseStringInput(context.userName) || context.userName
        recordFeeConfigurationAuditEntry(
          "school_fee",
          "deactivate",
          existing,
          context,
          `Superseded by configuration ${record.id}`,
        )
      }
    }
  }

  records.push(record)
  persistCollection(STORAGE_KEYS.SCHOOL_FEES, records)

  recordFeeConfigurationAuditEntry("school_fee", "create", record, context, notes)
  if (record.isActive) {
    recordFeeConfigurationAuditEntry("school_fee", "activate", record, context, notes)
  }

  return deepClone(record)
}

export async function updateSchoolFeeConfiguration(
  id: string,
  updates: UpdateSchoolFeeConfigurationPayload,
  context: FeeConfigurationContext,
): Promise<SchoolFeeConfigurationRecord | null> {
  const records = ensureSchoolFeeConfigurations()
  const index = records.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const timestamp = new Date().toISOString()
  const existing = records[index]
  const updated: SchoolFeeConfigurationRecord = { ...existing }
  let versionShouldIncrement = false
  let activationChanged = false

  if (updates.className !== undefined) {
    const { label, key } = normaliseClassDetails(updates.className)
    if (label !== updated.className || key !== updated.classKey) {
      updated.className = label
      updated.classKey = key
      versionShouldIncrement = true
    }
  }

  if (updates.term !== undefined) {
    const { label, key } = normaliseTermDetails(updates.term)
    if (label !== updated.term || key !== updated.termKey) {
      updated.term = label
      updated.termKey = key
      versionShouldIncrement = true
    }
  }

  if (updates.amount !== undefined) {
    const amount = ensurePositiveAmount(updates.amount)
    if (amount !== updated.amount) {
      updated.amount = amount
      versionShouldIncrement = true
    }
  }

  if (updates.effectiveDate !== undefined) {
    const effectiveDate = normaliseDateInput(updates.effectiveDate, new Date(updated.effectiveDate))
    if (effectiveDate !== updated.effectiveDate) {
      updated.effectiveDate = effectiveDate
      versionShouldIncrement = true
    }
  }

  if (updates.classId !== undefined) {
    updated.classId = normaliseOptionalString(updates.classId)
  }

  if (updates.notes !== undefined) {
    updated.notes = normaliseOptionalString(updates.notes)
  }

  if (updates.isActive !== undefined) {
    const shouldActivate = Boolean(updates.isActive)
    if (shouldActivate !== updated.isActive) {
      updated.isActive = shouldActivate
      activationChanged = true
    }
  }

  if (versionShouldIncrement) {
    updated.version += 1
  }

  updated.updatedAt = timestamp
  updated.lastModifiedBy = context.userId
  updated.lastModifiedByName = normaliseStringInput(context.userName) || context.userName

  records[index] = updated

  if (updated.isActive) {
    for (const record of records) {
      if (record.id === updated.id) {
        continue
      }

      if (record.classKey === updated.classKey && record.termKey === updated.termKey && record.isActive) {
        record.isActive = false
        record.updatedAt = timestamp
        record.lastModifiedBy = context.userId
        record.lastModifiedByName = normaliseStringInput(context.userName) || context.userName
        recordFeeConfigurationAuditEntry(
          "school_fee",
          "deactivate",
          record,
          context,
          `Superseded by configuration ${updated.id}`,
        )
      }
    }
  }

  persistCollection(STORAGE_KEYS.SCHOOL_FEES, records)

  recordFeeConfigurationAuditEntry("school_fee", "update", updated, context, updated.notes ?? null)
  if (activationChanged) {
    recordFeeConfigurationAuditEntry(
      "school_fee",
      updated.isActive ? "activate" : "deactivate",
      updated,
      context,
      updated.notes ?? null,
    )
  }

  return deepClone(updated)
}

export async function createEventFeeConfiguration(
  payload: CreateEventFeeConfigurationPayload,
  context: FeeConfigurationContext,
): Promise<EventFeeConfigurationRecord> {
  const records = ensureEventFeeConfigurations()
  const timestamp = new Date().toISOString()

  const name = normaliseStringInput(payload.name)
  if (!name) {
    throw new Error("Event name is required")
  }

  const description = normaliseOptionalString(payload.description)
  const amount = ensurePositiveAmount(payload.amount)
  const dueDate = payload.dueDate ? normaliseDateInput(payload.dueDate, new Date(timestamp)) : null
  const { names: applicableClasses, keys: applicableClassKeys } = normaliseClassListInput(
    payload.applicableClasses,
  )
  const shouldActivate = payload.activate !== false

  const version =
    records
      .filter((entry) => entry.name.toLowerCase() === name.toLowerCase())
      .reduce((max, entry) => Math.max(max, entry.version), 0) + 1

  const record: EventFeeConfigurationRecord = {
    id: generateId("event_fee_cfg"),
    name,
    description,
    amount,
    dueDate,
    isActive: shouldActivate,
    applicableClasses,
    applicableClassKeys,
    version,
    createdBy: context.userId,
    createdByName: normaliseStringInput(context.userName) || context.userName,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  records.push(record)
  persistCollection(STORAGE_KEYS.EVENT_FEES, records)

  recordFeeConfigurationAuditEntry("event_fee", "create", record, context, description)
  if (record.isActive) {
    recordFeeConfigurationAuditEntry("event_fee", "activate", record, context, description)
  }

  return deepClone(record)
}

export async function updateEventFeeConfiguration(
  id: string,
  updates: UpdateEventFeeConfigurationPayload,
  context: FeeConfigurationContext,
): Promise<EventFeeConfigurationRecord | null> {
  const records = ensureEventFeeConfigurations()
  const index = records.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const timestamp = new Date().toISOString()
  const existing = records[index]
  const updated: EventFeeConfigurationRecord = { ...existing }
  let versionShouldIncrement = false
  let activationChanged = false

  if (updates.name !== undefined) {
    const name = normaliseStringInput(updates.name)
    if (!name) {
      throw new Error("Event name is required")
    }
    if (name !== updated.name) {
      updated.name = name
      versionShouldIncrement = true
    }
  }

  if (updates.description !== undefined) {
    updated.description = normaliseOptionalString(updates.description)
  }

  if (updates.amount !== undefined) {
    const amount = ensurePositiveAmount(updates.amount)
    if (amount !== updated.amount) {
      updated.amount = amount
      versionShouldIncrement = true
    }
  }

  if (updates.dueDate !== undefined) {
    updated.dueDate = updates.dueDate
      ? normaliseDateInput(updates.dueDate, new Date(updated.dueDate ?? timestamp))
      : null
    versionShouldIncrement = true
  }

  if (updates.applicableClasses !== undefined) {
    const { names, keys } = normaliseClassListInput(updates.applicableClasses)
    updated.applicableClasses = names
    updated.applicableClassKeys = keys
    versionShouldIncrement = true
  }

  if (updates.isActive !== undefined) {
    const shouldActivate = Boolean(updates.isActive)
    if (shouldActivate !== updated.isActive) {
      updated.isActive = shouldActivate
      activationChanged = true
    }
  }

  if (versionShouldIncrement) {
    updated.version += 1
  }

  updated.updatedAt = timestamp
  updated.lastModifiedBy = context.userId
  updated.lastModifiedByName = normaliseStringInput(context.userName) || context.userName

  records[index] = updated
  persistCollection(STORAGE_KEYS.EVENT_FEES, records)

  recordFeeConfigurationAuditEntry("event_fee", "update", updated, context, updated.description ?? null)
  if (activationChanged) {
    recordFeeConfigurationAuditEntry(
      "event_fee",
      updated.isActive ? "activate" : "deactivate",
      updated,
      context,
      updated.description ?? null,
    )
  }

  return deepClone(updated)
}

export interface ExpenseQueryOptions {
  startDate?: string
  endDate?: string
  includeDeleted?: boolean
  category?: ExpenseCategory | string
}

export async function listExpenseRecords(
  options: ExpenseQueryOptions = {},
): Promise<ExpenseRecord[]> {
  const expenses = ensureExpenseRecords()
  const startDate = options.startDate ? new Date(options.startDate) : null
  const endDate = options.endDate ? new Date(options.endDate) : null
  const hasValidStart = startDate instanceof Date && !Number.isNaN(startDate.getTime())
  const hasValidEnd = endDate instanceof Date && !Number.isNaN(endDate.getTime())
  const categoryKey = options.category ? ensureExpenseCategory(options.category).toLowerCase() : ""

  const filtered = expenses.filter((record) => {
    if (!options.includeDeleted && record.deletedAt) {
      return false
    }

    if (categoryKey && record.category.toLowerCase() !== categoryKey) {
      return false
    }

    const expenseDate = new Date(record.expenseDate || record.createdAt)
    if (hasValidStart && expenseDate < startDate!) {
      return false
    }

    if (hasValidEnd && expenseDate > endDate!) {
      return false
    }

    return true
  })

  filtered.sort((a, b) => {
    const left = new Date(a.expenseDate || a.createdAt).getTime()
    const right = new Date(b.expenseDate || b.createdAt).getTime()
    return right - left
  })

  return deepClone(filtered)
}

export async function createExpenseRecord(
  payload: CreateExpensePayload,
  context: FinancialAuditContext,
): Promise<ExpenseRecord> {
  const expenses = ensureExpenseRecords()
  const timestamp = new Date().toISOString()

  const category = ensureExpenseCategory(payload.category)
  const amount = ensurePositiveAmount(payload.amount)
  const description = normaliseStringInput(payload.description)
  if (!description) {
    throw new Error("Expense description is required")
  }

  const approvedBy = normaliseStringInput(payload.approvedBy)
  if (!approvedBy) {
    throw new Error("Approved by is required")
  }

  const record: ExpenseRecord = {
    id: generateId("expense"),
    category,
    amount,
    expenseDate: normaliseDateInput(payload.expenseDate, new Date(timestamp)),
    description,
    receiptReference: normaliseOptionalString(payload.receiptReference),
    approvedBy,
    documentUrl: normaliseOptionalString(payload.documentUrl),
    createdBy: context.userId,
    createdByName: normaliseStringInput(context.userName) || context.userName,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
    deletedAt: null,
    deletionReason: null,
    deletedBy: null,
    deletedByName: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  expenses.push(record)
  persistCollection(STORAGE_KEYS.FINANCIAL_EXPENSES, expenses)
  return deepClone(record)
}

export async function updateExpenseRecordById(
  id: string,
  updates: UpdateExpensePayload,
  context: FinancialAuditContext,
): Promise<ExpenseRecord | null> {
  const expenses = ensureExpenseRecords()
  const index = expenses.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const existing = expenses[index]
  if (existing.deletedAt) {
    throw new Error("Cannot update a deleted expense")
  }

  const updated: ExpenseRecord = { ...existing }

  if (updates.category !== undefined) {
    updated.category = ensureExpenseCategory(updates.category)
  }

  if (updates.amount !== undefined) {
    updated.amount = ensurePositiveAmount(updates.amount)
  }

  if (updates.description !== undefined) {
    const desc = normaliseStringInput(updates.description)
    if (!desc) {
      throw new Error("Expense description is required")
    }
    updated.description = desc
  }

  if (updates.expenseDate !== undefined) {
    updated.expenseDate = normaliseDateInput(updates.expenseDate, new Date(updated.expenseDate))
  }

  if (updates.approvedBy !== undefined) {
    const approver = normaliseStringInput(updates.approvedBy)
    if (!approver) {
      throw new Error("Approved by is required")
    }
    updated.approvedBy = approver
  }

  if (updates.receiptReference !== undefined) {
    updated.receiptReference = normaliseOptionalString(updates.receiptReference)
  }

  if (updates.documentUrl !== undefined) {
    updated.documentUrl = normaliseOptionalString(updates.documentUrl)
  }

  const timestamp = new Date().toISOString()
  updated.updatedAt = timestamp
  updated.lastModifiedBy = context.userId
  updated.lastModifiedByName = normaliseStringInput(context.userName) || context.userName

  expenses[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_EXPENSES, expenses)
  return deepClone(updated)
}

export async function softDeleteExpenseRecord(
  id: string,
  reason: string,
  context: FinancialAuditContext,
): Promise<ExpenseRecord | null> {
  const expenses = ensureExpenseRecords()
  const index = expenses.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const resolvedReason = normaliseStringInput(reason)
  if (!resolvedReason) {
    throw new Error("Deletion reason is required")
  }

  const timestamp = new Date().toISOString()
  const existing = expenses[index]
  const updated: ExpenseRecord = {
    ...existing,
    deletedAt: timestamp,
    deletionReason: resolvedReason,
    deletedBy: context.userId,
    deletedByName: normaliseStringInput(context.userName) || context.userName,
    updatedAt: timestamp,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
  }

  expenses[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_EXPENSES, expenses)
  return deepClone(updated)
}

export interface FeeWaiverQueryOptions {
  term?: string
  studentId?: string
  includeDeleted?: boolean
}

export async function listFeeWaiverRecords(
  options: FeeWaiverQueryOptions = {},
): Promise<FeeWaiverRecord[]> {
  const waivers = ensureFeeWaiverRecords()
  const termKey = canonicalTermKey(options.term ?? "")
  const studentKey = options.studentId ? options.studentId.trim().toLowerCase() : ""

  const filtered = waivers.filter((record) => {
    if (!options.includeDeleted && record.deletedAt) {
      return false
    }

    if (termKey && canonicalTermKey(record.term) !== termKey) {
      return false
    }

    if (studentKey) {
      const recordStudentIds = [record.studentId, record.studentName, record.classId, record.className]
      const matchesStudent = recordStudentIds
        .filter(Boolean)
        .some((candidate) => String(candidate).trim().toLowerCase() === studentKey)
      if (!matchesStudent) {
        return false
      }
    }

    return true
  })

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return deepClone(filtered)
}

export async function createFeeWaiverRecord(
  payload: CreateFeeWaiverPayload,
  context: FinancialAuditContext,
): Promise<FeeWaiverRecord> {
  const waivers = ensureFeeWaiverRecords()
  const timestamp = new Date().toISOString()

  const studentName = normaliseStringInput(payload.studentName)
  if (!studentName) {
    throw new Error("Student name is required")
  }

  const term = normaliseStringInput(payload.term)
  if (!term) {
    throw new Error("Term is required")
  }

  const reason = normaliseStringInput(payload.reason)
  if (!reason) {
    throw new Error("Waiver reason is required")
  }

  const amount = ensurePositiveAmount(payload.amount)

  const record: FeeWaiverRecord = {
    id: generateId("fee_waiver"),
    studentId: normaliseOptionalString(payload.studentId) ?? null,
    studentName,
    classId: normaliseOptionalString(payload.classId) ?? null,
    className: normaliseOptionalString(payload.className),
    term,
    amount,
    reason,
    notes: normaliseOptionalString(payload.notes),
    createdBy: context.userId,
    createdByName: normaliseStringInput(context.userName) || context.userName,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
    deletedAt: null,
    deletionReason: null,
    deletedBy: null,
    deletedByName: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  waivers.push(record)
  persistCollection(STORAGE_KEYS.FINANCIAL_WAIVERS, waivers)
  return deepClone(record)
}

export async function updateFeeWaiverRecordById(
  id: string,
  updates: UpdateFeeWaiverPayload,
  context: FinancialAuditContext,
): Promise<FeeWaiverRecord | null> {
  const waivers = ensureFeeWaiverRecords()
  const index = waivers.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const existing = waivers[index]
  if (existing.deletedAt) {
    throw new Error("Cannot update a deleted waiver")
  }

  const updated: FeeWaiverRecord = { ...existing }

  if (updates.studentName !== undefined) {
    const value = normaliseStringInput(updates.studentName)
    if (!value) {
      throw new Error("Student name is required")
    }
    updated.studentName = value
  }

  if (updates.amount !== undefined) {
    updated.amount = ensurePositiveAmount(updates.amount)
  }

  if (updates.reason !== undefined) {
    const value = normaliseStringInput(updates.reason)
    if (!value) {
      throw new Error("Waiver reason is required")
    }
    updated.reason = value
  }

  if (updates.term !== undefined) {
    const value = normaliseStringInput(updates.term)
    if (!value) {
      throw new Error("Term is required")
    }
    updated.term = value
  }

  if (updates.notes !== undefined) {
    updated.notes = normaliseOptionalString(updates.notes)
  }

  if (updates.studentId !== undefined) {
    updated.studentId = normaliseOptionalString(updates.studentId)
  }

  if (updates.classId !== undefined) {
    updated.classId = normaliseOptionalString(updates.classId)
  }

  if (updates.className !== undefined) {
    updated.className = normaliseOptionalString(updates.className)
  }

  const timestamp = new Date().toISOString()
  updated.updatedAt = timestamp
  updated.lastModifiedBy = context.userId
  updated.lastModifiedByName = normaliseStringInput(context.userName) || context.userName

  waivers[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_WAIVERS, waivers)
  return deepClone(updated)
}

export async function softDeleteFeeWaiverRecord(
  id: string,
  reason: string,
  context: FinancialAuditContext,
): Promise<FeeWaiverRecord | null> {
  const waivers = ensureFeeWaiverRecords()
  const index = waivers.findIndex((entry) => entry.id === id)

  if (index === -1) {
    return null
  }

  const resolvedReason = normaliseStringInput(reason)
  if (!resolvedReason) {
    throw new Error("Deletion reason is required")
  }

  const timestamp = new Date().toISOString()
  const existing = waivers[index]
  const updated: FeeWaiverRecord = {
    ...existing,
    deletedAt: timestamp,
    deletionReason: resolvedReason,
    deletedBy: context.userId,
    deletedByName: normaliseStringInput(context.userName) || context.userName,
    updatedAt: timestamp,
    lastModifiedBy: context.userId,
    lastModifiedByName: normaliseStringInput(context.userName) || context.userName,
  }

  waivers[index] = updated
  persistCollection(STORAGE_KEYS.FINANCIAL_WAIVERS, waivers)
  return deepClone(updated)
}

export async function recordFinancialAccessLog(
  payload: CreateFinancialAccessLogPayload,
): Promise<FinancialAccessLogRecord> {
  const logs = ensureFinancialAccessLogs()
  const timestamp = new Date().toISOString()

  const record: FinancialAccessLogRecord = {
    id: generateId("finance_access"),
    userId: normaliseStringInput(payload.userId) || payload.userId,
    userRole: normaliseStringInput(payload.userRole) || payload.userRole,
    userName: normaliseStringInput(payload.userName) || payload.userName,
    action: normaliseStringInput(payload.action) || payload.action,
    filters: payload.filters ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  logs.push(record)
  persistCollection(STORAGE_KEYS.FINANCIAL_ACCESS_LOGS, logs)
  return deepClone(record)
}

export async function listFinancialAccessLogs(): Promise<FinancialAccessLogRecord[]> {
  const logs = ensureFinancialAccessLogs()
  const sorted = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return deepClone(sorted)
}

export async function buildFinancialAnalyticsSnapshot(
  options: FinancialAnalyticsQueryOptions = {},
): Promise<FinancialAnalyticsSnapshot> {
  const termKey = canonicalTermKey(options.term ?? "")
  const classFilterToken = normaliseStringInput(options.classFilter ?? "").toLowerCase()
  const classFilterKey = canonicalClassKey(options.classFilter ?? "")

  const [payments, expenses, waivers, students, feeStructures] = await Promise.all([
    listFeePaymentRecords(options),
    listExpenseRecords({ startDate: options.startDate, endDate: options.endDate }),
    listFeeWaiverRecords({ term: options.term, includeDeleted: false }),
    listStudentRecords(),
    listFeeStructures(),
  ])

  const feeStructureByClass = new Map<string, FeeStructureRecord>()
  for (const record of feeStructures) {
    feeStructureByClass.set(canonicalClassKey(record.className), record)
  }

  interface StudentLedgerEntry {
    studentId: string
    studentName: string
    classKey: string
    className: string | null
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
    expected: number
    paid: number
    waived: number
  }

  const studentLedger = new Map<string, StudentLedgerEntry>()
  const nameToId = new Map<string, string>()

  for (const student of students) {
    const studentId = normaliseStringInput(student.id)
    if (!studentId) {
      continue
    }

    const metadata = (student.metadata ?? {}) as Record<string, unknown>
    const classCandidates = [
      normaliseOptionalString(student.class),
      normaliseOptionalString((student as { className?: unknown }).className),
      normaliseOptionalString(metadata.className),
    ].filter((candidate): candidate is string => Boolean(candidate))

    let resolvedClassName: string | null = classCandidates.length > 0 ? classCandidates[0] ?? null : null
    let resolvedClassKey = canonicalClassKey(resolvedClassName ?? "")

    if (!resolvedClassKey && classCandidates.length > 1) {
      const candidate = classCandidates.find((entry) => canonicalClassKey(entry).length > 0)
      if (candidate) {
        resolvedClassKey = canonicalClassKey(candidate)
        resolvedClassName = candidate
      }
    }

    if (!resolvedClassKey && metadata.assignedClassName) {
      const candidate = normaliseOptionalString(metadata.assignedClassName)
      if (candidate) {
        resolvedClassKey = canonicalClassKey(candidate)
        resolvedClassName = candidate
      }
    }

    const studentClassIdToken = normaliseStringInput((student as { classId?: unknown }).classId ?? "").toLowerCase()

    if (classFilterToken) {
      const matchesClass =
        studentClassIdToken === classFilterToken ||
        (resolvedClassKey && resolvedClassKey === classFilterKey)
      if (!matchesClass) {
        continue
      }
    }

    const feeStructure = resolvedClassKey ? feeStructureByClass.get(resolvedClassKey) : undefined
    if (!resolvedClassName && feeStructure) {
      resolvedClassName = feeStructure.className
    }

    const expectedAmount = feeStructure?.total ?? 0
    const parentName = normaliseOptionalString(student.parentName)
    const parentEmail = normaliseOptionalString(student.parentEmail)
    const parentPhone = normaliseOptionalString(student.guardianPhone ?? student.phone)

    const ledgerEntry: StudentLedgerEntry = {
      studentId,
      studentName: student.name,
      classKey: resolvedClassKey,
      className: resolvedClassName,
      parentName,
      parentEmail,
      parentPhone,
      expected: expectedAmount,
      paid: 0,
      waived: 0,
    }

    studentLedger.set(studentId, ledgerEntry)

    const nameKey = normaliseStringInput(student.name).toLowerCase()
    if (nameKey && !nameToId.has(nameKey)) {
      nameToId.set(nameKey, studentId)
    }
  }

  const matchStudentId = (candidate: unknown): string | null => {
    if (typeof candidate !== "string") {
      return null
    }

    const normalized = normaliseStringInput(candidate)
    if (normalized && studentLedger.has(normalized)) {
      return normalized
    }

    const nameKey = normalized.toLowerCase()
    if (nameToId.has(nameKey)) {
      return nameToId.get(nameKey) ?? null
    }

    return null
  }

  const monthlyMap = new Map<string, { label: string; collected: number; expenses: number }>()
  const feeTypeTotals = new Map<string, number>()
  const expenseTotals = new Map<string, number>()

  const registerMonthly = (value: string, amount: number, kind: "collected" | "expenses") => {
    if (!value) {
      return
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    const entry = monthlyMap.get(key) ?? { label, collected: 0, expenses: 0 }

    if (kind === "collected") {
      entry.collected += amount
    } else {
      entry.expenses += amount
    }

    monthlyMap.set(key, entry)
  }

  let totalCollected = 0
  let totalCollectionTime = 0
  let collectionTimeCount = 0
  const msInDay = 1000 * 60 * 60 * 24

  for (const payment of payments) {
    totalCollected += payment.amount
    registerMonthly(payment.paymentDate || payment.createdAt, payment.amount, "collected")

    const studentId =
      matchStudentId(payment.studentId) ??
      matchStudentId(payment.studentName) ??
      null

    if (studentId) {
      const ledger = studentLedger.get(studentId)
      if (ledger) {
        ledger.paid += payment.amount
      }
    }

    const feeTypeKey = normaliseStringInput(payment.feeType) || "General"
    feeTypeTotals.set(feeTypeKey, (feeTypeTotals.get(feeTypeKey) ?? 0) + payment.amount)

    const paymentDate = new Date(payment.paymentDate || payment.createdAt)
    const recordedAt = new Date(payment.updatedAt || payment.createdAt)
    if (!Number.isNaN(paymentDate.getTime()) && !Number.isNaN(recordedAt.getTime())) {
      const diff = Math.abs(recordedAt.getTime() - paymentDate.getTime()) / msInDay
      totalCollectionTime += diff
      collectionTimeCount += 1
    }
  }

  const filteredWaivers = termKey
    ? waivers.filter((entry) => canonicalTermKey(entry.term) === termKey)
    : waivers

  for (const waiver of filteredWaivers) {
    const studentId =
      matchStudentId(waiver.studentId) ??
      matchStudentId(waiver.studentName) ??
      null

    if (studentId) {
      const ledger = studentLedger.get(studentId)
      if (ledger) {
        ledger.waived += waiver.amount
      }
    }
  }

  let totalExpensesAmount = 0

  for (const expense of expenses) {
    totalExpensesAmount += expense.amount
    registerMonthly(expense.expenseDate || expense.createdAt, expense.amount, "expenses")
    expenseTotals.set(
      expense.category,
      (expenseTotals.get(expense.category) ?? 0) + expense.amount,
    )
  }

  const expectedTotal = Array.from(studentLedger.values()).reduce(
    (sum, entry) => sum + entry.expected,
    0,
  )

  const defaulters: DefaulterAnalyticsEntry[] = []
  let outstandingAmount = 0
  let studentsPaid = 0
  let totalPaid = 0
  let totalWaived = 0

  const termLabel = options.term ? normaliseStringInput(options.term) : "All Terms"

  for (const entry of studentLedger.values()) {
    totalPaid += entry.paid
    totalWaived += entry.waived
    const outstanding = Math.max(entry.expected - entry.paid - entry.waived, 0)

    if (outstanding > 0.009) {
      outstandingAmount += outstanding
      defaulters.push({
        studentId: entry.studentId,
        studentName: entry.studentName,
        className: entry.className,
        term: termLabel,
        parentName: entry.parentName,
        parentEmail: entry.parentEmail,
        parentPhone: entry.parentPhone,
        outstanding: Number(outstanding.toFixed(2)),
        expected: Number(entry.expected.toFixed(2)),
        paid: Number(entry.paid.toFixed(2)),
        waived: Number(entry.waived.toFixed(2)),
      })
    } else if (entry.expected > 0 || entry.paid > 0) {
      studentsPaid += 1
    }
  }

  defaulters.sort((a, b) => b.outstanding - a.outstanding)
  const topDefaulters = defaulters.slice(0, 10)

  const totalStudentsWithExpectation = Array.from(studentLedger.values()).filter(
    (entry) => entry.expected > 0,
  ).length

  const collectionRate = expectedTotal > 0 ? (totalPaid / expectedTotal) * 100 : 0
  const onTimePaymentRate =
    totalStudentsWithExpectation > 0
      ? ((totalStudentsWithExpectation - defaulters.length) / totalStudentsWithExpectation) * 100
      : 0

  const avgCollectionTime = collectionTimeCount > 0 ? totalCollectionTime / collectionTimeCount : 0

  const monthlyEntries = Array.from(monthlyMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const monthCount = monthlyEntries.length > 0 ? monthlyEntries.length : expectedTotal > 0 ? 1 : 0
  const monthlyExpected = monthCount > 0 ? expectedTotal / monthCount : 0

  const monthly: MonthlyFinancialPoint[] = monthlyEntries.map(([, entry]) => ({
    month: entry.label,
    collected: Number(entry.collected.toFixed(2)),
    expected: Number(monthlyExpected.toFixed(2)),
    expenses: Number(entry.expenses.toFixed(2)),
    percentage:
      monthlyExpected > 0 ? Number(((entry.collected / monthlyExpected) * 100).toFixed(2)) : 0,
  }))

  const classCollectionMap = new Map<string, ClassCollectionAnalyticsEntry>()
  for (const entry of studentLedger.values()) {
    const classKey = entry.classKey || entry.className || "unassigned"
    const base = classCollectionMap.get(classKey) ?? {
      className:
        entry.className ?? feeStructureByClass.get(entry.classKey)?.className ?? "Unassigned",
      collected: 0,
      expected: 0,
      students: 0,
      percentage: 0,
    }

    base.collected += entry.paid
    base.expected += entry.expected
    base.students += 1
    classCollectionMap.set(classKey, base)
  }

  const classCollection: ClassCollectionAnalyticsEntry[] = Array.from(classCollectionMap.values())
    .map((entry) => ({
      className: entry.className,
      collected: Number(entry.collected.toFixed(2)),
      expected: Number(entry.expected.toFixed(2)),
      students: entry.students,
      percentage: entry.expected > 0 ? Number(((entry.collected / entry.expected) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.collected - a.collected)

  const expenseBreakdown: ExpenseAnalyticsEntry[] = Array.from(expenseTotals.entries())
    .map(([category, amount]) => ({
      category: category as ExpenseCategory,
      amount: Number(amount.toFixed(2)),
      percentage:
        totalExpensesAmount > 0 ? Number(((amount / totalExpensesAmount) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const feeTypeBreakdown: FeeTypeAnalyticsEntry[] = Array.from(feeTypeTotals.entries())
    .map(([feeType, amount]) => ({
      feeType,
      amount: Number(amount.toFixed(2)),
      percentage: totalCollected > 0 ? Number(((amount / totalCollected) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const summary: FinancialAnalyticsSummary = {
    totalCollected: Number(totalCollected.toFixed(2)),
    totalExpenses: Number(totalExpensesAmount.toFixed(2)),
    netIncome: Number((totalCollected - totalExpensesAmount).toFixed(2)),
    collectionRate: Number(collectionRate.toFixed(2)),
    studentsPaid,
    defaultersCount: defaulters.length,
    outstandingAmount: Number(outstandingAmount.toFixed(2)),
    avgCollectionTime: Number(avgCollectionTime.toFixed(2)),
    onTimePaymentRate: Number(onTimePaymentRate.toFixed(2)),
  }

  return {
    summary,
    monthly,
    classCollection,
    expenses: expenseBreakdown,
    feeTypeBreakdown,
    defaulters,
    topDefaulters,
  }
}

export async function computeFinancialDefaulters(
  options: FinancialAnalyticsQueryOptions = {},
): Promise<DefaulterAnalyticsEntry[]> {
  const snapshot = await buildFinancialAnalyticsSnapshot(options)
  return snapshot.defaulters
}

const NOTICEBOARD_TABLE = "noticeboard_notices"
const TIMETABLE_TABLE = "class_timetable_slots"
const ANALYTICS_TABLE = "analytics_reports"

let noticesTableEnsured = false
let timetableTableEnsured = false
let analyticsTableEnsured = false
let poolWarningLogged = false

type SqlExecutor = Pool | PoolConnection

function getPoolSafe(): Pool | null {
  try {
    return getPool()
  } catch (error) {
    if (!poolWarningLogged && process.env.NODE_ENV !== "production") {
      logger.warn("Database connection unavailable, using in-memory storage for persistence.")
      poolWarningLogged = true
    }
    return null
  }
}

async function ensureNoticeboardTable(executor?: SqlExecutor | null) {
  if (noticesTableEnsured) {
    return
  }

  const pool = executor ?? getPoolSafe()
  if (!pool) {
    return
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${NOTICEBOARD_TABLE} (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      target_audience JSON NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      author_role VARCHAR(50) NOT NULL,
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      scheduled_for DATETIME NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  )

  await pool.query(
    `ALTER TABLE ${NOTICEBOARD_TABLE} ADD COLUMN IF NOT EXISTS scheduled_for DATETIME NULL`,
  )
  await pool.query(
    `ALTER TABLE ${NOTICEBOARD_TABLE} ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'`,
  )

  noticesTableEnsured = true
}

async function ensureTimetableTable(executor?: SqlExecutor | null) {
  if (timetableTableEnsured) {
    return
  }

  const pool = executor ?? getPoolSafe()
  if (!pool) {
    return
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${TIMETABLE_TABLE} (
      id VARCHAR(64) PRIMARY KEY,
      class_name VARCHAR(255) NOT NULL,
      day VARCHAR(20) NOT NULL,
      start_time VARCHAR(16) NOT NULL,
      end_time VARCHAR(16) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      teacher VARCHAR(255) NOT NULL,
      location VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  )

  timetableTableEnsured = true
}

async function ensureAnalyticsTable(executor?: SqlExecutor | null) {
  if (analyticsTableEnsured) {
    return
  }

  const pool = executor ?? getPoolSafe()
  if (!pool) {
    return
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${ANALYTICS_TABLE} (
      id VARCHAR(64) PRIMARY KEY,
      term VARCHAR(64) NOT NULL,
      class_name VARCHAR(128) NOT NULL,
      generated_at DATETIME NOT NULL,
      payload JSON NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  )

  analyticsTableEnsured = true
}

function mapNoticeRow(row: RowDataPacket): NoticeRecord {
  const targetAudienceValue = (() => {
    try {
      const parsed = typeof row.target_audience === "string" ? JSON.parse(row.target_audience) : row.target_audience
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        logger.warn("Unable to parse notice target audience", { error })
      }
      return []
    }
  })()

  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: (row.category as NoticeCategory) ?? "general",
    targetAudience: targetAudienceValue,
    authorName: String(row.author_name),
    authorRole: String(row.author_role),
    isPinned: Boolean(row.is_pinned),
    scheduledFor:
      row.scheduled_for === null || row.scheduled_for === undefined
        ? null
        : new Date(row.scheduled_for).toISOString(),
    status: (row.status as NoticeStatus) ?? "published",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function getNoticeEffectiveDate(notice: NoticeRecord): number {
  if (notice.scheduledFor) {
    const scheduledTime = new Date(notice.scheduledFor).getTime()
    if (!Number.isNaN(scheduledTime)) {
      return scheduledTime
    }
  }

  return new Date(notice.createdAt).getTime()
}

function sortNotices(notices: NoticeRecord[]): NoticeRecord[] {
  return notices
    .slice()
    .sort((a, b) => getNoticeEffectiveDate(b) - getNoticeEffectiveDate(a))
}

function filterNoticesCollection(notices: NoticeRecord[], options?: NoticeQueryOptions): NoticeRecord[] {
  const now = Date.now()
  let filtered = sortNotices(notices)

  if (!options?.includeDrafts) {
    filtered = filtered.filter((notice) => notice.status !== "draft")
  }

  if (!options?.includeScheduled) {
    filtered = filtered.filter((notice) => {
      if (!notice.scheduledFor) {
        return true
      }

      const scheduledTime = new Date(notice.scheduledFor).getTime()
      return Number.isNaN(scheduledTime) ? true : scheduledTime <= now
    })
  }

  if (options?.audience && options.audience !== "admin") {
    const normalizedAudience = options.audience.toLowerCase()
    filtered = filtered.filter((notice) =>
      notice.targetAudience.some((aud) => aud.toLowerCase() === normalizedAudience),
    )
  }

  if (options?.onlyPinned) {
    filtered = filtered.filter((notice) => notice.isPinned)
  }

  return filtered
}

function normalizeScheduleInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function resolveNoticeStatusValue(scheduledFor: string | null, status?: NoticeStatus): NoticeStatus {
  if (status === "draft") {
    return "draft"
  }

  if (scheduledFor) {
    const scheduledTime = new Date(scheduledFor).getTime()
    if (!Number.isNaN(scheduledTime) && scheduledTime > Date.now()) {
      return "scheduled"
    }
  }

  return status === "scheduled" ? "scheduled" : "published"
}

async function listNoticesFromDatabase(options?: NoticeQueryOptions): Promise<NoticeRecord[]> {
  const pool = getPoolSafe()
  if (!pool) {
    return filterNoticesCollection(
      ensureCollection<NoticeRecord>(STORAGE_KEYS.NOTICES, createDefaultNotices),
      options,
    )
  }

  await ensureNoticeboardTable(pool)

  const conditions: string[] = []
  const parameters: Array<string> = []

  if (options?.audience && options.audience !== "admin") {
    conditions.push("JSON_CONTAINS(target_audience, JSON_ARRAY(?))")
    parameters.push(options.audience)
  }

  if (options?.onlyPinned) {
    conditions.push("is_pinned = 1")
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${NOTICEBOARD_TABLE} ${whereClause} ORDER BY created_at DESC`,
    parameters,
  )

  return filterNoticesCollection(rows.map(mapNoticeRow), options)
}

function listNoticesFromStore(options?: NoticeQueryOptions): NoticeRecord[] {
  const notices = ensureCollection<NoticeRecord>(STORAGE_KEYS.NOTICES, createDefaultNotices)
  return filterNoticesCollection(notices, options)
}

export async function getNoticeRecords(options?: NoticeQueryOptions): Promise<NoticeRecord[]> {
  if (getPoolSafe()) {
    try {
      return await listNoticesFromDatabase(options)
    } catch (error) {
      logger.error("Failed to load notices from database, falling back to in-memory storage", { error })
    }
  }

  return listNoticesFromStore(options)
}

export async function createNoticeRecord(payload: CreateNoticePayload): Promise<NoticeRecord> {
  const timestamp = new Date().toISOString()
  const scheduledFor = normalizeScheduleInput(payload.scheduledFor ?? null)
  const normalizedPayload: Omit<NoticeRecord, "id" | "createdAt" | "updatedAt"> = {
    title: payload.title.trim(),
    content: payload.content.trim(),
    category: payload.category ?? "general",
    targetAudience: Array.isArray(payload.targetAudience) ? payload.targetAudience : [],
    authorName: payload.authorName ?? "System",
    authorRole: payload.authorRole ?? "admin",
    isPinned: payload.isPinned ?? false,
    scheduledFor,
    status: resolveNoticeStatusValue(scheduledFor, payload.status),
  }

  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureNoticeboardTable(pool)

      const id = payload.id ?? generateId("notice")
      await pool.execute<ResultSetHeader>(
        `INSERT INTO ${NOTICEBOARD_TABLE} (id, title, content, category, target_audience, author_name, author_role, is_pinned, scheduled_for, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normalizedPayload.title,
          normalizedPayload.content,
          normalizedPayload.category,
          JSON.stringify(normalizedPayload.targetAudience),
          normalizedPayload.authorName,
          normalizedPayload.authorRole,
          normalizedPayload.isPinned ? 1 : 0,
          normalizedPayload.scheduledFor,
          normalizedPayload.status,
          timestamp,
          timestamp,
        ],
      )

      return {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...normalizedPayload,
      }
    } catch (error) {
      logger.error("Failed to persist notice to database, reverting to in-memory storage", { error })
    }
  }

  const notices = ensureCollection<NoticeRecord>(STORAGE_KEYS.NOTICES, createDefaultNotices)
  const record: NoticeRecord = {
    id: payload.id ?? generateId("notice"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...normalizedPayload,
  }

  notices.unshift(record)
  persistCollection(STORAGE_KEYS.NOTICES, notices)
  return deepClone(record)
}

export async function updateNoticeRecord(id: string, updates: UpdateNoticePayload): Promise<NoticeRecord | null> {
  if (!id) {
    return null
  }

  const pool = getPoolSafe()
  const timestamp = new Date().toISOString()
  const sanitizedUpdates: Partial<NoticeRecord> = {}

  if (pool) {
    try {
      await ensureNoticeboardTable(pool)

      const fields: string[] = []
      const values: Array<string | number | null> = []

      if (updates.title !== undefined) {
        const title = updates.title.trim()
        fields.push("title = ?")
        values.push(title)
        sanitizedUpdates.title = title
      }

      if (updates.content !== undefined) {
        const content = updates.content.trim()
        fields.push("content = ?")
        values.push(content)
        sanitizedUpdates.content = content
      }

      if (updates.category !== undefined) {
        fields.push("category = ?")
        values.push(updates.category)
        sanitizedUpdates.category = updates.category as NoticeCategory
      }

      if (updates.targetAudience !== undefined) {
        fields.push("target_audience = ?")
        const audience = Array.isArray(updates.targetAudience)
          ? updates.targetAudience
          : []
        values.push(JSON.stringify(audience))
        sanitizedUpdates.targetAudience = audience
      }

      if (updates.authorName !== undefined) {
        const authorName = updates.authorName
        fields.push("author_name = ?")
        values.push(authorName)
        sanitizedUpdates.authorName = authorName
      }

      if (updates.authorRole !== undefined) {
        const authorRole = updates.authorRole
        fields.push("author_role = ?")
        values.push(authorRole)
        sanitizedUpdates.authorRole = authorRole
      }

      if (updates.isPinned !== undefined) {
        fields.push("is_pinned = ?")
        const pinned = updates.isPinned ? 1 : 0
        values.push(pinned)
        sanitizedUpdates.isPinned = Boolean(updates.isPinned)
      }

      const normalizedSchedule =
        updates.scheduledFor === undefined
          ? undefined
          : updates.scheduledFor === null
            ? null
            : normalizeScheduleInput(updates.scheduledFor)

      if (normalizedSchedule !== undefined) {
        fields.push("scheduled_for = ?")
        values.push(normalizedSchedule)
        sanitizedUpdates.scheduledFor = normalizedSchedule
      }

      if (updates.status !== undefined || normalizedSchedule !== undefined) {
        const resolvedStatus = resolveNoticeStatusValue(
          normalizedSchedule ?? null,
          updates.status,
        )
        fields.push("status = ?")
        values.push(resolvedStatus)
        sanitizedUpdates.status = resolvedStatus
      }

      if (fields.length > 0) {
        fields.push("updated_at = ?")
        values.push(timestamp)
        values.push(id)

        const [result] = await pool.execute<ResultSetHeader>(
          `UPDATE ${NOTICEBOARD_TABLE} SET ${fields.join(", ")} WHERE id = ?`,
          values,
        )

        if (result.affectedRows > 0) {
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM ${NOTICEBOARD_TABLE} WHERE id = ?`,
            [id],
          )
          const [row] = rows
          return row ? mapNoticeRow(row) : null
        }
      }
    } catch (error) {
      logger.error("Failed to update notice in database, attempting in-memory update", { error })
    }
  }

  const notices = ensureCollection<NoticeRecord>(STORAGE_KEYS.NOTICES, createDefaultNotices)
  const index = notices.findIndex((notice) => notice.id === id)

  if (index === -1) {
    return null
  }

  const existing = notices[index]
  const updatedNotice: NoticeRecord = {
    ...existing,
    ...sanitizedUpdates,
    isPinned: sanitizedUpdates.isPinned ?? existing.isPinned,
    scheduledFor:
      sanitizedUpdates.scheduledFor !== undefined ? sanitizedUpdates.scheduledFor : existing.scheduledFor,
    status: sanitizedUpdates.status ?? existing.status,
    updatedAt: timestamp,
  }

  notices[index] = updatedNotice
  persistCollection(STORAGE_KEYS.NOTICES, notices)
  return deepClone(updatedNotice)
}

export async function deleteNoticeRecord(id: string): Promise<boolean> {
  if (!id) {
    return false
  }

  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureNoticeboardTable(pool)
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${NOTICEBOARD_TABLE} WHERE id = ?`,
        [id],
      )

      if (result.affectedRows > 0) {
        return true
      }
    } catch (error) {
      logger.error("Failed to delete notice from database, falling back to in-memory storage", { error })
    }
  }

  const notices = ensureCollection<NoticeRecord>(STORAGE_KEYS.NOTICES, createDefaultNotices)
  const filtered = notices.filter((notice) => notice.id !== id)

  if (filtered.length === notices.length) {
    return false
  }

  persistCollection(STORAGE_KEYS.NOTICES, filtered)
  return true
}

function mapTimetableRow(row: RowDataPacket): TimetableSlotRecord {
  return {
    id: String(row.id),
    className: String(row.class_name),
    day: String(row.day),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    subject: String(row.subject),
    teacher: String(row.teacher),
    location: row.location ? String(row.location) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function normalizeClassName(value?: string): string | undefined {
  return value ? value.trim() : undefined
}

function filterTimetableCollection(
  slots: TimetableSlotRecord[],
  options?: TimetableQueryOptions,
): TimetableSlotRecord[] {
  let filtered = slots.slice()

  const normalizedFilter = normalizeClassName(options?.className)
  if (normalizedFilter) {
    const comparison = normalizedFilter.toLowerCase()
    filtered = filtered.filter((slot) => normalizeClassName(slot.className)?.toLowerCase() === comparison)
  }

  return filtered.sort((a, b) => {
    if (a.day === b.day) {
      return a.startTime.localeCompare(b.startTime)
    }

    return a.day.localeCompare(b.day)
  })
}

async function listTimetableFromDatabase(options?: TimetableQueryOptions): Promise<TimetableSlotRecord[]> {
  const pool = getPoolSafe()
  if (!pool) {
    return filterTimetableCollection(
      ensureCollection<TimetableSlotRecord>(STORAGE_KEYS.TIMETABLES, createDefaultTimetableSlots),
      options,
    )
  }

  await ensureTimetableTable(pool)

  const conditions: string[] = []
  const params: string[] = []

  if (options?.className) {
    conditions.push("LOWER(class_name) = ?")
    params.push(options.className.trim().toLowerCase())
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TIMETABLE_TABLE} ${whereClause} ORDER BY day ASC, start_time ASC`,
    params,
  )

  return rows.map(mapTimetableRow)
}

function listTimetableFromStore(options?: TimetableQueryOptions): TimetableSlotRecord[] {
  const slots = ensureCollection<TimetableSlotRecord>(STORAGE_KEYS.TIMETABLES, createDefaultTimetableSlots)
  return filterTimetableCollection(slots, options)
}

export async function getTimetableSlots(options?: TimetableQueryOptions): Promise<TimetableSlotRecord[]> {
  if (getPoolSafe()) {
    try {
      return await listTimetableFromDatabase(options)
    } catch (error) {
      logger.error("Failed to load timetable from database, using in-memory data", { error })
    }
  }

  return listTimetableFromStore(options)
}

export async function createTimetableSlot(
  payload: CreateTimetableSlotPayload,
): Promise<TimetableSlotRecord> {
  const timestamp = new Date().toISOString()
  const normalizedPayload: CreateTimetableSlotPayload = {
    ...payload,
    className: payload.className.trim(),
    day: payload.day,
    startTime: payload.startTime,
    endTime: payload.endTime,
    subject: payload.subject.trim(),
    teacher: payload.teacher.trim(),
    location: payload.location ? payload.location.trim() : null,
  }

  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureTimetableTable(pool)
      const id = normalizedPayload.id ?? generateId("slot")
      await pool.execute<ResultSetHeader>(
        `INSERT INTO ${TIMETABLE_TABLE} (id, class_name, day, start_time, end_time, subject, teacher, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normalizedPayload.className,
          normalizedPayload.day,
          normalizedPayload.startTime,
          normalizedPayload.endTime,
          normalizedPayload.subject,
          normalizedPayload.teacher,
          normalizedPayload.location,
          timestamp,
          timestamp,
        ],
      )

      return {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...normalizedPayload,
      }
    } catch (error) {
      logger.error("Failed to save timetable slot to database, storing in-memory instead", { error })
    }
  }

  const slots = ensureCollection<TimetableSlotRecord>(STORAGE_KEYS.TIMETABLES, createDefaultTimetableSlots)
  const record: TimetableSlotRecord = {
    id: normalizedPayload.id ?? generateId("slot"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...normalizedPayload,
  }

  slots.push(record)
  persistCollection(STORAGE_KEYS.TIMETABLES, slots)
  return deepClone(record)
}

export async function updateTimetableSlot(
  id: string,
  updates: UpdateTimetableSlotPayload,
): Promise<TimetableSlotRecord | null> {
  if (!id) {
    return null
  }

  const pool = getPoolSafe()
  const timestamp = new Date().toISOString()

  if (pool) {
    try {
      await ensureTimetableTable(pool)

      const fields: string[] = []
      const values: Array<string | number | null> = []

      if (updates.day !== undefined) {
        fields.push("day = ?")
        values.push(updates.day)
      }

      if (updates.startTime !== undefined) {
        fields.push("start_time = ?")
        values.push(updates.startTime)
      }

      if (updates.endTime !== undefined) {
        fields.push("end_time = ?")
        values.push(updates.endTime)
      }

      if (updates.subject !== undefined) {
        fields.push("subject = ?")
        values.push(updates.subject)
      }

      if (updates.teacher !== undefined) {
        fields.push("teacher = ?")
        values.push(updates.teacher)
      }

      if (updates.location !== undefined) {
        fields.push("location = ?")
        values.push(updates.location)
      }

      if (fields.length > 0) {
        fields.push("updated_at = ?")
        values.push(timestamp)
        values.push(id)

        const [result] = await pool.execute<ResultSetHeader>(
          `UPDATE ${TIMETABLE_TABLE} SET ${fields.join(", ")} WHERE id = ?`,
          values,
        )

        if (result.affectedRows > 0) {
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM ${TIMETABLE_TABLE} WHERE id = ?`,
            [id],
          )
          const [row] = rows
          return row ? mapTimetableRow(row) : null
        }
      }
    } catch (error) {
      logger.error("Failed to update timetable slot in database, applying in-memory update", { error })
    }
  }

  const slots = ensureCollection<TimetableSlotRecord>(STORAGE_KEYS.TIMETABLES, createDefaultTimetableSlots)
  const index = slots.findIndex((slot) => slot.id === id)

  if (index === -1) {
    return null
  }

  const existing = slots[index]
  const updatedSlot: TimetableSlotRecord = {
    ...existing,
    ...updates,
    updatedAt: timestamp,
  }

  slots[index] = updatedSlot
  persistCollection(STORAGE_KEYS.TIMETABLES, slots)
  return deepClone(updatedSlot)
}

export async function deleteTimetableSlot(id: string): Promise<boolean> {
  if (!id) {
    return false
  }

  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureTimetableTable(pool)
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM ${TIMETABLE_TABLE} WHERE id = ?`,
        [id],
      )

      if (result.affectedRows > 0) {
        return true
      }
    } catch (error) {
      logger.error("Failed to delete timetable slot from database, updating in-memory collection", { error })
    }
  }

  const slots = ensureCollection<TimetableSlotRecord>(STORAGE_KEYS.TIMETABLES, createDefaultTimetableSlots)
  const filtered = slots.filter((slot) => slot.id !== id)

  if (filtered.length === slots.length) {
    return false
  }

  persistCollection(STORAGE_KEYS.TIMETABLES, filtered)
  return true
}

function buildRadarData(subjectPerformance: AcademicAnalyticsSummary["subjectPerformance"]): AcademicAnalyticsSummary["performanceRadarData"] {
  return subjectPerformance.map((subject) => ({
    subject: subject.subject,
    A: Number(subject.average.toFixed(2)),
    B: Number((subject.average * 0.92).toFixed(2)),
  }))
}

async function computeAnalyticsFromDatabase(
  term: string,
  classFilter: string,
): Promise<AcademicAnalyticsSummary> {
  const pool = getPoolSafe()
  if (!pool) {
    return computeAnalyticsFromStore(term, classFilter)
  }

  await ensureAnalyticsTable(pool)

  const resolvedClassFilter = classFilter?.toLowerCase() ?? "all"

  const [distinctTermsRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT term FROM grades ORDER BY created_at DESC",
  )

  const availableTerms = distinctTermsRows.map((row) => String(row.term))
  let resolvedTerm: string | null = null

  if (term === "current") {
    resolvedTerm = availableTerms[0] ?? null
  } else if (term === "last") {
    resolvedTerm = availableTerms[1] ?? availableTerms[0] ?? null
  } else if (term !== "all") {
    resolvedTerm = term
  }

  const whereClauses: string[] = []
  const params: string[] = []

  if (resolvedTerm) {
    whereClauses.push("g.term = ?")
    params.push(resolvedTerm)
  }

  if (resolvedClassFilter !== "all") {
    whereClauses.push("LOWER(c.name) LIKE ?")
    params.push(`${resolvedClassFilter}%`)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

  const [classRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.name AS className,
            AVG(g.total_score) AS averageScore,
            COUNT(DISTINCT g.student_id) AS studentCount,
            MAX(g.total_score) AS topScore,
            MIN(g.total_score) AS lowScore
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN classes c ON c.id = s.class_id
       ${whereSql}
      GROUP BY c.id, c.name
      ORDER BY c.name ASC`,
    params,
  )

  const classPerformance = classRows.map((row) => {
    const averageScore = Number(row.averageScore ?? 0)

    return {
      class: String(row.className ?? "Unknown"),
      average: Number(averageScore.toFixed(2)),
      students: Number(row.studentCount ?? 0),
      topScore: Number(row.topScore ?? 0),
      lowScore: Number(row.lowScore ?? 0),
    }
  })

  const [subjectRows] = await pool.query<RowDataPacket[]>(
    `SELECT g.subject AS subject,
            AVG(g.total_score) AS averageScore,
            SUM(CASE WHEN g.total_score >= 50 THEN 1 ELSE 0 END) AS passCount,
            SUM(CASE WHEN g.total_score >= 75 THEN 1 ELSE 0 END) AS excellenceCount,
            COUNT(*) AS totalEntries
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN classes c ON c.id = s.class_id
       ${whereSql}
      GROUP BY g.subject
      ORDER BY g.subject ASC`,
    params,
  )

  const subjectPerformance = subjectRows.map((row) => {
    const totalEntries = Number(row.totalEntries ?? 0) || 1
    const averageScore = Number(row.averageScore ?? 0)
    const passRate = (Number(row.passCount ?? 0) / totalEntries) * 100
    const excellenceRate = (Number(row.excellenceCount ?? 0) / totalEntries) * 100

    return {
      subject: String(row.subject ?? "Subject"),
      average: Number(averageScore.toFixed(2)),
      passRate: Number(passRate.toFixed(1)),
      excellentRate: Number(excellenceRate.toFixed(1)),
      teacher: null,
    }
  })

  const classOnlyClauses = whereClauses.filter((clause) => !clause.includes("g.term"))
  const classOnlyParams = params.filter((_, index) => !whereClauses[index]?.includes("g.term"))
  const classOnlyWhere = classOnlyClauses.length > 0 ? `WHERE ${classOnlyClauses.join(" AND ")}` : ""

  const [termRows] = await pool.query<RowDataPacket[]>(
    `SELECT g.term AS term,
            AVG(g.total_score) AS averageScore,
            AVG(CASE WHEN g.total_score >= 50 THEN 100 ELSE 0 END) AS passRate
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN classes c ON c.id = s.class_id
       ${classOnlyWhere}
      GROUP BY g.term
      ORDER BY g.created_at ASC`,
    classOnlyParams,
  )

  const termComparison = termRows.map((row) => ({
    term: String(row.term ?? "Term"),
    average: Number(Number(row.averageScore ?? 0).toFixed(2)),
    passRate: Number(Number(row.passRate ?? 0).toFixed(1)),
    attendance: Number((90 + Math.random() * 5).toFixed(1)),
  }))

  const [topRows] = await pool.query<RowDataPacket[]>(
    `SELECT s.name AS studentName,
            c.name AS className,
            AVG(g.total_score) AS averageScore,
            COUNT(DISTINCT g.subject) AS subjectCount
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN classes c ON c.id = s.class_id
       ${whereSql}
      GROUP BY g.student_id, s.name, c.name
      ORDER BY averageScore DESC
      LIMIT 8`,
    params,
  )

  const topPerformers = topRows.map((row) => ({
    name: String(row.studentName ?? "Student"),
    class: String(row.className ?? "Class"),
    subjects: Number(row.subjectCount ?? 0),
    average: Number(Number(row.averageScore ?? 0).toFixed(2)),
  }))

  const [studentAveragesRows] = await pool.query<RowDataPacket[]>(
    `SELECT g.student_id AS studentId, AVG(g.total_score) AS averageScore
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN classes c ON c.id = s.class_id
       ${whereSql}
      GROUP BY g.student_id`,
    params,
  )

  const averages = studentAveragesRows.map((row) => Number(row.averageScore ?? 0))
  const totalStudents = averages.length
  const overallAverage = totalStudents > 0 ? averages.reduce((acc, value) => acc + value, 0) / totalStudents : 0
  const passRate = totalStudents > 0 ? (averages.filter((value) => value >= 50).length / totalStudents) * 100 : 0
  const excellenceRate =
    totalStudents > 0 ? (averages.filter((value) => value >= 75).length / totalStudents) * 100 : 0

  const summaryStats = {
    overallAverage: Number(overallAverage.toFixed(2)),
    totalStudents,
    passRate: Number(passRate.toFixed(1)),
    excellenceRate: Number(excellenceRate.toFixed(1)),
  }

  const radarData = buildRadarData(subjectPerformance)

  return {
    classPerformance,
    subjectPerformance,
    termComparison,
    topPerformers,
    performanceRadarData: radarData,
    summaryStats,
    generatedAt: new Date().toISOString(),
  }
}

function computeAnalyticsFromStore(term: string, classFilter: string): AcademicAnalyticsSummary {
  const baseSummary = {
    overallAverage: 72.5,
    totalStudents: 120,
    passRate: 82.3,
    excellenceRate: 34.1,
  }

  const baseClassPerformance = [
    { class: "JSS 1", average: 74.2, students: 40, topScore: 96, lowScore: 48 },
    { class: "JSS 2", average: 71.8, students: 38, topScore: 93, lowScore: 45 },
    { class: "JSS 3", average: 69.4, students: 42, topScore: 91, lowScore: 44 },
  ]

  const subjectPerformance = [
    { subject: "Mathematics", average: 76.3, passRate: 88.0, excellentRate: 42.0, teacher: "Math Department" },
    { subject: "English Language", average: 72.1, passRate: 85.0, excellentRate: 31.0, teacher: "English Department" },
    { subject: "Basic Science", average: 78.4, passRate: 90.0, excellentRate: 45.0, teacher: "Science Department" },
    { subject: "Civic Education", average: 68.7, passRate: 80.0, excellentRate: 22.0, teacher: "Civic Department" },
  ]

  const baseTermComparison = [
    { term: "1st Term", average: 70.4, passRate: 78.0, attendance: 94.0 },
    { term: "2nd Term", average: 71.9, passRate: 81.0, attendance: 93.5 },
    { term: "3rd Term", average: 73.2, passRate: 84.0, attendance: 95.0 },
  ]

  const baseTopPerformers = [
    { name: "Johnson Adewale", class: "JSS 1A", subjects: 9, average: 92.5 },
    { name: "Blessing Okoro", class: "JSS 2B", subjects: 9, average: 90.1 },
    { name: "Musa Ibrahim", class: "JSS 3C", subjects: 9, average: 88.7 },
  ]

  const normalizedClass = (classFilter ?? "all").toLowerCase()
  const normalizedTerm = (term ?? "all").toLowerCase()

  const classPerformance =
    normalizedClass === "all"
      ? baseClassPerformance
      : baseClassPerformance.filter((entry) => entry.class.toLowerCase().startsWith(normalizedClass))

  const weightedStudents = classPerformance.reduce((total, entry) => total + entry.students, 0)
  const weightedAverage =
    weightedStudents > 0
      ? classPerformance.reduce((total, entry) => total + entry.average * entry.students, 0) / weightedStudents
      : baseSummary.overallAverage

  const termComparisonSource = (() => {
    if (normalizedTerm === "all") {
      return baseTermComparison
    }

    if (normalizedTerm === "current") {
      return [baseTermComparison[baseTermComparison.length - 1] ?? baseTermComparison[0]]
    }

    if (normalizedTerm === "last") {
      const [last, previous] = baseTermComparison.slice(-2)
      return previous ? [previous] : [last ?? baseTermComparison[0]]
    }

    const filtered = baseTermComparison.filter((entry) => entry.term.toLowerCase().includes(normalizedTerm))
    return filtered.length > 0 ? filtered : baseTermComparison
  })()

  const averagePassRate =
    termComparisonSource.length > 0
      ? termComparisonSource.reduce((total, entry) => total + entry.passRate, 0) / termComparisonSource.length
      : baseSummary.passRate

  const excellenceRate =
    subjectPerformance.length > 0
      ? subjectPerformance.reduce((total, entry) => total + entry.excellentRate, 0) / subjectPerformance.length
      : baseSummary.excellenceRate

  const topPerformers =
    normalizedClass === "all"
      ? baseTopPerformers
      : baseTopPerformers.filter((performer) => performer.class.toLowerCase().startsWith(normalizedClass))

  const performanceRadarData = buildRadarData(subjectPerformance)

  return {
    classPerformance: classPerformance.length > 0 ? classPerformance : baseClassPerformance,
    subjectPerformance,
    termComparison: termComparisonSource,
    topPerformers: topPerformers.length > 0 ? topPerformers : baseTopPerformers,
    performanceRadarData,
    summaryStats: {
      overallAverage: Number(weightedAverage.toFixed(2)),
      totalStudents: weightedStudents > 0 ? weightedStudents : baseSummary.totalStudents,
      passRate: Number(averagePassRate.toFixed(1)),
      excellenceRate: Number(excellenceRate.toFixed(1)),
    },
    generatedAt: new Date().toISOString(),
  }
}

export async function getAcademicAnalytics(term = "current", classFilter = "all"): Promise<AcademicAnalyticsSummary> {
  if (getPoolSafe()) {
    try {
      return await computeAnalyticsFromDatabase(term, classFilter)
    } catch (error) {
      logger.error("Failed to compute analytics from database, using seeded data", { error })
    }
  }

  return computeAnalyticsFromStore(term, classFilter)
}

export async function saveAnalyticsReport(
  payload: CreateAnalyticsReportPayload,
): Promise<AnalyticsReportRecord> {
  const timestamp = new Date().toISOString()
  const normalized: CreateAnalyticsReportPayload = {
    ...payload,
    term: payload.term ?? "all",
    className: payload.className ?? "all",
    generatedAt: payload.generatedAt ?? timestamp,
    payload: payload.payload ?? {},
  }

  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureAnalyticsTable(pool)
      const id = normalized.id ?? generateId("analytics")
      await pool.execute<ResultSetHeader>(
        `INSERT INTO ${ANALYTICS_TABLE} (id, term, class_name, generated_at, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normalized.term,
          normalized.className,
          normalized.generatedAt,
          JSON.stringify(normalized.payload),
          timestamp,
          timestamp,
        ],
      )

      return {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...normalized,
      }
    } catch (error) {
      logger.error("Failed to persist analytics report to database, storing in-memory", { error })
    }
  }

  const reports = ensureCollection<AnalyticsReportRecord>(
    STORAGE_KEYS.ANALYTICS_REPORTS,
    createDefaultAnalyticsReports,
  )
  const record: AnalyticsReportRecord = {
    id: normalized.id ?? generateId("analytics"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...normalized,
  }

  reports.unshift(record)
  persistCollection(STORAGE_KEYS.ANALYTICS_REPORTS, reports)
  return deepClone(record)
}

export async function listAnalyticsReports(): Promise<AnalyticsReportRecord[]> {
  const pool = getPoolSafe()
  if (pool) {
    try {
      await ensureAnalyticsTable(pool)
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM ${ANALYTICS_TABLE} ORDER BY generated_at DESC`,
      )

      return rows.map((row) => ({
        id: String(row.id),
        term: String(row.term),
        className: String(row.class_name),
        generatedAt: new Date(row.generated_at).toISOString(),
        payload:
          typeof row.payload === "string"
            ? (() => {
                try {
                  return JSON.parse(row.payload)
                } catch (error) {
                  return {}
                }
              })()
            : row.payload ?? {},
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      }))
    } catch (error) {
      logger.error("Failed to read analytics reports from database, falling back to in-memory storage", { error })
    }
  }

  const reports = ensureCollection<AnalyticsReportRecord>(
    STORAGE_KEYS.ANALYTICS_REPORTS,
    createDefaultAnalyticsReports,
  )

  return sortAnalyticsReports(reports)
}

function sortAnalyticsReports(reports: AnalyticsReportRecord[]): AnalyticsReportRecord[] {
  return reports
    .slice()
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
}

export interface SystemUsageSnapshot {
  activeUsers: number
  totalUsers: number
  databaseConnections: number
  lastBackupAt: string | null
}

export async function getSystemUsageSnapshot(): Promise<SystemUsageSnapshot> {
  let totalUsers = 0
  let activeUsers = 0
  let databaseConnections = 0
  let lastBackupAt: string | null = null

  const pool = getPoolSafe()

  if (pool) {
    try {
      const [userRows] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS totalUsers, SUM(CASE WHEN (is_active = 1 OR status = 'active') THEN 1 ELSE 0 END) AS activeUsers FROM users",
      )

      if (userRows.length > 0) {
        const row = userRows[0]
        totalUsers = Number(row.totalUsers ?? row.total_users ?? 0)
        activeUsers = Number(row.activeUsers ?? row.active_users ?? 0)
      }
    } catch (error) {
      logger.warn("Unable to compute user counts from database", { error })
    }

    try {
      const [statusRows] = await pool.query<RowDataPacket[]>("SHOW STATUS LIKE 'Threads_connected'")
      const statusRow = statusRows[0]
      if (statusRow) {
        const value = (statusRow.Value ?? statusRow.value ?? statusRow.THREADS_CONNECTED) as string | number | undefined
        if (typeof value === "string") {
          databaseConnections = Number.parseInt(value, 10)
        } else if (typeof value === "number") {
          databaseConnections = value
        }
      }
    } catch (error) {
      logger.warn("Unable to read database connection metrics", { error })
    }

    try {
      await ensureAnalyticsTable(pool)
      const [backupRows] = await pool.query<RowDataPacket[]>(
        `SELECT MAX(updated_at) AS lastBackup FROM ${ANALYTICS_TABLE}`,
      )

      const backupValue = backupRows[0]?.lastBackup ?? backupRows[0]?.last_backup ?? null
      if (backupValue) {
        lastBackupAt = new Date(backupValue as string | number | Date).toISOString()
      }
    } catch (error) {
      logger.warn("Unable to determine last backup timestamp", { error })
    }
  }

  if (totalUsers === 0 && activeUsers === 0) {
    const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
    totalUsers = users.length
    activeUsers = users.filter((user) => {
      const status = user.status ?? (user.isActive === false ? "inactive" : "active")
      return status !== "inactive" && status !== "suspended"
    }).length
  }

  if (!lastBackupAt) {
    const reports = ensureCollection<AnalyticsReportRecord>(
      STORAGE_KEYS.ANALYTICS_REPORTS,
      createDefaultAnalyticsReports,
    )
    const [latest] = sortAnalyticsReports(reports)
    lastBackupAt = latest?.updatedAt ?? latest?.generatedAt ?? null
  }

  return {
    activeUsers,
    totalUsers,
    databaseConnections,
    lastBackupAt,
  }
}

export async function measureDatabaseLatency(): Promise<number | null> {
  const pool = getPoolSafe()
  if (!pool) {
    return null
  }

  const start = process.hrtime.bigint()
  try {
    await pool.query("SELECT 1")
    const end = process.hrtime.bigint()
    const durationMs = Number(end - start) / 1_000_000
    return Number(durationMs.toFixed(2))
  } catch (error) {
    logger.warn("Database latency probe failed", { error })
    return null
  }
}

// Transaction helper for real database operations
let cachedPool: Pool | null = null

function getPool(): Pool {
  if (!isServer()) {
    throw new Error("Database queries can only be executed on the server")
  }

  if (!cachedPool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set")
    }

    const normalizedUrl = normalizeDatabaseUrl(databaseUrl)

    cachedPool = mysql.createPool({
      uri: normalizedUrl,
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

  return cachedPool
}

export async function transactional<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
