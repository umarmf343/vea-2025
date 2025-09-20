import { safeStorage } from "@/lib/safe-storage"

let mysql: any = null
let DatabaseConnector: any = null

if (typeof window === "undefined") {
  try {
    mysql = require("mysql2/promise")

    class ServerDatabaseConnector {
      private pool: any = null

      constructor() {
        this.initializePool()
      }

      private initializePool() {
        if (mysql && process.env.DATABASE_URL) {
          this.pool = mysql.createPool({
            uri: process.env.DATABASE_URL,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000,
          })
        }
      }

      async query(sql: string, params: any[] = []): Promise<any> {
        if (!this.pool) {
          throw new Error("Database not initialized")
        }

        try {
          const [rows] = await this.pool.execute(sql, params)
          return rows
        } catch (error) {
          console.error("[v0] Database query error:", error)
          throw error
        }
      }

      async close() {
        if (this.pool) {
          await this.pool.end()
        }
      }
    }

    DatabaseConnector = ServerDatabaseConnector
  } catch (error) {
    console.warn("[v0] MySQL2 not available, using fallback storage")
  }
}

export interface Student {
  id: string
  name: string
  email: string
  class: string
  admissionNumber: string
  parentId?: string
  profileImage?: string
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
  teacherRemarks?: string
  term: string
  session: string
}

export interface Assignment {
  id: string
  title: string
  description: string
  subject: string
  class: string
  teacherId: string
  dueDate: string
  status: "active" | "closed"
  submissions: AssignmentSubmission[]
}

export interface AssignmentSubmission {
  id: string
  assignmentId: string
  studentId: string
  content: string
  fileUrl?: string
  submittedAt: string
  status: "submitted" | "graded"
  grade?: number
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  passwordHash: string
  class?: string
  subjects?: string[]
  parentId?: string
  studentIds?: string[]
}

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

export interface BehavioralAssessment {
  id: string
  studentId: string
  class: string
  term: string
  session: string
  affectiveDomain: {
    neatness: string
    honesty: string
    punctuality: string
  }
  psychomotorDomain: {
    sport: string
    handwriting: string
  }
  teacherId: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
  studentId: string
  class: string
  term: string
  session: string
  present: number
  absent: number
  total: number
  position: number
  teacherId: string
  updatedAt: string
}

export interface ClassTeacherRemarks {
  id: string
  studentId: string
  class: string
  term: string
  session: string
  remarks: string
  teacherId: string
  updatedAt: string
}

export interface ClassRecord {
  id: string
  name: string
  level: string
  teacherId?: string | null
  capacity?: number
  status?: "active" | "inactive"
  subjects?: string[]
}

class DatabaseManager {
  private listeners: Map<string, Function[]> = new Map()
  private connector: any = null

  constructor() {
    // Only initialize server connector on server-side
    if (typeof window === "undefined" && DatabaseConnector) {
      this.connector = new DatabaseConnector()
    }
  }

  hasDatabaseConnection(): boolean {
    return typeof window === "undefined" && !!this.connector
  }

