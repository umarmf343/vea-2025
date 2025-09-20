import crypto from "crypto"
import bcrypt from "bcryptjs"
import mysql, { type Pool, type PoolConnection } from "mysql2/promise"
import { safeStorage } from "./safe-storage"

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
  metadata?: Record<string, any> | null
  profileImage?: string | null
  lastLogin?: string | null
  [key: string]: any
}

export interface ClassRecord extends CollectionRecord {
  name: string
  level: string
  capacity?: number | null
  classTeacherId?: string | null
  status: "active" | "inactive"
  subjects?: string[]
  [key: string]: any
}

export interface SubjectRecord extends CollectionRecord {
  name: string
  code: string
  description?: string | null
  classes: string[]
  teachers: string[]
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
  photoUrl?: string | null
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
  [key: string]: any
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
  metadata?: Record<string, any>
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

export interface ReceiptRecord extends CollectionRecord {
  paymentId: string
  receiptNumber: string
  studentName: string
  amount: number
  dateIssued: string
  reference?: string | null
  issuedBy?: string | null
  metadata?: Record<string, any> | null
}

export interface CreateReceiptPayload extends Omit<ReceiptRecord, "id" | "createdAt" | "updatedAt" | "receiptNumber" | "dateIssued"> {
  receiptNumber?: string | null
  dateIssued?: string | null
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
  studentId?: string | null
  studentIds?: string[]
  subjects?: string[]
  metadata?: Record<string, any> | null
  profileImage?: string | null
  isActive?: boolean
  status?: StoredUserStatus
}

export interface UpdateUserPayload extends Partial<Omit<StoredUser, "id" | "email" | "createdAt" | "updatedAt">> {
  email?: string
  studentId?: string | null
  studentIds?: string[]
  subjects?: string[]
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

export interface CreateStudentPayload extends Omit<StudentRecord, "id" | "createdAt" | "updatedAt"> {}

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
  metadata?: Record<string, any>
}

const STORAGE_KEYS = {
  USERS: "vea_users",
  CLASSES: "vea_classes",
  SUBJECTS: "vea_subjects",
  STUDENTS: "vea_students",
  GRADES: "vea_grades",
  MARKS: "vea_marks",
  PAYMENTS: "vea_payment_initializations",
  FEE_STRUCTURE: "vea_fee_structure",
  RECEIPTS: "vea_payment_receipts",
  REPORT_CARDS: "reportCards",
  REPORT_CARD_CONFIG: "reportCardConfig",
  BRANDING: "schoolBranding",
  SYSTEM_SETTINGS: "systemSettings",
} as const

const serverCollections = new Map<string, any[]>()

const defaultPasswordHash = bcrypt.hashSync("Admin2025!", 12)

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isServer(): boolean {
  return typeof globalThis === "undefined" || typeof (globalThis as Record<string, unknown>).window === "undefined"
}

function readCollection<T>(key: string): T[] | undefined {
  if (isServer()) {
    const data = serverCollections.get(key)
    return data ? deepClone(data) : undefined
  }

  const stored = safeStorage.getItem(key)
  if (!stored) {
    return undefined
  }

  try {
    return JSON.parse(stored) as T[]
  } catch (error) {
    console.error(`Failed to parse data for ${key}:`, error)
    return undefined
  }
}

function persistCollection<T>(key: string, data: T[]): void {
  const cloned = deepClone(data)

  if (isServer()) {
    serverCollections.set(key, cloned)
  }

  try {
    safeStorage.setItem(key, JSON.stringify(cloned))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Unable to persist ${key} to storage:`, error)
    }
  }
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
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`
}

function createDefaultUsers(): StoredUser[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "user_admin",
      name: "Admin User",
      email: "admin@vea.edu.ng",
      role: "Admin",
      passwordHash: defaultPasswordHash,
      isActive: true,
      status: "active",
      classId: null,
      studentIds: [],
      subjects: [],
      metadata: null,
      profileImage: null,
      lastLogin: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
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
      photoUrl: null,
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
      photoUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

interface ReportCardConfigState extends CollectionRecord {
  columns: ReportCardColumnRecord[]
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
export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase()
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const match = users.find((user) => user.email.toLowerCase() === normalized)
  return match ? deepClone(match) : null
}

export async function getUserByIdFromDb(id: string): Promise<StoredUser | null> {
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const match = users.find((user) => user.id === id)
  return match ? deepClone(match) : null
}

export async function getAllUsersFromDb(): Promise<StoredUser[]> {
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  return deepClone(users)
}

export async function getUsersByRoleFromDb(role: string): Promise<StoredUser[]> {
  const normalizedRole = role.trim().toLowerCase()
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const filtered = users.filter((user) => user.role.trim().toLowerCase() === normalizedRole)
  return deepClone(filtered)
}

export async function createUserRecord(payload: CreateUserPayload): Promise<StoredUser> {
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

  const newUser: StoredUser = {
    id: generateId("user"),
    name: payload.name,
    email: normalizedEmail,
    role: payload.role,
    passwordHash: payload.passwordHash,
    isActive,
    status,
    classId: payload.classId ?? null,
    studentIds: payload.studentIds ?? (payload.studentId ? [String(payload.studentId)] : []),
    subjects: payload.subjects ? [...payload.subjects] : [],
    metadata: payload.metadata ?? null,
    profileImage: payload.profileImage ?? null,
    lastLogin: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  users.push(newUser)
  persistCollection(STORAGE_KEYS.USERS, users)
  return deepClone(newUser)
}

export async function updateUserRecord(id: string, updates: UpdateUserPayload): Promise<StoredUser | null> {
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const index = users.findIndex((user) => user.id === id)

  if (index === -1) {
    return null
  }

  const existing = users[index]
  const timestamp = new Date().toISOString()

  const { studentId, studentIds, subjects, email, status, isActive, ...otherUpdates } = updates as UpdateUserPayload & {
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

  for (const [key, value] of Object.entries(otherUpdates)) {
    if (value !== undefined) {
      ;(existing as any)[key] = value
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

  if (subjects !== undefined) {
    existing.subjects = Array.isArray(subjects) ? subjects.map(String) : []
  }

  existing.updatedAt = timestamp
  users[index] = existing
  persistCollection(STORAGE_KEYS.USERS, users)
  return deepClone(existing)
}

export async function deleteUserRecord(id: string): Promise<boolean> {
  const users = ensureCollection<StoredUser>(STORAGE_KEYS.USERS, createDefaultUsers)
  const index = users.findIndex((user) => user.id === id)

  if (index === -1) {
    return false
  }

  users.splice(index, 1)
  persistCollection(STORAGE_KEYS.USERS, users)
  return true
}

// Class helpers
export async function getAllClassesFromDb(): Promise<ClassRecord[]> {
  const classes = ensureCollection<ClassRecord>(STORAGE_KEYS.CLASSES, createDefaultClasses)
  return deepClone(classes)
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
        ;(existing as any)[key] = value
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
  return deepClone(students)
}

export async function createStudentRecord(payload: CreateStudentPayload): Promise<StudentRecord> {
  const students = ensureCollection<StudentRecord>(STORAGE_KEYS.STUDENTS, createDefaultStudents)

  if (students.some((student) => student.admissionNumber === payload.admissionNumber)) {
    throw new Error("Student with this admission number already exists")
  }

  const timestamp = new Date().toISOString()
  const record: StudentRecord = {
    id: generateId("student"),
    ...payload,
    subjects: payload.subjects ? payload.subjects.map(String) : [],
    attendance: payload.attendance ?? { present: 0, total: 0 },
    grades: payload.grades ? payload.grades.map((grade) => ({ ...grade })) : [],
    photoUrl: payload.photoUrl ?? null,
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
    } else if (key === "photoUrl") {
      existing.photoUrl = value ?? null
    } else if (key !== "id" && key !== "createdAt" && key !== "updatedAt") {
      ;(existing as any)[key] = value
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

  const updated: ReportCardConfigState = {
    ...existing,
    columns: normalized,
    updatedAt: timestamp,
  }

  persistCollection(STORAGE_KEYS.REPORT_CARD_CONFIG, [updated])
  return deepClone(updated.columns)
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

  return {
    name: subject.name,
    ca1,
    ca2,
    assignment,
    exam,
    total,
    grade: (subject as ReportCardSubjectRecord).grade ?? determineGrade(total),
    remark: "remark" in subject ? (subject as ReportCardSubjectRecord).remark ?? undefined : undefined,
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
      ;(existing as any)[key] = value
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

function generateReceiptNumber(timestamp: string): string {
  const datePart = timestamp.slice(0, 10).replace(/-/g, "")
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase()
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
  metadata?: Record<string, any>
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

    cachedPool = mysql.createPool({
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
