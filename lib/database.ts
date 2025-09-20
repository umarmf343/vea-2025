import crypto from "crypto"
import bcrypt from "bcryptjs"
import mysql, { type Pool, type PoolConnection } from "mysql2/promise"
import { safeStorage } from "./safe-storage"

interface CollectionRecord {
  id: string
  createdAt: string
  updatedAt: string
}

export interface StoredUser extends CollectionRecord {
  name: string
  email: string
  role: string
  passwordHash: string
  isActive: boolean
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
  GRADES: "vea_grades",
  MARKS: "vea_marks",
  PAYMENTS: "vea_payment_initializations",
} as const

const serverCollections = new Map<string, any[]>()

const defaultPasswordHash = bcrypt.hashSync("Admin2025!", 12)

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isServer(): boolean {
  return typeof window === "undefined"
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
  const newUser: StoredUser = {
    id: generateId("user"),
    name: payload.name,
    email: normalizedEmail,
    role: payload.role,
    passwordHash: payload.passwordHash,
    isActive: payload.isActive ?? true,
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

  const {
    studentId,
    studentIds,
    subjects,
    email,
    id: _ignored,
    createdAt: _created,
    updatedAt: _updated,
    ...otherUpdates
  } = updates as UpdateUserPayload & { [key: string]: any }

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
