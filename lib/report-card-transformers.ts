import type { ReportCardRecord, ReportCardSubjectRecord } from "@/lib/database"
import { deriveGradeFromScore } from "@/lib/grade-utils"
import { resolveStudentPassportFromCache } from "./student-passport"
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  createBehavioralRecordSkeleton,
  normalizeBehavioralSelections,
} from "@/lib/report-card-constants"
import type { RawReportCardData } from "@/lib/report-card-types"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const extractRawFromMetadata = (metadata: unknown): RawReportCardData | null => {
  if (!isRecord(metadata)) {
    return null
  }

  const container = metadata as Record<string, unknown>
  const candidate =
    container.enhancedReportCard ??
    container.enhancedReport ??
    container.rawReportCard ??
    container.reportCard

  if (isRecord(candidate)) {
    return candidate as RawReportCardData
  }

  return null
}

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

const mergeBehavioralDomain = (
  domain: "affective" | "psychomotor",
  baseDomain: Record<string, boolean>,
  override: Record<string, unknown> | undefined,
) => {
  const merged = { ...baseDomain }
  const normalized = normalizeBehavioralSelections(domain, override)
  Object.entries(normalized).forEach(([key, value]) => {
    merged[key] = value
  })

  Object.keys(merged).forEach((key) => {
    merged[key] = Boolean(merged[key])
  })

  return merged
}

export const mapReportCardRecordToRaw = (record: ReportCardRecord): RawReportCardData => {
  const subjects = (record.subjects ?? []).map((subject) => normaliseSubject(subject))

  const totalMarksObtained = subjects.reduce((sum, subject) => sum + subject.total, 0)
  const totalMarksObtainable = subjects.length > 0 ? subjects.length * 100 : 0
  const averageScore =
    totalMarksObtainable > 0 ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2)) : 0

  const baseSummary = {
    totalMarksObtainable,
    totalMarksObtained,
    averageScore,
    grade: deriveGradeFromScore(averageScore),
  }

  const metadataRaw = extractRawFromMetadata(record.metadata)
  const metadataStudentRecord =
    metadataRaw && isRecord(metadataRaw.student) ? metadataRaw.student : undefined

  const { passportUrl, photoUrl } = resolveStudentPassportFromCache(
    {
      id: record.studentId,
      admissionNumber:
        (metadataStudentRecord?.admissionNumber as string | undefined) ?? record.studentId,
      name: (metadataStudentRecord?.name as string | undefined) ?? record.studentName,
    },
    metadataStudentRecord ?? null,
  )

  const base: RawReportCardData = {
    student: {
      id: record.studentId,
      name: record.studentName,
      admissionNumber: record.studentId ? `VEA/${record.studentId}` : record.studentName,
      class: record.className,
      term: record.term,
      session: record.session,
      passportUrl,
      photoUrl,
    },
    subjects,
    summary: baseSummary,
    totalObtainable: totalMarksObtainable,
    totalObtained: totalMarksObtained,
    average: averageScore,
    position: baseSummary.position,
    affectiveDomain: createBehavioralRecordSkeleton(AFFECTIVE_TRAITS),
    psychomotorDomain: createBehavioralRecordSkeleton(PSYCHOMOTOR_SKILLS),
    classTeacherRemarks: record.classTeacherRemark ?? undefined,
    remarks: {
      classTeacher: record.classTeacherRemark ?? undefined,
      headTeacher: record.headTeacherRemark ?? undefined,
    },
  }

  if (!metadataRaw) {
    return base
  }

  const metadataStudent = metadataStudentRecord ?? {}
  const metadataSummary = metadataRaw.summary
    ? { ...baseSummary, ...metadataRaw.summary }
    : baseSummary
  const metadataSubjects = Array.isArray(metadataRaw.subjects) && metadataRaw.subjects.length > 0
    ? metadataRaw.subjects
    : subjects
  const mergedClassTeacherRemark =
    metadataRaw.classTeacherRemarks ?? metadataRaw.remarks?.classTeacher ?? base.classTeacherRemarks

  return {
    ...base,
    ...metadataRaw,
    student: {
      ...base.student,
      ...metadataStudent,
      id: metadataStudent.id ? String(metadataStudent.id) : base.student.id,
      name: metadataStudent.name ?? base.student.name,
      admissionNumber: metadataStudent.admissionNumber ?? base.student.admissionNumber,
      class: metadataStudent.class ?? base.student.class,
      term: metadataStudent.term ?? base.student.term,
      session: metadataStudent.session ?? base.student.session,
      numberInClass: metadataStudent.numberInClass ?? base.student.numberInClass,
      status: metadataStudent.status ?? base.student.status,
    },
    subjects: metadataSubjects,
    summary: metadataSummary,
    totalObtainable:
      metadataRaw.totalObtainable ?? metadataSummary.totalMarksObtainable ?? base.totalObtainable,
    totalObtained: metadataRaw.totalObtained ?? metadataSummary.totalMarksObtained ?? base.totalObtained,
    average: metadataRaw.average ?? metadataSummary.averageScore ?? base.average,
    position: metadataRaw.position ?? metadataSummary.position ?? base.position,
    classTeacherRemarks: mergedClassTeacherRemark,
    remarks: {
      classTeacher: metadataRaw.remarks?.classTeacher ?? mergedClassTeacherRemark,
      headTeacher: metadataRaw.remarks?.headTeacher ?? base.remarks?.headTeacher,
    },
    affectiveDomain: mergeBehavioralDomain(
      "affective",
      base.affectiveDomain,
      metadataRaw.affectiveDomain as Record<string, unknown> | undefined,
    ),
    psychomotorDomain: mergeBehavioralDomain(
      "psychomotor",
      base.psychomotorDomain,
      metadataRaw.psychomotorDomain as Record<string, unknown> | undefined,
    ),
    attendance: metadataRaw.attendance ?? base.attendance,
    termInfo: metadataRaw.termInfo ?? base.termInfo,
    fees: metadataRaw.fees ?? base.fees,
  }
}
