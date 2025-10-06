"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { dbManager } from "@/lib/database-manager"
import { safeStorage } from "@/lib/safe-storage"
import type {
  BrandingRecord,
  ClassRecord,
  PaymentInitializationRecord,
  ReportCardRecord,
  ReportCardSubjectRecord,
  StudentRecord,
  StoredUser,
  SystemSettingsRecord,
} from "@/lib/database"
import { AdminApprovalDashboard } from "@/components/admin-approval-dashboard"
import { FinancialReports } from "@/components/financial-reports"
import { InternalMessaging } from "@/components/internal-messaging"
import { PaymentManagement } from "@/components/admin/payment-management"
import { StudentManagement } from "@/components/admin/student-management"
import { UserManagement } from "@/components/admin/user-management"
import { SchoolCalendarApprovalPanel } from "@/components/school-calendar-approval"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import {
  BarChart3,
  Calendar,
  CreditCard,
  Edit,
  GraduationCap,
  Plus,
  RefreshCw,
  Save,
  Loader2,
  Trash2,
  TrendingUp,
  Users,
  DollarSign,
  Wallet,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface SystemMetrics {
  serverStatus: string
  databaseStatus: string
  apiResponseTime: number
  activeUsers: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkLatency: number
}

type DashboardTab =
  | "overview"
  | "branding"
  | "messages"
  | "approval"
  | "receipts"
  | "students"
  | "users"
  | "system"
  | "reports"

type PanelRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "librarian"
  | "accountant"

type UserStatus = "active" | "inactive" | "suspended"

interface UserRow {
  id: string
  name: string
  email: string
  role: PanelRole
  status: UserStatus
  lastLogin?: string
  classId?: string | null
  subjects?: string[]
  studentIds?: string[]
  metadata?: Record<string, unknown> | null
}

interface ClassRow {
  id: string
  name: string
  level: string
  capacity?: number | null
  status: "active" | "inactive"
  subjects: string[]
  classTeacherId?: string | null
}

interface BrandingState {
  schoolName: string
  schoolAddress: string
  educationZone: string
  councilArea: string
  contactPhone: string
  contactEmail: string
  headmasterName: string
  defaultRemark: string
  logoUrl: string | null
  signatureUrl: string | null
  updatedAt?: string
}

interface BrandingUploadsState {
  logoUrl: string
  signatureUrl: string
  logoFileName: string
  signatureFileName: string
  logoFileSize: number
  signatureFileSize: number
  logoUploadedAt: string | null
  signatureUploadedAt: string | null
}

interface SystemSettingsState {
  academicYear: string
  currentTerm: string
  registrationEnabled: boolean
  reportCardDeadline: string
}

interface SaveActionOptions {
  silent?: boolean
  propagateError?: boolean
}

type PaymentStatus = "pending" | "completed" | "failed"
type PaymentMethod = "online" | "offline"
type PaymentSource = "api" | "accountant"

interface PaymentRow {
  id: string
  studentId: string | null
  studentName: string
  parentName: string | null
  className: string | null
  amount: number
  status: PaymentStatus
  method: PaymentMethod
  reference: string
  paymentType: string
  email: string
  updatedAt: string
  createdAt?: string | null
  source: PaymentSource
  hasAccess?: boolean
}

interface ReportCardRow extends Omit<ReportCardRecord, "subjects"> {
  subjects: ReportCardSubjectRecord[]
}

interface StudentRow {
  id: string
  name: string
  className: string
  admissionNumber: string
  parentEmail: string
}

const DEFAULT_BRANDING: BrandingState = {
  schoolName: "Victory Educational Academy",
  schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
  educationZone: "Municipal Education Zone",
  councilArea: "Bwari Area Council",
  contactPhone: "+234 (0) 700-832-2025",
  contactEmail: "info@victoryacademy.edu.ng",
  headmasterName: "Dr. Emmanuel Adebayo",
  defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
  logoUrl: null,
  signatureUrl: null,
}

const DEFAULT_SETTINGS: SystemSettingsState = {
  academicYear: "2024/2025",
  currentTerm: "First Term",
  registrationEnabled: true,
  reportCardDeadline: "",
}

function normalizeRole(role: string): PanelRole {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_")
  switch (normalized) {
    case "super_admin":
    case "superadmin":
      return "super_admin"
    case "admin":
    case "administrator":
      return "admin"
    case "teacher":
    case "teachers":
    case "instructor":
    case "educator":
      return "teacher"
    case "parent":
    case "parents":
    case "guardian":
    case "guardians":
      return "parent"
    case "librarian":
    case "libarian":
    case "library_admin":
      return "librarian"
    case "accountant":
    case "accountants":
    case "bursar":
    case "finance":
      return "accountant"
    case "student":
    case "students":
    case "pupil":
    case "pupils":
    case "learner":
    case "learners":
      return "student"
    default:
      return "student"
  }
}

function formatRole(role: PanelRole): string {
  return role.replace("_", " ").replace(/(^|\s)[a-z]/g, (segment) => segment.toUpperCase())
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "N/A"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "N/A"
  }

  return date.toLocaleDateString()
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatFileSize(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
    return "—"
  }

  const UNITS = ["B", "KB", "MB", "GB", "TB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < UNITS.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const formatted = size >= 10 || size % 1 === 0 ? size.toFixed(0) : size.toFixed(1)
  return `${formatted} ${UNITS[unitIndex]}`
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Not saved yet"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet"
  }

  return date.toLocaleString()
}

