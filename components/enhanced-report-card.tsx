"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, PrinterIcon as Print } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBranding } from "@/hooks/use-branding"
import {
  AFFECTIVE_TRAITS,
  BEHAVIORAL_RATING_COLUMNS,
  PSYCHOMOTOR_SKILLS,
  normalizeBehavioralRating,
} from "@/lib/report-card-constants"
import type { RawReportCardData } from "@/lib/report-card-types"
import { deriveGradeFromScore } from "@/lib/grade-utils"
import { safeStorage } from "@/lib/safe-storage"

interface SubjectScore {
  name: string
  ca1: number
  ca2: number
  assignment: number
  caTotal: number
  exam: number
  total: number
  grade: string
  remarks: string
}

interface AttendanceSummary {
  present: number
  absent: number
  total: number
  percentage: number
}

interface NormalizedReportCard {
  student: {
    id: string
    name: string
    admissionNumber: string
    class: string
    term: string
    session: string
    numberInClass?: number
    statusLabel?: string
    positionLabel?: string
  }
  subjects: SubjectScore[]
  summary: {
    totalMarksObtainable: number
    totalMarksObtained: number
    averageScore: number
    positionLabel: string
    numberOfStudents?: number
    classAverage?: number
    highestScore?: number
    lowestScore?: number
    grade?: string
  }
  attendance: AttendanceSummary
  affectiveDomain: Record<string, string>
  psychomotorDomain: Record<string, string>
  remarks: {
    classTeacher: string
    headTeacher: string
  }
  termInfo: {
    numberInClass?: number
    vacationEnds?: string
    nextTermBegins?: string
    nextTermFees?: string
    feesBalance?: string
  }
  branding: {
    schoolName: string
    address: string
    logo: string | null
    signature: string | null
    headmasterName: string
    defaultRemark: string
  }
}

const STORAGE_KEYS_TO_WATCH = [
  "studentMarks",
  "behavioralAssessments",
  "attendancePositions",
  "classTeacherRemarks",
]

const parseJsonRecord = (value: string | null) => {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch (error) {
    return {}
  }
}

const formatStatusLabel = (value?: string) => {
  if (!value || value.trim().length === 0) {
    return undefined
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ")
}

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""))
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

const parsePositionValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/)
    if (match) {
      const parsed = Number.parseInt(match[0], 10)
      return Number.isNaN(parsed) ? undefined : parsed
    }
  }

  return undefined
}

const formatOrdinal = (position?: number) => {
  if (!position || !Number.isFinite(position)) {
    return undefined
  }

  const suffix = (() => {
    const j = position % 10
    const k = position % 100
    if (j === 1 && k !== 11) return "st"
    if (j === 2 && k !== 12) return "nd"
    if (j === 3 && k !== 13) return "rd"
    return "th"
  })()

  return `${position}${suffix}`
}

const normalizeSubjects = (subjects: Array<Record<string, unknown>> | undefined): SubjectScore[] => {
  if (!Array.isArray(subjects)) {
    return []
  }

  return subjects.map((subject) => {
    const ca1 = Number(subject.ca1 ?? subject.firstCA ?? subject.first_ca ?? 0)
    const ca2 = Number(subject.ca2 ?? subject.secondCA ?? subject.second_ca ?? 0)
    const assignment = Number(subject.assignment ?? subject.noteAssignment ?? subject.continuousAssessment ?? 0)
    const exam = Number(subject.exam ?? subject.examScore ?? subject.exam_score ?? 0)
    const caTotal = Number(subject.caTotal ?? ca1 + ca2 + assignment)
    const total = Number(subject.total ?? subject.grandTotal ?? caTotal + exam)
    const grade = String(subject.grade ?? subject.letterGrade ?? "").toUpperCase()
    const remarks = String(subject.remarks ?? subject.teacherRemark ?? "")

    return {
      name: String(subject.name ?? subject.subject ?? "Unknown Subject"),
      ca1,
      ca2,
      assignment,
      caTotal,
      exam,
      total,
      grade,
      remarks,
    }
  })
}

