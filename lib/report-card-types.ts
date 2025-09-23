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
  logoUrl?: string | null
  schoolLogo?: string | null
  signature?: string | null
  signatureUrl?: string | null
  headmasterSignature?: string | null
  headmasterName?: string
  principalName?: string
  schoolName?: string
  address?: string
  schoolAddress?: string
  educationZone?: string
  educationDistrict?: string
  councilArea?: string
  lga?: string
  localGovernmentArea?: string
  contactPhone?: string
  contactEmail?: string
  defaultRemark?: string
  phone?: string
  contactNumber?: string
  email?: string
  schoolEmail?: string
  proprietorName?: string
  headTeacherRemark?: string
}

export interface RawReportCardData {
  student: RawReportCardStudent
  subjects?: Array<Record<string, unknown>>
  summary?: RawReportCardSummary
  totalObtainable?: number
  totalObtained?: number
  average?: number
  position?: number | string
  affectiveDomain?: Record<string, string | undefined>
  psychomotorDomain?: Record<string, string | undefined>
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