function calculateReportAverage(report: ReportCardRow): number {
  if (!report.subjects.length) {
    return 0
  }

  const total = report.subjects.reduce((sum, subject) => sum + Number(subject.total ?? 0), 0)
  return Number((total / report.subjects.length).toFixed(2))
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(input, { ...init, headers })

  if (!response.ok) {
    let message = response.statusText
    try {
      const errorBody = await response.json()
      if (errorBody && typeof errorBody.error === "string") {
        message = errorBody.error
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return {} as T
  }

  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  return {} as T
}

function mapStoredUser(user: StoredUser): UserRow {
  const rawStatus = typeof user.status === "string" ? user.status.trim().toLowerCase() : undefined
  const normalizedStatus: UserStatus =
    rawStatus === "inactive"
      ? "inactive"
      : rawStatus === "suspended"
        ? "suspended"
        : rawStatus === "active"
          ? "active"
          : user.isActive === false
            ? "inactive"
            : "active"

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    status: normalizedStatus,
    lastLogin: user.lastLogin ?? undefined,
    classId: user.classId ?? null,
    subjects: user.subjects ?? [],
    studentIds: user.studentIds ?? [],
    metadata: user.metadata ?? null,
  }
}

function mapClassRecord(record: Partial<ClassRecord> & Record<string, unknown>): ClassRow {
  return {
    id: String(record.id ?? record.name),
    name: record.name ?? "Unnamed Class",
    level: record.level ?? "",
    capacity: typeof record.capacity === "number" ? record.capacity : null,
    status: record.status === "inactive" ? "inactive" : "active",
    subjects: Array.isArray(record.subjects) ? record.subjects : [],
    classTeacherId: record.classTeacherId ?? null,
  }
}

function mapBranding(record: BrandingRecord): BrandingState {
  return {
    schoolName: record.schoolName,
    schoolAddress: record.schoolAddress,
    educationZone: record.educationZone,
    councilArea: record.councilArea,
    contactPhone: record.contactPhone,
    contactEmail: record.contactEmail,
    headmasterName: record.headmasterName,
    defaultRemark: record.defaultRemark,
    logoUrl: record.logoUrl ?? null,
    signatureUrl: record.signatureUrl ?? null,
    updatedAt: record.updatedAt,
  }
}

function mapSystemSettings(record: SystemSettingsRecord): SystemSettingsState {
  return {
    academicYear: record.academicYear,
    currentTerm: record.currentTerm,
    registrationEnabled: record.registrationEnabled,
    reportCardDeadline: record.reportCardDeadline ?? "",
  }
}

function normalizePaymentStatus(status?: string | null): PaymentStatus {
  const value = (status ?? "").toString().toLowerCase()
  if (value === "completed" || value === "success" || value === "successful" || value === "paid") {
    return "completed"
  }
  if (value === "failed" || value === "declined" || value === "reversed") {
    return "failed"
  }
  return "pending"
}

function inferPaymentMethod(
  metadata?: Record<string, unknown> | null,
  fallback?: string | null,
): PaymentMethod {
  const method = (metadata?.method as string | undefined) ?? fallback ?? ""
  return method.toLowerCase() === "offline" ? "offline" : "online"
}

function extractMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
  defaultValue: string | null = null,
): string | null {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value
    }
  }
  return defaultValue
}

function getPaymentKey(record: { reference?: string | null; id: string }): string {
  const reference = typeof record.reference === "string" ? record.reference.trim() : ""
  return reference.length > 0 ? reference.toLowerCase() : record.id.toLowerCase()
}

function mergePaymentRows(base: PaymentRow[], additions: PaymentRow[]): PaymentRow[] {
  if (!additions.length) {
    return [...base]
  }

  const map = new Map<string, PaymentRow>()
  const order: string[] = []

  for (const record of base) {
    const key = getPaymentKey(record)
    if (!map.has(key)) {
      order.push(key)
    }
    map.set(key, record)
  }

  for (const record of additions) {
    const key = getPaymentKey(record)
    if (!map.has(key)) {
      order.push(key)
    }
    map.set(key, record)
  }

  return order
    .map((key) => map.get(key))
    .filter((record): record is PaymentRow => Boolean(record))
}

function mapPayment(record: PaymentInitializationRecord): PaymentRow {
  const metadata = (record.metadata ?? {}) as Record<string, unknown>
  const status = normalizePaymentStatus(record.status)
  const method = inferPaymentMethod(metadata, (metadata.method as string | undefined) ?? null)
  const updatedAt = record.updatedAt ?? record.createdAt ?? new Date().toISOString()
  const parentName = extractMetadataString(metadata, ["parentName", "guardianName", "customerName"], null)
  const className = extractMetadataString(metadata, ["className", "class", "classroom"], null)

  return {
    id: record.id,
    studentId: record.studentId,
    studentName: extractMetadataString(metadata, ["studentName", "student"], "Unknown") ?? "Unknown",
    parentName,
    className,
    amount: Number(record.amount ?? 0),
    status,
    method,
    reference: record.reference,
    paymentType: record.paymentType ?? (metadata.paymentType as string) ?? "general",
    email: record.email,
    updatedAt,
    createdAt: record.createdAt ?? null,
    source: "api",
    hasAccess: Boolean((metadata.accessGranted as boolean | undefined) ?? metadata.hasAccess ?? false),
  }
}

function mapManualPayment(entry: Record<string, unknown>): PaymentRow {
  const rawStatus = typeof entry.status === "string" ? entry.status : undefined
  const status = normalizePaymentStatus(rawStatus)
  const method = inferPaymentMethod(entry as Record<string, unknown>, entry.method as string | undefined)
  const reference =
    typeof entry.reference === "string" && entry.reference.trim().length > 0
      ? entry.reference
      : String(entry.id ?? `manual-${Date.now()}`)
  const dateSource =
    typeof entry.updatedAt === "string"
      ? entry.updatedAt
      : typeof entry.date === "string"
        ? entry.date
        : typeof entry.createdAt === "string"
          ? entry.createdAt
          : undefined
  const timestamp = dateSource ? new Date(dateSource).toISOString() : new Date().toISOString()

  return {
    id: String(entry.id ?? reference),
    studentId: null,
    studentName: typeof entry.studentName === "string" ? entry.studentName : "Unknown",
    parentName: typeof entry.parentName === "string" ? entry.parentName : null,
    className: typeof entry.className === "string" ? entry.className : null,
    amount: Number(entry.amount ?? 0),
    status,
    method,
    reference,
    paymentType: typeof entry.paymentType === "string" ? entry.paymentType : "general",
    email: typeof entry.email === "string" ? entry.email : "",
    updatedAt: timestamp,
    createdAt: timestamp,
    source: "accountant",
    hasAccess: Boolean(entry.hasAccess ?? status === "completed"),
  }
}

function mapReportCard(record: ReportCardRecord): ReportCardRow {
  return {
    ...record,
    subjects: record.subjects ?? [],
  }
}

function mapStudentRecord(record: StudentRecord): StudentRow {
  return {
    id: record.id,
    name: record.name,
    className: record.class,
    admissionNumber: record.admissionNumber,
    parentEmail: record.parentEmail,
  }
}

