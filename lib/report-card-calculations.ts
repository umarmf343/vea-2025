// Report Card Calculation Utilities for VEA 2025 Portal

export interface StudentMarks {
  studentId: string
  studentName: string
  subjects: Array<{
    name: string
    ca1: number
    ca2: number
    assignment: number
    exam: number
    totalObtainable: number
  }>
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
  attendance: {
    present: number
    absent: number
    total: number
  }
}

export interface ClassPerformance {
  className: string
  students: StudentMarks[]
  classAverage: number
  highestScore: number
  lowestScore: number
  passRate: number
  gradeDistribution: Record<string, number>
}

// Calculate total marks obtained for a student
export function calculateTotalMarksObtained(subjects: StudentMarks["subjects"]): number {
  return subjects.reduce((total, subject) => {
    const subjectTotal = subject.ca1 + subject.ca2 + subject.assignment + subject.exam
    return total + subjectTotal
  }, 0)
}

// Calculate total marks obtainable for a student
export function calculateTotalMarksObtainable(subjects: StudentMarks["subjects"]): number {
  return subjects.reduce((total, subject) => total + subject.totalObtainable, 0)
}

// Calculate average percentage for a student
export function calculateAveragePercentage(obtained: number, obtainable: number): number {
  if (obtainable === 0) return 0
  return (obtained / obtainable) * 100
}

// Determine grade based on percentage
export function calculateGrade(percentage: number): string {
  if (percentage >= 75) return "A"
  if (percentage >= 60) return "B"
  if (percentage >= 50) return "C"
  if (percentage >= 40) return "D"
  if (percentage >= 30) return "E"
  return "F"
}

// Calculate class positions based on total scores
export function calculateClassPositions(students: StudentMarks[]): Record<string, number> {
  const studentScores = students.map((student) => ({
    id: student.studentId,
    totalObtained: calculateTotalMarksObtained(student.subjects),
    totalObtainable: calculateTotalMarksObtainable(student.subjects),
    percentage: calculateAveragePercentage(
      calculateTotalMarksObtained(student.subjects),
      calculateTotalMarksObtainable(student.subjects),
    ),
  }))

  // Sort by percentage in descending order
  studentScores.sort((a, b) => b.percentage - a.percentage)

  // Assign positions (handle ties)
  const positions: Record<string, number> = {}
  let currentPosition = 1

  for (let i = 0; i < studentScores.length; i++) {
    if (i > 0 && studentScores[i].percentage < studentScores[i - 1].percentage) {
      currentPosition = i + 1
    }
    positions[studentScores[i].id] = currentPosition
  }

  return positions
}

// Calculate class performance statistics
export function calculateClassPerformance(students: StudentMarks[], className: string): ClassPerformance {
  const totalScores = students.map((student) => {
    const obtained = calculateTotalMarksObtained(student.subjects)
    const obtainable = calculateTotalMarksObtainable(student.subjects)
    return calculateAveragePercentage(obtained, obtainable)
  })

  const classAverage = totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length
  const highestScore = Math.max(...totalScores)
  const lowestScore = Math.min(...totalScores)
  const passCount = totalScores.filter((score) => score >= 40).length
  const passRate = (passCount / totalScores.length) * 100

  // Calculate grade distribution
  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  totalScores.forEach((score) => {
    const grade = calculateGrade(score)
    gradeDistribution[grade]++
  })

  return {
    className,
    students,
    classAverage: Math.round(classAverage * 10) / 10,
    highestScore: Math.round(highestScore * 10) / 10,
    lowestScore: Math.round(lowestScore * 10) / 10,
    passRate: Math.round(passRate * 10) / 10,
    gradeDistribution,
  }
}

// Format position with ordinal suffix
export function formatPosition(position: number): string {
  const suffix = ["th", "st", "nd", "rd"]
  const value = position % 100
  return position + (suffix[(value - 20) % 10] || suffix[value] || suffix[0])
}

// Calculate subject-wise class average
export function calculateSubjectClassAverage(students: StudentMarks[], subjectName: string): number {
  const subjectScores = students
    .map((student) => {
      const subject = student.subjects.find((s) => s.name === subjectName)
      if (!subject) return 0
      const total = subject.ca1 + subject.ca2 + subject.assignment + subject.exam
      return (total / subject.totalObtainable) * 100
    })
    .filter((score) => score > 0)

  if (subjectScores.length === 0) return 0
  return subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length
}

// Generate comprehensive report card data
export function generateReportCardData(
  student: StudentMarks,
  classStudents: StudentMarks[],
): {
  totalObtained: number
  totalObtainable: number
  average: number
  position: string
  grade: string
  classPerformance: ClassPerformance
} {
  const totalObtained = calculateTotalMarksObtained(student.subjects)
  const totalObtainable = calculateTotalMarksObtainable(student.subjects)
  const average = calculateAveragePercentage(totalObtained, totalObtainable)
  const grade = calculateGrade(average)

  const positions = calculateClassPositions(classStudents)
  const position = formatPosition(positions[student.studentId] || 1)

  const classPerformance = calculateClassPerformance(classStudents, "Current Class")

  return {
    totalObtained,
    totalObtainable,
    average: Math.round(average * 10) / 10,
    position,
    grade,
    classPerformance,
  }
}