const normalizeDomainRatings = (
  rawRatings: Record<string, string | undefined> | undefined,
  defaultRatings: Record<string, string | undefined>,
) => {
  const normalized: Record<string, string> = {}

  const merged = { ...defaultRatings, ...rawRatings }
  Object.entries(merged).forEach(([trait, rating]) => {
    const normalizedRating = normalizeBehavioralRating(rating)
    if (normalizedRating) {
      normalized[trait] = normalizedRating
    }
  })

  return normalized
}

const normalizeReportCard = (
  source: RawReportCardData | undefined,
  defaultBranding: ReturnType<typeof useBranding>,
): NormalizedReportCard | null => {
  if (!source || !source.student) {
    return null
  }

  const studentId = source.student.id ?? source.student.admissionNumber ?? source.student.name
  const termLabel = source.student.term
  const sessionLabel = source.student.session
  const storageKey = `${studentId}-${termLabel}-${sessionLabel}`

  const behavioralStore = parseJsonRecord(safeStorage.getItem("behavioralAssessments"))
  const attendanceStore = parseJsonRecord(safeStorage.getItem("attendancePositions"))
  const remarksStore = parseJsonRecord(safeStorage.getItem("classTeacherRemarks"))

  const behavioralRecord = behavioralStore[storageKey] as
    | {
        affectiveDomain?: Record<string, string>
        psychomotorDomain?: Record<string, string>
      }
    | undefined

  const attendanceRecord = attendanceStore[storageKey] as
    | {
        position?: number | string | null
        attendance?: { present?: number; absent?: number; total?: number }
        status?: string
        termInfo?: Record<string, unknown>
      }
    | undefined

  const remarkRecord = remarksStore[storageKey] as { remark?: string } | undefined

  const normalizedSubjects = normalizeSubjects(source.subjects)
  const computedTotalObtained = normalizedSubjects.reduce((sum, subject) => sum + subject.total, 0)
  const computedTotalObtainable = normalizedSubjects.length * 100
  const computedAverage = computedTotalObtainable > 0 ? (computedTotalObtained / computedTotalObtainable) * 100 : 0

  const summaryTotalObtainable =
    source.summary?.totalMarksObtainable ?? source.totalObtainable ?? computedTotalObtainable
  const summaryTotalObtained = source.summary?.totalMarksObtained ?? source.totalObtained ?? computedTotalObtained
  const summaryAverageScore = source.summary?.averageScore ?? source.average ?? computedAverage

  const positionNumber =
    parsePositionValue(attendanceRecord?.position) ??
    parsePositionValue(source.summary?.position) ??
    parsePositionValue(source.position)

  const positionLabel = formatOrdinal(positionNumber) ?? source.summary?.position?.toString() ?? source.position ?? ""
  const numberInClass =
    parseNumeric(attendanceRecord?.termInfo?.numberInClass) ??
    parseNumeric(source.termInfo?.numberInClass) ??
    parseNumeric(source.summary?.numberOfStudents) ??
    parseNumeric(source.student.numberInClass)

  const attendancePresent =
    parseNumeric(attendanceRecord?.attendance?.present) ?? parseNumeric(source.attendance?.present) ?? 0
  const attendanceAbsent =
    parseNumeric(attendanceRecord?.attendance?.absent) ?? parseNumeric(source.attendance?.absent) ?? 0
  const attendanceTotal =
    parseNumeric(attendanceRecord?.attendance?.total) ?? parseNumeric(source.attendance?.total) ?? 0

  const normalizedAttendance = {
    present: Math.max(0, Math.round(attendancePresent)),
    absent: Math.max(0, Math.round(attendanceAbsent)),
    total: Math.max(0, Math.round(attendanceTotal)),
  }
  const inferredTotal =
    normalizedAttendance.total > 0
      ? normalizedAttendance.total
      : normalizedAttendance.present + normalizedAttendance.absent
  const attendanceStats = {
    present: normalizedAttendance.present,
    absent: normalizedAttendance.absent,
    total: inferredTotal,
  }
  const attendancePercentage = inferredTotal > 0 ? Math.round((attendanceStats.present / inferredTotal) * 100) : 0

  const affectiveRatings = normalizeDomainRatings(behavioralRecord?.affectiveDomain, source.affectiveDomain ?? {})
  const psychomotorRatings = normalizeDomainRatings(
    behavioralRecord?.psychomotorDomain,
    source.psychomotorDomain ?? {},
  )

  const resolvedBranding = {
    schoolName: source.branding?.schoolName?.trim() || defaultBranding.schoolName,
    address: source.branding?.address?.trim() || defaultBranding.schoolAddress,
    logo: source.branding?.logo ?? defaultBranding.logoUrl ?? null,
    signature: source.branding?.signature ?? defaultBranding.signatureUrl ?? null,
    headmasterName: source.branding?.headmasterName?.trim() || defaultBranding.headmasterName,
    defaultRemark: source.branding?.defaultRemark?.trim() || defaultBranding.defaultRemark,
  }

  const termInfo = {
    numberInClass,
    vacationEnds: source.termInfo?.vacationEnds ?? source.vacationDate ?? attendanceRecord?.termInfo?.vacationEnds,
    nextTermBegins:
      source.termInfo?.nextTermBegins ?? source.resumptionDate ?? attendanceRecord?.termInfo?.nextTermBegins,
    nextTermFees: source.termInfo?.nextTermFees ?? source.fees?.nextTerm ?? attendanceRecord?.termInfo?.nextTermFees,
    feesBalance: source.termInfo?.feesBalance ?? source.fees?.outstanding ?? attendanceRecord?.termInfo?.feesBalance,
  }

  return {
    student: {
      id: String(studentId),
      name: source.student.name,
      admissionNumber: source.student.admissionNumber,
      class: source.student.class,
      term: termLabel,
      session: sessionLabel,
      numberInClass,
      statusLabel: formatStatusLabel(attendanceRecord?.status ?? source.student.status),
      positionLabel,
    },
    subjects: normalizedSubjects,
    summary: {
      totalMarksObtainable: summaryTotalObtainable,
      totalMarksObtained: summaryTotalObtained,
      averageScore: summaryAverageScore,
      positionLabel,
      numberOfStudents: numberInClass,
      classAverage: source.summary?.classAverage,
      highestScore: source.summary?.highestScore,
      lowestScore: source.summary?.lowestScore,
      grade: source.summary?.grade ?? deriveGradeFromScore(summaryAverageScore),
    },
    attendance: {
      present: attendanceStats.present,
      absent: attendanceStats.absent,
      total: inferredTotal,
      percentage: attendancePercentage,
    },
    affectiveDomain: affectiveRatings,
    psychomotorDomain: psychomotorRatings,
    remarks: {
      classTeacher:
        remarkRecord?.remark?.trim() ??
        source.classTeacherRemarks?.trim() ??
        source.remarks?.classTeacher?.trim() ??
        "",
      headTeacher: source.remarks?.headTeacher?.trim() || resolvedBranding.defaultRemark,
    },
    termInfo,
    branding: resolvedBranding,
  }
}

