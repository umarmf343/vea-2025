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

class DatabaseManager {
  private listeners: Map<string, Function[]> = new Map()
  private connector: any = null

  constructor() {
    // Only initialize server connector on server-side
    if (typeof window === "undefined" && DatabaseConnector) {
      this.connector = new DatabaseConnector()
    }
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
      await this.connector.query(
        `INSERT INTO users (id, name, email, role, password, class_id, student_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) 
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), email = VALUES(email), role = VALUES(role), 
         password = VALUES(password), class_id = VALUES(class_id), 
         student_id = VALUES(student_id), updated_at = NOW()`,
        [user.id, user.name, user.email, user.role, user.passwordHash, user.class, user.studentIds?.[0]],
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
      class: row.class_id,
      subjects: row.subjects ? JSON.parse(row.subjects) : undefined,
      parentId: row.parent_id,
      studentIds: row.student_id ? [row.student_id] : undefined,
    }))
  }

  private async saveStudents(students: Student[]): Promise<void> {
    if (!this.connector) return

    for (const student of students) {
      await this.connector.query(
        `INSERT INTO students (id, student_id, name, class_id, parent_email, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), class_id = VALUES(class_id), parent_email = VALUES(parent_email)`,
        [student.id, student.admissionNumber, student.name, student.class, student.email],
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
      class: row.class_id,
      admissionNumber: row.student_id,
      parentId: row.parent_email,
    }))
  }
}

const dbManager = new DatabaseManager()

export const db = {
  students: {
    findMany: async (filter?: { class?: string }): Promise<Student[]> => {
      const students = dbManager.getData("students") || [
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
        return students.filter((s: Student) => s.class === filter.class)
      }
      return students
    },
    findById: async (id: string): Promise<Student | null> => {
      const students = await db.students.findMany()
      return students.find((s) => s.id === id) || null
    },
    create: async (data: Omit<Student, "id">): Promise<Student> => {
      const students = await db.students.findMany()
      const newStudent = { id: Date.now().toString(), ...data }
      students.push(newStudent)
      dbManager.saveData("students", students)
      return newStudent
    },
    update: async (id: string, data: Partial<Student>): Promise<Student> => {
      const students = await db.students.findMany()
      const index = students.findIndex((s) => s.id === id)
      if (index > -1) {
        students[index] = { ...students[index], ...data }
        dbManager.saveData("students", students)
        return students[index]
      }
      throw new Error("Student not found")
    },
  },

  grades: {
    findMany: async (filter?: { studentId?: string; class?: string }): Promise<Grade[]> => {
      const grades = dbManager.getData("grades") || [
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
        dbManager.saveData("grades", grades)
        return updated
      }
      throw new Error("Grade not found")
    },
  },

  assignments: {
    findMany: async (filter?: { class?: string; teacherId?: string }): Promise<Assignment[]> => {
      const assignments = dbManager.getData("assignments") || [
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
      dbManager.saveData("assignments", assignments)
      return newAssignment
    },
  },

  studentMarks: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<StudentMarks[]> => {
      const mockMarks = dbManager.getData("studentMarks") || [
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
      const assessments = dbManager.getData("behavioralAssessments") || {}
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
      const assessments = dbManager.getData("behavioralAssessments") || {}
      const newAssessment = { id: Date.now().toString(), ...data }
      const key = `${data.studentId}-${data.term}-${data.session}`
      assessments[key] = newAssessment
      dbManager.saveData("behavioralAssessments", assessments)
      return newAssessment
    },
  },

  attendanceRecords: {
    findMany: async (filter?: { studentId?: string; term?: string; session?: string }): Promise<AttendanceRecord[]> => {
      const records = dbManager.getData("attendancePositions") || {}
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
      const records = dbManager.getData("attendancePositions") || {}
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
      const remarks = dbManager.getData("classTeacherRemarks") || {}
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
      const remarks = dbManager.getData("classTeacherRemarks") || {}
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

export const getUserByEmail = async (email: string): Promise<User | null> => {
  // Mock user data - replace with actual database query
  const mockUsers: User[] = [
    {
      id: "1",
      name: "Super Admin",
      email: "superadmin@vea.edu.ng",
      role: "Super Admin",
      passwordHash: "$2a$12$hashedpassword", // This would be actual bcrypt hash
    },
    {
      id: "2",
      name: "Admin User",
      email: "admin@vea.edu.ng",
      role: "Admin",
      passwordHash: "$2a$12$hashedpassword",
    },
    {
      id: "3",
      name: "Teacher User",
      email: "teacher@vea.edu.ng",
      role: "Teacher",
      passwordHash: "$2a$12$hashedpassword",
      subjects: ["Mathematics", "Physics"],
    },
    {
      id: "4",
      name: "Student User",
      email: "student@vea.edu.ng",
      role: "Student",
      passwordHash: "$2a$12$hashedpassword",
      class: "JSS 1A",
    },
    {
      id: "5",
      name: "Parent User",
      email: "parent@vea.edu.ng",
      role: "Parent",
      passwordHash: "$2a$12$hashedpassword",
      studentIds: ["4"],
    },
  ]

  return mockUsers.find((user) => user.email === email) || null
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
