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

export type LibraryRequestStatus = "pending" | "approved" | "rejected"

export interface LibraryBookRecord extends CollectionRecord {
  title: string
  author: string
  isbn: string
  category: string
  copies: number
  available: number
  addedBy?: string | null
  addedDate?: string | null
  updatedBy?: string | null
}

export type LibraryBorrowStatus = "active" | "returned" | "overdue"

export interface LibraryBorrowRecord extends CollectionRecord {
  bookId: string
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  borrowDate: string
  dueDate: string
  status: LibraryBorrowStatus
  issuedBy?: string | null
  returnedDate?: string | null
  returnedTo?: string | null
}

export interface LibraryRequestRecord extends CollectionRecord {
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
  notes?: string | null
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

export interface CreateLibraryBookPayload
  extends Omit<LibraryBookRecord, "id" | "createdAt" | "updatedAt" | "available"> {
  available?: number
}

export interface UpdateLibraryBookPayload
  extends Partial<Omit<LibraryBookRecord, "id" | "createdAt" | "updatedAt">> {}

export interface CreateLibraryBorrowPayload
  extends Omit<LibraryBorrowRecord, "id" | "createdAt" | "updatedAt" | "status"> {
  status?: LibraryBorrowStatus
}

export interface UpdateLibraryBorrowPayload
  extends Partial<Omit<LibraryBorrowRecord, "id" | "createdAt" | "updatedAt">> {}

export interface CreateLibraryRequestPayload
  extends Omit<LibraryRequestRecord, "id" | "createdAt" | "updatedAt" | "status"> {
  status?: LibraryRequestStatus
}

export interface UpdateLibraryRequestPayload
  extends Partial<Omit<LibraryRequestRecord, "id" | "createdAt" | "updatedAt">> {}

const STORAGE_KEYS = {
  USERS: "vea_users",
  CLASSES: "vea_classes",
  SUBJECTS: "vea_subjects",
  STUDENTS: "vea_students",
  GRADES: "vea_grades",
  MARKS: "vea_marks",
  PAYMENTS: "vea_payment_initializations",
  LIBRARY_BOOKS: "vea_library_books",
  LIBRARY_BORROWED: "vea_library_borrowed",
  LIBRARY_REQUESTS: "vea_library_requests",
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

function createDefaultLibraryBooks(): LibraryBookRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "library_book_mathematics",
      title: "Mathematics Textbook",
      author: "John Smith",
      isbn: "978-123456789",
      category: "Mathematics",
      copies: 50,
      available: 45,
      addedBy: null,
      addedDate: timestamp,
      updatedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_book_english",
      title: "English Grammar",
      author: "Jane Doe",
      isbn: "978-987654321",
      category: "English",
      copies: 30,
      available: 28,
      addedBy: null,
      addedDate: timestamp,
      updatedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_book_physics",
      title: "Physics Fundamentals",
      author: "Dr. Brown",
      isbn: "978-456789123",
      category: "Physics",
      copies: 25,
      available: 20,
      addedBy: null,
      addedDate: timestamp,
      updatedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_book_chemistry",
      title: "Chemistry Basics",
      author: "Prof. Amina Bello",
      isbn: "978-112233445",
      category: "Chemistry",
      copies: 20,
      available: 18,
      addedBy: null,
      addedDate: timestamp,
      updatedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_book_biology",
      title: "Biology Guide",
      author: "Dr. Samuel Okeke",
      isbn: "978-556677889",
      category: "Biology",
      copies: 18,
      available: 17,
      addedBy: null,
      addedDate: timestamp,
      updatedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultBorrowRecords(): LibraryBorrowRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "library_borrow_mathematics_john",
      bookId: "library_book_mathematics",
      bookTitle: "Mathematics Textbook",
      studentId: "student_john_doe",
      studentName: "John Doe",
      studentClass: "JSS 1A",
      borrowDate: "2025-01-01",
      dueDate: "2025-01-15",
      status: "active",
      issuedBy: null,
      returnedDate: null,
      returnedTo: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_borrow_english_jane",
      bookId: "library_book_english",
      bookTitle: "English Grammar",
      studentId: "student_alice_smith",
      studentName: "Jane Smith",
      studentClass: "JSS 2B",
      borrowDate: "2024-12-20",
      dueDate: "2025-01-03",
      status: "active",
      issuedBy: null,
      returnedDate: null,
      returnedTo: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultLibraryRequests(): LibraryRequestRecord[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "library_request_chemistry_mike",
      bookId: "library_book_chemistry",
      bookTitle: "Chemistry Basics",
      studentId: "student_mike_johnson",
      studentName: "Mike Johnson",
      studentClass: "JSS 3A",
      requestDate: "2025-01-08",
      status: "pending",
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      notes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "library_request_biology_sarah",
      bookId: "library_book_biology",
      bookTitle: "Biology Guide",
      studentId: "student_sarah_wilson",
      studentName: "Sarah Wilson",
      studentClass: "SS 1B",
      requestDate: "2025-01-07",
      status: "approved",
      approvedBy: null,
      approvedDate: "2025-01-07",
      rejectedBy: null,
      rejectedDate: null,
      notes: null,
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

export async function listPaymentInitializations(): Promise<PaymentInitializationRecord[]> {
  const payments = ensureCollection<PaymentInitializationRecord>(STORAGE_KEYS.PAYMENTS, defaultEmptyCollection)
  return deepClone(payments)
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

export interface LibraryDashboardSnapshot {
  books: LibraryBookRecord[]
  borrowedBooks: LibraryBorrowRecord[]
  requests: LibraryRequestRecord[]
  stats: {
    totalBooks: number
    totalCopies: number
    availableCopies: number
    borrowedCount: number
    pendingRequests: number
    overdueCount: number
  }
}

export interface ApproveLibraryRequestOptions {
  librarianId: string
  dueDate?: string
  notes?: string | null
}

export interface ApproveLibraryRequestResult {
  request: LibraryRequestRecord
  borrowRecord: LibraryBorrowRecord | null
}

export async function listLibraryBooks(): Promise<LibraryBookRecord[]> {
  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)
  return deepClone(books)
}

export async function createLibraryBookRecord(payload: CreateLibraryBookPayload): Promise<LibraryBookRecord> {
  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)

  const normalizedIsbn = payload.isbn.trim().toLowerCase()
  if (books.some((book) => book.isbn.trim().toLowerCase() === normalizedIsbn)) {
    throw new Error("Book with this ISBN already exists")
  }

  const timestamp = new Date().toISOString()
  const copies = Number.isFinite(Number(payload.copies)) ? Math.max(0, Number(payload.copies)) : 0
  let available =
    payload.available !== undefined && Number.isFinite(Number(payload.available))
      ? Math.max(0, Number(payload.available))
      : copies

  if (available > copies) {
    available = copies
  }

  const record: LibraryBookRecord = {
    id: generateId("library_book"),
    title: payload.title,
    author: payload.author,
    isbn: payload.isbn,
    category: payload.category,
    copies,
    available,
    addedBy: payload.addedBy ?? null,
    addedDate: payload.addedDate ?? timestamp,
    updatedBy: payload.updatedBy ?? payload.addedBy ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  books.push(record)
  persistCollection(STORAGE_KEYS.LIBRARY_BOOKS, books)
  return deepClone(record)
}

export async function updateLibraryBookRecord(
  id: string,
  updates: UpdateLibraryBookPayload,
): Promise<LibraryBookRecord | null> {
  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)
  const index = books.findIndex((book) => book.id === id)

  if (index === -1) {
    return null
  }

  const existing = books[index]

  if (updates.isbn) {
    const normalizedIsbn = updates.isbn.trim().toLowerCase()
    if (books.some((book, idx) => idx !== index && book.isbn.trim().toLowerCase() === normalizedIsbn)) {
      throw new Error("Book with this ISBN already exists")
    }
    existing.isbn = updates.isbn
  }

  if (updates.title !== undefined) {
    existing.title = updates.title
  }

  if (updates.author !== undefined) {
    existing.author = updates.author
  }

  if (updates.category !== undefined) {
    existing.category = updates.category
  }

  if (updates.copies !== undefined) {
    const copies = Math.max(0, Number(updates.copies))
    existing.copies = copies
    if (existing.available > copies) {
      existing.available = copies
    }
  }

  if (updates.available !== undefined) {
    const available = Math.max(0, Number(updates.available))
    existing.available = Math.min(available, existing.copies)
  }

  if (updates.addedBy !== undefined) {
    existing.addedBy = updates.addedBy
  }

  if (updates.addedDate !== undefined) {
    existing.addedDate = updates.addedDate
  }

  if (updates.updatedBy !== undefined) {
    existing.updatedBy = updates.updatedBy
  }

  existing.updatedAt = new Date().toISOString()
  books[index] = existing
  persistCollection(STORAGE_KEYS.LIBRARY_BOOKS, books)
  return deepClone(existing)
}

export async function deleteLibraryBookRecord(id: string): Promise<boolean> {
  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)
  const index = books.findIndex((book) => book.id === id)

  if (index === -1) {
    return false
  }

  books.splice(index, 1)
  persistCollection(STORAGE_KEYS.LIBRARY_BOOKS, books)
  return true
}

export async function listBorrowedLibraryBooks(): Promise<LibraryBorrowRecord[]> {
  const borrowed = ensureCollection<LibraryBorrowRecord>(STORAGE_KEYS.LIBRARY_BORROWED, createDefaultBorrowRecords)
  return deepClone(borrowed)
}

export async function createLibraryBorrowRecord(
  payload: CreateLibraryBorrowPayload,
): Promise<LibraryBorrowRecord> {
  const borrowed = ensureCollection<LibraryBorrowRecord>(STORAGE_KEYS.LIBRARY_BORROWED, createDefaultBorrowRecords)
  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)

