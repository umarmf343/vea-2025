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

export interface Grade {
  id: string
  studentId: string
  subject: string
  firstCA: number
  secondCA: number
  assignment: number
  exam: number
  total: number
  grade: string
  teacherRemarks?: string | null
  term: string
  session: string
  classId?: string | null
}

export interface GradeRecordInput {
  studentId: string
  subject: string
  firstCA: number
  secondCA: number
  assignment: number
  exam: number
  term: string
  session: string
  teacherRemarks?: string
  classId?: string | null
}

export type GradeUpdateInput = Partial<Grade> & { classId?: string | null }

export interface StudentMarks {
  id: string
  studentId: string
  subject: string
  ca1: number
  ca2: number
  assignment: number
  exam: number
  caTotal: number
  grandTotal: number
  percentage: number
  grade: string
  remarks: string
  term: string
  session: string
  teacherId: string
  updatedAt: string
}

export interface PaymentInitializationRecord {
  reference: string
  amount: number
  studentId?: string | null
  paymentType?: string
  status?: "pending" | "completed" | "failed"
  paystackReference?: string | null
  email?: string
  metadata?: Record<string, any>
}

function mapUserRow(row: RowDataPacket): User {
  return {
    id: String(row.id),
    name: row.name as string,
    email: row.email as string,
    role: fromDbRole(String(row.role)),
    passwordHash: row.password as string,
    class: row.class_id !== null && row.class_id !== undefined ? String(row.class_id) : undefined,
    subjects: parseJsonArray(row.subjects),
    studentIds: row.student_id ? [String(row.student_id)] : undefined,
  }
}

function mapClassRow(row: RowDataPacket): ClassRecord {
  return {
    id: String(row.id),
    name: row.name as string,
    level: row.level as string,
    teacherId: row.teacher_id !== null && row.teacher_id !== undefined ? String(row.teacher_id) : null,
    capacity: row.capacity !== null && row.capacity !== undefined ? Number(row.capacity) : null,
    status: (row.status as "active" | "inactive") ?? "active",
    subjects: parseJsonArray(row.subjects),
  }
}

function mapGradeRow(row: RowDataPacket): Grade {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    subject: row.subject as string,
    firstCA: Number(row.first_ca ?? 0),
    secondCA: Number(row.second_ca ?? 0),
    assignment: Number(row.assignment ?? 0),
    exam: Number(row.exam ?? 0),
    total: Number(row.total ?? 0),
    grade: (row.grade as string) ?? calculateGrade(Number(row.total ?? 0)),
    teacherRemarks: row.teacher_remarks ? String(row.teacher_remarks) : null,
    term: row.term as string,
    session: row.session as string,
    classId: row.class_id !== null && row.class_id !== undefined ? String(row.class_id) : undefined,
  }
}

function mapStudentMarkRow(row: RowDataPacket): StudentMarks {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    subject: row.subject as string,
    ca1: Number(row.ca1 ?? 0),
    ca2: Number(row.ca2 ?? 0),
    assignment: Number(row.assignment ?? 0),
    exam: Number(row.exam ?? 0),
    caTotal: Number(row.ca_total ?? 0),
    grandTotal: Number(row.grand_total ?? 0),
    percentage: Number(row.percentage ?? 0),
    grade: row.grade as string,
    remarks: row.remarks ? String(row.remarks) : "",
    term: row.term as string,
    session: row.session as string,
    teacherId: row.teacher_id !== null && row.teacher_id !== undefined ? String(row.teacher_id) : "",
    updatedAt: new Date(row.updated_at ?? new Date()).toISOString(),
  }
}

async function getGradeById(gradeId: string): Promise<Grade | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session, class_id FROM grades WHERE id = ? LIMIT 1",
    [gradeId],
  )

  if (!rows.length) {
    return null
  }

  return mapGradeRow(rows[0])
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE email = ? LIMIT 1",
    [email],
  )

  if (!rows.length) {
    return null
  }

  return mapUserRow(rows[0])
}

export const getAllUsersFromDb = async (): Promise<User[]> => {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users ORDER BY created_at DESC",
  )
  return rows.map(mapUserRow)
}

