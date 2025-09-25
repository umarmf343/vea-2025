"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, PrinterIcon as Print } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  } catch {
    return {}
  }
}

const resolveBrowserWindow = () => {
  if (typeof globalThis === "undefined") {
    return null
  }

  const candidate = globalThis as Window & typeof globalThis

  return typeof candidate.addEventListener === "function" ? candidate : null
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
    return ""
  }

  if (rating === target) {
    return "●"
  }

  return ""
}

export function EnhancedReportCard({ data }: { data?: RawReportCardData }) {
  const branding = useBranding()
  const [reportCardData, setReportCardData] = useState<NormalizedReportCard | null>(() =>
    normalizeReportCard(data, branding),
  )
  const [studentPhoto, setStudentPhoto] = useState<string>("")

  useEffect(() => {
    const browserWindow = resolveBrowserWindow()
    if (!browserWindow) {
      return undefined
    }

    const updateData = () => {
      const normalized = normalizeReportCard(data, branding)
      setReportCardData(normalized)

      if (!normalized) {
        setStudentPhoto("")
        return
      }

      const storageKey = `${normalized.student.id}-${normalized.student.term}-${normalized.student.session}`
      const photoStore = parseJsonRecord(safeStorage.getItem("studentPhotos"))
      const storedPhoto = photoStore[storageKey]

      if (typeof storedPhoto === "string" && storedPhoto.trim().length > 0) {
        setStudentPhoto(storedPhoto)
      } else {
        setStudentPhoto("")
      }
    }

    updateData()

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || !STORAGE_KEYS_TO_WATCH.includes(event.key)) {
        return
      }
      updateData()
    }

    browserWindow.addEventListener("storage", handleStorageChange)

    return () => {
      browserWindow.removeEventListener("storage", handleStorageChange)
    }
  }, [data, branding])

  const domainColumns = useMemo(() => [...BEHAVIORAL_RATING_COLUMNS], [])

  const affectiveTraits = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ key: string; label: string }>
    }

    const seen = new Set<string>()
    const ordered = [...PRIMARY_AFFECTIVE_TRAITS, ...AFFECTIVE_TRAITS]
    const traits: Array<{ key: string; label: string }> = []

    ordered.forEach((trait) => {
      if (!seen.has(trait.key)) {
        traits.push(trait)
        seen.add(trait.key)
      }
    })

    Object.keys(reportCardData.affectiveDomain).forEach((key) => {
      if (!seen.has(key)) {
        traits.push({ key, label: formatStatusLabel(key) ?? key })
        seen.add(key)
      }
    })

    return traits
  }, [reportCardData])

  const psychomotorSkills = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ key: string; label: string }>
    }

    const seen = new Set<string>()
    const ordered = [...PRIMARY_PSYCHOMOTOR_SKILLS, ...PSYCHOMOTOR_SKILLS]
    const traits: Array<{ key: string; label: string }> = []

    ordered.forEach((trait) => {
      if (!seen.has(trait.key)) {
        traits.push(trait)
        seen.add(trait.key)
      }
    })

    Object.keys(reportCardData.psychomotorDomain).forEach((key) => {
      if (!seen.has(key)) {
        traits.push({ key, label: formatStatusLabel(key) ?? key })
        seen.add(key)
      }
    })

    return traits
  }, [reportCardData])

  const infoRows = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<
        Array<{
          label: string
          value: string
        }>
      >
    }

    const { student, attendance, termInfo } = reportCardData

    return [
      [
        { label: "Student Name", value: student.name },
        { label: "Admission No", value: student.admissionNumber },
        { label: "Class", value: student.class },
        { label: "Term", value: student.term },
      ],
      [
        { label: "Session", value: student.session },
        { label: "Position", value: student.positionLabel || "—" },
        {
          label: "No. in Class",
          value: student.numberInClass ? String(student.numberInClass) : "—",
        },
        { label: "Status", value: student.statusLabel || "—" },
      ],
      [
        {
          label: "Date of Birth",
          value: formatDateDisplay(student.dateOfBirth) ?? "—",
        },
        {
          label: "Age",
          value: student.age ? `${student.age} yrs` : "—",
        },
        { label: "Gender", value: student.gender ?? "—" },
        {
          label: "Attendance",
          value: `${attendance.present} / ${attendance.total} (${attendance.percentage}%)`,
        },
      ],
      [
        {
          label: "Vacation Ends",
          value: formatDateDisplay(termInfo.vacationEnds) ?? "—",
        },
        {
          label: "Next Term Begins",
          value: formatDateDisplay(termInfo.nextTermBegins) ?? "—",
        },
        {
          label: "Next Term Fees",
          value: termInfo.nextTermFees ?? "—",
        },
        {
          label: "Outstanding Fees",
          value: termInfo.feesBalance ?? "—",
        },
      ],
    ]
  }, [reportCardData])

  const summaryBoxes = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ label: string; value: string }>
    }

    const { summary } = reportCardData

    return [
      {
        label: "Total Obtainable",
        value: summary.totalMarksObtainable.toLocaleString(),
      },
      {
        label: "Total Obtained",
        value: summary.totalMarksObtained.toLocaleString(),
      },
      {
        label: "Average Score",
        value: `${summary.averageScore.toFixed(2)}%`,
      },
      {
        label: "Position",
        value:
          summary.positionLabel && summary.positionLabel.trim().length > 0
            ? summary.positionLabel
            : "—",
      },
      {
        label: "Class Average",
        value:
          typeof summary.classAverage === "number"
            ? `${summary.classAverage.toFixed(2)}%`
            : "—",
      },
      {
        label: "Class Size",
        value: summary.numberOfStudents ? String(summary.numberOfStudents) : "—",
      },
    ]
  }, [reportCardData])

  const commentEntries = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ label: string; value: string }>
    }

    return [
      {
        label: "Class Teacher's Remarks",
        value: reportCardData.remarks.classTeacher || "________________",
      },
      {
        label: "Head Teacher's Comment",
        value: reportCardData.remarks.headTeacher || "________________",
      },
      {
        label: "Vacation Ends",
        value: formatDateDisplay(reportCardData.termInfo.vacationEnds) ?? "________________",
      },
      {
        label: "Resumption Date",
        value: formatDateDisplay(reportCardData.termInfo.nextTermBegins) ?? "________________",
      },
    ]
  }, [reportCardData])

  const totalsRow = useMemo(() => {
    if (!reportCardData || reportCardData.subjects.length === 0) {
      return null
    }

    return reportCardData.subjects.reduce(
      (totals, subject) => {
        totals.ca1 += subject.ca1
        totals.ca2 += subject.ca2
        totals.assignment += subject.assignment
        totals.caTotal += subject.caTotal
        totals.exam += subject.exam
        totals.total += subject.total
        return totals
      },
      { ca1: 0, ca2: 0, assignment: 0, caTotal: 0, exam: 0, total: 0 },
    )
  }, [reportCardData])

  const handlePrint = () => {
    const browserWindow = resolveBrowserWindow()
    if (!browserWindow || typeof browserWindow.print !== "function") {
      return
    }

    browserWindow.print()
  }

  const handleDownload = () => {
    const browserWindow = resolveBrowserWindow()
    if (!browserWindow || typeof browserWindow.print !== "function") {
      return
    }

    browserWindow.print()
  }

  if (!reportCardData) {
    return (
      <div className="mx-auto w-full max-w-5xl py-6">
        <div className="rounded-lg border border-dashed border-[#2d5016] bg-white p-8 text-center text-[#2d5016] shadow-sm">
          <h2 className="text-lg font-semibold">No report card data available</h2>
          <p className="mt-2 text-sm">
            Please select a student with recorded assessments to preview the enhanced report card.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl py-6 print:w-[210mm] print:max-w-none print:py-0">
      <div className="mb-4 flex justify-end gap-2 px-2 print:hidden">
        <Button
          onClick={handlePrint}
          className="bg-[#2d5016] px-3 text-xs font-medium text-white shadow-md hover:bg-[#244012]"
        >
          <Print className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-[#2d5016] px-3 text-xs font-medium text-[#2d5016] hover:bg-[#2d5016] hover:text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      <div className="border-[3px] border-[#2d5016] bg-white text-[13px] leading-tight text-slate-800 shadow-xl print:shadow-none">
        <div className="bg-white">
          <div className="m-3 flex flex-col items-center gap-4 border-2 border-[#2d5016] bg-[#e8f5e8] px-4 py-4 md:flex-row md:items-start">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#2d5016] bg-[#2d5016] text-center text-[10px] font-semibold uppercase leading-tight text-white">
              {reportCardData.branding.logo ? (
                <img
                  src={reportCardData.branding.logo}
                  alt={`${reportCardData.branding.schoolName} logo`}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span>
                  School
                  <br />
                  Logo
                </span>
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold uppercase tracking-wide text-[#2d5016]">
                {reportCardData.branding.schoolName}
              </h1>
              {reportCardData.branding.address ? (
                <p className="text-sm font-medium text-slate-700">{reportCardData.branding.address}</p>
              ) : null}
              <p className="mt-3 text-base font-semibold uppercase tracking-wide text-[#2d5016]">
                Terminal Report Sheet
              </p>
            </div>
            <div className="flex h-24 w-20 items-center justify-center border border-[#2d5016] bg-[#f5f5f5]">
              {studentPhoto ? (
                <img
                  src={studentPhoto}
                  alt={`${reportCardData.student.name} passport`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-medium text-slate-500">Photo</span>
              )}
            </div>
          </div>

          <div className="mx-3 border border-[#2d5016] text-[12px]">
            {infoRows.map((row, rowIndex) => (
              <div
                key={`info-row-${rowIndex}`}
                className={`flex flex-wrap ${rowIndex !== infoRows.length - 1 ? "border-b border-[#2d5016]" : ""}`}
              >
                {row.map((cell) => (
                  <div
                    key={cell.label}
                    className={`w-full px-3 py-2 sm:flex sm:items-center ${row.length === 4 ? "sm:w-1/4" : "sm:w-1/3"}`}
                  >
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-[#2d5016]">
                      {cell.label}
                    </span>
                    <span className="mt-1 block text-[12px] font-semibold text-[#2d5016] sm:ml-2 sm:mt-0">
                      {cell.value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mx-3 mt-3 grid gap-3 text-white sm:grid-cols-2">
            {summaryBoxes.map((box) => (
              <div
                key={box.label}
                className="rounded-md border border-[#2d5016] bg-gradient-to-br from-[#2d5016] to-[#6fa233] px-4 py-3 text-center shadow-sm"
              >
                <p className="text-[12px] font-semibold uppercase tracking-wide">{box.label}</p>
                <p className="mt-2 text-lg font-bold">{box.value}</p>
              </div>
            ))}
          </div>

          <div className="mx-3 mt-3 overflow-x-auto">
            <table className="w-full border border-[#2d5016] text-[12px] text-slate-800">
              <thead>
                <tr className="bg-[#f0f0f0] text-[#2d5016]">
                  <th className="border border-[#2d5016] px-2 py-2 text-left font-semibold uppercase">Subject</th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    1st C.A
                    <br />
                    10
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    2nd C.A
                    <br />
                    10
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    Note/
                    <br />
                    Assign
                    <br />
                    20
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    Total
                    <br />
                    40
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    Exam
                    <br />
                    60
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    Total
                    <br />
                    100
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase">
                    Subject
                    <br />
                    Position
                  </th>
                  <th className="border border-[#2d5016] px-2 py-2 text-left font-semibold uppercase">
                    Teacher&apos;s
                    <br />
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportCardData.subjects.length > 0 ? (
                  reportCardData.subjects.map((subject, index) => (
                    <tr key={`${subject.name}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-[#f9f9f9]"}>
                      <td className="border border-[#2d5016] px-3 py-2 font-semibold uppercase text-[#2d5016]">
                        {subject.name}
                      </td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center">{subject.ca1}</td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center">{subject.ca2}</td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center">{subject.assignment}</td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center font-semibold text-[#2d5016]">
                        {subject.caTotal}
                      </td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center">{subject.exam}</td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center font-semibold text-[#2d5016]">
                        {subject.total}
                      </td>
                      <td className="border border-[#2d5016] px-2 py-2 text-center font-semibold text-[#2d5016]">
                        {subject.position ?? "—"}
                      </td>
                      <td className="border border-[#2d5016] px-2 py-2 text-left text-[11px] text-slate-700">
                        {subject.remarks || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="border border-[#2d5016] px-3 py-4 text-center text-sm text-slate-600">
                      No subject scores have been recorded for this student.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#f0f0f0] font-semibold text-[#2d5016]">
                  <td className="border border-[#2d5016] px-3 py-2 text-left uppercase">Total</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.ca1 ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.ca2 ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.assignment ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.caTotal ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.exam ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">{totalsRow?.total ?? "—"}</td>
                  <td className="border border-[#2d5016] px-2 py-2 text-center">—</td>
                  <td className="border border-[#2d5016] px-2 py-2">&nbsp;</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mx-3 mt-3 bg-[#d4a574] py-2 text-center text-[14px] font-bold uppercase tracking-wide text-white">
            Remarks, Affective and Psychomotor Domains
          </div>

          <div className="mx-3 -mt-[1px] border border-[#2d5016]">
            <div className="flex flex-col lg:flex-row">
              <div className="flex flex-1 flex-col">
                {commentEntries.map((entry, index) => (
                  <div
                    key={entry.label}
                    className={`px-4 py-3 ${index !== commentEntries.length - 1 ? "border-b border-[#2d5016]" : ""}`}
                  >
                    <p className="text-[13px] font-bold uppercase tracking-wide text-[#2d5016]">{entry.label}</p>
                    <p className="mt-1 text-[13px] font-semibold text-[#2d5016]">{entry.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-1 flex-col border-t border-[#2d5016] lg:border-t-0 lg:border-l">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[11px] text-slate-800">
                    <thead>
                      <tr className="bg-[#f0f0f0] text-[#2d5016]">
                        <th className="border border-[#2d5016] px-3 py-2 text-left font-semibold uppercase">
                          Affective Domain
                        </th>
                        {domainColumns.map((column) => (
                          <th
                            key={`affective-header-${column.key}`}
                            className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {affectiveTraits.map((trait, index) => (
                        <tr key={trait.key} className={index % 2 === 0 ? "bg-white" : "bg-[#f9f9f9]"}>
                          <td className="border border-[#2d5016] px-3 py-2 font-semibold text-[#2d5016]">{trait.label}</td>
                          {domainColumns.map((column) => (
                            <td
                              key={`${trait.key}-${column.key}`}
                              className="border border-[#2d5016] px-2 py-2 text-center text-[#2d5016]"
                            >
                              {getBehavioralMark(reportCardData.affectiveDomain, trait.key, column.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto border-t border-[#2d5016]">
                  <table className="w-full border-collapse text-[11px] text-slate-800">
                    <thead>
                      <tr className="bg-[#f0f0f0] text-[#2d5016]">
                        <th className="border border-[#2d5016] px-3 py-2 text-left font-semibold uppercase">
                          Psychomotor Domain
                        </th>
                        {domainColumns.map((column) => (
                          <th
                            key={`psychomotor-header-${column.key}`}
                            className="border border-[#2d5016] px-2 py-2 text-center font-semibold uppercase"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {psychomotorSkills.map((skill, index) => (
                        <tr key={skill.key} className={index % 2 === 0 ? "bg-white" : "bg-[#f9f9f9]"}>
                          <td className="border border-[#2d5016] px-3 py-2 font-semibold text-[#2d5016]">{skill.label}</td>
                          {domainColumns.map((column) => (
                            <td
                              key={`${skill.key}-${column.key}`}
                              className="border border-[#2d5016] px-2 py-2 text-center text-[#2d5016]"
                            >
                              {getBehavioralMark(reportCardData.psychomotorDomain, skill.key, column.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[#2d5016] px-4 py-3 text-[12px] text-[#2d5016]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Teacher&apos;s Signature:</span>
                    <span className="min-w-[140px] border-b border-dashed border-[#2d5016]">&nbsp;</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-semibold">Headmaster&apos;s Signature:</span>
                    {reportCardData.branding.signature ? (
                      <img
                        src={reportCardData.branding.signature}
                        alt={`${reportCardData.branding.headmasterName} signature`}
                        className="h-10 w-36 object-contain"
                      />
                    ) : (
                      <span className="min-w-[140px] border-b border-dashed border-[#2d5016]">&nbsp;</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-3 -mt-[1px] border border-[#2d5016] border-t-0 px-3 py-2 text-[10px] text-gray-600">
            <p className="font-semibold text-[#2d5016]">Grading</p>
            <p>
              75 - 100 A (Excellent) | 60 - 74 B (V.Good) | 50 - 59 C (Good) | 40 - 49 D (Pass) | 0 - 39 F (Poor)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