  const timestamp = new Date().toISOString()
  const record: LibraryBorrowRecord = {
    id: generateId("library_borrow"),
    bookId: payload.bookId,
    bookTitle: payload.bookTitle,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentClass: payload.studentClass,
    borrowDate: payload.borrowDate ?? timestamp,
    dueDate:
      payload.dueDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: payload.status ?? "active",
    issuedBy: payload.issuedBy ?? null,
    returnedDate: payload.returnedDate ?? null,
    returnedTo: payload.returnedTo ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const bookIndex = books.findIndex((book) => book.id === payload.bookId)
  if (bookIndex !== -1) {
    const book = books[bookIndex]
    if (book.available <= 0) {
      throw new Error("No available copies for this book")
    }
    book.available = Math.max(0, book.available - 1)
    book.updatedAt = timestamp
    book.updatedBy = payload.issuedBy ?? book.updatedBy ?? null
    books[bookIndex] = book
    persistCollection(STORAGE_KEYS.LIBRARY_BOOKS, books)
  }

  borrowed.push(record)
  persistCollection(STORAGE_KEYS.LIBRARY_BORROWED, borrowed)
  return deepClone(record)
}

export async function updateLibraryBorrowRecord(
  id: string,
  updates: UpdateLibraryBorrowPayload,
): Promise<LibraryBorrowRecord | null> {
  const borrowed = ensureCollection<LibraryBorrowRecord>(STORAGE_KEYS.LIBRARY_BORROWED, createDefaultBorrowRecords)
  const index = borrowed.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = borrowed[index]

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      ;(existing as any)[key] = value
    }
  }

  existing.updatedAt = new Date().toISOString()
  borrowed[index] = existing
  persistCollection(STORAGE_KEYS.LIBRARY_BORROWED, borrowed)
  return deepClone(existing)
}

