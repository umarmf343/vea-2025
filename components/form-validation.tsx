import { z } from "zod"

export const studentFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Please enter a valid phone number"),
  class: z.string().min(1, "Please select a class"),
  admissionNumber: z.string().min(3, "Admission number must be at least 3 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(10, "Address must be at least 10 characters"),
})

export const teacherFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Please enter a valid phone number"),
  subjects: z.array(z.string()).min(1, "Please select at least one subject"),
  qualification: z.string().min(5, "Qualification must be at least 5 characters"),
  experience: z.number().min(0, "Experience cannot be negative"),
})

export const gradeFormSchema = z.object({
  firstCA: z.number().min(0, "Score cannot be negative").max(20, "First CA cannot exceed 20"),
  secondCA: z.number().min(0, "Score cannot be negative").max(20, "Second CA cannot exceed 20"),
  assignment: z.number().min(0, "Score cannot be negative").max(10, "Assignment cannot exceed 10"),
  exam: z.number().min(0, "Score cannot be negative").max(50, "Exam cannot exceed 50"),
  remarks: z.string().max(200, "Remarks cannot exceed 200 characters"),
})

export const paymentFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Please enter a valid phone number"),
  amount: z.number().min(1000, "Minimum payment is ₦1,000"),
  term: z.enum(["first", "second", "third"], {
    required_error: "Please select a term",
  }),
  session: z.string().min(1, "Please select a session"),
})

export type StudentFormData = z.infer<typeof studentFormSchema>
export type TeacherFormData = z.infer<typeof teacherFormSchema>
export type GradeFormData = z.infer<typeof gradeFormSchema>
export type PaymentFormData = z.infer<typeof paymentFormSchema>
