import type { ReportCardRecord, ReportCardSubjectRecord } from "@/lib/database"
import { deriveGradeFromScore } from "@/lib/grade-utils"
import type { RawReportCardData } from "@/lib/report-card-types"

const normaliseSubject = (subject: ReportCardSubjectRecord) => {
  const ca1 = Number.isFinite(subject.ca1) ? subject.ca1 : 0
  const ca2 = Number.isFinite(subject.ca2) ? subject.ca2 : 0
  const assignment = Number.isFinite(subject.assignment) ? subject.assignment : 0
  const exam = Number.isFinite(subject.exam) ? subject.exam : 0
  const caTotal = ca1 + ca2 + assignment
  const total = Number.isFinite(subject.total) ? subject.total : caTotal + exam
  const grade = subject.grade && subject.grade.trim().length > 0 ? subject.grade : deriveGradeFromScore(total)

  return {
    name: subject.name,
    ca1,
    ca2,
    assignment,
    caTotal,
    exam,
    total,
    grade,
    remarks: subject.remark ?? "",
    position: subject.position ?? null,
  }
}

export const mapReportCardRecordToRaw = (record: ReportCardRecord): RawReportCardData => {
  const subjects = (record.subjects ?? []).map((subject) => normaliseSubject(subject))

  const totalMarksObtained = subjects.reduce((sum, subject) => sum + subject.total, 0)
  const totalMarksObtainable = subjects.length > 0 ? subjects.length * 100 : 0
  const averageScore =
    totalMarksObtainable > 0 ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2)) : 0

  return {
    student: {
      id: record.studentId,
      name: record.studentName,
      admissionNumber: record.studentId ? `VEA/${record.studentId}` : record.studentName,
      class: record.className,
      term: record.term,
      session: record.session,
    },
    subjects,
    summary: {
      totalMarksObtainable,
      totalMarksObtained: totalMarksObtained,
      averageScore,
      grade: deriveGradeFromScore(averageScore),
    },
    totalObtainable: totalMarksObtainable,
    totalObtained: totalMarksObtained,
    average: averageScore,
    affectiveDomain: {},
    psychomotorDomain: {},
    classTeacherRemarks: record.classTeacherRemark ?? undefined,
    remarks: {
      classTeacher: record.classTeacherRemark ?? undefined,
      headTeacher: record.headTeacherRemark ?? undefined,
    },
  }
}