export async function markBorrowRecordAsReturned(
  id: string,
  librarianId?: string,
): Promise<LibraryBorrowRecord | null> {
  const borrowed = ensureCollection<LibraryBorrowRecord>(STORAGE_KEYS.LIBRARY_BORROWED, createDefaultBorrowRecords)
  const index = borrowed.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = borrowed[index]

  if (existing.status === "returned") {
    return deepClone(existing)
  }

  existing.status = "returned"
  existing.returnedDate = new Date().toISOString()
  existing.returnedTo = librarianId ?? existing.returnedTo ?? null
  existing.updatedAt = new Date().toISOString()
  borrowed[index] = existing
  persistCollection(STORAGE_KEYS.LIBRARY_BORROWED, borrowed)

  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)
  const bookIndex = books.findIndex((book) => book.id === existing.bookId)
  if (bookIndex !== -1) {
    const book = books[bookIndex]
    book.available = Math.min(book.copies, book.available + 1)
    book.updatedAt = new Date().toISOString()
    book.updatedBy = librarianId ?? book.updatedBy ?? null
    books[bookIndex] = book
    persistCollection(STORAGE_KEYS.LIBRARY_BOOKS, books)
  }

  return deepClone(existing)
}

export async function listLibraryRequests(): Promise<LibraryRequestRecord[]> {
  const requests = ensureCollection<LibraryRequestRecord>(
    STORAGE_KEYS.LIBRARY_REQUESTS,
    createDefaultLibraryRequests,
  )
  return deepClone(requests)
}

