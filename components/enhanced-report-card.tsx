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

const pickBrandingField = (
  branding: RawReportCardData["branding"] | undefined,
  keys: readonly string[],
): string | undefined => {
  if (!branding) {
    return undefined
  }

  const record = branding as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim()
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

const AFFECTIVE_FOOTER_COLUMNS = [
  { key: "neatness", label: "Neatness" },
  { key: "honesty", label: "Honesty" },
  { key: "punctuality", label: "Punctuality" },
] as const

const PSYCHOMOTOR_FOOTER_COLUMNS = [
  { key: "gamesSports", label: "Sport" },
  { key: "handwriting", label: "Handwriting" },
] as const

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
    schoolName: pickBrandingField(source.branding, ["schoolName"]) ?? defaultBranding.schoolName,
    address:
      pickBrandingField(source.branding, ["address", "schoolAddress"]) ?? defaultBranding.schoolAddress,
    educationZone:
      pickBrandingField(source.branding, ["educationZone", "educationDistrict"]) ??
      defaultBranding.educationZone,
    councilArea:
      pickBrandingField(source.branding, ["councilArea", "lga", "localGovernmentArea"]) ??
      defaultBranding.councilArea,
    contactPhone:
      pickBrandingField(source.branding, ["contactPhone", "phone", "contactNumber"]) ??
      defaultBranding.contactPhone,
    contactEmail:
      pickBrandingField(source.branding, ["contactEmail", "email", "schoolEmail"]) ??
      defaultBranding.contactEmail,
    logo:
      pickBrandingField(source.branding, ["logo", "logoUrl", "logoURL", "schoolLogo"]) ??
      defaultBranding.logoUrl ??
      null,
    signature:
      pickBrandingField(source.branding, ["signature", "signatureUrl", "headmasterSignature", "principalSignature"]) ??
      defaultBranding.signatureUrl ??
      null,
    headmasterName:
      pickBrandingField(source.branding, ["headmasterName", "principalName", "proprietorName"]) ??
      defaultBranding.headmasterName,
    defaultRemark:
      pickBrandingField(source.branding, ["defaultRemark", "headTeacherRemark"]) ??
      defaultBranding.defaultRemark,
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

    if (typeof reportCardData.summary.classAverage === "number") {
      items.push({
        label: "Class Average",
        value: `${reportCardData.summary.classAverage.toFixed(1)}%`,
      })
    }

    if (typeof reportCardData.summary.highestScore === "number") {
      items.push({
        label: "Highest Score",
        value: reportCardData.summary.highestScore.toLocaleString(),
      })
    }

    if (typeof reportCardData.summary.lowestScore === "number") {
      items.push({
        label: "Lowest Score",
        value: reportCardData.summary.lowestScore.toLocaleString(),
      })
    }

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

  const additionalAffectiveTraits = useMemo(
    () =>
      AFFECTIVE_TRAITS.filter((trait) =>
        PRIMARY_AFFECTIVE_TRAITS.every((primary) => primary.key !== trait.key),
      ),
    [],
  )

  const additionalPsychomotorSkills = useMemo(
    () =>
      PSYCHOMOTOR_SKILLS.filter((skill) =>
        PRIMARY_PSYCHOMOTOR_SKILLS.every((primary) => primary.key !== skill.key),
      ),
    [],
  )

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
      <div className="flex justify-end gap-3 mb-4 print:hidden">
        <Button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30"
        >
          <Print className="h-4 w-4 mr-2" />
          Print Report Card
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white bg-white shadow-lg shadow-emerald-500/20"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-1 rounded-[32px] shadow-2xl print:bg-white print:p-0 print:rounded-none print:shadow-none">
        <div className="bg-white rounded-[28px] border border-emerald-200 overflow-hidden print:border-black print:rounded-none">
          <header className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 px-8 py-8 text-white print:bg-white print:px-6 print:py-6 print:text-emerald-900 print:border-b print:border-black">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/70 bg-white/90 shadow-inner print:border-emerald-800/70 print:bg-white">
                  {reportCardData.branding.logo ? (
                    <img
                      src={reportCardData.branding.logo}
                      alt={`${reportCardData.branding.schoolName} logo`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-700 print:text-emerald-900 leading-tight text-center">
                      School
                      <br />
                      Logo
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-black uppercase tracking-[0.35em] drop-shadow-md print:drop-shadow-none print:text-emerald-900">
                    {reportCardData.branding.schoolName}
                  </h1>
                  <p className="text-sm font-medium leading-relaxed text-white/90 print:text-emerald-900">
                    {reportCardData.branding.address}
                  </p>
                  <div className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80 print:text-emerald-800">
                    <span>Education Zone: {reportCardData.branding.educationZone}</span>
                    <span>Council Area: {reportCardData.branding.councilArea}</span>
                    <span>
                      Contact: {reportCardData.branding.contactPhone} • {reportCardData.branding.contactEmail}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/70 bg-white/90 shadow-inner print:border-emerald-800/70 print:bg-white">
                  {studentPhoto ? (
                    <img src={studentPhoto} alt="Student" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700 print:text-emerald-900 text-center">
                      Student
                      <br />
                      Photo
                    </div>
                  )}
                </div>
                <dl className="grid gap-1 text-right text-xs font-semibold text-white/85 print:text-emerald-900">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Term</dt>
                    <dd className="font-bold text-white print:text-emerald-900">{reportCardData.student.term}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Session</dt>
                    <dd className="font-bold text-white print:text-emerald-900">{reportCardData.student.session}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Class</dt>
                    <dd className="font-bold text-white print:text-emerald-900">{reportCardData.student.class}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Students</dt>
                    <dd className="font-bold text-white print:text-emerald-900">
                      {reportCardData.student.numberInClass ?? "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Position</dt>
                    <dd className="font-bold text-white print:text-emerald-900">
                      {reportCardData.summary.positionLabel || "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="uppercase tracking-[0.35em] text-white/60 print:text-emerald-700">Status</dt>
                    <dd className="font-bold text-white print:text-emerald-900">
                      {reportCardData.student.statusLabel ?? "Active"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 text-white/90 print:text-emerald-900 md:grid-cols-3 md:items-center">
              <div className="text-sm font-semibold uppercase tracking-[0.3em]">
                Admission No: {reportCardData.student.admissionNumber || "________________"}
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.45em] text-white/60 print:text-emerald-700">Student Name</p>
                <p className="text-2xl font-black uppercase tracking-[0.3em] text-white print:text-emerald-900">
                  {reportCardData.student.name}
                </p>
              </div>
              <div className="text-sm text-right font-semibold uppercase tracking-[0.3em]">
                Overall Position: {reportCardData.summary.positionLabel || "—"}
              </div>
            </div>
          </header>

          <main className="px-8 py-8 space-y-10 print:px-6 print:py-6">
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-center shadow-sm print:bg-white print:border-black"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700">{item.label}</p>
                    <p className="mt-2 text-lg font-bold text-emerald-900">{item.value}</p>
                    {item.helper ? <p className="text-xs font-medium text-emerald-600">{item.helper}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[3fr_1.2fr]">
              <div className="rounded-3xl border border-emerald-200 shadow-lg print:border-black print:shadow-none">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white print:bg-gray-200 print:text-emerald-900">
                  Academic Performance Overview
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-emerald-600 text-white print:bg-gray-200 print:text-emerald-900">
                        <th className="px-3 py-3 text-left uppercase tracking-wide">Subject</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">1st C.A. (10)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">2nd C.A. (10)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Notes &amp; Assignments (20)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Total (40)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Exam (60)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Grand Total (100)</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Grade</th>
                        <th className="px-3 py-3 text-center uppercase tracking-wide">Subject Position</th>
                        <th className="px-3 py-3 text-left uppercase tracking-wide">Teacher's Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                                            {reportCardData.subjects.map((subject, index) => (
                        <tr
                          key={`${subject.name}-${index}`}
                          className={index % 2 === 0 ? "bg-white" : "bg-emerald-50/60 print:bg-gray-100"}
                        >
                          <td className="border border-emerald-200 px-3 py-3 text-left font-semibold text-emerald-900 print:border-black">
                            {subject.name}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-medium text-emerald-800 print:border-black">
                            {subject.ca1}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-medium text-emerald-800 print:border-black">
                            {subject.ca2}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-medium text-emerald-800 print:border-black">
                            {subject.assignment}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-semibold text-emerald-900 print:border-black">
                            {subject.caTotal}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-medium text-emerald-800 print:border-black">
                            {subject.exam}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-bold text-emerald-900 print:border-black">
                            {subject.total}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-bold text-teal-600 print:text-black print:border-black">
                            {subject.grade || deriveGradeFromScore(subject.total)}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-center font-semibold text-emerald-800 print:border-black">
                            {subject.position ?? "—"}
                          </td>
                          <td className="border border-emerald-200 px-3 py-3 text-left text-xs text-emerald-700 print:border-black">
                            {subject.remarks || "—"}
                          </td>
                        </tr>
                      ))}

                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-600/10 text-emerald-900 font-semibold print:bg-gray-100">
                        <td className="border border-emerald-200 px-3 py-3 text-center uppercase tracking-wide print:border-black">
                          Totals
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.ca1 ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.ca2 ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.assignment ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.caTotal ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.exam ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">
                          {totalsRow?.total ?? "—"}
                        </td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">—</td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">—</td>
                        <td className="border border-emerald-200 px-3 py-3 text-center print:border-black">&nbsp;</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="px-6 pb-6 pt-3 text-xs italic text-emerald-800/90 print:text-emerald-900">
                  Continuous assessments contribute 40% of the final score (1st C.A. 10%, 2nd C.A. 10%, Notes &amp; Assignments 20%), while examinations account for the remaining 60%.
                </p>
              </div>
              <aside className="space-y-5">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm print:bg-white print:border-emerald-200">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-800 text-center">Class Metrics</h3>
                  <div className="mt-4 space-y-3 text-sm text-emerald-900">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Students</span>
                      <span className="font-semibold">{reportCardData.student.numberInClass ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Subjects</span>
                      <span className="font-semibold">{reportCardData.subjects.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Class Position</span>
                      <span className="font-semibold">{reportCardData.summary.positionLabel || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Average Score</span>
                      <span className="font-semibold">{reportCardData.summary.averageScore.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Overall Grade</span>
                      <span className="font-semibold">{reportCardData.summary.grade ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">Status</span>
                      <span className="font-semibold">{reportCardData.student.statusLabel ?? "Active"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm print:border-emerald-200">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-800 text-center">Attendance Summary</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-emerald-900">
                    <div className="rounded-2xl bg-emerald-50/70 px-4 py-3 text-center shadow-inner print:bg-white">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Present</p>
                      <p className="text-lg font-bold">{reportCardData.attendance.present}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50/70 px-4 py-3 text-center shadow-inner print:bg-white">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Absent</p>
                      <p className="text-lg font-bold">{reportCardData.attendance.absent}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50/70 px-4 py-3 text-center shadow-inner print:bg-white">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Total</p>
                      <p className="text-lg font-bold">{reportCardData.attendance.total}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50/70 px-4 py-3 text-center shadow-inner print:bg-white">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Attendance %</p>
                      <p className="text-lg font-bold">{reportCardData.attendance.percentage}%</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm print:border-emerald-200">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-800 text-center">Term Information</h3>
                  <div className="mt-4 space-y-3 text-sm text-emerald-900">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Vacation Date</span>
                      <span>{reportCardData.termInfo.vacationEnds || "________________"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Resumption Date</span>
                      <span>{reportCardData.termInfo.nextTermBegins || "________________"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Next Term Fees</span>
                      <span>{reportCardData.termInfo.nextTermFees || "________________"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-700">Outstanding Fees</span>
                      <span>{reportCardData.termInfo.feesBalance || "________________"}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </section>
            <section className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-emerald-200 bg-white shadow-sm print:border-emerald-200">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white text-center print:bg-gray-200 print:text-emerald-900">
                    Affective Domain
                  </div>
                  <div className="space-y-5 p-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      {PRIMARY_AFFECTIVE_TRAITS.map((trait) => {
                        const ratingLabel = formatBehavioralLabel(reportCardData.affectiveDomain[trait.key])
                        return (
                          <div
                            key={trait.key}
                            className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-center shadow-inner print:bg-white print:border-emerald-200"
                          >
                            <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-700">{trait.label}</p>
                            <div className="mt-3 flex items-center justify-center gap-2">
                              {BEHAVIORAL_RATING_COLUMNS.map((option) => {
                                const mark = getBehavioralMark(reportCardData.affectiveDomain, trait.key, option.key)
                                const isActive = mark === "●"
                                return (
                                  <span
                                    key={`${trait.key}-${option.key}`}
                                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                                      isActive
                                        ? "border-emerald-600 bg-emerald-500 text-white"
                                        : "border-emerald-300 text-emerald-500"
                                    }`}
                                  >
                                    {mark}
                                  </span>
                                )
                              })}
                            </div>
                            <p className="mt-3 text-xs font-semibold text-emerald-800">{ratingLabel}</p>
                          </div>
                        )
                      })}
                    </div>
                    {additionalAffectiveTraits.length > 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4 print:border-emerald-200">
                        <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-600">Additional Traits</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {additionalAffectiveTraits.map((trait) => (
                            <div key={trait.key} className="flex items-center justify-between text-sm text-emerald-800">
                              <span className="font-medium">{trait.label}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                                {formatBehavioralLabel(reportCardData.affectiveDomain[trait.key])}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-white shadow-sm print:border-emerald-200">
                  <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 px-5 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white text-center print:bg-gray-200 print:text-emerald-900">
                    Psychomotor Domain
                  </div>
                  <div className="space-y-5 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      {PRIMARY_PSYCHOMOTOR_SKILLS.map((skill) => {
                        const ratingLabel = formatBehavioralLabel(reportCardData.psychomotorDomain[skill.key])
                        return (
                          <div
                            key={skill.key}
                            className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-center shadow-inner print:bg-white print:border-emerald-200"
                          >
                            <p className="text-[11px] uppercase tracking-[0.35em] text-teal-700">{skill.label}</p>
                            <div className="mt-3 flex items-center justify-center gap-2">
                              {BEHAVIORAL_RATING_COLUMNS.map((option) => {
                                const mark = getBehavioralMark(reportCardData.psychomotorDomain, skill.key, option.key)
                                const isActive = mark === "●"
                                return (
                                  <span
                                    key={`${skill.key}-${option.key}`}
                                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                                      isActive
                                        ? "border-teal-600 bg-teal-500 text-white"
                                        : "border-teal-300 text-teal-500"
                                    }`}
                                  >
                                    {mark}
                                  </span>
                                )
                              })}
                            </div>
                            <p className="mt-3 text-xs font-semibold text-teal-800">{ratingLabel}</p>
                          </div>
                        )
                      })}
                    </div>
                    {additionalPsychomotorSkills.length > 0 ? (
                      <div className="rounded-2xl border border-teal-100 bg-white p-4 print:border-emerald-200">
                        <p className="text-[11px] uppercase tracking-[0.35em] text-teal-600">Additional Skills</p>
                        <div className="mt-3 grid gap-3">
                          {additionalPsychomotorSkills.map((skill) => (
                            <div key={skill.key} className="flex items-center justify-between text-sm text-teal-800">
                              <span className="font-medium">{skill.label}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-teal-600">
                                {formatBehavioralLabel(reportCardData.psychomotorDomain[skill.key])}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-xs text-emerald-800 shadow-sm print:bg-white print:border-emerald-200">
                <p className="font-semibold uppercase tracking-[0.3em] text-center">Rating Legend</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  {BEHAVIORAL_RATING_COLUMNS.map((column) => (
                    <div key={column.key} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500 text-[10px] font-bold text-emerald-600">
                        ●
                      </span>
                      <span className="text-xs font-medium">{column.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 px-6 py-6 text-center shadow-sm print:bg-white print:border-emerald-200">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-900">Class Teacher's Remarks</h3>
                    <p className="mt-4 text-base leading-relaxed text-emerald-900/90">
                      {reportCardData.remarks.classTeacher || "She is improving in her studies."}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-200 bg-white px-6 py-6 text-center shadow-sm print:border-emerald-200">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-800">Head Teacher's Remark</h3>
                    <p className="mt-4 text-sm italic text-emerald-900/90">{reportCardData.remarks.headTeacher}</p>
                  </div>
                  <div className="rounded-3xl border-2 border-dashed border-emerald-300 px-6 py-6 text-center print:border-emerald-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Class Teacher's Signature</p>
                    <div className="mt-6 h-14 border-b-2 border-emerald-400 print:border-emerald-800"></div>
                  </div>
                </div>
                <div className="space-y-6 text-center">
                  <div className="rounded-3xl border border-emerald-200 bg-white px-6 py-6 shadow-sm print:border-emerald-200">
                    {reportCardData.branding.signature ? (
                      <img
                        src={reportCardData.branding.signature}
                        alt={`${reportCardData.branding.headmasterName} signature`}
                        className="mx-auto h-16 w-48 object-contain"
                      />
                    ) : (
                      <div className="mx-auto h-14 w-48 border-b-2 border-dashed border-emerald-400 print:border-emerald-800"></div>
                    )}
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-800">
                      {reportCardData.branding.headmasterName}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">Head Teacher</p>
                  </div>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 px-6 py-6 shadow-sm print:bg-white print:border-emerald-200">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Parent / Guardian Acknowledgement</p>
                    <div className="mt-6 h-14 border-b border-dashed border-emerald-400 print:border-emerald-800"></div>
                  </div>
                </div>
              </div>
            </section>
            <section>
              <div className="rounded-3xl border border-emerald-200 overflow-hidden shadow-sm print:border-black">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold uppercase tracking-[0.4em] text-white text-center print:bg-gray-200 print:text-black">
                  Grading Scale
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
                  {GRADING_SCALE.map((item) => (
                    <div
                      key={item.grade}
                      className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-center shadow-inner print:border-black"
                    >
                      <p className="text-2xl font-black text-emerald-700">{item.grade}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">{item.range}</p>
                      <p className="text-[11px] text-emerald-800 mt-1">{item.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <p className="text-center text-xs text-emerald-700/80 print:text-gray-600">
              © {reportCardData.branding.schoolName}. All rights reserved.
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