export const getUserByIdFromDb = async (userId: string): Promise<User | null> => {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE id = ? LIMIT 1",
    [userId],
  )

  if (!rows.length) {
    return null
  }

  return mapUserRow(rows[0])
}

export const getUsersByRoleFromDb = async (role: string): Promise<User[]> => {
  const dbRole = toDbRole(role)
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE role = ? ORDER BY name",
    [dbRole],
  )
  return rows.map(mapUserRow)
}

export const createUserRecord = async (data: {
  name: string
  email: string
  passwordHash: string
  role: string
  classId?: string | null
  studentId?: string | null
  subjects?: string[]
}): Promise<User> => {
  const dbRole = toDbRole(data.role)
  const result = await execute(
    "INSERT INTO users (name, email, password, role, class_id, student_id, subjects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
    [
      data.name,
      data.email,
      data.passwordHash,
      dbRole,
      toNullableInt(data.classId ?? null),
      data.studentId ?? null,
      data.subjects ? JSON.stringify(data.subjects) : null,
    ],
  )

  const insertedId = result.insertId
  const createdUser = await getUserByIdFromDb(String(insertedId))
  if (!createdUser) {
    throw new Error("Failed to load user after creation")
  }
  return createdUser
}

export const updateUserRecord = async (
  userId: string,
  updates: Partial<User> & { passwordHash?: string | null },
): Promise<User | null> => {
  const fields: string[] = []
  const params: any[] = []

  if (updates.name !== undefined) {
    fields.push("name = ?")
    params.push(updates.name)
  }
  if (updates.email !== undefined) {
    fields.push("email = ?")
    params.push(updates.email)
  }
  if (updates.role !== undefined) {
    fields.push("role = ?")
    params.push(toDbRole(updates.role))
  }
  if (updates.passwordHash !== undefined) {
    fields.push("password = ?")
    params.push(updates.passwordHash)
  }
  if (updates.class !== undefined) {
    fields.push("class_id = ?")
    params.push(toNullableInt(updates.class ?? null))
  }
  if (updates.subjects !== undefined) {
    fields.push("subjects = ?")
    params.push(updates.subjects ? JSON.stringify(updates.subjects) : null)
  }
  if (updates.studentIds !== undefined) {
    fields.push("student_id = ?")
    params.push(updates.studentIds?.[0] ?? null)
  }

  if (!fields.length) {
    return await getUserByIdFromDb(userId)
  }

  fields.push("updated_at = NOW()")
  params.push(userId)

  await execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params)
  return await getUserByIdFromDb(userId)
}

export const getAllClassesFromDb = async (): Promise<ClassRecord[]> => {
  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes ORDER BY name",
  )
  return rows.map(mapClassRow)
}

export const createClassRecord = async (data: {
  name: string
  level: string
  capacity?: number
  classTeacherId?: string | null
  status?: "active" | "inactive"
  subjects?: string[]
}): Promise<ClassRecord> => {
  const result = await execute(
    "INSERT INTO classes (name, level, teacher_id, capacity, status, subjects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
    [
      data.name,
      data.level,
      toNullableInt(data.classTeacherId ?? null),
      data.capacity ?? 30,
      data.status ?? "active",
      data.subjects ? JSON.stringify(data.subjects) : null,
    ],
  )

  const insertedId = result.insertId
  const createdClass = await query<RowDataPacket[]>(
    "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes WHERE id = ? LIMIT 1",
    [insertedId],
  )

  if (!createdClass.length) {
    throw new Error("Failed to load class after creation")
  }

  return mapClassRow(createdClass[0])
}

