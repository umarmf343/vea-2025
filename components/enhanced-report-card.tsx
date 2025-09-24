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
  position?: string
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
    dateOfBirth?: string
    gender?: string
    age?: number
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
    educationZone: string
    councilArea: string
    contactPhone: string
    contactEmail: string
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
  "studentPhotos",
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

const calculateAge = (value?: string) => {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  const today = new Date()
  let age = today.getFullYear() - parsed.getFullYear()
  const hasNotHadBirthdayThisYear =
    today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())

  if (hasNotHadBirthdayThisYear) {
    age -= 1
  }

  if (age < 0 || age > 150) {
    return undefined
  }

  return age
}

const formatDateDisplay = (value?: string) => {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const BEHAVIORAL_LABELS: Record<string, string> = {
  excel: "Excellent",
  vgood: "Very Good",
  good: "Good",
  fair: "Fair",
  poor: "Needs Improvement",
}

const formatBehavioralLabel = (value?: string) => {
  const normalized = normalizeBehavioralRating(value)
  if (!normalized) {
    return "Not Recorded"
  }

  return BEHAVIORAL_LABELS[normalized] ?? normalized
}

const GRADING_SCALE = [
  { grade: "A", range: "80 - 100%", meaning: "Distinction" },
  { grade: "B", range: "70 - 79%", meaning: "Excellent" },
  { grade: "C", range: "60 - 69%", meaning: "Very Good" },
  { grade: "D", range: "50 - 59%", meaning: "Good" },
  { grade: "E", range: "40 - 49%", meaning: "Pass" },
  { grade: "F", range: "0 - 39%", meaning: "Needs Improvement" },
] as const

const PRIMARY_AFFECTIVE_TRAITS = [
  { key: "neatness", label: "Neatness" },
  { key: "honesty", label: "Honesty" },
  { key: "punctuality", label: "Punctuality" },
] as const

const PRIMARY_PSYCHOMOTOR_SKILLS = [
  { key: "gamesSports", label: "Sport" },
  { key: "handwriting", label: "Handwriting" },
] as const

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
    const rawPosition = parsePositionValue(
      subject.position ?? subject.subjectPosition ?? subject.rank ?? subject.order ?? null,
    )
    const positionLabel = rawPosition ? formatOrdinal(rawPosition) : undefined

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
      position:
        positionLabel ??
        (typeof subject.position === "string" && subject.position.trim().length > 0
          ? subject.position
          : undefined),
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
    educationZone: source.branding?.educationZone?.trim() || defaultBranding.educationZone,
    councilArea: source.branding?.councilArea?.trim() || defaultBranding.councilArea,
    contactPhone: source.branding?.contactPhone?.trim() || defaultBranding.contactPhone,
    contactEmail: source.branding?.contactEmail?.trim() || defaultBranding.contactEmail,
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
      dateOfBirth: source.student.dateOfBirth ?? undefined,
      gender: source.student.gender ?? undefined,
      age: calculateAge(source.student.dateOfBirth),
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

    const items = [
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
      {
        label: "Overall Grade",
        value: reportCardData.summary.grade ?? "—",
      },
    ] as Array<{ label: string; value: string; helper?: string }>

    return items
  }, [reportCardData])

  const totalsRow = useMemo(() => {
    if (!reportCardData) {
      return null
    }

    return reportCardData.subjects.reduce(
      (acc, subject) => {
        acc.ca1 += subject.ca1
        acc.ca2 += subject.ca2
        acc.assignment += subject.assignment
        acc.caTotal += subject.caTotal
        acc.exam += subject.exam
        acc.total += subject.total
        return acc
      },
      { ca1: 0, ca2: 0, assignment: 0, caTotal: 0, exam: 0, total: 0 },
    )
  }, [reportCardData])

  const classSummaryItems = useMemo(() => {
    if (!reportCardData) {
      return []
    }

    const items: Array<{ label: string; value: string }> = [
      {
        label: "Number in Class",
        value: reportCardData.student.numberInClass
          ? reportCardData.student.numberInClass.toString()
          : "—",
      },
      {
        label: "Class Average",
        value:
          typeof reportCardData.summary.classAverage === "number"
            ? `${reportCardData.summary.classAverage.toFixed(1)}%`
            : "—",
      },
      {
        label: "Highest Score",
        value:
          typeof reportCardData.summary.highestScore === "number"
            ? reportCardData.summary.highestScore.toLocaleString()
            : "—",
      },
      {
        label: "Lowest Score",
        value:
          typeof reportCardData.summary.lowestScore === "number"
            ? reportCardData.summary.lowestScore.toLocaleString()
            : "—",
      },
      {
        label: "Student Status",
        value: reportCardData.student.statusLabel ?? "Active",
      },
    ]

    return items
  }, [reportCardData])

  const affectiveTraits = useMemo(() => {
    const seen = new Set<string>()
    return [...PRIMARY_AFFECTIVE_TRAITS, ...AFFECTIVE_TRAITS].filter((trait) => {
      if (seen.has(trait.key)) {
        return false
      }
      seen.add(trait.key)
      return true
    })
  }, [])

  const psychomotorSkills = useMemo(() => {
    const seen = new Set<string>()
    return [...PRIMARY_PSYCHOMOTOR_SKILLS, ...PSYCHOMOTOR_SKILLS].filter((skill) => {
      if (seen.has(skill.key)) {
        return false
      }
      seen.add(skill.key)
      return true
    })
  }, [])

  const learnerDetails = useMemo(() => {
    if (!reportCardData) {
      return []
    }

    const details: Array<{ label: string; value: string; helper?: string }> = [
      {
        label: "Student Name",
        value: reportCardData.student.name,
      },
      {
        label: "Admission Number",
        value: reportCardData.student.admissionNumber || "—",
      },
      {
        label: "Class",
        value: reportCardData.student.class || "—",
      },
      {
        label: "Term",
        value: reportCardData.student.term || "—",
      },
      {
        label: "Session",
        value: reportCardData.student.session || "—",
      },
      {
        label: "Gender",
        value: reportCardData.student.gender ?? "—",
      },
      {
        label: "Date of Birth",
        value: formatDateDisplay(reportCardData.student.dateOfBirth) ?? "—",
      },
      {
        label: "Age",
        value:
          reportCardData.student.age !== undefined ? `${reportCardData.student.age} years` : "—",
      },
      {
        label: "Overall Position",
        value: reportCardData.summary.positionLabel || "—",
        helper:
          reportCardData.student.numberInClass && reportCardData.student.numberInClass > 0
            ? `of ${reportCardData.student.numberInClass}`
            : undefined,
      },
      {
        label: "Number in Class",
        value: reportCardData.student.numberInClass
          ? reportCardData.student.numberInClass.toString()
          : "—",
      },
      {
        label: "Student Status",
        value: reportCardData.student.statusLabel ?? "Active",
      },
    ]

    return details
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
    <div className="max-w-6xl mx-auto py-6 print:py-0">
      <div className="mb-4 flex justify-end gap-3 print:hidden">
        <Button
          onClick={handlePrint}
          className="bg-emerald-700 text-white shadow-md hover:bg-emerald-800"
        >
          <Print className="mr-2 h-4 w-4" />
          Print Report Card
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl print:rounded-none print:border-black print:shadow-none">
        <header className="border-b border-slate-300 bg-slate-50 px-8 py-6 print:bg-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-300 bg-white">
                {reportCardData.branding.logo ? (
                  <img
                    src={reportCardData.branding.logo}
                    alt={`${reportCardData.branding.schoolName} logo`}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                    School
                    <br />
                    Logo
                  </div>
                )}
              </div>
              <div className="flex-1 text-center lg:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-600">
                  Official Report Card
                </p>
                <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.25em] text-slate-900">
                  {reportCardData.branding.schoolName}
                </h1>
                {reportCardData.branding.address ? (
                  <p className="text-sm text-slate-700">{reportCardData.branding.address}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.25em] text-slate-600 lg:justify-start">
                  {reportCardData.branding.educationZone ? (
                    <span>Education Zone: {reportCardData.branding.educationZone}</span>
                  ) : null}
                  {reportCardData.branding.councilArea ? (
                    <span>L.G.A: {reportCardData.branding.councilArea}</span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap justify-center gap-3 text-[11px] text-slate-600 lg:justify-start">
                  {reportCardData.branding.contactPhone ? (
                    <span>Tel: {reportCardData.branding.contactPhone}</span>
                  ) : null}
                  {reportCardData.branding.contactEmail ? (
                    <span>Email: {reportCardData.branding.contactEmail}</span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.35em] text-slate-800">
                  {reportCardData.student.term} • {reportCardData.student.session} Academic Session
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-slate-300 bg-white">
                {studentPhoto ? (
                  <img
                    src={studentPhoto}
                    alt={`${reportCardData.student.name} passport`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                    Passport
                  </div>
                )}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600">
                Student Passport
              </p>
            </div>
          </div>
        </header>

        <section className="border-b border-slate-200 px-8 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">Learner Information</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
            {learnerDetails.map((detail) => (
              <div key={detail.label} className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">{detail.label}</p>
                <div className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-800">
                  {detail.value}
                </div>
                {detail.helper ? (
                  <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-slate-500">
                    {detail.helper}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 px-8 py-5">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-300">
              <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                Performance Summary
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {summaryItems.map((item) => (
                    <tr key={item.label} className="border-b border-slate-200 last:border-b-0">
                      <th className="w-1/2 bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                        {item.label}
                      </th>
                      <td className="px-4 py-2 font-semibold text-slate-800">
                        {item.value}
                        {item.helper ? (
                          <span className="ml-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                            {item.helper}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-300">
                <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                  Attendance Record
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                        Days Present
                      </th>
                      <td className="px-4 py-2 font-semibold text-slate-800">{reportCardData.attendance.present}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                        Days Absent
                      </th>
                      <td className="px-4 py-2 font-semibold text-slate-800">{reportCardData.attendance.absent}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                        Total Days
                      </th>
                      <td className="px-4 py-2 font-semibold text-slate-800">{reportCardData.attendance.total}</td>
                    </tr>
                    <tr>
                      <th className="bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                        Attendance %
                      </th>
                      <td className="px-4 py-2 font-semibold text-slate-800">{reportCardData.attendance.percentage}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-300">
                <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                  Class Overview
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {classSummaryItems.map((item) => (
                      <tr key={item.label} className="border-b border-slate-200 last:border-b-0">
                        <th className="bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.25em] text-slate-600">
                          {item.label}
                        </th>
                        <td className="px-4 py-2 font-semibold text-slate-800">{item.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 px-8 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">
            Academic Performance
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border border-slate-400 text-xs md:text-sm">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.2em] text-slate-700">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-left">Subjects</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">1st C.A. (10)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">2nd C.A. (10)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Assignments (20)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">C.A. Total (40)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Exam (60)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Grand Total (100)</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Grade</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Subject Position</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">Teacher&apos;s Remark</th>
                </tr>
              </thead>
              <tbody>
                {reportCardData.subjects.length > 0 ? (
                  reportCardData.subjects.map((subject, index) => (
                    <tr key={`${subject.name}-${index}`} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900">{subject.name}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-medium text-slate-800">{subject.ca1}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-medium text-slate-800">{subject.ca2}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-medium text-slate-800">{subject.assignment}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-900">{subject.caTotal}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-medium text-slate-800">{subject.exam}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-900">{subject.total}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">
                        {subject.grade || deriveGradeFromScore(subject.total)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800">
                        {subject.position ?? "—"}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-left text-xs text-slate-700">
                        {subject.remarks || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="border border-slate-300 px-3 py-4 text-center text-sm text-slate-600">
                      No subject scores have been recorded for this student.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold text-slate-900">
                  <td className="border border-slate-300 px-3 py-2 text-center uppercase tracking-[0.2em]">Totals</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.ca1 ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.ca2 ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.assignment ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.caTotal ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.exam ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalsRow?.total ?? "—"}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">—</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">—</td>
                  <td className="border border-slate-300 px-3 py-2">&nbsp;</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Continuous assessments contribute 40% of the total score (First & Second C.A plus Assignments), while examinations account for 60%.
          </p>
        </section>

        <section className="border-b border-slate-200 px-8 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">
            Whole Child Development
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-300">
              <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                Affective (Behavioural) Domain
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-slate-700">
                  <thead className="bg-slate-50 uppercase tracking-[0.25em] text-slate-600">
                    <tr>
                      <th className="border border-slate-300 px-3 py-2 text-left">Traits</th>
                      {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                        <th key={column.key} className="border border-slate-300 px-2 py-2 text-center">
                          {column.label}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-center">Recorded Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affectiveTraits.map((trait) => (
                      <tr key={trait.key} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{trait.label}</td>
                        {BEHAVIORAL_RATING_COLUMNS.map((option) => {
                          const mark = getBehavioralMark(reportCardData.affectiveDomain, trait.key, option.key)
                          return (
                            <td
                              key={`${trait.key}-${option.key}`}
                              className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700"
                            >
                              {mark}
                            </td>
                          )
                        })}
                        <td className="border border-slate-300 px-3 py-2 text-center font-medium text-emerald-700">
                          {formatBehavioralLabel(reportCardData.affectiveDomain[trait.key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-300">
              <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                Psychomotor Skills
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-slate-700">
                  <thead className="bg-slate-50 uppercase tracking-[0.25em] text-slate-600">
                    <tr>
                      <th className="border border-slate-300 px-3 py-2 text-left">Skills</th>
                      {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                        <th key={column.key} className="border border-slate-300 px-2 py-2 text-center">
                          {column.label}
                        </th>
                      ))}
                      <th className="border border-slate-300 px-3 py-2 text-center">Recorded Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {psychomotorSkills.map((skill) => (
                      <tr key={skill.key} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{skill.label}</td>
                        {BEHAVIORAL_RATING_COLUMNS.map((option) => {
                          const mark = getBehavioralMark(reportCardData.psychomotorDomain, skill.key, option.key)
                          return (
                            <td
                              key={`${skill.key}-${option.key}`}
                              className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700"
                            >
                              {mark}
                            </td>
                          )
                        })}
                        <td className="border border-slate-300 px-3 py-2 text-center font-medium text-emerald-700">
                          {formatBehavioralLabel(reportCardData.psychomotorDomain[skill.key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-[11px] text-slate-600">
            <span className="font-semibold uppercase tracking-[0.3em] text-slate-700">Rating Legend:</span>
            {BEHAVIORAL_RATING_COLUMNS.map((column) => (
              <span key={column.key} className="flex items-center gap-2 font-medium">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[9px] font-bold text-slate-700">
                  ●
                </span>
                {column.label}
              </span>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 px-8 py-5">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-300 bg-slate-50/40 px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                  Class Teacher&apos;s Remark
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-800">
                  {reportCardData.remarks.classTeacher || "Class teacher remark pending."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-slate-50/40 px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                  Head Teacher&apos;s Remark & Signature
                </h3>
                <p className="mt-3 text-sm italic text-slate-800">{reportCardData.remarks.headTeacher}</p>
                <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  {reportCardData.branding.signature ? (
                    <img
                      src={reportCardData.branding.signature}
                      alt={`${reportCardData.branding.headmasterName} signature`}
                      className="h-16 w-48 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-48 border-b-2 border-dashed border-slate-400"></div>
                  )}
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">
                      {reportCardData.branding.headmasterName}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-slate-500">
                      Head Teacher / Principal
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-300 px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">Term Information</h3>
                <dl className="mt-3 space-y-3 text-sm text-slate-800">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">Vacation Date</dt>
                    <dd>{formatDateDisplay(reportCardData.termInfo.vacationEnds) ?? "________________"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">Resumption Date</dt>
                    <dd>{formatDateDisplay(reportCardData.termInfo.nextTermBegins) ?? "________________"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">Next Term Fees</dt>
                    <dd>{reportCardData.termInfo.nextTermFees || "________________"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">Outstanding Fees</dt>
                    <dd>{reportCardData.termInfo.feesBalance || "________________"}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl border border-slate-300 px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                  Parent / Guardian Acknowledgement
                </h3>
                <div className="mt-6 space-y-6 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <div>
                    <div className="h-10 border-b border-slate-400"></div>
                    <p className="mt-2">Signature</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-slate-400"></div>
                    <p className="mt-2">Date</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-8 py-5">
          <div className="overflow-hidden rounded-2xl border border-slate-300">
            <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
              Grading Scale
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              {GRADING_SCALE.map((item) => (
                <div
                  key={item.grade}
                  className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-center"
                >
                  <span className="text-2xl font-black text-emerald-700">{item.grade}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600">{item.range}</span>
                  <span className="mt-1 text-xs text-slate-600">{item.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-300 bg-slate-50 px-8 py-4 text-center text-[11px] text-slate-600 print:bg-white">
          <p>
            Report generated for {reportCardData.student.name}. For enquiries, contact {reportCardData.branding.contactPhone ||
              reportCardData.branding.contactEmail || "the school"}.
          </p>
          <p className="mt-1">© {reportCardData.branding.schoolName}. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