  async executeQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.hasDatabaseConnection()) {
      throw new Error("Database not initialized")
    }

    return await this.connector.query(sql, params)
  }

  addEventListener(key: string, callback: Function) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key)!.push(callback)
  }

  removeEventListener(key: string, callback: Function) {
    const callbacks = this.listeners.get(key)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private notifyListeners(key: string, data: any) {
    const callbacks = this.listeners.get(key)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  async saveData(key: string, data: any) {
    try {
      // Try database first on server-side
      if (this.connector && typeof window === "undefined") {
        if (key === "users") {
          await this.saveUsers(data)
        } else if (key === "students") {
          await this.saveStudents(data)
        }
      }

      // Always save to localStorage as fallback
      safeStorage.setItem(key, JSON.stringify(data))
      this.notifyListeners(key, data)

      // Dispatch storage event for cross-tab communication
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
    } catch (error) {
      console.error("[v0] Error saving data:", error)
      // Fallback to safe storage
      safeStorage.setItem(key, JSON.stringify(data))
    }
  }

  async getData(key: string) {
    try {
      // Try database first on server-side
      if (this.connector && typeof window === "undefined") {
        if (key === "users") {
          return await this.getUsers()
        } else if (key === "students") {
          return await this.getStudents()
        }
      }

      // Fallback to safe storage
      const data = safeStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("[v0] Error getting data:", error)
      // Fallback to safe storage
      const data = safeStorage.getItem(key)
      return data ? JSON.parse(data) : null
    }
  }

  private async saveUsers(users: User[]): Promise<void> {
    if (!this.connector) return

    for (const user of users) {
      const classId =
        typeof user.class === "string" && /^\d+$/.test(user.class)
          ? Number.parseInt(user.class, 10)
          : typeof user.class === "number"
            ? user.class
            : null
      await this.connector.query(
        `INSERT INTO users (id, name, email, role, password, class_id, student_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         name = VALUES(name), email = VALUES(email), role = VALUES(role),
         password = VALUES(password), class_id = VALUES(class_id),
         student_id = VALUES(student_id), updated_at = NOW()`,
        [user.id, user.name, user.email, user.role, user.passwordHash, classId, user.studentIds?.[0] ?? null],
      )
    }
  }

  private async getUsers(): Promise<User[]> {
    if (!this.connector) return []

    const rows = await this.connector.query("SELECT * FROM users")
    return rows.map((row: any) => ({
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      role: row.role,
      passwordHash: row.password,
      class: row.class_id ? row.class_id.toString() : undefined,
      subjects: row.subjects ? JSON.parse(row.subjects) : undefined,
      parentId: row.parent_id,
      studentIds: row.student_id ? [row.student_id] : undefined,
    }))
  }

  private async saveStudents(students: Student[]): Promise<void> {
    if (!this.connector) return

    for (const student of students) {
      const classId =
        typeof student.class === "string" && /^\d+$/.test(student.class)
          ? Number.parseInt(student.class, 10)
          : typeof student.class === "number"
            ? student.class
            : null
      const className = typeof student.class === "string" && !/^\d+$/.test(student.class) ? student.class : null
      await this.connector.query(
        `INSERT INTO students (id, student_id, name, class_id, class_name, parent_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         name = VALUES(name), class_id = VALUES(class_id), class_name = VALUES(class_name), parent_email = VALUES(parent_email), updated_at = NOW()`,
        [
          student.id,
          student.admissionNumber,
          student.name,
          classId,
          className,
          student.email,
        ],
      )
    }
  }

  private async getStudents(): Promise<Student[]> {
    if (!this.connector) return []

    const rows = await this.connector.query("SELECT * FROM students")
    return rows.map((row: any) => ({
      id: row.id.toString(),
      name: row.name,
      email: row.parent_email,
      class: row.class_name || (row.class_id ? row.class_id.toString() : ""),
      admissionNumber: row.student_id,
      parentId: row.parent_email,
    }))
  }
}

const dbManager = new DatabaseManager()

export const db = {
  students: {
    findMany: async (filter?: { class?: string }): Promise<Student[]> => {
      const storedStudents = ((await dbManager.getData("students")) as Student[] | null) || [
        {
          id: "1",
          name: "John Doe",
          email: "john@student.vea.edu.ng",
          class: "JSS 1A",
          admissionNumber: "VEA/2024/001",
          parentId: "parent1",
        },
        {
          id: "2",
          name: "Jane Smith",
          email: "jane@student.vea.edu.ng",
          class: "JSS 1A",
          admissionNumber: "VEA/2024/002",
          parentId: "parent2",
        },
        {
          id: "3",
          name: "Mike Johnson",
          email: "mike@student.vea.edu.ng",
          class: "JSS 1A",
          admissionNumber: "VEA/2024/003",
          parentId: "parent3",
        },
      ]

      if (filter?.class) {
        return storedStudents.filter((s: Student) => s.class === filter.class)
      }
      return storedStudents
    },
    findById: async (id: string): Promise<Student | null> => {
      const students = await db.students.findMany()
      return students.find((s) => s.id === id) || null
    },
    create: async (data: Omit<Student, "id">): Promise<Student> => {
      const students = await db.students.findMany()
      const newStudent = { id: Date.now().toString(), ...data }
      students.push(newStudent)
      await dbManager.saveData("students", students)
      return newStudent
    },
    update: async (id: string, data: Partial<Student>): Promise<Student> => {
      const students = await db.students.findMany()
      const index = students.findIndex((s) => s.id === id)
      if (index > -1) {
        students[index] = { ...students[index], ...data }
        await dbManager.saveData("students", students)
        return students[index]
      }
      throw new Error("Student not found")
    },
  },

  grades: {
    findMany: async (filter?: { studentId?: string; class?: string }): Promise<Grade[]> => {
      const grades = ((await dbManager.getData("grades")) as Grade[] | null) || [
        {
          id: "1",
          studentId: "1",
          subject: "Mathematics",
          firstCA: 15,
          secondCA: 18,
          assignment: 8,
          exam: 65,
          total: 106,
          grade: "A",
          teacherRemarks: "Excellent performance",
          term: "First Term",
          session: "2024/2025",
        },
      ]

      let filteredGrades = grades
      if (filter?.studentId) {
        filteredGrades = filteredGrades.filter((g: Grade) => g.studentId === filter.studentId)
      }
      if (filter?.class) {
        // Would need to join with students table in real implementation
        filteredGrades = filteredGrades
      }
      return filteredGrades
    },
    create: async (data: Omit<Grade, "id">): Promise<Grade> => {
      const grades = await db.grades.findMany()
      const total = data.firstCA + data.secondCA + data.assignment + data.exam
      const grade = calculateGrade(total)
      const newGrade = { id: Date.now().toString(), ...data, total, grade }
      grades.push(newGrade)
      dbManager.saveData("grades", grades)
      return newGrade
    },
    update: async (id: string, data: Partial<Grade>): Promise<Grade> => {
      const grades = await db.grades.findMany()
      const index = grades.findIndex((g) => g.id === id)
      if (index > -1) {
        const updated = { ...grades[index], ...data }
        updated.total = updated.firstCA + updated.secondCA + updated.assignment + updated.exam
        updated.grade = calculateGrade(updated.total)
        grades[index] = updated
        await dbManager.saveData("grades", grades)
        return updated
      }
      throw new Error("Grade not found")
    },
  },

  assignments: {
    findMany: async (filter?: { class?: string; teacherId?: string }): Promise<Assignment[]> => {
      const assignments = ((await dbManager.getData("assignments")) as Assignment[] | null) || [
        {
          id: "1",
          title: "Mathematics Assignment 1",
          description: "Solve algebraic equations",
          subject: "Mathematics",
          class: "JSS 1A",
          teacherId: "teacher1",
          dueDate: "2024-12-31",
          status: "active",
          submissions: [],
        },
      ]

      let filteredAssignments = assignments
      if (filter?.class) {
        filteredAssignments = filteredAssignments.filter((a: Assignment) => a.class === filter.class)
      }
      if (filter?.teacherId) {
        filteredAssignments = filteredAssignments.filter((a: Assignment) => a.teacherId === filter.teacherId)
      }
      return filteredAssignments
    },
    create: async (data: Omit<Assignment, "id" | "submissions">): Promise<Assignment> => {
      const assignments = await db.assignments.findMany()
      const newAssignment = { id: Date.now().toString(), ...data, submissions: [] }
      assignments.push(newAssignment)
      await dbManager.saveData("assignments", assignments)
      return newAssignment
    },
  },

  studentMarks: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<StudentMarks[]> => {
      const mockMarks = ((await dbManager.getData("studentMarks")) as StudentMarks[] | null) || [
        {
          id: "1",
          studentId: "1",
          subject: "Mathematics",
          ca1: 15,
          ca2: 18,
          assignment: 8,
          exam: 45,
          caTotal: 41,
          grandTotal: 86,
          percentage: 86,
          grade: "A",
          remarks: "Excellent performance in Mathematics",
          term: "First Term",
          session: "2024/2025",
          teacherId: "teacher1",
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          studentId: "1",
          subject: "English Language",
          ca1: 12,
          ca2: 16,
          assignment: 7,
          exam: 42,
          caTotal: 35,
          grandTotal: 77,
          percentage: 77,
          grade: "A",
          remarks: "Good progress in English",
          term: "First Term",
          session: "2024/2025",
          teacherId: "teacher2",
          updatedAt: new Date().toISOString(),
        },
        {
          id: "3",
          studentId: "1",
          subject: "Basic Science",
          ca1: 14,
          ca2: 15,
          assignment: 9,
          exam: 38,
          caTotal: 38,
          grandTotal: 76,
          percentage: 76,
          grade: "A",
          remarks: "Shows good understanding of concepts",
          term: "First Term",
          session: "2024/2025",
          teacherId: "teacher3",
          updatedAt: new Date().toISOString(),
        },
      ]

      // Filter by studentId, term, and session if provided
      let filteredMarks = mockMarks

      if (filter?.studentId) {
        filteredMarks = filteredMarks.filter((mark: StudentMarks) => mark.studentId === filter.studentId)
      }

      if (filter?.term) {
        filteredMarks = filteredMarks.filter((mark: StudentMarks) => mark.term === filter.term)
      }

      if (filter?.session) {
        filteredMarks = filteredMarks.filter((mark: StudentMarks) => mark.session === filter.session)
      }

      return filteredMarks
    },
    create: async (data: Omit<StudentMarks, "id">): Promise<StudentMarks> => {
      const existingMarks = await db.studentMarks.findMany()
      const savedMarks: StudentMarks = {
        id: Date.now().toString(),
        ...data,
      }

      existingMarks.push(savedMarks)
      dbManager.saveData("studentMarks", existingMarks)
      return savedMarks
    },
  },

  behavioralAssessments: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<
      BehavioralAssessment[]
    > => {
      const assessments = ((await dbManager.getData("behavioralAssessments")) as Record<string, BehavioralAssessment> | null) || {}
      const assessmentList = Object.values(assessments) as BehavioralAssessment[]

      let filtered = assessmentList
      if (filter?.studentId) {
        filtered = filtered.filter((a) => a.studentId === filter.studentId)
      }
      if (filter?.term) {
        filtered = filtered.filter((a) => a.term === filter.term)
      }
      if (filter?.session) {
        filtered = filtered.filter((a) => a.session === filter.session)
      }

      return filtered
    },
    create: async (data: Omit<BehavioralAssessment, "id">): Promise<BehavioralAssessment> => {
      const assessments = ((await dbManager.getData("behavioralAssessments")) as Record<string, BehavioralAssessment> | null) || {}
      const newAssessment = { id: Date.now().toString(), ...data }
      const key = `${data.studentId}-${data.term}-${data.session}`
      assessments[key] = newAssessment
      dbManager.saveData("behavioralAssessments", assessments)
      return newAssessment
    },
  },

  attendanceRecords: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<AttendanceRecord[]> => {
      const records = ((await dbManager.getData("attendancePositions")) as Record<string, AttendanceRecord> | null) || {}
      const recordList = Object.values(records) as AttendanceRecord[]

      let filtered = recordList
      if (filter?.studentId) {
        filtered = filtered.filter((r) => r.studentId === filter.studentId)
      }
      if (filter?.term) {
        filtered = filtered.filter((r) => r.term === filter.term)
      }
      if (filter?.session) {
        filtered = filtered.filter((r) => r.session === filter.session)
      }

      return filtered
    },
    create: async (data: Omit<AttendanceRecord, "id">): Promise<AttendanceRecord> => {
      const records = ((await dbManager.getData("attendancePositions")) as Record<string, AttendanceRecord> | null) || {}
      const newRecord = { id: Date.now().toString(), ...data }
      const key = `${data.studentId}-${data.term}-${data.session}`
      records[key] = newRecord
      dbManager.saveData("attendancePositions", records)
      return newRecord
    },
  },

  classTeacherRemarks: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<
      ClassTeacherRemarks[]
    > => {
      const remarks = ((await dbManager.getData("classTeacherRemarks")) as Record<string, ClassTeacherRemarks> | null) || {}
      const remarksList = Object.values(remarks) as ClassTeacherRemarks[]

      let filtered = remarksList
      if (filter?.studentId) {
        filtered = filtered.filter((r) => r.studentId === filter.studentId)
      }
      if (filter?.term) {
        filtered = filtered.filter((r) => r.term === filter.term)
      }
      if (filter?.session) {
        filtered = filtered.filter((r) => r.session === filter.session)
      }

      return filtered
    },
    create: async (data: Omit<ClassTeacherRemarks, "id">): Promise<ClassTeacherRemarks> => {
      const remarks = ((await dbManager.getData("classTeacherRemarks")) as Record<string, ClassTeacherRemarks> | null) || {}
      const newRemark = { id: Date.now().toString(), ...data }
      const key = `${data.studentId}-${data.term}-${data.session}`
      remarks[key] = newRemark
      dbManager.saveData("classTeacherRemarks", remarks)
      return newRemark
    },
  },
}