export const updateClassRecord = async (
  classId: string,
  updates: Partial<ClassRecord> & { classTeacherId?: string | null },
): Promise<ClassRecord | null> => {
  const fields: string[] = []
  const params: any[] = []

  if (updates.name !== undefined) {
    fields.push("name = ?")
    params.push(updates.name)
  }
  if (updates.level !== undefined) {
    fields.push("level = ?")
    params.push(updates.level)
  }
  if (updates.classTeacherId !== undefined) {
    fields.push("teacher_id = ?")
    params.push(toNullableInt(updates.classTeacherId ?? null))
  }
  if (updates.capacity !== undefined) {
    fields.push("capacity = ?")
    params.push(updates.capacity ?? null)
  }
  if (updates.status !== undefined) {
    fields.push("status = ?")
    params.push(updates.status)
  }
  if (updates.subjects !== undefined) {
    fields.push("subjects = ?")
    params.push(updates.subjects ? JSON.stringify(updates.subjects) : null)
  }

  if (!fields.length) {
    const rows = await query<RowDataPacket[]>(
      "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes WHERE id = ? LIMIT 1",
      [classId],
    )
    return rows.length ? mapClassRow(rows[0]) : null
  }

  fields.push("updated_at = NOW()")
  params.push(classId)

  await execute(`UPDATE classes SET ${fields.join(", ")} WHERE id = ?`, params)

  const rows = await query<RowDataPacket[]>(
    "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes WHERE id = ? LIMIT 1",
    [classId],
  )
  return rows.length ? mapClassRow(rows[0]) : null
}

const gradeSelection =
  "SELECT id, student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session, class_id FROM grades"

export const getAllGradesFromDb = async (): Promise<Grade[]> => {
  const rows = await query<RowDataPacket[]>(`${gradeSelection} ORDER BY updated_at DESC`)
  return rows.map(mapGradeRow)
}

export const getGradesForStudentFromDb = async (studentId: string): Promise<Grade[]> => {
  const studentIdValue = toNullableInt(studentId)
  if (studentIdValue === null) {
    throw new Error("Invalid student ID supplied for grade lookup")
  }

  const rows = await query<RowDataPacket[]>(`${gradeSelection} WHERE student_id = ? ORDER BY subject`, [studentIdValue])
  return rows.map(mapGradeRow)
}

export const getGradesForClassFromDb = async (classId: string): Promise<Grade[]> => {
  const classIdValue = toNullableInt(classId)
  if (classIdValue === null) {
    throw new Error("Invalid class ID supplied for grade lookup")
  }

  const rows = await query<RowDataPacket[]>(
    `${gradeSelection} WHERE class_id = ? ORDER BY updated_at DESC`,
    [classIdValue],
  )
  return rows.map(mapGradeRow)
}

export const createGradeRecord = async (data: GradeRecordInput): Promise<Grade> => {
  const total = data.firstCA + data.secondCA + data.assignment + data.exam
  const gradeLetter = calculateGrade(total)

  const studentIdValue = toNullableInt(data.studentId)
  if (studentIdValue === null) {
    throw new Error("Invalid student ID supplied for grade creation")
  }

  const result = await execute(
    "INSERT INTO grades (student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session, class_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
    [
      studentIdValue,
      data.subject,
      data.firstCA,
      data.secondCA,
      data.assignment,
      data.exam,
      total,
      gradeLetter,
      data.teacherRemarks ?? null,
      data.term,
      data.session,
      toNullableInt(data.classId ?? null),
    ],
  )

  const insertedId = result.insertId
  const createdGrade = await getGradeById(String(insertedId))
  if (!createdGrade) {
    throw new Error("Failed to load grade after creation")
  }
  return createdGrade
}

export const updateGradeRecord = async (gradeId: string, updates: GradeUpdateInput): Promise<Grade | null> => {
  const existing = await getGradeById(gradeId)
  if (!existing) {
    return null
  }

  const merged: Grade = {
    ...existing,
    ...updates,
    classId: updates.classId !== undefined ? updates.classId : existing.classId ?? null,
  }

  const studentIdValue = toNullableInt(merged.studentId)
  if (studentIdValue === null) {
    throw new Error("Invalid student ID supplied for grade update")
  }

  if (
    updates.firstCA !== undefined ||
    updates.secondCA !== undefined ||
    updates.assignment !== undefined ||
    updates.exam !== undefined
  ) {
    merged.total = (updates.firstCA ?? existing.firstCA) +
      (updates.secondCA ?? existing.secondCA) +
      (updates.assignment ?? existing.assignment) +
      (updates.exam ?? existing.exam)
    merged.grade = calculateGrade(merged.total)
  }

  await execute(
    "UPDATE grades SET student_id = ?, subject = ?, first_ca = ?, second_ca = ?, assignment = ?, exam = ?, total = ?, grade = ?, teacher_remarks = ?, term = ?, session = ?, class_id = ?, updated_at = NOW() WHERE id = ?",
    [
      studentIdValue,
      merged.subject,
      merged.firstCA,
      merged.secondCA,
      merged.assignment,
      merged.exam,
      merged.total,
      merged.grade,
      merged.teacherRemarks ?? null,
      merged.term,
      merged.session,
      toNullableInt(merged.classId ?? null),
      gradeId,
    ],
  )

  return await getGradeById(gradeId)
}