const getBehavioralMark = (ratings: Record<string, string>, traitKey: string, target: string) => {
  const rating = normalizeBehavioralRating(ratings[traitKey])
  if (!rating) {
    return "○"
  }

  if (rating === target) {
    return "●"
  }

  if (rating === "poor" && target === "poor") {
    return "●"
  }

  return "○"
}

export function EnhancedReportCard({ data }: { data?: RawReportCardData }) {
  const branding = useBranding()
  const [reportCardData, setReportCardData] = useState<NormalizedReportCard | null>(() =>
    normalizeReportCard(data, branding),
  )
  const [studentPhoto, setStudentPhoto] = useState<string>("")

  useEffect(() => {
    const updateData = () => {
      setReportCardData(normalizeReportCard(data, branding))
    }

    updateData()

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || !STORAGE_KEYS_TO_WATCH.includes(event.key)) {
        return
      }
      updateData()
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [data, branding])

  useEffect(() => {
    if (!reportCardData?.student.id) {
      return
    }

    try {
      const storedPhotos = safeStorage.getItem("studentPhotos")
      if (!storedPhotos) {
        setStudentPhoto("")
        return
      }
      const parsed = JSON.parse(storedPhotos) as Record<string, string>
      setStudentPhoto(parsed[reportCardData.student.id] ?? "")
    } catch (error) {
      setStudentPhoto("")
    }
  }, [reportCardData?.student.id])

  const handlePrint = () => window.print()
  const handleDownload = () => alert("Report card downloaded as PDF")

  const summaryItems = useMemo(() => {
    if (!reportCardData) {
      return []
    }

    return [
      {
        label: "Total Marks Obtainable",
        value: reportCardData.summary.totalMarksObtainable.toLocaleString(),
      },
      {
        label: "Total Marks Obtained",
        value: reportCardData.summary.totalMarksObtained.toLocaleString(),
      },
      {
        label: "Average Score",
        value: `${reportCardData.summary.averageScore.toFixed(1)}%`,
      },
      {
        label: "Class Position",
        value: reportCardData.summary.positionLabel,
        helper:
          reportCardData.student.numberInClass && reportCardData.student.numberInClass > 0
            ? `of ${reportCardData.student.numberInClass}`
            : undefined,
      },
    ]
  }, [reportCardData])

  if (!reportCardData) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8">
        <Card className="border-2 border-gray-300">
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <h3 className="text-lg font-semibold mb-2">No Report Card Data Available</h3>
              <p>Please select a student to view their report card.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto bg-white">
      <div className="flex gap-2 mb-4 print:hidden">
        <Button onClick={handlePrint} className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
          <Print className="h-4 w-4 mr-2" />
          Print Report Card
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d] hover:text-white bg-transparent"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div className="border-8 border-[#2d682d] print:border-black bg-white print:shadow-none">
        <div className="px-6 pt-6 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="w-24 h-24 border-2 border-[#2d682d] print:border-black flex items-center justify-center bg-white">
              {reportCardData.branding.logo ? (
                <img
                  src={reportCardData.branding.logo}
                  alt={`${reportCardData.branding.schoolName} logo`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-[10px] text-[#2d682d] print:text-gray-600 text-center font-bold leading-tight">
                  SCHOOL
                  <br />
                  LOGO
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:px-4">
              <h1 className="text-3xl font-bold text-[#2d682d] print:text-black mb-2 uppercase tracking-wide font-serif">
                {reportCardData.branding.schoolName}
              </h1>
              <p className="text-sm text-[#2d682d]/80 print:text-black mb-2 font-medium">
                {reportCardData.branding.address}
              </p>
              <div className="bg-[#b29032] print:bg-gray-200 inline-block px-6 py-2 border-2 border-[#2d682d] print:border-black">
                <p className="text-base font-bold text-white print:text-black uppercase tracking-wider">Terminal Report Sheet</p>
              </div>
            </div>

            <div className="w-24 h-28 border-2 border-[#2d682d] print:border-black flex items-center justify-center bg-white">
              {studentPhoto ? (
                <img src={studentPhoto} alt="Student" className="w-full h-full object-cover p-1" />
              ) : (
                <div className="text-xs text-[#2d682d] print:text-gray-600 text-center font-bold">
                  STUDENT
                  <br />
                  PHOTO
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <table className="w-full border-2 border-[#2d682d] print:border-black text-sm">
            <tbody>
              <tr>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Name of Student
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.name}
                </td>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Admission Number
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.admissionNumber}
                </td>
              </tr>
              <tr>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Term
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.term}
                </td>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Session
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.session}
                </td>
              </tr>
              <tr>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Class
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.class}
                </td>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Number in Class
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-medium">
                  {reportCardData.student.numberInClass ?? "N/A"}
                </td>
              </tr>
              <tr>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Status
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-semibold text-[#b29032] print:text-black">
                  {reportCardData.student.statusLabel ?? "Awaiting Update"}
                </td>
                <td className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold uppercase text-[#2d682d] print:text-black border border-[#2d682d] print:border-black px-3 py-2">
                  Position
                </td>
                <td className="border border-[#2d682d] print:border-black px-3 py-2 font-semibold text-[#b29032] print:text-black">
                  {reportCardData.summary.positionLabel}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="border-2 border-[#2d682d] print:border-black bg-[#2d682d]/5 print:bg-gray-100 px-4 py-3 text-center"
              >
                <p className="text-xs uppercase tracking-wide text-[#2d682d] print:text-black font-semibold">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-[#b29032] print:text-black">
                  {item.value}
                </p>
                {item.helper ? (
                  <p className="text-[11px] text-[#2d682d] print:text-gray-600">{item.helper}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-2 border-[#2d682d] print:border-black">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2d682d] print:bg-gray-300 text-white print:text-black">
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-left">Subject</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">1st C.A.</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">2nd C.A.</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">Assignment</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">Total C.A.</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">Exam</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">Total</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-center">Grade</th>
                  <th className="border border-[#2d682d] print:border-black px-3 py-2 text-left">Teacher's Remark</th>
                </tr>
              </thead>
              <tbody>
                {reportCardData.subjects.map((subject, index) => (
                  <tr key={`${subject.name}-${index}`} className="odd:bg-white even:bg-[#2d682d]/5 print:even:bg-gray-100">
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 font-semibold text-left">
                      {subject.name}
                    </td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">{subject.ca1}</td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">{subject.ca2}</td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                      {subject.assignment}
                    </td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center font-semibold">
                      {subject.caTotal}
                    </td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">{subject.exam}</td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center font-bold text-[#b29032] print:text-black">
                      {subject.total}
                    </td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center font-bold">
                      {subject.grade}
                    </td>
                    <td className="border border-[#2d682d] print:border-black px-3 py-2 text-left text-xs">
                      {subject.remarks}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#2d682d]/10 print:bg-gray-100 font-semibold text-[#2d682d] print:text-black">
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center uppercase">Totals</td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                    {reportCardData.subjects.reduce((sum, subject) => sum + subject.ca1, 0)}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                    {reportCardData.subjects.reduce((sum, subject) => sum + subject.ca2, 0)}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                    {reportCardData.subjects.reduce((sum, subject) => sum + subject.assignment, 0)}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                    {reportCardData.subjects.reduce((sum, subject) => sum + subject.caTotal, 0)}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">
                    {reportCardData.subjects.reduce((sum, subject) => sum + subject.exam, 0)}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center text-[#b29032] print:text-black">
                    {reportCardData.summary.totalMarksObtained}
                  </td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">-</td>
                  <td className="border border-[#2d682d] print:border-black px-3 py-2 text-center">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="border-2 border-[#2d682d] print:border-black">
                <div className="bg-[#2d682d]/10 print:bg-gray-100 px-4 py-2 border-b-2 border-[#2d682d] print:border-black">
                  <h3 className="text-sm font-semibold text-[#2d682d] print:text-black uppercase">Class Teacher's Remark</h3>
                </div>
                <div className="px-4 py-3 min-h-[100px] text-sm leading-relaxed">
                  {reportCardData.remarks.classTeacher || "No remark provided"}
                </div>
              </div>

              <div className="border-2 border-[#2d682d] print:border-black">
                <div className="bg-[#2d682d]/10 print:bg-gray-100 px-4 py-2 border-b-2 border-[#2d682d] print:border-black">
                  <h3 className="text-sm font-semibold text-[#2d682d] print:text-black uppercase">Head Teacher's Remark</h3>
                </div>
                <div className="px-4 py-3 min-h-[80px] text-sm italic leading-relaxed text-[#2d682d] print:text-black">
                  {reportCardData.remarks.headTeacher}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-dashed border-[#2d682d] print:border-black px-3 py-2 text-sm">
                  <span className="font-semibold text-[#2d682d] print:text-black">Vacation Date:</span>
                  <span className="ml-2 text-gray-700 print:text-black">
                    {reportCardData.termInfo.vacationEnds || "________________"}
                  </span>
                </div>
                <div className="border border-dashed border-[#2d682d] print:border-black px-3 py-2 text-sm">
                  <span className="font-semibold text-[#2d682d] print:text-black">Next Term Begins:</span>
                  <span className="ml-2 text-gray-700 print:text-black">
                    {reportCardData.termInfo.nextTermBegins || "________________"}
                  </span>
                </div>
                <div className="border border-dashed border-[#2d682d] print:border-black px-3 py-2 text-sm">
                  <span className="font-semibold text-[#2d682d] print:text-black">Next Term Fees:</span>
                  <span className="ml-2 text-gray-700 print:text-black">
                    {reportCardData.termInfo.nextTermFees || "________________"}
                  </span>
                </div>
                <div className="border border-dashed border-[#2d682d] print:border-black px-3 py-2 text-sm">
                  <span className="font-semibold text-[#2d682d] print:text-black">Outstanding Fees:</span>
                  <span className="ml-2 text-gray-700 print:text-black">
                    {reportCardData.termInfo.feesBalance || "________________"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-[#2d682d] print:border-black">
                <div className="bg-[#2d682d] print:bg-gray-300 text-white print:text-black px-3 py-2 font-semibold text-sm text-center">
                  Affective Domain
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#2d682d]/10 print:bg-gray-100 text-[#2d682d] print:text-black">
                      <th className="border border-[#2d682d] print:border-black px-2 py-1 text-left">Traits</th>
                      {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                        <th
                          key={`affective-header-${column.key}`}
                          className="border border-[#2d682d] print:border-black px-2 py-1 text-center"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AFFECTIVE_TRAITS.map((trait) => (
                      <tr key={`affective-${trait.key}`}>
                        <td className="border border-[#2d682d] print:border-black px-2 py-1 font-medium text-left">
                          {trait.label}
                        </td>
                        {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                          <td
                            key={`${trait.key}-${column.key}`}
                            className="border border-[#2d682d] print:border-black px-2 py-1 text-center text-[#b29032] print:text-black"
                          >
                            {getBehavioralMark(reportCardData.affectiveDomain, trait.key, column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-2 border-[#2d682d] print:border-black">
                <div className="bg-[#2d682d] print:bg-gray-300 text-white print:text-black px-3 py-2 font-semibold text-sm text-center">
                  Psychomotor Domain
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#2d682d]/10 print:bg-gray-100 text-[#2d682d] print:text-black">
                      <th className="border border-[#2d682d] print:border-black px-2 py-1 text-left">Skills</th>
                      {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                        <th
                          key={`psychomotor-header-${column.key}`}
                          className="border border-[#2d682d] print:border-black px-2 py-1 text-center"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PSYCHOMOTOR_SKILLS.map((skill) => (
                      <tr key={`psychomotor-${skill.key}`}>
                        <td className="border border-[#2d682d] print:border-black px-2 py-1 font-medium text-left">
                          {skill.label}
                        </td>
                        {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                          <td
                            key={`${skill.key}-${column.key}`}
                            className="border border-[#2d682d] print:border-black px-2 py-1 text-center text-[#b29032] print:text-black"
                          >
                            {getBehavioralMark(reportCardData.psychomotorDomain, skill.key, column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-2 border-[#2d682d] print:border-black">
                <div className="bg-[#2d682d]/10 print:bg-gray-100 px-3 py-2 font-semibold text-sm text-[#2d682d] print:text-black">
                  Attendance Summary
                </div>
                <div className="px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">Times Present:</span>
                    <span>{reportCardData.attendance.present}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Times Absent:</span>
                    <span>{reportCardData.attendance.absent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Times School Opened:</span>
                    <span>{reportCardData.attendance.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Attendance %:</span>
                    <span>{reportCardData.attendance.percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="border border-dashed border-[#2d682d] print:border-black px-3 py-2 text-xs text-[#2d682d] print:text-black">
                <p className="font-semibold uppercase mb-1">Key to Ratings</p>
                <p>Excellent • Very Good • Good • Fair • Needs Improvement</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between mt-6 gap-6">
            <div className="text-center md:text-left">
              <div className="border-b-2 border-dashed border-[#2d682d] print:border-black w-48 h-10 mb-2"></div>
              <p className="text-sm font-bold text-[#2d682d] print:text-black">Class Teacher's Signature</p>
            </div>
            <div className="text-center md:text-right">
              {reportCardData.branding.signature ? (
                <img
                  src={reportCardData.branding.signature}
                  alt={`${reportCardData.branding.headmasterName} signature`}
                  className="h-16 w-48 object-contain mb-1 md:ml-auto"
                />
              ) : (
                <div className="border-b-2 border-dashed border-[#2d682d] print:border-black w-48 h-10 mb-1 md:ml-auto"></div>
              )}
              <p className="text-sm font-bold text-[#2d682d] print:text-black">
                {reportCardData.branding.headmasterName}
              </p>
              <p className="text-xs font-semibold text-[#2d682d] print:text-black uppercase tracking-wide">Head Teacher</p>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-[#2d682d] print:text-gray-600 font-medium">
              © {reportCardData.branding.schoolName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
