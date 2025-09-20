import { z } from "zod"

// User validation schemas
export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["Super Admin", "Admin", "Teacher", "Student", "Parent", "Librarian", "Accountant"]),
  class: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
})

// Marks validation schema
export const marksSchema = z.object({
  studentId: z.string(),
  subject: z.string().min(1, "Subject is required"),
  ca1: z.number().min(0).max(20, "CA1 must be between 0-20"),
  ca2: z.number().min(0).max(20, "CA2 must be between 0-20"),
  assignment: z.number().min(0).max(10, "Assignment must be between 0-10"),
  exam: z.number().min(0).max(50, "Exam must be between 0-50"),
  remarks: z.string().max(200, "Remarks must be less than 200 characters"),
  term: z.enum(["First Term", "Second Term", "Third Term"]),
  session: z.string(),
})

// Payment validation schema
export const paymentSchema = z.object({
  studentId: z.string(),
  amount: z.number().positive("Amount must be positive"),
  reference: z.string(),
  status: z.enum(["pending", "success", "failed"]),
  paymentMethod: z.string(),
})

// Class validation schema
export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  teacherId: z.string().optional(),
  subjects: z.array(z.string()),
  capacity: z.number().positive("Capacity must be positive"),
})

// Assignment validation schema
export const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  subject: z.string().min(1, "Subject is required"),
  class: z.string().min(1, "Class is required"),
  dueDate: z.string(),
  maxScore: z.number().positive("Max score must be positive"),
})