export const recordPaymentInitialization = async (
  data: PaymentInitializationRecord,
): Promise<void> => {
  await execute(
    `INSERT INTO payments (student_id, amount, payment_type, status, reference, paystack_reference, payer_email, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       amount = VALUES(amount),
       payment_type = VALUES(payment_type),
       status = VALUES(status),
       paystack_reference = VALUES(paystack_reference),
       payer_email = VALUES(payer_email),
       metadata = VALUES(metadata),
       updated_at = NOW()`,
    [
      toNullableInt(data.studentId ?? null),
      data.amount,
      data.paymentType ?? "general",
      data.status ?? "pending",
      data.reference,
      data.paystackReference ?? null,
      data.email ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ],
  )
}

export const saveStudentMarks = async (marksData: Omit<StudentMarks, "id">): Promise<StudentMarks> => {
  const studentIdValue = toNullableInt(marksData.studentId)
  if (studentIdValue === null) {
    throw new Error("Invalid student ID supplied for marks entry")
  }

  const teacherIdValue = toNullableInt(marksData.teacherId)
  if (teacherIdValue === null) {
    throw new Error("Invalid teacher ID supplied for marks entry")
  }

  const updatedAtDate = marksData.updatedAt ? new Date(marksData.updatedAt) : new Date()
  if (Number.isNaN(updatedAtDate.getTime())) {
    throw new Error("Invalid timestamp supplied for marks entry")
  }

  const result = await execute(
    "INSERT INTO student_marks (student_id, subject, ca1, ca2, assignment, exam, ca_total, grand_total, percentage, grade, remarks, term, session, teacher_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      studentIdValue,
      marksData.subject,
      marksData.ca1,
      marksData.ca2,
      marksData.assignment,
      marksData.exam,
      marksData.caTotal,
      marksData.grandTotal,
      marksData.percentage,
      marksData.grade,
      marksData.remarks,
      marksData.term,
      marksData.session,
      teacherIdValue,
      updatedAtDate,
    ],
  )

  const rows = await query<RowDataPacket[]>(
    "SELECT id, student_id, subject, ca1, ca2, assignment, exam, ca_total, grand_total, percentage, grade, remarks, term, session, teacher_id, updated_at FROM student_marks WHERE id = ?",
    [result.insertId],
  )

  if (!rows.length) {
    throw new Error("Failed to load marks after creation")
  }

  return mapStudentMarkRow(rows[0])
}

export const getStudentMarks = async (
  studentId: string,
  term?: string | null,
  session?: string | null,
): Promise<StudentMarks[]> => {
  const studentIdValue = toNullableInt(studentId)
  if (studentIdValue === null) {
    throw new Error("Invalid student ID supplied for marks lookup")
  }

  const conditions: string[] = ["student_id = ?"]
  const params: any[] = [studentIdValue]

  if (term) {
    conditions.push("term = ?")
    params.push(term)
  }

  if (session) {
    conditions.push("session = ?")
    params.push(session)
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT id, student_id, subject, ca1, ca2, assignment, exam, ca_total, grand_total, percentage, grade, remarks, term, session, teacher_id, updated_at FROM student_marks WHERE ${conditions.join(
      " AND ",
    )} ORDER BY updated_at DESC`,
    params,
  )

  return rows.map(mapStudentMarkRow)
}