export default function SuperAdminDashboard() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview")
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [classForm, setClassForm] = useState({
    name: "",
    level: "Junior Secondary",
    capacity: "",
    subjectInput: "",
    subjects: [] as string[],
  })
  const [classToDelete, setClassToDelete] = useState<ClassRow | null>(null)
  const [classBeingEdited, setClassBeingEdited] = useState<ClassRow | null>(null)
  const [editClassDialogOpen, setEditClassDialogOpen] = useState(false)
  const [editClassForm, setEditClassForm] = useState({
    name: "",
    level: "Junior Secondary",
    capacity: "",
    subjects: [] as string[],
    subjectInput: "",
  })

  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING)
  const [brandingUploads, setBrandingUploads] = useState<BrandingUploadsState>({
    logoUrl: "",
    signatureUrl: "",
    logoFileName: "",
    signatureFileName: "",
    logoFileSize: 0,
    signatureFileSize: 0,
    logoUploadedAt: null,
    signatureUploadedAt: null,
  })
  const [isSavingBranding, setIsSavingBranding] = useState(false)

  const [systemSettings, setSystemSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingAllEntries, setIsSavingAllEntries] = useState(false)

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  const [reportCards, setReportCards] = useState<ReportCardRow[]>([])

  const brandingChecklist = useMemo(
    () => {
      const trimmed = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "")

      return [
        { label: "School name", completed: trimmed(branding.schoolName).length > 0 },
        { label: "School address", completed: trimmed(branding.schoolAddress).length > 0 },
        { label: "Education zone", completed: trimmed(branding.educationZone).length > 0 },
        { label: "Local council area", completed: trimmed(branding.councilArea).length > 0 },
        { label: "Contact phone", completed: trimmed(branding.contactPhone).length > 0 },
        { label: "Contact email", completed: trimmed(branding.contactEmail).length > 0 },
        { label: "Head of school", completed: trimmed(branding.headmasterName).length > 0 },
        { label: "Default remark", completed: trimmed(branding.defaultRemark).length > 0 },
        { label: "Logo uploaded", completed: brandingUploads.logoUrl.trim().length > 0 },
        { label: "Signature uploaded", completed: brandingUploads.signatureUrl.trim().length > 0 },
      ]
    },
    [branding, brandingUploads.logoUrl, brandingUploads.signatureUrl],
  )

  const brandingCompletion = useMemo(() => {
    if (!brandingChecklist.length) {
      return 0
    }

    const completed = brandingChecklist.filter((item) => item.completed).length
    return Math.min(100, Math.max(0, Math.round((completed / brandingChecklist.length) * 100)))
  }, [brandingChecklist])

  const refreshUsers = useCallback(async () => {
    const data = await fetchJson<{ users: StoredUser[] }>("/api/users")
    const mapped = data.users.map(mapStoredUser)
    setUsers(mapped)

    safeStorage.setItem("users", JSON.stringify(data.users))

    data.users.forEach((user) => dbManager.emit("userUpdated", user))
    dbManager.triggerEvent("usersRefreshed", data.users)
  }, [])

  const refreshClasses = useCallback(async () => {
    const data = await fetchJson<{ classes: ClassRow[] }>("/api/classes")
    const mapped = data.classes.map(mapClassRecord)
    setClasses(mapped)

    safeStorage.setItem("classes", JSON.stringify(mapped))

    mapped.forEach((classRecord) => dbManager.emit("classUpdated", classRecord))
    dbManager.triggerEvent("classesRefreshed", mapped)
  }, [])

  const refreshStudents = useCallback(async () => {
    const data = await fetchJson<{ students: StudentRecord[] }>("/api/students")
    const mapped = data.students.map(mapStudentRecord)
    setStudents(mapped)

    safeStorage.setItem("students", JSON.stringify(mapped))

    mapped.forEach((student) => dbManager.emit("studentUpdated", student))
    dbManager.triggerEvent("studentsRefreshed", mapped)
  }, [])

  const refreshBranding = useCallback(async () => {
    const data = await fetchJson<{ branding: BrandingRecord }>("/api/system/branding")
    const mapped = mapBranding(data.branding)
    setBranding(mapped)
    setBrandingUploads((previous) => {
      const hasLogo = Boolean(mapped.logoUrl)
      const hasSignature = Boolean(mapped.signatureUrl)

      return {
        ...previous,
        logoUrl: mapped.logoUrl ?? "",
        signatureUrl: mapped.signatureUrl ?? "",
        logoFileName: hasLogo ? previous.logoFileName || "Synced logo" : "",
        signatureFileName: hasSignature ? previous.signatureFileName || "Synced signature" : "",
        logoFileSize: hasLogo ? previous.logoFileSize : 0,
        signatureFileSize: hasSignature ? previous.signatureFileSize : 0,
        logoUploadedAt: hasLogo ? mapped.updatedAt ?? previous.logoUploadedAt : null,
        signatureUploadedAt: hasSignature ? mapped.updatedAt ?? previous.signatureUploadedAt : null,
      }
    })

    safeStorage.setItem("schoolBranding", JSON.stringify(mapped))

    dbManager.triggerEvent("brandingUpdated", mapped)
  }, [])

  const refreshSystemSettings = useCallback(async () => {
    const data = await fetchJson<{ settings: SystemSettingsRecord }>("/api/system/settings")
    const mapped = mapSystemSettings(data.settings)
    setSystemSettings(mapped)

    safeStorage.setItem("systemSettings", JSON.stringify(mapped))
    safeStorage.setItem("registrationEnabled", JSON.stringify(mapped.registrationEnabled))

    dbManager.triggerEvent("systemSettingsUpdated", mapped)
  }, [])

  const refreshMetrics = useCallback(async () => {
    const data = await fetchJson<SystemMetrics>("/api/system/metrics")
    setMetrics(data)
  }, [])

  const refreshPayments = useCallback(async () => {
    const data = await fetchJson<{ payments: PaymentInitializationRecord[] }>("/api/payments/records")
    const apiPayments = data.payments.map(mapPayment)

    let manualPayments: PaymentRow[] = []
    try {
      const stored = await dbManager.getPayments()
      if (Array.isArray(stored)) {
        manualPayments = stored.map((entry: any) => mapManualPayment(entry as Record<string, unknown>))
      }
    } catch (error) {
      console.warn("Unable to load accountant payment entries", error)
    }

    const combined = mergePaymentRows(apiPayments, manualPayments)
    setPayments(combined)

    safeStorage.setItem("superAdminPayments", JSON.stringify(combined))

    try {
      await dbManager.syncFinancialAnalytics(combined)
    } catch (error) {
      console.error("Failed to sync financial analytics from super admin dashboard:", error)
    }

    dbManager.triggerEvent("paymentsSynced", combined)
  }, [])

  const refreshReportCards = useCallback(async () => {
    const data = await fetchJson<{ reportCards: ReportCardRecord[] }>("/api/report-cards")
    const mapped = data.reportCards.map(mapReportCard)
    setReportCards(mapped)

    safeStorage.setItem("reportCards", JSON.stringify(mapped))

    mapped.forEach((reportCard) => dbManager.triggerEvent("reportCardUpdated", reportCard))
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshUsers(),
      refreshClasses(),
      refreshStudents(),
      refreshBranding(),
      refreshSystemSettings(),
      refreshMetrics(),
      refreshPayments(),
      refreshReportCards(),
    ])
  }, [
    refreshUsers,
    refreshClasses,
    refreshStudents,
    refreshBranding,
    refreshSystemSettings,
    refreshMetrics,
    refreshPayments,
    refreshReportCards,
  ])

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    refreshAll()
      .catch((error) => {
        if (!isMounted) {
          return
        }
        const message = error instanceof Error ? error.message : "Unable to load super admin dashboard"
        toast({ title: "Failed to load dashboard", description: message, variant: "destructive" })
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [refreshAll, toast])

  useEffect(() => {
    const handlePaymentsChange = () => {
      void refreshPayments()
    }

    dbManager.on("paymentsUpdated", handlePaymentsChange)
    dbManager.on("paymentCompleted", handlePaymentsChange)

    return () => {
      dbManager.off("paymentsUpdated", handlePaymentsChange)
      dbManager.off("paymentCompleted", handlePaymentsChange)
    }
  }, [refreshPayments])

  const sortedPayments = useMemo(() => {
    const getTime = (value?: string | null) => {
      if (!value) {
        return 0
      }
      const parsed = new Date(value).getTime()
      return Number.isNaN(parsed) ? 0 : parsed
    }

    return [...payments].sort((a, b) => getTime(b.updatedAt ?? b.createdAt) - getTime(a.updatedAt ?? a.createdAt))
  }, [payments])

  const systemStats = useMemo(() => {
    const totalUsers = users.length
    const totalStudents = users.filter((user) => user.role === "student").length
    const totalTeachers = users.filter((user) => user.role === "teacher").length
    const totalParents = users.filter((user) => user.role === "parent").length
    const paidPayments = payments.filter((payment) => payment.status === "completed")
    const pendingPayments = payments.filter((payment) => payment.status !== "completed")
    const monthlyRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const averages = reportCards.map((card) => calculateReportAverage(card))
    const averageGrade = averages.length
      ? Number((averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2))
      : 0
    const attendanceRate = metrics ? Math.min(100, Math.round(70 + metrics.activeUsers / 2)) : 0

    return {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalParents,
      activePayments: paidPayments.length,
      pendingPayments: pendingPayments.length,
      monthlyRevenue,
      averageGrade,
      attendanceRate,
    }
  }, [metrics, payments, reportCards, users])

  const paymentInsights = useMemo(() => {
    const manual = payments.filter((payment) => payment.source === "accountant")
    const online = payments.filter((payment) => payment.source === "api")

    const manualTotal = manual
      .filter((payment) => payment.status === "completed")
      .reduce((sum, payment) => sum + payment.amount, 0)
    const onlineTotal = online
      .filter((payment) => payment.status === "completed")
      .reduce((sum, payment) => sum + payment.amount, 0)

    return {
      manual,
      manualCount: manual.length,
      manualTotal,
      onlineCount: online.length,
      onlineTotal,
      pendingFollowUps: payments.filter((payment) => payment.status !== "completed").length,
    }
  }, [payments])

  const sortedReportCards = useMemo(
    () => [...reportCards].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    [reportCards],
  )

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshAll()
      toast({ title: "Dashboard refreshed", description: "Latest analytics are now displayed." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to refresh dashboard"
      toast({ title: "Refresh failed", description: message, variant: "destructive" })
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshAll, toast])

  const handleSaveBranding = useCallback(
    async (options?: SaveActionOptions) => {
      const silent = options?.silent ?? false
      const propagateError = options?.propagateError ?? false
      setIsSavingBranding(true)
      const compressWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()
      const resolveMediaValue = (value?: string | null, fallback?: string | null) => {
        if (typeof value === "string") {
          const trimmed = value.trim()
          if (trimmed.length > 0) {
            return trimmed
          }
        }

        if (typeof fallback === "string") {
          const trimmed = fallback.trim()
          if (trimmed.length > 0) {
            return trimmed
          }
        }

        return null
      }

      try {
        const normalizedFields = {
          schoolName: compressWhitespace(branding.schoolName),
          schoolAddress: compressWhitespace(branding.schoolAddress),
          educationZone: compressWhitespace(branding.educationZone),
          councilArea: compressWhitespace(branding.councilArea),
          contactPhone: branding.contactPhone.trim(),
          contactEmail: branding.contactEmail.trim(),
          headmasterName: compressWhitespace(branding.headmasterName),
          defaultRemark: branding.defaultRemark.trim(),
        }

        const payload = {
          ...normalizedFields,
          logoUrl: resolveMediaValue(brandingUploads.logoUrl, branding.logoUrl),
          signatureUrl: resolveMediaValue(brandingUploads.signatureUrl, branding.signatureUrl),
        }

        const response = await fetchJson<{ branding: BrandingRecord; message?: string }>("/api/system/branding", {
          method: "PUT",
          body: JSON.stringify(payload),
        })

        await dbManager.saveBranding({ ...payload })

        const mapped = mapBranding(response.branding)
        setBranding(mapped)
        const updatedTimestamp = mapped.updatedAt ?? new Date().toISOString()

        setBrandingUploads((previous) => ({
          ...previous,
          logoUrl: mapped.logoUrl ?? "",
          signatureUrl: mapped.signatureUrl ?? "",
          logoUploadedAt: mapped.logoUrl ? updatedTimestamp : previous.logoUploadedAt,
          signatureUploadedAt: mapped.signatureUrl ? updatedTimestamp : previous.signatureUploadedAt,
        }))

        if (!silent) {
          const successTitle = response.message ?? "Branding updated"
          toast({
            title: successTitle,
            description: "Your school's identity has been refreshed across every connected portal.",
          })
        }

        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update branding"
        if (!silent) {
          toast({ title: "Update failed", description: message, variant: "destructive" })
        }

        if (propagateError) {
          throw error instanceof Error ? error : new Error(message)
        }

        return false
      } finally {
        setIsSavingBranding(false)
      }
    },
    [branding, brandingUploads, toast],
  )

  const handleBrandingFile = useCallback((file: File, key: "logo" | "signature") => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const value = typeof event.target?.result === "string" ? event.target.result : ""
      setBrandingUploads((previous) => {
        const uploadedAt = new Date().toISOString()

        if (key === "logo") {
          return {
            ...previous,
            logoUrl: value,
            logoFileName: file.name,
            logoFileSize: file.size,
            logoUploadedAt: uploadedAt,
          }
        }

        return {
          ...previous,
          signatureUrl: value,
          signatureFileName: file.name,
          signatureFileSize: file.size,
          signatureUploadedAt: uploadedAt,
        }
      })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSaveSettings = useCallback(
    async (options?: SaveActionOptions) => {
      const silent = options?.silent ?? false
      const propagateError = options?.propagateError ?? false
      setIsSavingSettings(true)
      try {
        await fetchJson("/api/system/settings", {
          method: "PUT",
          body: JSON.stringify(systemSettings),
        })
        if (!silent) {
          toast({ title: "System settings saved" })
        }
        await refreshSystemSettings()
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save system settings"
        if (!silent) {
          toast({ title: "Save failed", description: message, variant: "destructive" })
        }

        if (propagateError) {
          throw error instanceof Error ? error : new Error(message)
        }

        return false
      } finally {
        setIsSavingSettings(false)
      }
    },
    [refreshSystemSettings, systemSettings, toast],
  )

  const handleSaveAllEntries = useCallback(async () => {
    if (isSavingAllEntries || isSavingBranding || isSavingSettings) {
      return
    }

    setIsSavingAllEntries(true)
    try {
      await handleSaveBranding({ silent: true, propagateError: true })
      await handleSaveSettings({ silent: true, propagateError: true })
      await refreshAll()
      toast({
        title: "All entries saved",
        description: "Every dashboard update is now synchronised across devices.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save all entries"
      toast({ title: "Save unsuccessful", description: message, variant: "destructive" })
    } finally {
      setIsSavingAllEntries(false)
    }
  }, [
    handleSaveBranding,
    handleSaveSettings,
    isSavingAllEntries,
    isSavingBranding,
    isSavingSettings,
    refreshAll,
    toast,
  ])

  const handleAddClassSubject = useCallback(() => {
    setClassForm((previous) => {
      const value = previous.subjectInput.trim()
      if (!value) {
        return previous
      }

      const normalized = value.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "")
      if (previous.subjects.some((subject) => subject.toLowerCase() === normalized.toLowerCase())) {
        return { ...previous, subjectInput: "" }
      }

      return { ...previous, subjects: [...previous.subjects, normalized], subjectInput: "" }
    })
  }, [])

  const handleRemoveClassSubject = useCallback((subject: string) => {
    setClassForm((previous) => ({
      ...previous,
      subjects: previous.subjects.filter((item) => item.toLowerCase() !== subject.toLowerCase()),
    }))
  }, [])

  const handleAddEditClassSubject = useCallback(() => {
    setEditClassForm((previous) => {
      const value = previous.subjectInput.trim()
      if (!value) {
        return previous
      }

      const normalized = value.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "")
      if (previous.subjects.some((subject) => subject.toLowerCase() === normalized.toLowerCase())) {
        return { ...previous, subjectInput: "" }
      }

      return { ...previous, subjects: [...previous.subjects, normalized], subjectInput: "" }
    })
  }, [])

  const handleRemoveEditClassSubject = useCallback((subject: string) => {
    setEditClassForm((previous) => ({
      ...previous,
      subjects: previous.subjects.filter((item) => item.toLowerCase() !== subject.toLowerCase()),
    }))
  }, [])

  const handleAddClass = useCallback(async () => {
    if (!classForm.name.trim()) {
      toast({ title: "Missing class name", description: "Please provide a class name." })
      return
    }

    if (!classForm.subjects.length) {
      toast({
        title: "Add subjects",
        description: "Include at least one subject offered in this class before saving.",
      })
      return
    }

    try {
      await fetchJson("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          name: classForm.name,
          level: classForm.level,
          capacity: classForm.capacity ? Number(classForm.capacity) : undefined,
          subjects: classForm.subjects,
        }),
      })
      toast({ title: "Class added" })
      setClassForm({ name: "", level: classForm.level, capacity: "", subjectInput: "", subjects: [] })
      await refreshClasses()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add class"
      toast({ title: "Class creation failed", description: message, variant: "destructive" })
    }
  }, [classForm, refreshClasses, toast])

  const handleOpenEditClass = useCallback((classRecord: ClassRow) => {
    setClassBeingEdited(classRecord)
    setEditClassForm({
      name: classRecord.name,
      level: classRecord.level,
      capacity: classRecord.capacity ? String(classRecord.capacity) : "",
      subjects: Array.isArray(classRecord.subjects) ? [...classRecord.subjects] : [],
      subjectInput: "",
    })
    setEditClassDialogOpen(true)
  }, [])

  const resetEditClassForm = useCallback(() => {
    setClassBeingEdited(null)
    setEditClassForm({
      name: "",
      level: "Junior Secondary",
      capacity: "",
      subjects: [],
      subjectInput: "",
    })
  }, [])

  const handleUpdateClass = useCallback(async () => {
    if (!classBeingEdited) {
      return
    }

    const trimmedName = editClassForm.name.trim()
    if (!trimmedName) {
      toast({ title: "Missing class name", description: "Please provide a class name." })
      return
    }

    try {
      await fetchJson("/api/classes", {
        method: "PUT",
        body: JSON.stringify({
          id: classBeingEdited.id,
          name: trimmedName,
          level: editClassForm.level,
          capacity: editClassForm.capacity ? Number(editClassForm.capacity) : undefined,
          subjects: editClassForm.subjects,
        }),
      })
      toast({ title: "Class updated" })
      setEditClassDialogOpen(false)
      resetEditClassForm()
      await refreshClasses()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update class"
      toast({ title: "Unable to update class", description: message, variant: "destructive" })
    }
  }, [classBeingEdited, editClassForm.capacity, editClassForm.level, editClassForm.name, editClassForm.subjects, refreshClasses, resetEditClassForm, toast])

  const handleDeleteClass = useCallback(async () => {
    if (!classToDelete) {
      return
    }

    try {
      await fetchJson(`/api/classes?id=${encodeURIComponent(classToDelete.id)}`, { method: "DELETE" })
      toast({ title: "Class removed" })
      setClassToDelete(null)
      await refreshClasses()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete class"
      toast({ title: "Deletion failed", description: message, variant: "destructive" })
    }
  }, [classToDelete, refreshClasses, toast])

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2d682d]">Super Admin Dashboard</h1>
            <p className="text-gray-600">Holistic control for every panel within the VEA portal</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TutorialLink href="https://www.youtube.com/watch?v=04854XqcfCY" />
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh Data
            </Button>
            <Button
              className="bg-[#b29032] hover:bg-[#9a7c2a]"
              onClick={handleSaveAllEntries}
              disabled={isSavingAllEntries || isSavingBranding || isSavingSettings}
            >
              {isSavingAllEntries ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSavingAllEntries ? "Saving..." : "Save All Entries"}
            </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)}>
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max flex-nowrap gap-1 bg-green-50 p-1">
            <TabsTrigger
              value="overview"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="branding"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Branding
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="approval"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Report Approval
            </TabsTrigger>
            <TabsTrigger
              value="receipts"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Students
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Users
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              System
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-gray-500">Preparing the latest analytics…</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Users</p>
                      <p className="text-2xl font-semibold text-[#2d682d]">{systemStats.totalUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-[#b29032]" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Monthly Revenue</p>
                      <p className="text-2xl font-semibold text-[#2d682d]">{formatCurrency(systemStats.monthlyRevenue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-[#b29032]" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Average Grade</p>
                      <p className="text-2xl font-semibold text-green-600">{systemStats.averageGrade}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Attendance Rate</p>
                      <p className="text-2xl font-semibold text-[#2d682d]">{systemStats.attendanceRate}%</p>
                    </div>
                    <Calendar className="h-8 w-8 text-[#b29032]" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-[#2d682d]/20">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Online Collections</p>
                      <p className="text-2xl font-semibold text-[#2d682d]">
                        {formatCurrency(paymentInsights.onlineTotal)}
                      </p>
                      <p className="text-xs text-gray-500">{paymentInsights.onlineCount} transactions</p>
                    </div>
                    <CreditCard className="h-8 w-8 text-[#2d682d]" />
                  </CardContent>
                </Card>
                <Card className="border-[#b29032]/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Manual Entries</p>
                      <p className="text-2xl font-semibold text-[#b29032]">
                        {formatCurrency(paymentInsights.manualTotal)}
                      </p>
                      <p className="text-xs text-gray-500">{paymentInsights.manualCount} accountant records</p>
                    </div>
                    <Wallet className="h-8 w-8 text-[#b29032]" />
                  </CardContent>
                </Card>
                <Card className="border-amber-300/40">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-gray-600">Pending Follow-ups</p>
                      <p className="text-2xl font-semibold text-amber-600">
                        {paymentInsights.pendingFollowUps}
                      </p>
                      <p className="text-xs text-gray-500">Awaiting confirmation or approval</p>
                    </div>
                    <RefreshCw className="h-8 w-8 text-amber-500" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Latest Payments</span>
                      <Badge variant="outline">{payments.length} records</Badge>
                    </CardTitle>
                    <CardDescription>Recent transactions across all payment channels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPayments.slice(0, 5).map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="font-medium">{payment.studentName}</div>
                              <div className="text-xs text-gray-500">{formatDate(payment.updatedAt)}</div>
                            </TableCell>
                            <TableCell>{payment.className ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="flex items-center gap-1">
                                {payment.method === "online" ? (
                                  <CreditCard className="h-3 w-3" />
                                ) : (
                                  <Wallet className="h-3 w-3" />
                                )}
                                {payment.method === "online" ? "Online" : "Manual"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  payment.status === "completed"
                                    ? "default"
                                    : payment.status === "pending"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {payment.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {!sortedPayments.length && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                              No payment records yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Recent Report Cards</span>
                      <Badge variant="outline">{reportCards.length} entries</Badge>
                    </CardTitle>
                    <CardDescription>Track academic performance across classes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead className="text-right">Average</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedReportCards.slice(0, 5).map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div className="font-medium">{report.studentName}</div>
                              <div className="text-xs text-gray-500">{formatDate(report.updatedAt)}</div>
                            </TableCell>
                            <TableCell>{report.className}</TableCell>
                            <TableCell className="text-right">{calculateReportAverage(report)}%</TableCell>
                          </TableRow>
                        ))}
                        {!sortedReportCards.length && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                              No report cards available yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <ExamScheduleOverview
                  role="super_admin"
                  title="Upcoming Exams"
                  description="Monitor the latest assessments scheduled across all classes."
                  className="h-full"
                  limit={6}
                  emptyState="No upcoming exams scheduled by administrators yet."
                />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Manual Accounting Entries</span>
                      <Badge variant="outline">{paymentInsights.manualCount}</Badge>
                    </CardTitle>
                    <CardDescription>Offline payments recorded from the accountant console.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {paymentInsights.manual.length ? (
                      paymentInsights.manual.slice(0, 5).map((payment) => (
                        <div key={payment.id} className="rounded-lg border border-[#b29032]/30 bg-[#fffaf2] p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-[#2d682d]">{payment.studentName}</p>
                              <p className="text-xs text-gray-500">
                                {payment.className ?? "—"} • {formatDate(payment.updatedAt)}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-[#b29032]/60 text-[#b29032]">
                              {formatCurrency(payment.amount)}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">Parent: {payment.parentName ?? "—"}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No manual entries recorded yet.</p>
                    )}
                    {paymentInsights.manual.length > 5 && (
                      <p className="text-xs text-gray-500">
                        {paymentInsights.manual.length - 5} additional entries available in the receipts tab.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#b29032]" />
                    Infrastructure Metrics
                  </CardTitle>
                  <CardDescription>Realtime service health for the deployed portal</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-gray-500">Server</p>
                    <p className="text-lg font-semibold">{metrics?.serverStatus ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Database</p>
                    <p className="text-lg font-semibold">{metrics?.databaseStatus ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">API latency</p>
                    <p className="text-lg font-semibold">{metrics ? `${metrics.apiResponseTime}ms` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active sessions</p>
                    <p className="text-lg font-semibold">{metrics?.activeUsers ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card className="overflow-hidden border-none shadow-xl ring-1 ring-emerald-100/70">
            <CardHeader className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-amber-500 px-6 py-8 text-white">
              <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 space-y-4">
                <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur">
                  Visual Experience
                </Badge>
                <CardTitle className="text-3xl font-semibold tracking-tight text-white">School Identity</CardTitle>
                <CardDescription className="max-w-2xl text-sm text-white/80">
                  Curate the logos, signatures, and official details that appear on every dashboard, report card, and notification.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 bg-slate-50/80 p-6">
              <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-amber-50 p-6 shadow-inner">
                    <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-emerald-200/60 blur-3xl" />
                    <div className="absolute -bottom-16 left-6 h-28 w-28 rounded-full bg-amber-200/50 blur-2xl" />
                    <div className="relative space-y-5 text-center">
                      <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/70 bg-white/70 shadow-lg">
                        {brandingUploads.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={brandingUploads.logoUrl} alt="School logo preview" className="h-full w-full object-contain" />
                        ) : (
                          <GraduationCap className="h-10 w-10 text-emerald-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700/80">Official Identity</p>
                        <h3 className="text-2xl font-bold text-emerald-900">{branding.schoolName || "Add your school name"}</h3>
                        <p className="text-sm text-emerald-900/80">
                          {branding.educationZone || "Education zone will appear here"}
                        </p>
                      </div>
                      <p className="text-sm text-emerald-900/70">
                        {branding.schoolAddress || "Share your official address to update receipts and transcripts."}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-800/90">
                        {branding.contactPhone && (
                          <Badge variant="outline" className="border-emerald-200 bg-white/90 text-emerald-700">
                            {branding.contactPhone}
                          </Badge>
                        )}
                        {branding.contactEmail && (
                          <Badge variant="outline" className="border-emerald-200 bg-white/90 text-emerald-700">
                            {branding.contactEmail}
                          </Badge>
                        )}
                        {branding.councilArea && (
                          <Badge variant="outline" className="border-emerald-200 bg-white/90 text-emerald-700">
                            {branding.councilArea}
                          </Badge>
                        )}
                      </div>
                      <div className="rounded-2xl border border-emerald-100/70 bg-white/70 p-4 text-left text-sm text-emerald-900/80 shadow-sm">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          <span>Head of School</span>
                          <span>{branding.headmasterName ? "Ready" : "Pending"}</span>
                        </div>
                        <p className="mt-2 text-base font-semibold text-emerald-900">
                          {branding.headmasterName || "Awaiting update"}
                        </p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-600">Default Remark</p>
                        <p className="mt-1 text-sm italic text-emerald-800/80">
                          {branding.defaultRemark || "Add an encouraging note that appears on every report card."}
                        </p>
                        <p className="mt-4 text-xs text-emerald-700/80">Last saved {formatDateTime(branding.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="group relative rounded-2xl border border-dashed border-emerald-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-lg">
                      <Label htmlFor="branding-logo" className="sr-only">
                        School Logo
                      </Label>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
                          {brandingUploads.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={brandingUploads.logoUrl} alt="School logo preview" className="h-full w-full object-contain" />
                          ) : (
                            <GraduationCap className="h-6 w-6" />
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                            !brandingUploads.logoUrl && "border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {brandingUploads.logoUrl ? "Preview ready" : "Awaiting upload"}
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-semibold text-gray-900">School Logo</p>
                        <p className="text-xs text-gray-500">Upload a transparent PNG or SVG for crisp documents.</p>
                      </div>
                      <Input
                        id="branding-logo"
                        type="file"
                        accept="image/*"
                        className="mt-3 cursor-pointer rounded-full border border-dashed border-emerald-200 bg-white/80 text-xs text-gray-600 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:border-emerald-400 focus-visible:ring-emerald-500"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            handleBrandingFile(file, "logo")
                            event.target.value = ""
                          }
                        }}
                      />
                      <dl className="mt-3 space-y-1 text-[11px] text-gray-500">
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">File</dt>
                          <dd className="text-gray-600">{brandingUploads.logoFileName || "Not uploaded"}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">Size</dt>
                          <dd className="text-gray-600">{formatFileSize(brandingUploads.logoFileSize)}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">Updated</dt>
                          <dd className="text-gray-600">{formatDateTime(brandingUploads.logoUploadedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="group relative rounded-2xl border border-dashed border-emerald-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-lg">
                      <Label htmlFor="branding-signature" className="sr-only">
                        Headmaster Signature
                      </Label>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-amber-50 text-amber-600 shadow-inner">
                          {brandingUploads.signatureUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={brandingUploads.signatureUrl}
                              alt="Headmaster signature preview"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Edit className="h-6 w-6" />
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                            !brandingUploads.signatureUrl && "border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {brandingUploads.signatureUrl ? "Signature ready" : "Awaiting upload"}
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-semibold text-gray-900">Headmaster Signature</p>
                        <p className="text-xs text-gray-500">Add a clear signature to authenticate student reports.</p>
                      </div>
                      <Input
                        id="branding-signature"
                        type="file"
                        accept="image/*"
                        className="mt-3 cursor-pointer rounded-full border border-dashed border-emerald-200 bg-white/80 text-xs text-gray-600 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:border-emerald-400 focus-visible:ring-emerald-500"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            handleBrandingFile(file, "signature")
                            event.target.value = ""
                          }
                        }}
                      />
                      <dl className="mt-3 space-y-1 text-[11px] text-gray-500">
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">File</dt>
                          <dd className="text-gray-600">{brandingUploads.signatureFileName || "Not uploaded"}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">Size</dt>
                          <dd className="text-gray-600">{formatFileSize(brandingUploads.signatureFileSize)}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-gray-700">Updated</dt>
                          <dd className="text-gray-600">{formatDateTime(brandingUploads.signatureUploadedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Branding completion</p>
                        <p className="text-xs text-gray-500">Complete these essentials to keep your reports and portals aligned.</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {brandingCompletion}% complete
                      </Badge>
                    </div>
                    <Progress
                      value={brandingCompletion}
                      className="mt-4 h-2 bg-emerald-100 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                    />
                    <ul className="mt-4 space-y-2">
                      {brandingChecklist.map((item) => (
                        <li
                          key={item.label}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition",
                            item.completed
                              ? "border-transparent bg-emerald-50/80 text-emerald-700 shadow-sm"
                              : "border-dashed border-emerald-200 bg-white text-gray-500",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {item.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                            {item.label}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide">
                            {item.completed ? "Ready" : "Pending"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Core school details</p>
                        <p className="text-xs text-gray-500">Displayed on login screens, dashboards, and PDF exports.</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Brand essentials
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="branding-school-name"
                          className="text-xs font-semibold uppercase tracking-wide text-emerald-700"
                        >
                          School Name
                        </Label>
                        <Input
                          id="branding-school-name"
                          value={branding.schoolName}
                          onChange={(event) => setBranding((prev) => ({ ...prev, schoolName: event.target.value }))}
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="branding-head-name"
                          className="text-xs font-semibold uppercase tracking-wide text-emerald-700"
                        >
                          Headmaster Name
                        </Label>
                        <Input
                          id="branding-head-name"
                          value={branding.headmasterName}
                          onChange={(event) => setBranding((prev) => ({ ...prev, headmasterName: event.target.value }))}
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="branding-zone" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Education Zone
                        </Label>
                        <Input
                          id="branding-zone"
                          value={branding.educationZone}
                          onChange={(event) => setBranding((prev) => ({ ...prev, educationZone: event.target.value }))}
                          placeholder="e.g. Municipal Education Zone"
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="branding-council"
                          className="text-xs font-semibold uppercase tracking-wide text-emerald-700"
                        >
                          Local Council Area
                        </Label>
                        <Input
                          id="branding-council"
                          value={branding.councilArea}
                          onChange={(event) => setBranding((prev) => ({ ...prev, councilArea: event.target.value }))}
                          placeholder="e.g. Bwari Area Council"
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="branding-address" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        School Address
                      </Label>
                      <Textarea
                        id="branding-address"
                        rows={3}
                        value={branding.schoolAddress}
                        onChange={(event) => setBranding((prev) => ({ ...prev, schoolAddress: event.target.value }))}
                        className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Contact & reporting</p>
                        <p className="text-xs text-gray-500">Used on invoices, report cards, and notification emails.</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Communication ready
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="branding-phone" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Contact Phone
                        </Label>
                        <Input
                          id="branding-phone"
                          value={branding.contactPhone}
                          onChange={(event) => setBranding((prev) => ({ ...prev, contactPhone: event.target.value }))}
                          placeholder="e.g. +234 (0) 700-832-2025"
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="branding-email" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Contact Email
                        </Label>
                        <Input
                          id="branding-email"
                          type="email"
                          value={branding.contactEmail}
                          onChange={(event) => setBranding((prev) => ({ ...prev, contactEmail: event.target.value }))}
                          placeholder="e.g. info@victoryacademy.edu.ng"
                          className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="branding-remark" className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Default Report Remark
                      </Label>
                      <Textarea
                        id="branding-remark"
                        rows={4}
                        value={branding.defaultRemark}
                        onChange={(event) => setBranding((prev) => ({ ...prev, defaultRemark: event.target.value }))}
                        className="rounded-xl border-emerald-100 bg-white/90 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-gray-600">
                      Changes sync instantly across report cards, receipts, and parent portals once saved.
                    </p>
                    <Button
                      type="button"
                      onClick={handleSaveBranding}
                      disabled={isSavingBranding}
                      className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400/70"
                    >
                      <Save className={cn("h-4 w-4", isSavingBranding && "animate-spin")} />
                      <span>{isSavingBranding ? "Saving changes" : "Save branding"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <InternalMessaging currentUser={{ id: "super-admin", name: "Super Admin", role: "super_admin" }} />
        </TabsContent>

        <TabsContent value="approval" className="space-y-6">
          <SchoolCalendarApprovalPanel />
          <AdminApprovalDashboard />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-6">
          <PaymentManagement />
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <StudentManagement />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Academic calendar controls shared across the entire portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-academic-year">Academic Year</Label>
                    <Input
                      id="settings-academic-year"
                      value={systemSettings.academicYear}
                      onChange={(event) =>
                        setSystemSettings((prev) => ({ ...prev, academicYear: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-term">Current Term</Label>
                    <Input
                      id="settings-term"
                      value={systemSettings.currentTerm}
                      onChange={(event) =>
                        setSystemSettings((prev) => ({ ...prev, currentTerm: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="settings-deadline">Report Card Deadline</Label>
                    <Input
                      id="settings-deadline"
                      type="date"
                      value={systemSettings.reportCardDeadline}
                      onChange={(event) =>
                        setSystemSettings((prev) => ({ ...prev, reportCardDeadline: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium">Parent Self-Registration</p>
                    <p className="text-sm text-gray-500">
                      Allow guardians to onboard directly via the public portal.
                    </p>
                  </div>
                  <Select
                    value={systemSettings.registrationEnabled ? "enabled" : "disabled"}
                    onValueChange={(value) =>
                      setSystemSettings((prev) => ({ ...prev, registrationEnabled: value === "enabled" }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                    <Save className={cn("mr-2 h-4 w-4", isSavingSettings && "animate-spin")} />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Class Management</CardTitle>
                <CardDescription>Create classes and keep teacher assignments aligned.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="class-name">Class Name</Label>
                    <Input
                      id="class-name"
                      value={classForm.name}
                      onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class-level">Level</Label>
                    <Select
                      value={classForm.level}
                      onValueChange={(value) => setClassForm((prev) => ({ ...prev, level: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Junior Secondary">Junior Secondary</SelectItem>
                        <SelectItem value="Senior Secondary">Senior Secondary</SelectItem>
                        <SelectItem value="Primary">Primary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class-capacity">Capacity</Label>
                    <Input
                      id="class-capacity"
                      type="number"
                      value={classForm.capacity}
                      onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class-subject-input">Subjects</Label>
                  <div className="flex flex-wrap gap-2 rounded-md border border-dashed border-[#2d682d]/30 bg-[#f8faf5] p-3">
                    {classForm.subjects.length ? (
                      classForm.subjects.map((subject) => (
                        <Badge key={subject} variant="secondary" className="flex items-center gap-2 bg-[#2d682d]/10 text-[#1f4a1f]">
                          {subject}
                          <button
                            type="button"
                            onClick={() => handleRemoveClassSubject(subject)}
                            className="rounded-full p-0.5 text-[#1f4a1f]/70 transition hover:bg-[#2d682d]/10 hover:text-[#1f4a1f]"
                            aria-label={`Remove ${subject}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">No subjects added yet.</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="class-subject-input"
                      placeholder="Add subject e.g. Mathematics"
                      value={classForm.subjectInput}
                      onChange={(event) => setClassForm((prev) => ({ ...prev, subjectInput: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          handleAddClassSubject()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddClassSubject} className="sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" /> Add Subject
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAddClass}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Class
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Subjects</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.length ? (
                      classes.map((classRecord) => (
                        <TableRow key={classRecord.id}>
                          <TableCell>{classRecord.name}</TableCell>
                          <TableCell>{classRecord.level}</TableCell>
                          <TableCell>{classRecord.capacity ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(classRecord.subjects ?? []).length ? (
                                classRecord.subjects?.map((subject) => (
                                  <Badge key={`${classRecord.id}-${subject}`} variant="outline" className="border-[#2d682d]/30 text-[#2d682d]">
                                    {subject}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No subjects</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditClass(classRecord)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setClassToDelete(classRecord)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                          No classes defined yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <FinancialReports />
        </TabsContent>
      </Tabs>

      <Dialog
        open={editClassDialogOpen}
        onOpenChange={(open) => {
          setEditClassDialogOpen(open)
          if (!open) {
            resetEditClassForm()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update class details and align subjects with the curriculum.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class-name">Class Name</Label>
              <Input
                id="edit-class-name"
                value={editClassForm.name}
                onChange={(event) => setEditClassForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-level">Level</Label>
              <Select
                value={editClassForm.level}
                onValueChange={(value) => setEditClassForm((prev) => ({ ...prev, level: value }))}
              >
                <SelectTrigger id="edit-class-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Junior Secondary">Junior Secondary</SelectItem>
                  <SelectItem value="Senior Secondary">Senior Secondary</SelectItem>
                  <SelectItem value="Primary">Primary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-capacity">Capacity</Label>
              <Input
                id="edit-class-capacity"
                type="number"
                value={editClassForm.capacity}
                onChange={(event) => setEditClassForm((prev) => ({ ...prev, capacity: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class-subject">Subjects</Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-dashed border-[#2d682d]/30 bg-[#f8faf5] p-3">
                {editClassForm.subjects.length ? (
                  editClassForm.subjects.map((subject) => (
                    <Badge key={`${classBeingEdited?.id ?? "edit"}-${subject}`} variant="secondary" className="flex items-center gap-2 bg-[#2d682d]/10 text-[#1f4a1f]">
                      {subject}
                      <button
                        type="button"
                        onClick={() => handleRemoveEditClassSubject(subject)}
                        className="rounded-full p-0.5 text-[#1f4a1f]/70 transition hover:bg-[#2d682d]/10 hover:text-[#1f4a1f]"
                        aria-label={`Remove ${subject}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">No subjects assigned yet.</span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="edit-class-subject"
                  placeholder="Add subject e.g. Biology"
                  value={editClassForm.subjectInput}
                  onChange={(event) => setEditClassForm((prev) => ({ ...prev, subjectInput: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleAddEditClassSubject()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddEditClassSubject} className="sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Add Subject
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditClassDialogOpen(false)
                resetEditClassForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateClass}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!classToDelete} onOpenChange={(open) => !open && setClassToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove class?</AlertDialogTitle>
            <AlertDialogDescription>
              Students and teachers linked to this class will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClass} className="bg-red-600 hover:bg-red-600/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
