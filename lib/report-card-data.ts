export interface StudentMarks {
  studentId: string
  studentName: string
  class: string
  subjects: {
    [subjectName: string]: {
      firstCA: number
      secondCA: number
      noteAssignment: number
      exam: number
      teacherRemark: string
      teacherId: string
      term: string
      session: string
      lastUpdated: string
    }
  }
  affectiveDomain: {
    neatness: string
    honesty: string
    punctuality: string
  }
  psychomotorDomain: {
    sport: string
    handwriting: string
  }
  classTeacherRemarks: string
  adminOverrides?: {
    [field: string]: any
    overriddenBy: string
    overrideDate: string
    reason: string
  }
}

export interface ReportCardSettings {
  schoolLogo?: string
  headmasterSignature?: string
  defaultRemarks: string
  gradingScale: {
    A: { min: number; max: number; description: string }
    B: { min: number; max: number; description: string }
    C: { min: number; max: number; description: string }
    D: { min: number; max: number; description: string }
    E: { min: number; max: number; description: string }
    F: { min: number; max: number; description: string }
  }
}

// Mock database storage
const studentMarksDatabase: { [studentId: string]: StudentMarks } = {}
let reportCardSettings: ReportCardSettings = {
  defaultRemarks: "Keep up the good work and continue to strive for excellence.",
  gradingScale: {
    A: { min: 75, max: 100, description: "Excellent" },
    B: { min: 60, max: 74, description: "Very Good" },
    C: { min: 50, max: 59, description: "Good" },
    D: { min: 40, max: 49, description: "Fair" },
    E: { min: 30, max: 39, description: "Poor" },
    F: { min: 0, max: 29, description: "Fail" },
  },
}

export const calculateGrade = (total: number): string => {
  const { gradingScale } = reportCardSettings
  for (const [grade, range] of Object.entries(gradingScale)) {
    if (total >= range.min && total <= range.max) {
      return grade
    }
  }
  return "F"
}

export const saveTeacherMarks = async (marksData: {
  class: string
  subject: string
  term: string
  session: string
  marks: Array<{
    studentId: number
    studentName: string
    firstCA: number
    secondCA: number
    noteAssignment: number
    exam: number
    teacherRemark: string
  }>
  teacherId: string
}) => {
  try {
    // Save each student's marks
    for (const studentMark of marksData.marks) {
      const studentId = studentMark.studentId.toString()

      if (!studentMarksDatabase[studentId]) {
        studentMarksDatabase[studentId] = {
          studentId,
          studentName: studentMark.studentName,
          class: marksData.class,
          subjects: {},
          affectiveDomain: {
            neatness: "Good",
            honesty: "Good",
            punctuality: "Good",
          },
          psychomotorDomain: {
            sport: "Good",
            handwriting: "Good",
          },
          classTeacherRemarks: reportCardSettings.defaultRemarks,
        }
      }

      // Update subject marks
      studentMarksDatabase[studentId].subjects[marksData.subject] = {
        firstCA: studentMark.firstCA,
        secondCA: studentMark.secondCA,
        noteAssignment: studentMark.noteAssignment,
        exam: studentMark.exam,
        teacherRemark: studentMark.teacherRemark,
        teacherId: marksData.teacherId,
        term: marksData.term,
        session: marksData.session,
        lastUpdated: new Date().toISOString(),
      }
    }

    return { success: true, message: "Marks saved and will appear on report cards" }
  } catch (error) {
    console.error("Error saving marks:", error)
    return { success: false, message: "Error saving marks" }
  }
}

export const getStudentReportCardData = (studentId: string, term: string, session: string) => {
  const studentData = studentMarksDatabase[studentId]
  if (!studentData) {
    return null
  }

  // Filter subjects for the specific term and session
  const subjects = Object.entries(studentData.subjects)
    .filter(([_, subjectData]) => subjectData.term === term && subjectData.session === session)
    .map(([subjectName, subjectData]) => {
      const caTotal = subjectData.firstCA + subjectData.secondCA + subjectData.noteAssignment
      const grandTotal = caTotal + subjectData.exam
      const grade = calculateGrade(grandTotal)

      return {
        name: subjectName,
        ca1: subjectData.firstCA,
        ca2: subjectData.secondCA,
        assignment: subjectData.noteAssignment,
        exam: subjectData.exam,
        total: grandTotal,
        grade,
        remarks: subjectData.teacherRemark,
      }
    })

  const totalObtainable = subjects.length * 100
  const totalObtained = subjects.reduce((sum, subject) => sum + subject.total, 0)
  const average = totalObtainable > 0 ? Math.round((totalObtained / totalObtainable) * 100) : 0

  // Calculate position (mock implementation)
  const position = average >= 80 ? "1st" : average >= 70 ? "2nd" : average >= 60 ? "3rd" : "4th"

  return {
    student: {
      name: studentData.studentName,
      admissionNumber: `VEA/${studentId}/2024`,
      class: studentData.class,
      term,
      session,
    },
    subjects,
    affectiveDomain: studentData.affectiveDomain,
    psychomotorDomain: studentData.psychomotorDomain,
    classTeacherRemarks: studentData.classTeacherRemarks,
    totalObtainable,
    totalObtained,
    average,
    position,
  }
}

export const updateReportCardSettings = (settings: Partial<ReportCardSettings>) => {
  reportCardSettings = { ...reportCardSettings, ...settings }
}

export const adminOverrideMarks = (studentId: string, overrides: any, adminId: string, reason: string) => {
  if (studentMarksDatabase[studentId]) {
    studentMarksDatabase[studentId].adminOverrides = {
      ...overrides,
      overriddenBy: adminId,
      overrideDate: new Date().toISOString(),
      reason,
    }
  }
}

// Export for debugging
export const getStudentMarksDatabase = () => studentMarksDatabase
export const getReportCardSettings = () => reportCardSettings
