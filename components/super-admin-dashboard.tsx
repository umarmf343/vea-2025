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
  StoredUser,
  SystemSettingsRecord,
} from "@/lib/database"
import { AdminApprovalDashboard } from "@/components/admin-approval-dashboard"
import { FinancialReports } from "@/components/financial-reports"
import { InternalMessaging } from "@/components/internal-messaging"
import {
  BarChart3,
  Calendar,
  Download,
  Edit,
  GraduationCap,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  TrendingUp,
  Users,
  DollarSign,
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
  | "reportcards"
  | "approval"
  | "receipts"
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
}

interface UserFormState {
  name: string
  email: string
  role: PanelRole
  status: UserStatus
  password: string
  phone: string
  address: string
  classId: string
  subjects: string[]
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
  headmasterName: string
  defaultRemark: string
  logoUrl: string | null
  signatureUrl: string | null
  updatedAt?: string
}

interface SystemSettingsState {
  academicYear: string
  currentTerm: string
  registrationEnabled: boolean
  reportCardDeadline: string
}

interface PaymentRow {
  id: string
  studentId: string | null
  studentName: string
  amount: number
  status: "pending" | "completed" | "failed"
  reference: string
  paymentType: string
  email: string
  updatedAt: string
}

interface ReportCardRow extends Omit<ReportCardRecord, "subjects"> {
  subjects: ReportCardSubjectRecord[]
}

const ROLE_OPTIONS: Array<{ value: PanelRole; label: string }> = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "librarian", label: "Librarian" },
  { value: "accountant", label: "Accountant" },
]