function calculateGrade(total: number): string {
  if (total >= 75) return "A"
  if (total >= 60) return "B"
  if (total >= 50) return "C"
  if (total >= 40) return "D"
  if (total >= 30) return "E"
  return "F"
}

const safeParseJson = (value: any): any => {
  if (!value) return undefined
  if (typeof value !== "string") return value

  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn("[v0] Failed to parse JSON value from database:", error)
    return undefined
  }
}

const toNullableInt = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10)
  }

  return null
}

const mapUserRow = (row: any): User => {
  const subjects = safeParseJson(row.subjects)

  return {
    id: row.id?.toString() ?? "",
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password,
    class: row.class_id ? row.class_id.toString() : row.class_name ?? undefined,
    subjects: Array.isArray(subjects) ? (subjects as string[]) : undefined,
    parentId: row.parent_id ?? undefined,
    studentIds: row.student_id ? [row.student_id.toString()] : undefined,
  }
}

const mapClassRow = (row: any): ClassRecord => {
  const subjects = safeParseJson(row.subjects)

  return {
    id: row.id?.toString() ?? "",
    name: row.name,
    level: row.level,
    teacherId: row.teacher_id ? row.teacher_id.toString() : null,
    capacity:
      row.capacity !== undefined && row.capacity !== null && row.capacity !== ""
        ? Number(row.capacity)
        : undefined,
    status: row.status ?? undefined,
    subjects: Array.isArray(subjects) ? (subjects as string[]) : undefined,
  }
}