export async function createLibraryRequestRecord(
  payload: CreateLibraryRequestPayload,
): Promise<LibraryRequestRecord> {
  const requests = ensureCollection<LibraryRequestRecord>(
    STORAGE_KEYS.LIBRARY_REQUESTS,
    createDefaultLibraryRequests,
  )

  const timestamp = new Date().toISOString()
  const record: LibraryRequestRecord = {
    id: generateId("library_request"),
    bookId: payload.bookId ?? null,
    bookTitle: payload.bookTitle,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentClass: payload.studentClass,
    requestDate: payload.requestDate ?? timestamp,
    status: payload.status ?? "pending",
    approvedBy: payload.approvedBy ?? null,
    approvedDate: payload.approvedDate ?? null,
    rejectedBy: payload.rejectedBy ?? null,
    rejectedDate: payload.rejectedDate ?? null,
    notes: payload.notes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  requests.push(record)
  persistCollection(STORAGE_KEYS.LIBRARY_REQUESTS, requests)
  return deepClone(record)
}

export async function updateLibraryRequestRecord(
  id: string,
  updates: UpdateLibraryRequestPayload,
): Promise<LibraryRequestRecord | null> {
  const requests = ensureCollection<LibraryRequestRecord>(
    STORAGE_KEYS.LIBRARY_REQUESTS,
    createDefaultLibraryRequests,
  )
  const index = requests.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = requests[index]

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      ;(existing as any)[key] = value
    }
  }

  existing.updatedAt = new Date().toISOString()
  requests[index] = existing
  persistCollection(STORAGE_KEYS.LIBRARY_REQUESTS, requests)
  return deepClone(existing)
}

function resolveLibraryBookForRequest(
  requests: LibraryRequestRecord[],
  request: LibraryRequestRecord,
  books: LibraryBookRecord[],
): LibraryBookRecord | null {
  if (request.bookId) {
    const byId = books.find((book) => book.id === request.bookId)
    if (byId) {
      return byId
    }
  }

  const normalizedTitle = request.bookTitle.trim().toLowerCase()
  return books.find((book) => book.title.trim().toLowerCase() === normalizedTitle) ?? null
}

