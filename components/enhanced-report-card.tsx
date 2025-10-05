"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, PrinterIcon as Print } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBranding } from "@/hooks/use-branding"
import { useToast } from "@/hooks/use-toast"
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  normalizeBehavioralRating,
} from "@/lib/report-card-constants"
import type { RawReportCardData } from "@/lib/report-card-types"
import { deriveGradeFromScore } from "@/lib/grade-utils"
import { getHtmlToImage } from "@/lib/html-to-image-loader"
import { getJsPdf } from "@/lib/jspdf-loader"
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

const sanitizeFileName = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned.length > 0 ? cleaned : "report-card"
}

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

const DOMAIN_COLUMNS = [
  { key: "excel", label: "Excel." },
  { key: "vgood", label: "V.Good" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Poor" },
  { key: "poor", label: "V.Poor" },
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

const isBehavioralRatingMatch = (ratings: Record<string, string>, traitKey: string, target: string) => {
  const rating = normalizeBehavioralRating(ratings[traitKey])
  return rating === target
}

export function EnhancedReportCard({ data }: { data?: RawReportCardData }) {
  const branding = useBranding()
  const { toast } = useToast()
  const [reportCardData, setReportCardData] = useState<NormalizedReportCard | null>(() =>
    normalizeReportCard(data, branding),
  )
  const [studentPhoto, setStudentPhoto] = useState<string>("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const formatScoreValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—"
    }

    const rounded = Math.round(value * 10) / 10
    if (Number.isInteger(rounded)) {
      return `${rounded}`
    }

    return rounded.toFixed(1)
  }

  const formatTotalValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—"
    }

    const rounded = Math.round(value * 10) / 10
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    })

    return formatter.format(rounded)
  }

  const formatAverageValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—"
    }

    return `${(Math.round(value * 10) / 10).toFixed(1)}%`
  }

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

  const preparePdfDocument = useCallback(async () => {
    const target = containerRef.current
    if (!target || !reportCardData) {
      return null
    }

    const { toPng } = await getHtmlToImage()
    const dataUrl = await toPng(target, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      cacheBust: true,
      filter: (element) => {
        if (!element?.classList) {
          return true
        }

        return (
          !element.classList.contains("print:hidden") &&
          !element.classList.contains("no-export")
        )
      },
    })

    const dimensions = target.getBoundingClientRect()
    const orientation = dimensions.width >= dimensions.height ? "landscape" : "portrait"
    const { jsPDF } = await getJsPdf()
    const pdf = new jsPDF({
      orientation,
      unit: "px",
      format: [dimensions.width, dimensions.height],
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imageProps = pdf.getImageProperties(dataUrl)
    const imageRatio = imageProps.width / imageProps.height

    let renderWidth = pdfWidth
    let renderHeight = renderWidth / imageRatio

    if (renderHeight > pdfHeight) {
      renderHeight = pdfHeight
      renderWidth = renderHeight * imageRatio
    }

    const offsetX = (pdfWidth - renderWidth) / 2
    const offsetY = (pdfHeight - renderHeight) / 2

    pdf.addImage(dataUrl, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST")

    return pdf
  }, [reportCardData])

  const handlePrint = useCallback(async () => {
    if (isPrinting) {
      return
    }

    try {
      setIsPrinting(true)
      const pdf = await preparePdfDocument()
      if (!pdf) {
        return
      }

      const pdfOutput = pdf.output("blob")
      if (!(pdfOutput instanceof Blob)) {
        throw new Error("Unable to generate PDF blob")
      }

      const browserWindow = resolveBrowserWindow()
      if (!browserWindow) {
        throw new Error("Browser window context is not available")
      }

      const blobUrl = browserWindow.URL.createObjectURL(pdfOutput)
      const openedWindow = browserWindow.open(blobUrl, "_blank", "noopener,noreferrer")

      if (!openedWindow) {
        browserWindow.location.href = blobUrl
      } else {
        openedWindow.focus()
      }

      browserWindow.setTimeout(() => {
        browserWindow.URL.revokeObjectURL(blobUrl)
      }, 60000)
    } catch (error) {
      console.error("Failed to prepare report card PDF", error)
      toast({
        title: "Print failed",
        description: "Unable to prepare the report card PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }, [isPrinting, preparePdfDocument, toast])

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return
    }

    try {
      setIsDownloading(true)
      const pdf = await preparePdfDocument()
      if (!pdf || !reportCardData) {
        return
      }

      const filename = sanitizeFileName(
        `${reportCardData.student.name}-${reportCardData.student.term}-${reportCardData.student.session}`,
      )

      pdf.save(`${filename}.pdf`)
    } catch (error) {
      console.error("Failed to export report card as PDF", error)
      toast({
        title: "Download failed",
        description: "Unable to prepare the report card PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }, [isDownloading, preparePdfDocument, reportCardData, toast])

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

  const { student, summary, termInfo } = reportCardData
  const resolveDisplayValue = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }

    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }

    return "—"
  }

  const numberInClass = resolveDisplayValue(
    student.numberInClass ?? termInfo?.numberInClass ?? "—",
  )
  const termLabel = resolveDisplayValue(student.term)
  const sessionLabel = resolveDisplayValue(student.session)
  const admissionNumber = resolveDisplayValue(student.admissionNumber)
  const studentName = resolveDisplayValue(student.name)
  const classLabel = resolveDisplayValue(student.class)
  const gradeLabel = resolveDisplayValue(
    summary.grade ? summary.grade.toUpperCase() : undefined,
  )
  const totalMarksObtainable = formatTotalValue(summary.totalMarksObtainable)
  const totalMarksObtained = formatTotalValue(summary.totalMarksObtained)
  const averageScore = formatAverageValue(summary.averageScore)
  const positionLabel = resolveDisplayValue(summary.positionLabel)

  const classTeacherRemark =
    reportCardData.remarks.classTeacher?.trim().length
      ? reportCardData.remarks.classTeacher
      : "________________"
  const defaultHeadRemark = reportCardData.branding?.defaultRemark?.trim() ?? ""
  const headTeacherRemark =
    reportCardData.remarks.headTeacher?.trim().length
      ? reportCardData.remarks.headTeacher
      : defaultHeadRemark.length > 0
        ? defaultHeadRemark
        : "________________"
  const vacationDate = formatDateDisplay(reportCardData.termInfo.vacationEnds) ?? "________________"
  const resumptionDate = formatDateDisplay(reportCardData.termInfo.nextTermBegins) ?? "________________"

  return (
    <div className="victory-report-card-wrapper">
      <div className="victory-report-card-actions no-export">
        <Button
          onClick={handlePrint}
          className="bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-[#256028]"
          disabled={isPrinting}
        >
          <Print className="mr-2 h-4 w-4" />
          {isPrinting ? "Preparing..." : "Print"}
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-[#2e7d32] px-4 py-2 text-sm font-medium text-[#2e7d32] hover:bg-[#2e7d32] hover:text-white"
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Preparing..." : "Download"}
        </Button>
      </div>

      <div className="victory-report-card">
        <div className="report-container" ref={containerRef}>
          <div className="header-wrapper">
            <div className="logo">
              {reportCardData.branding.logo ? (
                <img src={reportCardData.branding.logo} alt="School logo" />
              ) : (
                <span>SCHOOL LOGO</span>
              )}
            </div>
            <div className="school-info">
              <p className="school-name">{reportCardData.branding.schoolName}</p>
              {reportCardData.branding.address ? (
                <p className="school-address">{reportCardData.branding.address}</p>
              ) : null}
              {(reportCardData.branding.educationZone || reportCardData.branding.councilArea) && (
                <p className="school-address">
                  {[reportCardData.branding.educationZone, reportCardData.branding.councilArea]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {(reportCardData.branding.contactPhone || reportCardData.branding.contactEmail) && (
                <p className="school-address">
                  {[reportCardData.branding.contactPhone, reportCardData.branding.contactEmail]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              )}
            </div>
            <div className="photo-placeholder">
              {studentPhoto ? (
                <img src={studentPhoto} alt={`${reportCardData.student.name} passport`} />
              ) : (
                <span>PHOTO</span>
              )}
            </div>
          </div>

          <div className="report-title">TERMINAL REPORT SHEET</div>

          <div className="student-info">
            <div className="student-row">
              <div className="info-label">NAME OF STUDENT:</div>
              <div className="info-value">{studentName}</div>
              <div className="info-label">ADMISSION NUMBER:</div>
              <div className="info-value">{admissionNumber}</div>
              <div className="info-label">CLASS:</div>
              <div className="info-value">{classLabel}</div>
            </div>
            <div className="student-row">
              <div className="info-label">NUMBER IN CLASS:</div>
              <div className="info-value">{numberInClass}</div>
              <div className="info-label">TERM:</div>
              <div className="info-value">{termLabel}</div>
              <div className="info-label">SESSION:</div>
              <div className="info-value">{sessionLabel}</div>
              <div className="info-label">GRADE:</div>
              <div className="info-value">{gradeLabel}</div>
            </div>
            <div className="student-row">
              <div className="info-label">TOTAL MARKS OBTAINABLE:</div>
              <div className="info-value">{totalMarksObtainable}</div>
              <div className="info-label">TOTAL MARKS OBTAINED</div>
              <div className="info-value">{totalMarksObtained}</div>
              <div className="info-label">AVERAGE:</div>
              <div className="info-value">{averageScore}</div>
              <div className="info-label">POSITION:</div>
              <div className="info-value">{positionLabel}</div>
            </div>
          </div>

          <table className="grades-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>
                  1<sup>st</sup>
                  <br />
                  C.A
                  <br />
                  10
                </th>
                <th>
                  2<sup>nd</sup>
                  <br />
                  C.A
                  <br />
                  10
                </th>
                <th>NOTE/<br />ASSIGNMENT (20)</th>
                <th>TOTAL<br />40</th>
                <th>EXAM<br />60</th>
                <th>TOTAL<br />100</th>
                <th>Subject<br />Position</th>
                <th>Teacher&apos;s<br />Remarks</th>
              </tr>
            </thead>
            <tbody>
              {reportCardData.subjects.length > 0 ? (
                <>
                  {reportCardData.subjects.map((subject, index) => (
                    <tr key={`${subject.name}-${index}`}>
                      <td className="subject-name">{subject.name}</td>
                      <td>{formatScoreValue(subject.ca1)}</td>
                      <td>{formatScoreValue(subject.ca2)}</td>
                      <td>{formatScoreValue(subject.assignment)}</td>
                      <td>{formatScoreValue(subject.caTotal)}</td>
                      <td>{formatScoreValue(subject.exam)}</td>
                      <td>{formatScoreValue(subject.total)}</td>
                      <td>{subject.position ?? ""}</td>
                      <td>{subject.remarks || ""}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="total-label">TOTAL</td>
                    <td>{formatTotalValue(totalsRow?.ca1)}</td>
                    <td>{formatTotalValue(totalsRow?.ca2)}</td>
                    <td>{formatTotalValue(totalsRow?.assignment)}</td>
                    <td>{formatTotalValue(totalsRow?.caTotal)}</td>
                    <td>{formatTotalValue(totalsRow?.exam)}</td>
                    <td>{formatTotalValue(totalsRow?.total)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={9}>No subject scores have been recorded for this student.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="remark-section">
            <div className="remarks-column">
              <div className="teacher-remarks">
                <strong>Class Teacher Remarks:</strong>
                <br />
                {classTeacherRemark}
                <hr />
                <strong>Head Master&apos;s Remark:</strong>
                <br />
                <em>{headTeacherRemark}</em>
              </div>
              <div className="domain-block psychomotor-block">
                <strong>PSYCHOMOTOR DOMAIN</strong>
                <table className="af-domain-table">
                  <thead>
                    <tr>
                      <th></th>
                      {DOMAIN_COLUMNS.map((column) => (
                        <th key={`psychomotor-header-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {psychomotorSkills.length > 0 ? (
                      psychomotorSkills.map((skill) => (
                        <tr key={skill.key}>
                          <td>{skill.label}</td>
                          {DOMAIN_COLUMNS.map((column) => {
                            const match = isBehavioralRatingMatch(
                              reportCardData.psychomotorDomain,
                              skill.key,
                              column.key,
                            )
                            return (
                              <td key={`${skill.key}-${column.key}`} className={match ? "tick" : ""}>
                                {match ? "✓" : ""}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={DOMAIN_COLUMNS.length + 1}>No psychomotor records available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="domain-block affective-block">
              <strong>AFFECTIVE DOMAIN</strong>
              <table className="af-domain-table">
                <thead>
                  <tr>
                    <th></th>
                    {DOMAIN_COLUMNS.map((column) => (
                      <th key={`affective-header-${column.key}`}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affectiveTraits.length > 0 ? (
                    affectiveTraits.map((trait) => (
                      <tr key={trait.key}>
                        <td>{trait.label}</td>
                        {DOMAIN_COLUMNS.map((column) => {
                          const match = isBehavioralRatingMatch(
                            reportCardData.affectiveDomain,
                            trait.key,
                            column.key,
                          )
                          return (
                            <td key={`${trait.key}-${column.key}`} className={match ? "tick" : ""}>
                              {match ? "✓" : ""}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={DOMAIN_COLUMNS.length + 1}>No affective records available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="vacation-box">
            <div>
              <strong>Vacation Date:</strong> {vacationDate}
            </div>
            <div>
              <strong>Resumption Date:</strong> {resumptionDate}
            </div>
          </div>

          <div className="signatures-box">
            <span>
              Teacher&apos;s Signature:
              <div className="signature-line" />
            </span>
            <span>
              Headmaster&apos;s Signature:
              <div className="signature-line" />
            </span>
          </div>

          <div className="grading-key-container">
            <div className="grading-key">
              GRADING:
              {" "}
              75–100 A (Excellent) |
              {" "}
              60–74 B (V.Good) |
              {" "}
              50–59 C (Good) |
              {" "}
              40–49 D (Fair) |
              {" "}
              30–39 E (Poor) |
              {" "}
              0–29 F (FAIL)
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .victory-report-card-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px;
          background-color: transparent;
        }

        .victory-report-card-actions {
          width: 100%;
          max-width: 980px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-bottom: 16px;
        }

        .victory-report-card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .victory-report-card .report-container {
          width: min(960px, 100%);
          margin: 0 auto;
          border: 3px solid #2e7d32;
          background-color: #fff;
          color: #333;
          font-family: "Times New Roman", serif;
          padding: 0;
        }

        .victory-report-card .report-container * {
          box-sizing: border-box;
        }

        .header-wrapper {
          display: flex;
          align-items: center;
          border-bottom: 3px solid #2e7d32;
          padding: 10px 15px;
          background-color: #fff;
        }

        .logo {
          width: 120px;
          height: 120px;
          border: 2px solid #2e7d32;
          background-color: #f9f9f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #999;
          margin-right: 15px;
        }

        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .school-info {
          flex-grow: 1;
          background-color: #e0e0e0;
          border: 2px solid #2e7d32;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
        }

        .school-name {
          font-size: 32px;
          font-weight: bold;
          color: #2e7d32;
          margin: 0 0 4px 0;
          line-height: 1.1;
        }

        .school-address {
          font-size: 14px;
          color: #333;
          margin: 0;
          line-height: 1.3;
        }

        .school-info .school-address + .school-address {
          margin-top: 4px;
        }

        .photo-placeholder {
          width: 100px;
          height: 120px;
          border: 2px solid #2e7d32;
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 15px;
          font-size: 10px;
          color: #999;
        }

        .photo-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .report-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #2e7d32;
          padding: 8px 0;
          margin: 0;
          border-top: 1px solid #2e7d32;
          border-bottom: 1px solid #2e7d32;
        }

        .student-info {
          border: 2px solid #2e7d32;
          padding: 0;
          margin: 10px 15px;
          font-size: 14px;
        }

        .student-row {
          display: flex;
          border-bottom: 1px solid #2e7d32;
        }

        .student-row:last-of-type {
          border-bottom: none;
        }

        .info-label {
          font-weight: bold;
          color: #2e7d32;
          padding: 6px 8px;
          border-right: 1px solid #2e7d32;
          width: 20%;
          font-size: 14px;
          background-color: #fafafa;
        }

        .info-value {
          padding: 6px 8px;
          width: 80%;
          font-size: 16px;
          font-weight: bold;
          background-color: #fff;
        }

        .grades-table {
          width: calc(100% - 30px);
          margin: 10px 15px 30px;
          border-collapse: collapse;
          font-size: 14px;
          table-layout: fixed;
        }

        .grades-table th,
        .grades-table td {
          border: 1px solid #2e7d32;
          padding: 6px 4px;
          text-align: center;
          vertical-align: middle;
          font-size: 13px;
          line-height: 1.3;
        }

        .grades-table th {
          background-color: #2e7d32;
          color: #fff;
          font-weight: bold;
        }

        .grades-table td {
          background-color: #fff;
        }

        .subject-name {
          text-align: left !important;
          padding-left: 8px;
          font-weight: bold;
          color: #2e7d32;
        }

        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }

        .total-label {
          text-align: left !important;
          padding-left: 8px;
        }

        .remark-section {
          margin-top: 12px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: stretch;
          padding: 0 15px 8px;
        }

        .remarks-column {
          display: flex;
          flex: 1 1 260px;
          flex-direction: column;
          gap: 12px;
        }

        .teacher-remarks,
        .domain-block {
          border: 1.5px solid #27613d;
          background: #fafdff;
          border-radius: 4px;
          padding: 12px 16px;
          font-size: 1em;
          flex: 1 1 auto;
        }

        .psychomotor-block {
          padding-bottom: 16px;
        }

        .affective-block {
          flex: 1 1 320px;
          min-width: 280px;
        }

        .vacation-box,
        .signatures-box {
          display: flex;
          gap: 24px;
          margin-top: 6px;
          font-size: 1em;
          align-items: center;
          padding: 0 15px 8px;
        }

        .signature-line {
          border-bottom: 1px dotted #27613d;
          width: 110px;
          height: 2px;
          margin-top: 12px;
          display: inline-block;
        }

        .signatures-box span {
          display: flex;
          flex-direction: column;
          font-weight: 600;
          color: #27613d;
        }

        .af-domain-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }

        .af-domain-table th,
        .af-domain-table td {
          padding: 4px;
          text-align: center;
          font-size: 0.95em;
          border: 1px solid #b2c7b9;
        }

        .af-domain-table th {
          background: #fbd54a;
          color: #27613d;
        }

        .af-domain-table td {
          background: #fafdff;
        }

        .af-domain-table td:first-child {
          text-align: left;
          font-weight: 600;
          color: #27613d;
        }

        .af-domain-table .tick {
          color: #05762b;
          font-size: 1.2em;
          font-weight: bold;
        }

        hr {
          border: 0;
          border-top: 1px solid #27613d;
          margin: 8px 0;
        }

        .grading-key-container {
          padding: 0 15px 12px;
          text-align: center;
          font-size: 13px;
          color: #27613d;
          font-weight: bold;
        }

        .grading-key {
          display: inline-block;
          background: #f9f9f9;
          border: 1px solid #27613d;
          padding: 6px 12px;
          border-radius: 4px;
          margin-top: 5px;
        }

        @media print {
          .victory-report-card-wrapper {
            padding: 0;
          }

          .victory-report-card-actions {
            display: none !important;
          }

          .victory-report-card {
            width: 100%;
          }

          .victory-report-card .report-container {
            width: 190mm !important;
            max-width: none;
            border-width: 3px;
          }
        }
      `}</style>
    </div>
  )
}