const DEFAULT_BRANDING: BrandingState = {
  schoolName: "Victory Educational Academy",
  schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
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

const DEFAULT_USER_FORM: UserFormState = {
  name: "",
  email: "",
  role: "teacher",
  status: "active",
  password: "",
  phone: "",
  address: "",
  classId: "",
  subjects: [],
}

function normalizeRole(role: string): PanelRole {
  const normalized = role.trim().toLowerCase()
  switch (normalized) {
    case "super admin":
    case "super_admin":
      return "super_admin"
    case "admin":
      return "admin"
    case "teacher":
      return "teacher"
    case "parent":
      return "parent"
    case "librarian":
      return "librarian"
    case "accountant":
      return "accountant"
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

function gradeFromScore(score: number): string {
  if (score >= 75) return "A"
  if (score >= 60) return "B"
  if (score >= 50) return "C"
  if (score >= 45) return "D"
  if (score >= 40) return "E"
  return "F"
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

function mapPayment(record: PaymentInitializationRecord): PaymentRow {
  return {
    id: record.id,
    studentId: record.studentId,
    studentName: record.metadata?.studentName ?? record.metadata?.student ?? "Unknown",
    amount: Number(record.amount ?? 0),
    status: record.status,
    reference: record.reference,
    paymentType: record.paymentType,
    email: record.email,
    updatedAt: record.updatedAt ?? record.createdAt,
  }
}

function mapReportCard(record: ReportCardRecord): ReportCardRow {
  return {
    ...record,
    subjects: record.subjects ?? [],
  }
}

export default function SuperAdminDashboard() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview")
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [userForm, setUserForm] = useState<UserFormState>(DEFAULT_USER_FORM)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [classForm, setClassForm] = useState({ name: "", level: "Junior Secondary", capacity: "" })
  const [classToDelete, setClassToDelete] = useState<ClassRow | null>(null)

  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING)
  const [brandingUploads, setBrandingUploads] = useState({ logoUrl: "", signatureUrl: "" })
  const [isSavingBranding, setIsSavingBranding] = useState(false)

  const [systemSettings, setSystemSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  const [reportCards, setReportCards] = useState<ReportCardRow[]>([])
  const [selectedReportCard, setSelectedReportCard] = useState<ReportCardRow | null>(null)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportRemarks, setReportRemarks] = useState({ classTeacherRemark: "", headTeacherRemark: "" })
  const [reportToDelete, setReportToDelete] = useState<ReportCardRow | null>(null)
  const [isSavingReport, setIsSavingReport] = useState(false)

  const [isSavingUser, setIsSavingUser] = useState(false)

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

  const refreshBranding = useCallback(async () => {
    const data = await fetchJson<{ branding: BrandingRecord }>("/api/system/branding")
    const mapped = mapBranding(data.branding)
    setBranding(mapped)
    setBrandingUploads({ logoUrl: mapped.logoUrl ?? "", signatureUrl: mapped.signatureUrl ?? "" })

    safeStorage.setItem("schoolBranding", JSON.stringify(mapped))

    dbManager.triggerEvent("brandingUpdated", mapped)
  }, [])

  const refreshSystemSettings = useCallback(async () => {
    const data = await fetchJson<{ settings: SystemSettingsRecord }>("/api/system/settings")
    const mapped = mapSystemSettings(data.settings)
    setSystemSettings(mapped)

    safeStorage.setItem("systemSettings", JSON.stringify(mapped))

    dbManager.triggerEvent("systemSettingsUpdated", mapped)
  }, [])

  const refreshMetrics = useCallback(async () => {
    const data = await fetchJson<SystemMetrics>("/api/system/metrics")
    setMetrics(data)
  }, [])

  const refreshPayments = useCallback(async () => {
    const data = await fetchJson<{ payments: PaymentInitializationRecord[] }>("/api/payments/records")
    const mapped = data.payments.map(mapPayment)
    setPayments(mapped)

    safeStorage.setItem("payments", JSON.stringify(mapped))

    dbManager.triggerEvent("paymentsUpdated", mapped)
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
      refreshBranding(),
      refreshSystemSettings(),
      refreshMetrics(),
      refreshPayments(),
      refreshReportCards(),
    ])
  }, [
    refreshUsers,
    refreshClasses,
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

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) {
      return users
    }
    const term = userSearch.trim().toLowerCase()
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        formatRole(user.role).toLowerCase().includes(term),
    )
  }, [userSearch, users])

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

  const handleOpenCreateUser = useCallback(() => {
    setEditingUserId(null)
    setUserForm(DEFAULT_USER_FORM)
    setUserDialogOpen(true)
  }, [])

  const handleEditUser = useCallback((user: UserRow) => {
    setEditingUserId(user.id)
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      password: "",
      phone: "",
      address: "",
      classId: user.classId ?? "",
      subjects: user.subjects ?? [],
    })
    setUserDialogOpen(true)
  }, [])

  const handleSaveUser = useCallback(async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast({ title: "Missing information", description: "Name and email are required." })
      return
    }

    if (!editingUserId && !userForm.password.trim()) {
      toast({ title: "Missing password", description: "New users must have a password." })
      return
    }

    setIsSavingUser(true)
    try {
      if (editingUserId) {
        await fetchJson("/api/users", {
          method: "PUT",
          body: JSON.stringify({
            id: editingUserId,
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            status: userForm.status,
            classId: userForm.classId || null,
            subjects: userForm.subjects,
            isActive: userForm.status === "active",
            password: userForm.password ? userForm.password : undefined,
          }),
        })
        toast({ title: "User updated" })
      } else {
        await fetchJson("/api/users", {
          method: "POST",
          body: JSON.stringify({
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            password: userForm.password,
            status: userForm.status,
            classId: userForm.classId || null,
            subjects: userForm.subjects,
          }),
        })
        toast({ title: "User created" })
      }

      setUserDialogOpen(false)
      setUserForm(DEFAULT_USER_FORM)
      setEditingUserId(null)
      await refreshUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save user"
      toast({ title: "User update failed", description: message, variant: "destructive" })
    } finally {
      setIsSavingUser(false)
    }
  }, [editingUserId, refreshUsers, toast, userForm])

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) {
      return
    }

    try {
      await fetchJson(`/api/users?id=${encodeURIComponent(userToDelete.id)}`, { method: "DELETE" })
      toast({ title: "User removed" })
      setUserToDelete(null)
      await refreshUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user"
      toast({ title: "Deletion failed", description: message, variant: "destructive" })
    }
  }, [refreshUsers, toast, userToDelete])

  const handleSaveBranding = useCallback(async () => {
    setIsSavingBranding(true)
    try {
      const payload = { ...branding, ...brandingUploads }

      await fetchJson("/api/system/branding", {
        method: "PUT",
        body: JSON.stringify(payload),
      })

      toast({ title: "Branding updated" })
      await refreshBranding()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update branding"
      toast({ title: "Update failed", description: message, variant: "destructive" })
    } finally {
      setIsSavingBranding(false)
    }
  }, [branding, brandingUploads, refreshBranding, toast])

  const handleBrandingFile = useCallback((file: File, key: "logoUrl" | "signatureUrl") => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const value = typeof event.target?.result === "string" ? event.target.result : ""
      setBrandingUploads((prev) => ({ ...prev, [key]: value }))
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true)
    try {
      await fetchJson("/api/system/settings", {
        method: "PUT",
        body: JSON.stringify(systemSettings),
      })
      toast({ title: "System settings saved" })
      await refreshSystemSettings()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save system settings"
      toast({ title: "Save failed", description: message, variant: "destructive" })
    } finally {
      setIsSavingSettings(false)
    }
  }, [refreshSystemSettings, systemSettings, toast])

  const handleAddClass = useCallback(async () => {
    if (!classForm.name.trim()) {
      toast({ title: "Missing class name", description: "Please provide a class name." })
      return
    }

    try {
      await fetchJson("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          name: classForm.name,
          level: classForm.level,
          capacity: classForm.capacity ? Number(classForm.capacity) : undefined,
        }),
      })
      toast({ title: "Class added" })
      setClassForm({ name: "", level: classForm.level, capacity: "" })
      await refreshClasses()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add class"
      toast({ title: "Class creation failed", description: message, variant: "destructive" })
    }
  }, [classForm, refreshClasses, toast])

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

  const handleOpenReportCard = useCallback((report: ReportCardRow) => {
    setSelectedReportCard(report)
    setReportRemarks({
      classTeacherRemark: report.classTeacherRemark ?? "",
      headTeacherRemark: report.headTeacherRemark ?? "",
    })
    setReportDialogOpen(true)
  }, [])

  const handleSaveReportCard = useCallback(async () => {
    if (!selectedReportCard) {
      return
    }

    setIsSavingReport(true)
    try {
      await fetchJson("/api/report-cards", {
        method: "PUT",
        body: JSON.stringify({
          id: selectedReportCard.id,
          studentId: selectedReportCard.studentId,
          studentName: selectedReportCard.studentName,
          className: selectedReportCard.className,
          term: selectedReportCard.term,
          session: selectedReportCard.session,
          subjects: selectedReportCard.subjects,
          classTeacherRemark: reportRemarks.classTeacherRemark,
          headTeacherRemark: reportRemarks.headTeacherRemark,
        }),
      })

      toast({ title: "Report card updated" })
      await refreshReportCards()
      setReportDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update report card"
      toast({ title: "Update failed", description: message, variant: "destructive" })
    } finally {
      setIsSavingReport(false)
    }
  }, [refreshReportCards, reportRemarks.classTeacherRemark, reportRemarks.headTeacherRemark, selectedReportCard, toast])

  const handleDeleteReport = useCallback(async () => {
    if (!reportToDelete) {
      return
    }

    try {
      await fetchJson(`/api/report-cards?id=${encodeURIComponent(reportToDelete.id)}`, { method: "DELETE" })
      toast({ title: "Report card removed" })
      setReportToDelete(null)
      await refreshReportCards()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete report card"
      toast({ title: "Deletion failed", description: message, variant: "destructive" })
    }
  }, [refreshReportCards, reportToDelete, toast])

  const handlePrintReceipt = useCallback(
    (payment: PaymentRow) => {
      const browserWindow =
        typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).window === "object"
          ? (globalThis as { window: Window }).window
          : undefined

      if (!browserWindow) {
        return
      }

      const printWindow = browserWindow.open("", "_blank")
      if (!printWindow) {
        return
      }

      const brandingHeading = branding.schoolName
        ? `<h2 style="margin: 0; color: #2d682d;">${branding.schoolName}</h2>`
        : "<h2 style=\"margin: 0; color: #2d682d;\">Payment Receipt</h2>"

      const doc = printWindow.document

      doc.write(`
        <html>
          <head>
            <title>Payment Receipt - ${payment.reference}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
              .header { text-align: center; margin-bottom: 24px; }
              .section { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
              .label { font-weight: 600; color: #4b5563; }
            </style>
          </head>
          <body>
            <div class="header">
              ${brandingUploads.logoUrl
                ? `<img src="${brandingUploads.logoUrl}" alt="School Logo" style="max-height: 64px; margin-bottom: 12px;" />`
                : ""}
              ${brandingHeading}
              <p style="margin-top: 4px;">Official payment acknowledgement</p>
            </div>
            <div class="section">
              <div><span class="label">Receipt No:</span> ${payment.reference}</div>
              <div><span class="label">Student:</span> ${payment.studentName}</div>
              <div><span class="label">Amount:</span> ${formatCurrency(payment.amount)}</div>
              <div><span class="label">Status:</span> ${payment.status.toUpperCase()}</div>
              <div><span class="label">Updated:</span> ${formatDate(payment.updatedAt)}</div>
            </div>
            <p style="text-align: center; font-size: 12px; color: #6b7280;">Thank you for your payment.</p>
          </body>
        </html>
      `)
      doc.close()
      printWindow.print()
    },
    [branding.schoolName, brandingUploads.logoUrl],
  )

  const handleDownloadReceipt = useCallback((payment: PaymentRow) => {
    const browserWindow =
      typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).window === "object"
        ? (globalThis as { window: Window }).window
        : undefined

    if (!browserWindow) {
      return
    }

    const payload = {
      reference: payment.reference,
      studentName: payment.studentName,
      amount: payment.amount,
      status: payment.status,
      updatedAt: payment.updatedAt,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = browserWindow.document.createElement("a")
    link.href = url
    link.download = `receipt-${payment.reference}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2d682d]">Super Admin Dashboard</h1>
          <p className="text-gray-600">Holistic control for every panel within the VEA portal</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh Data
          </Button>
          <Button className="bg-[#b29032] hover:bg-[#9a7c2a]" onClick={() => setActiveTab("system")}>
            <Shield className="mr-2 h-4 w-4" />
            Admin Tools
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="reportcards">Report Cards</TabsTrigger>
          <TabsTrigger value="approval">Report Approval</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-gray-500">Preparing the latest analytics…</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.slice(0, 5).map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="font-medium">{payment.studentName}</div>
                              <div className="text-xs text-gray-500">{formatDate(payment.updatedAt)}</div>
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
                        {!payments.length && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-gray-500">
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
          <Card>
            <CardHeader>
              <CardTitle>School Identity</CardTitle>
              <CardDescription>Control the visuals and remarks shared across all portals and documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="text-center">
                  <div className="mb-4 flex h-24 items-center justify-center rounded-lg border">
                    {brandingUploads.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brandingUploads.logoUrl} alt="School logo preview" className="max-h-24" />
                    ) : (
                      <GraduationCap className="h-10 w-10 text-[#2d682d]" />
                    )}
                  </div>
                  <Label htmlFor="branding-logo">School Logo</Label>
                  <Input
                    id="branding-logo"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleBrandingFile(file, "logoUrl")
                      }
                    }}
                  />
                </div>
                <div className="text-center">
                  <div className="mb-4 flex h-24 items-center justify-center rounded-lg border">
                    {brandingUploads.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brandingUploads.signatureUrl} alt="Headmaster signature" className="max-h-24" />
                    ) : (
                      <Edit className="h-10 w-10 text-[#b29032]" />
                    )}
                  </div>
                  <Label htmlFor="branding-signature">Headmaster Signature</Label>
                  <Input
                    id="branding-signature"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleBrandingFile(file, "signatureUrl")
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Updated</Label>
                  <p className="rounded border bg-muted px-3 py-2 text-sm text-gray-600">
                    {branding.updatedAt ? formatDate(branding.updatedAt) : "Not set"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="branding-school-name">School Name</Label>
                  <Input
                    id="branding-school-name"
                    value={branding.schoolName}
                    onChange={(event) => setBranding((prev) => ({ ...prev, schoolName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branding-head-name">Headmaster Name</Label>
                  <Input
                    id="branding-head-name"
                    value={branding.headmasterName}
                    onChange={(event) => setBranding((prev) => ({ ...prev, headmasterName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="branding-address">School Address</Label>
                  <Textarea
                    id="branding-address"
                    rows={3}
                    value={branding.schoolAddress}
                    onChange={(event) => setBranding((prev) => ({ ...prev, schoolAddress: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="branding-remark">Default Report Remark</Label>
                  <Textarea
                    id="branding-remark"
                    rows={3}
                    value={branding.defaultRemark}
                    onChange={(event) => setBranding((prev) => ({ ...prev, defaultRemark: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBranding} disabled={isSavingBranding}>
                  <Save className={cn("mr-2 h-4 w-4", isSavingBranding && "animate-spin")} />
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <InternalMessaging currentUser={{ id: "super-admin", name: "Super Admin", role: "super_admin" }} />
        </TabsContent>

        <TabsContent value="reportcards" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Academic Records</CardTitle>
                <CardDescription>All generated report cards across the school.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportCards.length ? (
                    sortedReportCards.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="font-medium">{report.studentName}</div>
                          <div className="text-xs text-gray-500">{formatDate(report.updatedAt)}</div>
                        </TableCell>
                        <TableCell>{report.className}</TableCell>
                        <TableCell>
                          {report.term} ({report.session})
                        </TableCell>
                        <TableCell className="text-right">{calculateReportAverage(report)}%</TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenReportCard(report)}>
                            View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setReportToDelete(report)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                        No report cards available yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="space-y-6">
          <AdminApprovalDashboard />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Receipts</CardTitle>
              <CardDescription>Generate official receipts for parents and guardians.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length ? (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.studentName}</TableCell>
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
                        <TableCell>{payment.reference}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handlePrintReceipt(payment)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadReceipt(payment)}>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
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
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>User Directory</CardTitle>
                <CardDescription>Manage every actor across the school portal.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-60"
                  placeholder="Search by name, email or role"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
                <Button onClick={handleOpenCreateUser}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </TableCell>
                        <TableCell>{formatRole(user.role)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.status === "active"
                                ? "default"
                                : user.status === "suspended"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {user.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastLogin ? formatDate(user.lastLogin) : "—"}</TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setUserToDelete(user)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                        No users match the search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                          <TableCell className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setClassToDelete(classRecord)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-gray-500">
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

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUserId ? "Update User" : "Create User"}</DialogTitle>
            <DialogDescription>Access control for every panel begins here.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select value={userForm.role} onValueChange={(value: PanelRole) => setUserForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-status">Status</Label>
              <Select
                value={userForm.status}
                onValueChange={(value: UserStatus) => setUserForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingUserId && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="user-password">Password</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="user-class">Class</Label>
              <Input
                id="user-class"
                value={userForm.classId}
                onChange={(event) => setUserForm((prev) => ({ ...prev, classId: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-subjects">Subjects (comma separated)</Label>
              <Input
                id="user-subjects"
                value={userForm.subjects.join(", ")}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, subjects: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              <Save className={cn("mr-2 h-4 w-4", isSavingUser && "animate-spin")} />
              Save User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Card Overview</DialogTitle>
            <DialogDescription>
              {selectedReportCard?.studentName} • {selectedReportCard?.className} • {selectedReportCard?.term} ({selectedReportCard?.session})
            </DialogDescription>
          </DialogHeader>
          {selectedReportCard ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReportCard.subjects.map((subject) => (
                    <TableRow key={`${selectedReportCard.id}-${subject.name}`}>
                      <TableCell>{subject.name}</TableCell>
                      <TableCell className="text-right">{subject.total}</TableCell>
                      <TableCell className="text-right">{subject.grade ?? gradeFromScore(subject.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-class-remark">Class Teacher Remark</Label>
                  <Textarea
                    id="report-class-remark"
                    rows={3}
                    value={reportRemarks.classTeacherRemark}
                    onChange={(event) =>
                      setReportRemarks((prev) => ({ ...prev, classTeacherRemark: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-head-remark">Head Teacher Remark</Label>
                  <Textarea
                    id="report-head-remark"
                    rows={3}
                    value={reportRemarks.headTeacherRemark}
                    onChange={(event) =>
                      setReportRemarks((prev) => ({ ...prev, headTeacherRemark: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <p>No report selected.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSaveReportCard} disabled={isSavingReport}>
              <Save className={cn("mr-2 h-4 w-4", isSavingReport && "animate-spin")} />
              Save Remarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action removes the selected user from every connected panel. It can be reversed by creating the user again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-600/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report card?</AlertDialogTitle>
            <AlertDialogDescription>
              Parents and teachers will no longer be able to view this result until it is regenerated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-red-600 hover:bg-red-600/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