export async function approveLibraryRequest(
  id: string,
  options: ApproveLibraryRequestOptions,
): Promise<ApproveLibraryRequestResult | null> {
  const requests = ensureCollection<LibraryRequestRecord>(
    STORAGE_KEYS.LIBRARY_REQUESTS,
    createDefaultLibraryRequests,
  )
  const requestIndex = requests.findIndex((record) => record.id === id)

  if (requestIndex === -1) {
    return null
  }

  const currentRequest = requests[requestIndex]
  const timestamp = new Date().toISOString()

  if (currentRequest.status === "approved") {
    return { request: deepClone(currentRequest), borrowRecord: null }
  }

  const books = ensureCollection<LibraryBookRecord>(STORAGE_KEYS.LIBRARY_BOOKS, createDefaultLibraryBooks)
  const resolvedBook = resolveLibraryBookForRequest(requests, currentRequest, books)

  if (!resolvedBook) {
    throw new Error("Requested book could not be found in inventory")
  }

  if (resolvedBook.available <= 0) {
    throw new Error("No available copies of the requested book")
  }

  currentRequest.status = "approved"
  currentRequest.approvedBy = options.librarianId
  currentRequest.approvedDate = timestamp
  currentRequest.rejectedBy = null
  currentRequest.rejectedDate = null
  currentRequest.notes = options.notes ?? currentRequest.notes ?? null
  currentRequest.updatedAt = timestamp
  requests[requestIndex] = currentRequest
  persistCollection(STORAGE_KEYS.LIBRARY_REQUESTS, requests)

  const borrowRecord = await createLibraryBorrowRecord({
    bookId: resolvedBook.id,
    bookTitle: resolvedBook.title,
    studentId: currentRequest.studentId,
    studentName: currentRequest.studentName,
    studentClass: currentRequest.studentClass,
    borrowDate: timestamp,
    dueDate: options.dueDate ?? undefined,
    status: "active",
    issuedBy: options.librarianId,
  })

  return { request: deepClone(currentRequest), borrowRecord }
}

export async function rejectLibraryRequest(
  id: string,
  librarianId: string,
  notes?: string | null,
): Promise<LibraryRequestRecord | null> {
  const requests = ensureCollection<LibraryRequestRecord>(
    STORAGE_KEYS.LIBRARY_REQUESTS,
    createDefaultLibraryRequests,
  )
  const index = requests.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  const existing = requests[index]
  const timestamp = new Date().toISOString()

  existing.status = "rejected"
  existing.rejectedBy = librarianId
  existing.rejectedDate = timestamp
  existing.notes = notes ?? existing.notes ?? null
  existing.updatedAt = timestamp
  requests[index] = existing
  persistCollection(STORAGE_KEYS.LIBRARY_REQUESTS, requests)
  return deepClone(existing)
}

export async function getLibraryDashboardSnapshot(): Promise<LibraryDashboardSnapshot> {
  const [books, borrowedBooks, requests] = await Promise.all([
    listLibraryBooks(),
    listBorrowedLibraryBooks(),
    listLibraryRequests(),
  ])

  const totalCopies = books.reduce((sum, book) => sum + Number(book.copies ?? 0), 0)
  const availableCopies = books.reduce((sum, book) => sum + Number(book.available ?? 0), 0)
  const borrowedCount = borrowedBooks.filter((record) => record.status === "active").length
  const pendingRequests = requests.filter((record) => record.status === "pending").length
  const overdueCount = borrowedBooks.filter((record) => {
    if (record.status !== "active") {
      return false
    }
    const dueDate = new Date(record.dueDate)
    return !Number.isNaN(dueDate.getTime()) && dueDate < new Date()
  }).length

  return {
    books,
    borrowedBooks,
    requests,
    stats: {
      totalBooks: books.length,
      totalCopies,
      availableCopies,
      borrowedCount,
      pendingRequests,
      overdueCount,
    },
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
