export interface RawReportCardStudent {
  id?: string
  name: string
  admissionNumber: string
  class: string
  term: string
  session: string
  numberInClass?: number | string
  status?: string
  dateOfBirth?: string
  gender?: string
  photoUrl?: string | null
  passportUrl?: string | null
}

export interface RawReportCardSummary {
  totalMarksObtainable?: number
  totalMarksObtained?: number
  averageScore?: number
  position?: number | string
  numberOfStudents?: number | string
  classAverage?: number
  grade?: string
  highestScore?: number
  lowestScore?: number
}

export interface RawReportCardAttendance {
  present?: number
  absent?: number
  total?: number
}

export interface RawReportCardTermInfo {
  numberInClass?: number | string
  vacationEnds?: string
  nextTermBegins?: string
  nextTermFees?: string
  feesBalance?: string
}

export interface RawReportCardBranding {
  logo?: string | null
  signature?: string | null
  headmasterName?: string
  schoolName?: string
  address?: string
  educationZone?: string
  councilArea?: string
  contactPhone?: string
  contactEmail?: string
  defaultRemark?: string
}

export interface RawReportCardData {
  student: RawReportCardStudent
  subjects?: Array<Record<string, unknown>>
  summary?: RawReportCardSummary
  totalObtainable?: number
  totalObtained?: number
  average?: number
  position?: number | string
  affectiveDomain?: Record<string, boolean | undefined>
  psychomotorDomain?: Record<string, boolean | undefined>
  classTeacherRemarks?: string
  remarks?: {
    classTeacher?: string
    headTeacher?: string
  }
  attendance?: RawReportCardAttendance
  vacationDate?: string
  resumptionDate?: string
  termInfo?: RawReportCardTermInfo
  branding?: RawReportCardBranding
  fees?: {
    nextTerm?: string
    outstanding?: string
  }
}

export interface StoredSubjectRecord {
  subject: string
  className: string
  ca1: number
  ca2: number
  assignment: number
  caTotal: number
  exam: number
  total: number
  grade: string
  remark?: string
  position?: number | string | null
  totalObtainable?: number
  totalObtained?: number
  averageScore?: number
  teacherId?: string
  teacherName?: string
  updatedAt?: string
}

export interface StoredStudentMarkRecord {
  studentId: string
  studentName: string
  className: string
  term: string
  session: string
  subjects: Record<string, StoredSubjectRecord>
  lastUpdated?: string
  status?: string
  numberInClass?: number | string
  overallAverage?: number
  overallPosition?: number | string | null
}