const mapGradeRow = (row: any): Grade => {
  const firstCA = Number(row.first_ca ?? row.firstCA ?? 0)
  const secondCA = Number(row.second_ca ?? row.secondCA ?? 0)
  const assignment = Number(row.assignment ?? row.assignment_score ?? 0)
  const exam = Number(row.exam ?? row.exam_score ?? 0)
  const total = Number(row.total ?? firstCA + secondCA + assignment + exam)
  const gradeLetter = row.grade ?? calculateGrade(total)

  return {
    id: row.id?.toString() ?? "",
    studentId: row.student_id?.toString() ?? row.studentId?.toString() ?? "",
    subject: row.subject,
    firstCA,
    secondCA,
    assignment,
    exam,
    total,
    grade: gradeLetter,
    teacherRemarks: row.teacher_remarks ?? row.remarks ?? undefined,
    term: row.term ?? "",
    session: row.session ?? "",
  }
}

const mapStudentRow = (row: any): Student => {
  return {
    id: row.id?.toString() ?? "",
    name: row.name,
    email: row.parent_email ?? row.email ?? "",
    class: row.class_id ? row.class_id.toString() : row.class_name ?? "",
    admissionNumber: row.student_id ?? "",
    parentId: row.parent_email ?? undefined,
    profileImage: row.profile_image ?? undefined,
  }
}

const getFallbackUsers = async (): Promise<User[]> => {
  const storedUsers = (await dbManager.getData("users")) as User[] | null
  return storedUsers || []
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  if (dbManager.hasDatabaseConnection()) {
    const rows = (await dbManager.executeQuery(
      "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE email = ? LIMIT 1",
      [email],
    )) as any[]

    if (Array.isArray(rows) && rows.length > 0) {
      return mapUserRow(rows[0])
    }
  }

  const fallbackUsers = await getFallbackUsers()
  return fallbackUsers.find((user) => user.email === email) || null
}

export const getAllUsersFromDb = async (): Promise<User[]> => {
  if (dbManager.hasDatabaseConnection()) {
    const rows = (await dbManager.executeQuery(
      "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users ORDER BY created_at DESC",
    )) as any[]

    return Array.isArray(rows) ? rows.map(mapUserRow) : []
  }

  return await getFallbackUsers()
}

export const getUserByIdFromDb = async (userId: string): Promise<User | null> => {
  if (dbManager.hasDatabaseConnection()) {
    const rows = (await dbManager.executeQuery(
      "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE id = ? LIMIT 1",
      [userId],
    )) as any[]

    if (Array.isArray(rows) && rows.length > 0) {
      return mapUserRow(rows[0])
    }
  }

  const fallbackUsers = await getFallbackUsers()
  return fallbackUsers.find((user) => user.id === userId) || null
}

export const getUsersByRoleFromDb = async (role: string): Promise<User[]> => {
  if (dbManager.hasDatabaseConnection()) {
    const rows = (await dbManager.executeQuery(
      "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE role = ? ORDER BY name",
      [role],
    )) as any[]

    return Array.isArray(rows) ? rows.map(mapUserRow) : []
  }

  const fallbackUsers = await getFallbackUsers()
  return fallbackUsers.filter((user) => user.role === role)
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
  if (dbManager.hasDatabaseConnection()) {
    const result: any = await dbManager.executeQuery(
      "INSERT INTO users (name, email, password, role, class_id, student_id, subjects) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        data.name,
        data.email,
        data.passwordHash,
        data.role,
        toNullableInt(data.classId ?? null),
        data.studentId ?? null,
        data.subjects ? JSON.stringify(data.subjects) : null,
      ],
    )

    const insertedId = result?.insertId

    if (insertedId) {
      const rows = (await dbManager.executeQuery(
        "SELECT id, name, email, role, password, class_id, student_id, subjects FROM users WHERE id = ? LIMIT 1",
        [insertedId],
      )) as any[]

      if (Array.isArray(rows) && rows.length > 0) {
        return mapUserRow(rows[0])
      }
    }

    return {
      id: insertedId?.toString() ?? Date.now().toString(),
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash: data.passwordHash,
      class: data.classId ?? undefined,
      subjects: data.subjects,
      studentIds: data.studentId ? [data.studentId] : undefined,
    }
  }

  const fallbackUsers = await getFallbackUsers()
  const newUser: User = {
    id: Date.now().toString(),
    name: data.name,
    email: data.email,
    role: data.role,
    passwordHash: data.passwordHash,
    class: data.classId ?? undefined,
    subjects: data.subjects,
    studentIds: data.studentId ? [data.studentId] : undefined,
  }
  fallbackUsers.push(newUser)
  await dbManager.saveData("users", fallbackUsers)
  return newUser
}

export const updateUserRecord = async (
  userId: string,
  updates: Partial<User> & { passwordHash?: string },
): Promise<User | null> => {
  if (dbManager.hasDatabaseConnection()) {
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
      params.push(updates.role)
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

    if (fields.length > 0) {
      fields.push("updated_at = NOW()")
      const updateSql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`
      params.push(userId)
      await dbManager.executeQuery(updateSql, params)
    }

    return await getUserByIdFromDb(userId)
  }

  const fallbackUsers = await getFallbackUsers()
  const index = fallbackUsers.findIndex((user) => user.id === userId)
  if (index === -1) {
    return null
  }

  const updatedUser: User = {
    ...fallbackUsers[index],
    ...updates,
    passwordHash: updates.passwordHash ?? fallbackUsers[index].passwordHash,
  }

  fallbackUsers[index] = updatedUser
  await dbManager.saveData("users", fallbackUsers)
  return updatedUser
}

export const getAllClassesFromDb = async (): Promise<ClassRecord[]> => {
  if (dbManager.hasDatabaseConnection()) {
    const rows = (await dbManager.executeQuery(
      "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes ORDER BY name",
    )) as any[]

    return Array.isArray(rows) ? rows.map(mapClassRow) : []
  }

  const storedClasses = (await dbManager.getData("classes")) as ClassRecord[] | null
  return storedClasses || []
}

export const createClassRecord = async (data: {
  name: string
  level: string
  capacity?: number
  classTeacherId?: string | null
  status?: "active" | "inactive"
  subjects?: string[]
}): Promise<ClassRecord> => {
  if (dbManager.hasDatabaseConnection()) {
    const result: any = await dbManager.executeQuery(
      "INSERT INTO classes (name, level, teacher_id, capacity, status, subjects) VALUES (?, ?, ?, ?, ?, ?)",
      [
        data.name,
        data.level,
        toNullableInt(data.classTeacherId ?? null),
        data.capacity ?? 30,
        data.status ?? "active",
        data.subjects ? JSON.stringify(data.subjects) : null,
      ],
    )

    const insertedId = result?.insertId
    if (insertedId) {
      const rows = (await dbManager.executeQuery(
        "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes WHERE id = ? LIMIT 1",
        [insertedId],
      )) as any[]

      if (Array.isArray(rows) && rows.length > 0) {
        return mapClassRow(rows[0])
      }
    }

    return {
      id: insertedId?.toString() ?? Date.now().toString(),
      name: data.name,
      level: data.level,
      teacherId: data.classTeacherId ?? null,
      capacity: data.capacity,
      status: data.status ?? "active",
      subjects: data.subjects,
    }
  }

  const storedClasses = (await dbManager.getData("classes")) as ClassRecord[] | null
  const classes = storedClasses || []
  const newClass: ClassRecord = {
    id: Date.now().toString(),
    name: data.name,
    level: data.level,
    teacherId: data.classTeacherId ?? null,
    capacity: data.capacity,
    status: data.status ?? "active",
    subjects: data.subjects,
  }
  classes.push(newClass)
  await dbManager.saveData("classes", classes)
  return newClass
}

export const updateClassRecord = async (
  classId: string,
  updates: Partial<ClassRecord> & { classTeacherId?: string | null },
): Promise<ClassRecord | null> => {
  if (dbManager.hasDatabaseConnection()) {
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

    if (fields.length > 0) {
      fields.push("updated_at = NOW()")
      const sql = `UPDATE classes SET ${fields.join(", ")} WHERE id = ?`
      params.push(classId)
      await dbManager.executeQuery(sql, params)
    }

    const rows = (await dbManager.executeQuery(
      "SELECT id, name, level, teacher_id, capacity, status, subjects FROM classes WHERE id = ? LIMIT 1",
      [classId],
    )) as any[]

    if (Array.isArray(rows) && rows.length > 0) {
      return mapClassRow(rows[0])
    }

    return null
  }

  const storedClasses = (await dbManager.getData("classes")) as ClassRecord[] | null
  if (!storedClasses) {
    return null
  }

  const index = storedClasses.findIndex((item) => item.id === classId)
  if (index === -1) {
    return null
  }

  const updatedClass: ClassRecord = {
    ...storedClasses[index],
    ...updates,
    teacherId: updates.classTeacherId ?? storedClasses[index].teacherId ?? null,
  }

  storedClasses[index] = updatedClass
  await dbManager.saveData("classes", storedClasses)
  return updatedClass
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

const fetchGradesWithQuery = async (sql: string, params: any[] = []): Promise<Grade[]> => {
  const rows = (await dbManager.executeQuery(sql, params)) as any[]
  if (!Array.isArray(rows)) {
    return []
  }
  return rows.map(mapGradeRow)
}

export const getAllGradesFromDb = async (): Promise<Grade[]> => {
  if (dbManager.hasDatabaseConnection()) {
    return await fetchGradesWithQuery(
      "SELECT g.id, g.student_id, g.subject, g.first_ca, g.second_ca, g.assignment, g.exam, g.total, g.grade, g.teacher_remarks, g.term, g.session FROM grades g ORDER BY g.updated_at DESC",
    )
  }

  const fallbackGrades = (await dbManager.getData("grades")) as Grade[] | null
  return fallbackGrades || []
}

export const getGradesForStudentFromDb = async (studentId: string): Promise<Grade[]> => {
  if (dbManager.hasDatabaseConnection()) {
    return await fetchGradesWithQuery(
      "SELECT g.id, g.student_id, g.subject, g.first_ca, g.second_ca, g.assignment, g.exam, g.total, g.grade, g.teacher_remarks, g.term, g.session FROM grades g WHERE g.student_id = ? ORDER BY g.subject",
      [studentId],
    )
  }

  const fallbackGrades = (await dbManager.getData("grades")) as Grade[] | null
  return (fallbackGrades || []).filter((grade) => grade.studentId === studentId)
}

export const getGradesForClassFromDb = async (classId: string): Promise<Grade[]> => {
  if (dbManager.hasDatabaseConnection()) {
    return await fetchGradesWithQuery(
      "SELECT g.id, g.student_id, g.subject, g.first_ca, g.second_ca, g.assignment, g.exam, g.total, g.grade, g.teacher_remarks, g.term, g.session FROM grades g INNER JOIN students s ON g.student_id = s.id WHERE s.class_id = ? ORDER BY g.updated_at DESC",
      [classId],
    )
  }

  const fallbackGrades = (await dbManager.getData("grades")) as Grade[] | null
  if (!fallbackGrades) {
    return []
  }

  const students = ((await dbManager.getData("students")) as Student[] | null) || []
  const studentIds = new Set(
    students.filter((student) => student.class === classId || student.id === classId).map((student) => student.id),
  )

  return fallbackGrades.filter((grade) => studentIds.has(grade.studentId))
}

export const createGradeRecord = async (data: GradeRecordInput): Promise<Grade> => {
  const total = data.firstCA + data.secondCA + data.assignment + data.exam
  const gradeLetter = calculateGrade(total)

  if (dbManager.hasDatabaseConnection()) {
    const result: any = await dbManager.executeQuery(
      "INSERT INTO grades (student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        toNullableInt(data.studentId),
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

    const insertedId = result?.insertId
    if (insertedId) {
      const rows = (await dbManager.executeQuery(
        "SELECT id, student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session FROM grades WHERE id = ? LIMIT 1",
        [insertedId],
      )) as any[]

      if (Array.isArray(rows) && rows.length > 0) {
        return mapGradeRow(rows[0])
      }
    }

    return {
      id: insertedId?.toString() ?? Date.now().toString(),
      studentId: data.studentId,
      subject: data.subject,
      firstCA: data.firstCA,
      secondCA: data.secondCA,
      assignment: data.assignment,
      exam: data.exam,
      total,
      grade: gradeLetter,
      teacherRemarks: data.teacherRemarks,
      term: data.term,
      session: data.session,
    }
  }

  const fallbackGrades = (await dbManager.getData("grades")) as Grade[] | null
  const grades = fallbackGrades || []
  const newGrade: Grade = {
    id: Date.now().toString(),
    studentId: data.studentId,
    subject: data.subject,
    firstCA: data.firstCA,
    secondCA: data.secondCA,
    assignment: data.assignment,
    exam: data.exam,
    total,
    grade: gradeLetter,
    teacherRemarks: data.teacherRemarks,
    term: data.term,
    session: data.session,
  }
  grades.push(newGrade)
  await dbManager.saveData("grades", grades)
  return newGrade
}

export const updateGradeRecord = async (gradeId: string, updates: GradeUpdateInput): Promise<Grade | null> => {
  if (dbManager.hasDatabaseConnection()) {
    const fields: string[] = []
    const params: any[] = []

    if (updates.studentId !== undefined) {
      fields.push("student_id = ?")
      params.push(toNullableInt(updates.studentId ?? null))
    }
    if (updates.subject !== undefined) {
      fields.push("subject = ?")
      params.push(updates.subject)
    }
    if (updates.firstCA !== undefined) {
      fields.push("first_ca = ?")
      params.push(updates.firstCA)
    }
    if (updates.secondCA !== undefined) {
      fields.push("second_ca = ?")
      params.push(updates.secondCA)
    }
    if (updates.assignment !== undefined) {
      fields.push("assignment = ?")
      params.push(updates.assignment)
    }
    if (updates.exam !== undefined) {
      fields.push("exam = ?")
      params.push(updates.exam)
    }
    if (updates.teacherRemarks !== undefined) {
      fields.push("teacher_remarks = ?")
      params.push(updates.teacherRemarks ?? null)
    }
    if (updates.term !== undefined) {
      fields.push("term = ?")
      params.push(updates.term)
    }
    if (updates.session !== undefined) {
      fields.push("session = ?")
      params.push(updates.session)
    }
    if (updates.classId !== undefined) {
      fields.push("class_id = ?")
      params.push(toNullableInt(updates.classId ?? null))
    }

    let total: number | undefined
    let gradeLetter: string | undefined

    if (
      updates.firstCA !== undefined ||
      updates.secondCA !== undefined ||
      updates.assignment !== undefined ||
      updates.exam !== undefined
    ) {
      const existingRows = (await dbManager.executeQuery(
        "SELECT first_ca, second_ca, assignment, exam FROM grades WHERE id = ? LIMIT 1",
        [gradeId],
      )) as any[]
      const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null

      const firstCA = updates.firstCA ?? Number(existing?.first_ca ?? 0)
      const secondCA = updates.secondCA ?? Number(existing?.second_ca ?? 0)
      const assignment = updates.assignment ?? Number(existing?.assignment ?? 0)
      const exam = updates.exam ?? Number(existing?.exam ?? 0)
      total = firstCA + secondCA + assignment + exam
      gradeLetter = calculateGrade(total)
      fields.push("total = ?")
      params.push(total)
      fields.push("grade = ?")
      params.push(gradeLetter)
    }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()")
      const sql = `UPDATE grades SET ${fields.join(", ")} WHERE id = ?`
      params.push(gradeId)
      await dbManager.executeQuery(sql, params)
    }

    const rows = (await dbManager.executeQuery(
      "SELECT id, student_id, subject, first_ca, second_ca, assignment, exam, total, grade, teacher_remarks, term, session FROM grades WHERE id = ? LIMIT 1",
      [gradeId],
    )) as any[]

    if (Array.isArray(rows) && rows.length > 0) {
      return mapGradeRow(rows[0])
    }

    return null
  }

  const fallbackGrades = (await dbManager.getData("grades")) as Grade[] | null
  if (!fallbackGrades) {
    return null
  }

  const index = fallbackGrades.findIndex((grade) => grade.id === gradeId)
  if (index === -1) {
    return null
  }

  const existingGrade = fallbackGrades[index]
  const updated: Grade = {
    ...existingGrade,
    ...updates,
  }

  updated.total =
    (updates.firstCA ?? existingGrade.firstCA) +
    (updates.secondCA ?? existingGrade.secondCA) +
    (updates.assignment ?? existingGrade.assignment) +
    (updates.exam ?? existingGrade.exam)
  updated.grade = calculateGrade(updated.total)

  fallbackGrades[index] = updated
  await dbManager.saveData("grades", fallbackGrades)
  return updated
}

export interface PaymentInitializationRecord {
  reference: string
  amount: number
  studentId?: string | null
  paymentType?: string
  status?: "pending" | "completed" | "failed"
  paystackReference?: string
  email?: string
  metadata?: Record<string, any>
}

export const recordPaymentInitialization = async (
  data: PaymentInitializationRecord,
): Promise<void> => {
  if (!dbManager.hasDatabaseConnection()) {
    return
  }

  await dbManager.executeQuery(
    `INSERT INTO payments (student_id, amount, payment_type, status, reference, paystack_reference, payer_email, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  return await db.studentMarks.create(marksData)
}

export const getStudentMarks = async (
  studentId: string,
  term?: string | null,
  session?: string | null,
): Promise<StudentMarks[]> => {
  const filter: { studentId: string; term?: string; session?: string } = { studentId }

  if (term) filter.term = term
  if (session) filter.session = session

  return await db.studentMarks.findMany(filter)
}

export { dbManager }
