"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { GraduationCap, Users, BookOpen, DollarSign, UserCheck, Key, Loader2 } from "lucide-react"
import { PaymentModal } from "@/components/payment-modal"
import { StudentProfileCard } from "@/components/student-profile-card"
import { AcademicProgress } from "@/components/academic-progress"
import { AttendanceTracker } from "@/components/attendance-tracker"
import { SystemOverview } from "@/components/admin/system-overview"
import { StudentManagement } from "@/components/admin/student-management"
import { PaymentManagement } from "@/components/admin/payment-management"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { StudentDashboard } from "@/components/student-dashboard"
import { LibrarianDashboard } from "@/components/librarian-dashboard"
import AccountantDashboard from "@/components/accountant-dashboard"
import TimetableManagement from "@/components/timetable-management"
import ExamManagement from "@/components/exam-management"
import SuperAdminDashboard from "@/components/super-admin-dashboard"
import { Noticeboard } from "@/components/noticeboard"
import { UserManagement } from "@/components/admin/user-management"
import { ClassSubjectManagement } from "@/components/admin/class-subject-management"
import { SystemSettings } from "@/components/admin/system-settings"
import { CumulativeReportTrigger } from "@/components/cumulative-report"
import { SystemHealthMonitor } from "@/components/system-health-monitor"
import { NotificationCenter } from "@/components/notification-center"
import { ReportCardViewer } from "@/components/report-card-viewer"
import type { RawReportCardData } from "@/lib/report-card-types"
import { AutomaticPromotionSystem } from "@/components/automatic-promotion-system"
import { getStudentReportCardData } from "@/lib/report-card-data"
import { InternalMessaging, type MessagingParticipant } from "@/components/internal-messaging"
import { AdminApprovalDashboard } from "@/components/admin-approval-dashboard"
import { safeStorage } from "@/lib/safe-storage"
import { getBrandingFromStorage } from "@/lib/branding"
import { dbManager } from "@/lib/database-manager"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { normalizeTimetableCollection } from "@/lib/timetable"
import { deriveGradeFromScore } from "@/lib/grade-utils"
import { toast } from "@/hooks/use-toast"
import type { Viewport } from "next"
import Image from "next/image"
import { SchoolCalendarManager } from "@/components/admin/school-calendar-manager"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { TimetableWeeklyView, type TimetableWeeklyViewSlot } from "@/components/timetable-weekly-view"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { Skeleton } from "@/components/ui/skeleton"
import {
  grantReportCardAccess,
  normalizeTermLabel,
  REPORT_CARD_ACCESS_EVENT,
  type ReportCardAccessRecord,
  syncReportCardAccess,
} from "@/lib/report-card-access"
import { useBranding } from "@/hooks/use-branding"
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

export const dynamic = "force-dynamic"
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

type UserRole = "super-admin" | "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant"

const SELECTABLE_LOGIN_ROLES: readonly UserRole[] = ["teacher", "student", "parent"]

const CONTACT_DEVELOPER_URL =
  "https://wa.me/8100362023?text=" +
  encodeURIComponent(
    "Hello! I'd love to learn more about the Advanced SchoolPortal and how it can elevate our school's experience.",
  )

interface User {
  id: string
  email: string
  role: UserRole
  name: string
  hasAccess?: boolean
  classId?: string | null
  className?: string | null
  subjects?: string[]
  classIds?: string[]
  teachingAssignments?: { classId: string; className: string; subjects: string[] }[]
  assignedClassIds?: string[]
  assignedClassNames?: string[]
  assignedClasses?: { id: string; name: string }[]
  metadata?: Record<string, unknown> | null
}

interface ParentStudentProfile {
  id: string
  name: string
  class: string
  section: string
  admissionNumber: string
  dateOfBirth: string
  address: string
  phone: string
  email: string
  status: "active" | "inactive"
  avatar?: string | null
}

interface ParentAcademicSummaryState {
  subjects: Array<{
    name: string
    score: number
    grade: string
    position: number | null
    totalStudents: number
  }>
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
}

interface ParentAttendanceSummaryState {
  totalDays: number
  presentDays: number
  absentDays: number
  lateArrivals: number
  attendancePercentage: number
  recentAttendance: Array<{ date: string; status: "present" | "absent" | "late" }>
}

const mapApiRoleToUi = (role: string): UserRole => {
  switch (role) {
    case "super_admin":
    case "super-admin":
      return "super-admin"
    case "admin":
      return "admin"
    case "teacher":
      return "teacher"
    case "student":
      return "student"
    case "librarian":
      return "librarian"
    case "accountant":
      return "accountant"
    case "parent":
    default:
      return "parent"
  }
}

const mapUiRoleToApi = (role: UserRole): string => {
  if (role === "super-admin") {
    return "super_admin"
  }
  return role
}

const roleHasPortalAccess = (role: UserRole): boolean => {
  return role === "admin" || role === "super-admin" || role === "teacher"
}

const requiresClassSelection = (role: UserRole): boolean => role === "teacher" || role === "student"

const NO_CLASS_OPTION = "__no_class__"

interface FallbackAccount extends Omit<User, "hasAccess"> {
  password: string
  hasAccess?: boolean
  token?: string
}

const normalizeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return ""
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toUniqueStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value
    .map((entry) => normalizeString(entry))
    .filter((entry) => entry.length > 0)

  return Array.from(new Set(normalized))
}

const buildIdentifierFromName = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized
}

const normalizeTeachingAssignments = (
  input: unknown,
  options: {
    fallbackClassId?: unknown
    fallbackClassName?: unknown
    fallbackSubjects?: unknown
    fallbackAssignedClasses?: unknown
  } = {},
): { classId: string; className: string; subjects: string[] }[] => {
  const assignments: { classId: string; className: string; subjects: string[] }[] = []

  if (Array.isArray(input)) {
    input.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return
      }

      const record = entry as Record<string, any>
      const classIdCandidate = normalizeString(record.classId ?? record.class_id ?? record.id)
      const classNameCandidate = normalizeString(record.className ?? record.class_name ?? record.name)
      const subjects = toUniqueStringArray(record.subjects)
      const resolvedClassId =
        classIdCandidate || (classNameCandidate ? buildIdentifierFromName(classNameCandidate) : "") ||
        `class_${index}`
      const resolvedClassName = classNameCandidate || classIdCandidate || `Class ${index + 1}`

      assignments.push({
        classId: resolvedClassId,
        className: resolvedClassName,
        subjects,
      })
    })
  }

  const fallbackAssignedClasses = Array.isArray(options.fallbackAssignedClasses)
    ? options.fallbackAssignedClasses
    : []

  fallbackAssignedClasses.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return
    }

    const record = entry as Record<string, any>
    const classIdCandidate = normalizeString(record.id ?? record.classId ?? record.class_id)
    const classNameCandidate = normalizeString(record.name ?? record.className ?? record.class_name)
    const resolvedClassId =
      classIdCandidate || (classNameCandidate ? buildIdentifierFromName(classNameCandidate) : "") ||
      `class_assigned_${index}`
    const resolvedClassName = classNameCandidate || classIdCandidate || `Assigned Class ${index + 1}`

    assignments.push({
      classId: resolvedClassId,
      className: resolvedClassName,
      subjects: [],
    })
  })

  const fallbackClassId = normalizeString(options.fallbackClassId)
  const fallbackClassName = normalizeString(options.fallbackClassName)
  const fallbackSubjects = toUniqueStringArray(options.fallbackSubjects)

  if (assignments.length === 0 && (fallbackClassId || fallbackClassName)) {
    const resolvedClassId =
      fallbackClassId || (fallbackClassName ? buildIdentifierFromName(fallbackClassName) : "") || "class_fallback"
    const resolvedClassName = fallbackClassName || fallbackClassId || "Assigned Class"

    assignments.push({
      classId: resolvedClassId,
      className: resolvedClassName,
      subjects: fallbackSubjects,
    })
  }

  const seen = new Set<string>()

  return assignments
    .map((assignment, index) => {
      const classId = assignment.classId.trim().length > 0 ? assignment.classId.trim() : `class_${index}`
      const className = assignment.className.trim().length > 0 ? assignment.className.trim() : `Class ${index + 1}`
      const subjects = Array.from(
        new Set(assignment.subjects.map((subject) => subject.trim()).filter((subject) => subject.length > 0)),
      )
      const key = `${classId.toLowerCase()}::${className.toLowerCase()}`

      if (seen.has(key)) {
        return null
      }

      seen.add(key)
      return { classId, className, subjects }
    })
    .filter((assignment): assignment is { classId: string; className: string; subjects: string[] } => assignment !== null)
}

interface BuildUserStateOptions {
  resolvedRole: UserRole
  fallbackEmail: string
  fallbackName?: string
  fallbackHasAccess?: boolean
}

const buildUserState = (
  rawUser: Record<string, any> | null | undefined,
  options: BuildUserStateOptions,
): User => {
  const fallbackEmail = options.fallbackEmail || `${options.resolvedRole}@vea.edu.ng`
  const email = normalizeString(rawUser?.email) || fallbackEmail
  const id = normalizeString(rawUser?.id) || email
  const metadata = isPlainObject(rawUser?.metadata) ? (rawUser?.metadata as Record<string, any>) : null
  const classId = normalizeString(rawUser?.classId ?? rawUser?.class_id)
  const className =
    normalizeString(rawUser?.className ?? rawUser?.class_name) ||
    normalizeString(metadata?.assignedClassName ?? metadata?.className ?? metadata?.class)
  const explicitSubjects = toUniqueStringArray(rawUser?.subjects)
  const metadataSubjects = metadata ? toUniqueStringArray(metadata.subjects) : []
  const fallbackSubjects = explicitSubjects.length > 0 ? explicitSubjects : metadataSubjects
  const assignedClassIdsFromRaw = toUniqueStringArray(
    rawUser?.assignedClassIds ?? rawUser?.assigned_class_ids ?? rawUser?.teachingClassIds,
  )
  const assignedClassNamesFromRaw = toUniqueStringArray(
    rawUser?.assignedClassNames ?? rawUser?.assigned_class_names,
  )
  const assignedClassSummaries = Array.isArray(rawUser?.assignedClasses)
    ? (rawUser?.assignedClasses as unknown[])
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") {
            return null
          }

          const record = entry as Record<string, any>
          const idCandidate = normalizeString(record.id ?? record.classId ?? record.class_id)
          const nameCandidate = normalizeString(record.name ?? record.className ?? record.class_name)
          const resolvedId =
            idCandidate || (nameCandidate ? buildIdentifierFromName(nameCandidate) : "") || `class_assigned_${index}`
          const resolvedName = nameCandidate || idCandidate || `Assigned Class ${index + 1}`

          if (!resolvedId && !resolvedName) {
            return null
          }

          return { id: resolvedId, name: resolvedName }
        })
        .filter((entry): entry is { id: string; name: string } => Boolean(entry))
    : []

  const teachingAssignments = normalizeTeachingAssignments(rawUser?.teachingAssignments ?? rawUser?.classes, {
    fallbackClassId: classId,
    fallbackClassName: className,
    fallbackSubjects: fallbackSubjects,
    fallbackAssignedClasses: assignedClassSummaries,
  })

  const combinedClassIds = Array.from(
    new Set([
      ...toUniqueStringArray(rawUser?.classIds ?? rawUser?.class_ids ?? rawUser?.teachingClassIds),
      ...assignedClassIdsFromRaw,
      ...(classId ? [classId] : []),
      ...teachingAssignments.map((assignment) => assignment.classId),
      ...assignedClassSummaries.map((entry) => entry.id),
    ]),
  )

  const resolvedSubjects =
    explicitSubjects.length > 0
      ? explicitSubjects
      : fallbackSubjects.length > 0
        ? fallbackSubjects
        : Array.from(new Set(teachingAssignments.flatMap((assignment) => assignment.subjects)))

  const hasAccess =
    typeof rawUser?.hasAccess === "boolean"
      ? Boolean(rawUser.hasAccess)
      : options.fallbackHasAccess ?? roleHasPortalAccess(options.resolvedRole)

  const assignedClassIds = Array.from(
    new Set([
      ...assignedClassIdsFromRaw,
      ...assignedClassSummaries.map((entry) => entry.id),
      ...(classId ? [classId] : []),
      ...teachingAssignments.map((assignment) => assignment.classId),
    ]),
  )

  const assignedClassNames = Array.from(
    new Set([
      ...assignedClassNamesFromRaw,
      ...assignedClassSummaries.map((entry) => entry.name),
      ...(className ? [className] : []),
      ...teachingAssignments.map((assignment) => assignment.className),
    ]),
  )

  const assignedClassMap = new Map<string, { id: string; name: string }>()

  const registerAssignedClass = (idValue: string, nameValue: string) => {
    const id = idValue.trim()
    const name = nameValue.trim()

    if (!id && !name) {
      return
    }

    const resolvedId = id || (name ? buildIdentifierFromName(name) : "") || `assigned_${assignedClassMap.size}`
    const resolvedName = name || id || `Assigned Class ${assignedClassMap.size + 1}`
    const key = `${resolvedId.toLowerCase()}::${resolvedName.toLowerCase()}`

    if (!assignedClassMap.has(key)) {
      assignedClassMap.set(key, { id: resolvedId, name: resolvedName })
    }
  }

  assignedClassSummaries.forEach((entry) => registerAssignedClass(entry.id, entry.name))
  teachingAssignments.forEach((assignment) => registerAssignedClass(assignment.classId, assignment.className))
  if (classId || className) {
    registerAssignedClass(classId || "", className || "")
  }

  const assignedClasses = Array.from(assignedClassMap.values())

  return {
    id,
    email,
    role: options.resolvedRole,
    name: normalizeString(rawUser?.name) || options.fallbackName || email.split("@")[0],
    hasAccess,
    classId: classId || null,
    className: className || null,
    subjects: resolvedSubjects,
    classIds: combinedClassIds,
    teachingAssignments,
    assignedClassIds,
    assignedClassNames,
    assignedClasses,
    metadata,
  }
}

const FALLBACK_ACCOUNTS: FallbackAccount[] = [
  {
    id: "user_super_admin",
    email: "superadmin@vea.edu.ng",
    password: "SuperAdmin2025!",
    role: "super-admin",
    name: "System Super Admin",
    hasAccess: roleHasPortalAccess("super-admin"),
    metadata: {
      permissions: ["portal:full_access"],
    },
    token: "demo-token-super-admin",
  },
  {
    id: "user_admin",
    email: "admin@vea.edu.ng",
    password: "Admin2025!",
    role: "admin",
    name: "Admin User",
    hasAccess: roleHasPortalAccess("admin"),
    metadata: {
      department: "Administration",
    },
    token: "demo-token-admin",
  },
  {
    id: "user_teacher",
    email: "teacher@vea.edu.ng",
    password: "Teacher2025!",
    role: "teacher",
    name: "Class Teacher",
    hasAccess: roleHasPortalAccess("teacher"),
    classId: "class_jss1a",
    className: "JSS 1A",
    classIds: ["class_jss1a"],
    subjects: ["Mathematics", "English"],
    teachingAssignments: [
      {
        classId: "class_jss1a",
        className: "JSS 1A",
        subjects: ["Mathematics", "English"],
      },
    ],
    assignedClassIds: ["class_jss1a"],
    assignedClassNames: ["JSS 1A"],
    assignedClasses: [{ id: "class_jss1a", name: "JSS 1A" }],
    metadata: {
      assignedClassName: "JSS 1A",
    },
    token: "demo-token-teacher",
  },
  {
    id: "student_john_doe",
    email: "student@vea.edu.ng",
    password: "Student2025!",
    role: "student",
    name: "John Student",
    hasAccess: roleHasPortalAccess("student"),
    classId: "class_jss1a",
    className: "JSS 1A",
    metadata: {
      admissionNumber: "VEA2025001",
    },
    token: "demo-token-student",
  },
  {
    id: "user_parent",
    email: "parent@vea.edu.ng",
    password: "Parent2025!",
    role: "parent",
    name: "Parent Guardian",
    hasAccess: roleHasPortalAccess("parent"),
    metadata: {
      linkedStudentId: "student_john_doe",
    },
    token: "demo-token-parent",
  },
  {
    id: "user_librarian",
    email: "librarian@vea.edu.ng",
    password: "Librarian2025!",
    role: "librarian",
    name: "Library Manager",
    hasAccess: roleHasPortalAccess("librarian"),
    token: "demo-token-librarian",
  },
  {
    id: "user_accountant",
    email: "accountant@vea.edu.ng",
    password: "Accountant2025!",
    role: "accountant",
    name: "Account Officer",
    hasAccess: roleHasPortalAccess("accountant"),
    token: "demo-token-accountant",
  },
]

export default function HomePage() {
  const branding = useBranding()
  const resolvedLogo = branding.logoUrl
  const resolvedSchoolName = branding.schoolName
  const portalDescription = resolvedSchoolName
    ? `${resolvedSchoolName} School Management Portal`
    : "School Management Portal"
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ email: "", password: "", role: "parent" as UserRole })
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "parent" as UserRole,
    studentId: "",
    classId: "",
    phoneNumber1: "",
    phoneNumber2: "",
    address: "",
  })
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [classOptions, setClassOptions] = useState<Array<{ id: string; name: string }>>([])
  const [knownStudents, setKnownStudents] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (currentUser) {
      return
    }

    const storedSetting = safeStorage.getItem("registrationEnabled")
    if (storedSetting !== null) {
      try {
        setRegistrationEnabled(JSON.parse(storedSetting))
      } catch (error) {
        logger.error("Failed to parse stored registration setting", { error })
      }
    }

    const fetchSettings = async () => {
      try {
        const settings = await dbManager.getSystemSettings()
        const enabled = Boolean((settings as { registrationEnabled?: boolean })?.registrationEnabled ?? true)
        setRegistrationEnabled(enabled)
        safeStorage.setItem("registrationEnabled", JSON.stringify(enabled))
      } catch (error) {
        logger.error("Unable to load system settings", { error })
      }
    }

    void fetchSettings()
  }, [currentUser])

  useEffect(() => {
    if (currentUser) {
      return
    }

    let isMounted = true

    const loadRegistrationOptions = async () => {
      try {
        const classes = await dbManager.getAllClasses()
        if (isMounted) {
          const normalized = Array.isArray(classes)
            ? classes.map((cls, index) => {
                if (typeof cls === "string") {
                  const trimmed = cls.trim()
                  return { id: trimmed.length > 0 ? trimmed : `class_${index}`, name: trimmed || `Class ${index + 1}` }
                }

                const record = cls as { id?: string | number; name?: string }
                const identifier = record.id ?? record.name ?? `class_${index}`
                return {
                  id: String(identifier),
                  name: String(record.name ?? identifier),
                }
              })
            : []
          setClassOptions(normalized)
        }
      } catch (error) {
        logger.error("Unable to load registration classes", { error })
      }

      try {
        const users = await dbManager.getAllUsers()
        if (isMounted) {
          const students = Array.isArray(users)
            ? users
                .filter((user) => mapApiRoleToUi(String(user.role ?? "student")) === "student")
                .map((student, index) => ({
                  id: String((student as { id?: string | number; email?: string }).id ?? student.email ?? `student_${index}`),
                  name: String((student as { name?: string; id?: string | number }).name ?? student.id ?? "Student"),
                }))
            : []
          setKnownStudents(students)
        }
      } catch (error) {
        logger.error("Unable to load student directory for registration", { error })
      }
    }

    void loadRegistrationOptions()

    return () => {
      isMounted = false
    }
  }, [currentUser])

  useEffect(() => {
    const storedUser = safeStorage.getItem("vea_current_user")
    const storedToken = safeStorage.getItem("vea_auth_token")

    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser) as Record<string, unknown>
        const normalizedRole = mapApiRoleToUi(String(parsed.role ?? "parent"))
        const allowedRoles: UserRole[] = [
          "teacher",
          "student",
          "parent",
          "admin",
          "super-admin",
          "librarian",
          "accountant",
        ]

        if (allowedRoles.includes(normalizedRole)) {
          const normalizedUser = buildUserState(parsed as Record<string, any>, {
            resolvedRole: normalizedRole,
            fallbackEmail: typeof parsed.email === "string" ? parsed.email : `${normalizedRole}@vea.edu.ng`,
            fallbackName: typeof parsed.name === "string" ? parsed.name : undefined,
            fallbackHasAccess:
              typeof parsed.hasAccess === "boolean" ? Boolean(parsed.hasAccess) : roleHasPortalAccess(normalizedRole),
          })

          setCurrentUser(normalizedUser)
        } else {
          safeStorage.removeItem("vea_current_user")
          safeStorage.removeItem("vea_auth_token")
        }
      } catch (error) {
        logger.error("Failed to restore saved user", { error })
        safeStorage.removeItem("vea_current_user")
        safeStorage.removeItem("vea_auth_token")
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setIsLoggingIn(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setLoginError(payload.error ?? "Invalid email or password")
        return
      }

      const userRole = mapApiRoleToUi(payload.user?.role ?? loginForm.role)
      if (SELECTABLE_LOGIN_ROLES.includes(userRole) && userRole !== loginForm.role) {
        setLoginError("This account does not match the selected role.")
        return
      }
      const user = buildUserState(payload.user, {
        resolvedRole: userRole,
        fallbackEmail: loginForm.email,
        fallbackName: payload.user?.name ?? loginForm.email.split("@")[0],
        fallbackHasAccess: roleHasPortalAccess(userRole),
      })

      setCurrentUser(user)
      if (payload.token) {
        safeStorage.setItem("vea_auth_token", payload.token)
      }
      safeStorage.setItem("vea_current_user", JSON.stringify(user))
    } catch (error) {
      logger.error("Login failed", { error })
      const normalizedEmail = loginForm.email.trim().toLowerCase()
      const fallbackUser = FALLBACK_ACCOUNTS.find(
        (account) => account.email.toLowerCase() === normalizedEmail && account.password === loginForm.password,
      )

      if (fallbackUser) {
        const userRole = fallbackUser.role
        if (SELECTABLE_LOGIN_ROLES.includes(userRole) && userRole !== loginForm.role) {
          setLoginError("This account does not match the selected role.")
          return
        }

        const user = buildUserState(fallbackUser, {
          resolvedRole: userRole,
          fallbackEmail: fallbackUser.email,
          fallbackName: fallbackUser.name,
          fallbackHasAccess: fallbackUser.hasAccess ?? roleHasPortalAccess(userRole),
        })

        const token = fallbackUser.token ?? `fallback-token-${fallbackUser.id}-${Date.now()}`

        setCurrentUser(user)
        safeStorage.setItem("vea_auth_token", token)
        safeStorage.setItem("vea_current_user", JSON.stringify(user))
        toast({
          title: "Offline login activated",
          description: "We could not reach the live server, so built-in demo data is being used.",
        })
        logger.warn("Login succeeded using fallback credentials", { email: fallbackUser.email })
        return
      }

      setLoginError("Unable to login at this time. Please try again later.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError(null)
    setIsRegistering(true)

    try {
      const normalizedClassId = registerForm.classId.trim()
      const normalizedStudentId = registerForm.studentId.trim()

      if (requiresClassSelection(registerForm.role) && !normalizedClassId) {
        setRegisterError("Please select a class before creating your account.")
        setIsRegistering(false)
        return
      }

      if (registerForm.role === "parent" && !normalizedStudentId) {
        setRegisterError("Please provide your child's student ID.")
        setIsRegistering(false)
        return
      }

      if (
        registerForm.role === "parent" &&
        normalizedStudentId &&
        knownStudents.length > 0 &&
        !knownStudents.some((student) => student.id === normalizedStudentId)
      ) {
        setRegisterError("We could not find a student with that ID. Please confirm and try again.")
        setIsRegistering(false)
        return
      }

      const primaryPhone = registerForm.phoneNumber1.trim()
      const secondaryPhone = registerForm.phoneNumber2.trim()
      const address = registerForm.address.trim()

      if (registerForm.role !== "student" && !primaryPhone) {
        setRegisterError("Please provide a primary phone number.")
        setIsRegistering(false)
        return
      }

      if (!address) {
        setRegisterError("Please provide an address for this account.")
        setIsRegistering(false)
        return
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          role: mapUiRoleToApi(registerForm.role),
          classId: requiresClassSelection(registerForm.role) ? normalizedClassId : undefined,
          studentId: registerForm.role === "parent" ? normalizedStudentId : undefined,
          phoneNumber1: primaryPhone || undefined,
          phoneNumber2: secondaryPhone || undefined,
          address,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setRegisterError(payload.error ?? "Unable to complete registration")
        return
      }

      // Automatically authenticate the new user
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerForm.email, password: registerForm.password }),
      })

      const loginPayload = await loginResponse.json().catch(() => ({}))

      if (!loginResponse.ok) {
        setRegisterError(loginPayload.error ?? "Account created, but automatic login failed")
        return
      }

      const userRole = mapApiRoleToUi(loginPayload.user?.role ?? registerForm.role)
      const user: User = {
        id: String(loginPayload.user?.id ?? ""),
        email: loginPayload.user?.email ?? registerForm.email,
        role: userRole,
        name: loginPayload.user?.name ?? registerForm.name,
        hasAccess: roleHasPortalAccess(userRole),
        classId: loginPayload.user?.classId ?? loginPayload.user?.class_id ?? null,
        className:
          typeof loginPayload.user?.metadata?.assignedClassName === "string"
            ? loginPayload.user.metadata.assignedClassName
            : null,
        subjects: Array.isArray(loginPayload.user?.subjects) ? loginPayload.user.subjects : [],
        metadata: loginPayload.user?.metadata ?? null,
      }

      setCurrentUser(user)
      if (loginPayload.token) {
        safeStorage.setItem("vea_auth_token", loginPayload.token)
      }
      safeStorage.setItem("vea_current_user", JSON.stringify(user))
    } catch (error) {
      logger.error("Registration failed", { error })
      setRegisterError("Unable to register at this time. Please try again later.")
    } finally {
      setIsRegistering(false)
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    safeStorage.removeItem("vea_auth_token")
    safeStorage.removeItem("vea_current_user")
  }

  if (currentUser) {
    return <Dashboard user={currentUser} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {resolvedLogo ? (
              <Image
                src={resolvedLogo}
                alt={`${resolvedSchoolName} logo`}
                width={48}
                height={48}
                className="h-12 w-12 object-contain rounded-md shadow-sm"
              />
            ) : (
              <GraduationCap className="h-12 w-12 text-[#2d682d]" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-[#2d682d] mb-2">{resolvedSchoolName}</h1>
          <p className="text-[#b29032]">{portalDescription}</p>
        </div>

        <Card className="border-[#2d682d]/20 bg-white/95 backdrop-blur shadow-xl">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Welcome Back</CardTitle>
            <CardDescription className="text-[#b29032]">Sign in to access your school portal</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className={cn("grid w-full bg-green-50", registrationEnabled ? "grid-cols-2" : "grid-cols-1")}>
                <TabsTrigger value="login" className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white">
                  Login
                </TabsTrigger>
                {registrationEnabled && (
                  <TabsTrigger
                    value="register"
                    className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
                  >
                    Register
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-role" className="text-[#2d682d]">
                      Role
                    </Label>
                    <Select
                      value={loginForm.role}
                      disabled={isLoggingIn}
                      onValueChange={(value: UserRole) => setLoginForm((prev) => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="border-[#2d682d]/20 focus:border-[#2d682d]">
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Teacher
                        </div>
                      </SelectItem>
                      <SelectItem value="student">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Student
                        </div>
                      </SelectItem>
                      <SelectItem value="parent">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Parent
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-[#2d682d]">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="border-[#2d682d]/20 focus:border-[#2d682d]"
                      required
                      disabled={isLoggingIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-[#2d682d]">
                      Password
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="border-[#2d682d]/20 focus:border-[#2d682d]"
                      required
                      disabled={isLoggingIn}
                    />
                  </div>
                  {loginError && <p className="text-sm text-red-600">{loginError}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90 text-white"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                  <div className="pt-2 text-center">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm text-[#2d682d] hover:text-[#b29032]"
                      asChild
                    >
                      <a href={CONTACT_DEVELOPER_URL} target="_blank" rel="noopener noreferrer">
                        Contact Developer
                      </a>
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {registrationEnabled && (
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-role" className="text-[#2d682d]">
                        Role
                      </Label>
                      <Select
                        value={registerForm.role}
                        disabled={isRegistering}
                        onValueChange={(value: UserRole) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            role: value,
                            classId: requiresClassSelection(value) ? prev.classId : "",
                            studentId: value === "parent" ? prev.studentId : "",
                          }))
                        }
                      >
                        <SelectTrigger className="border-[#2d682d]/20 focus:border-[#2d682d]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              Teacher
                            </div>
                          </SelectItem>
                          <SelectItem value="student">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4" />
                              Student
                            </div>
                          </SelectItem>
                          <SelectItem value="parent">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Parent
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-[#2d682d]">
                        Full Name
                      </Label>
                      <Input
                        id="register-name"
                        placeholder="Enter your full name"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        required
                        disabled={isRegistering}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-[#2d682d]">
                        Email
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="Enter your email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        required
                        disabled={isRegistering}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-phone1" className="text-[#2d682d]">
                        Primary Phone Number
                      </Label>
                      <Input
                        id="register-phone1"
                        type="tel"
                        placeholder="Enter primary phone number"
                        value={registerForm.phoneNumber1}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, phoneNumber1: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        required={registerForm.role !== "student"}
                        disabled={isRegistering}
                      />
                      <p className="text-xs text-muted-foreground">
                        Primary phone number is optional for students.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-phone2" className="text-[#2d682d]">
                        Secondary Phone Number (Optional)
                      </Label>
                      <Input
                        id="register-phone2"
                        type="tel"
                        placeholder="Enter secondary phone number"
                        value={registerForm.phoneNumber2}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, phoneNumber2: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        disabled={isRegistering}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-address" className="text-[#2d682d]">
                        Address
                      </Label>
                      <Textarea
                        id="register-address"
                        placeholder="Enter your home address"
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, address: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        rows={2}
                        required
                        disabled={isRegistering}
                      />
                    </div>
                    {requiresClassSelection(registerForm.role) && (
                      <div className="space-y-2">
                        <Label htmlFor="register-class" className="text-[#2d682d]">
                          Class
                        </Label>
                        <Select
                          value={
                            registerForm.classId && registerForm.classId.trim().length > 0
                              ? registerForm.classId
                              : NO_CLASS_OPTION
                          }
                          disabled={isRegistering}
                          onValueChange={(value) =>
                            setRegisterForm((prev) => ({
                              ...prev,
                              classId: value === NO_CLASS_OPTION ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger className="border-[#2d682d]/20 focus:border-[#2d682d]">
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CLASS_OPTION} disabled>
                              Select a class
                            </SelectItem>
                            {classOptions.length === 0 ? (
                              <SelectItem value="__no_classes__" disabled>
                                No classes available
                              </SelectItem>
                            ) : (
                              classOptions.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {registerForm.role === "parent" && (
                      <div className="space-y-2">
                        <Label htmlFor="student-id" className="text-[#2d682d]">
                          Student ID
                        </Label>
                        <Input
                          id="student-id"
                          placeholder="Enter your child's student ID"
                          value={registerForm.studentId}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, studentId: e.target.value }))}
                          className="border-[#2d682d]/20 focus:border-[#2d682d]"
                          required
                          disabled={isRegistering}
                          list={knownStudents.length > 0 ? "available-student-ids" : undefined}
                        />
                        {knownStudents.length > 0 && (
                          <datalist id="available-student-ids">
                            {knownStudents.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name}
                              </option>
                            ))}
                          </datalist>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-[#2d682d]">
                        Password
                      </Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="border-[#2d682d]/20 focus:border-[#2d682d]"
                        required
                        disabled={isRegistering}
                      />
                    </div>
                    {registerError && <p className="text-sm text-red-600">{registerError}</p>}
                    <Button
                      type="submit"
                      className="w-full bg-[#b29032] hover:bg-[#b29032]/90 text-white"
                      disabled={isRegistering}
                    >
                      {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center gap-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white/80 border-[#2d682d]/20 text-[#2d682d] hover:bg-white hover:text-[#2d682d]"
          >
            <a href="https://victoryeducationalacademy.com.ng/" target="_blank" rel="noopener noreferrer">
              HOME
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white/80 border-[#2d682d]/20 text-[#2d682d] hover:bg-white hover:text-[#2d682d]"
          >
            <a href="https://victoryeducationalacademy.com.ng/contact" target="_blank" rel="noopener noreferrer">
              CONTACT US
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

type TeacherClassAssignment = { id: string; name: string; subjects: string[] }

const buildTeacherAssignmentsFromUser = (
  user: User,
): { classes: TeacherClassAssignment[]; subjects: string[] } => {
  if (user.role !== "teacher") {
    return { classes: [], subjects: [] }
  }

  const classMap = new Map<string, TeacherClassAssignment>()
  const subjectSet = new Set<string>()

  const registerClass = (
    idValue: unknown,
    nameValue?: unknown,
    subjectsValue?: unknown,
    fallbackIndex?: number,
  ) => {
    const id = typeof idValue === "string" ? idValue.trim() : ""
    const name = typeof nameValue === "string" ? nameValue.trim() : ""
    const index = typeof fallbackIndex === "number" ? fallbackIndex : classMap.size

    if (!id && !name) {
      return
    }

    const resolvedId = id || (name ? buildIdentifierFromName(name) : `class_${index}`)
    const resolvedName = name || id || `Class ${index + 1}`
    const normalizedSubjects: string[] = []

    if (Array.isArray(subjectsValue)) {
      for (const subject of subjectsValue) {
        if (typeof subject === "string") {
          const trimmed = subject.trim()
          if (trimmed.length > 0) {
            normalizedSubjects.push(trimmed)
          }
        }
      }
    }
    const key = `${resolvedId.toLowerCase()}::${resolvedName.toLowerCase()}`

    if (classMap.has(key)) {
      const existing = classMap.get(key) as TeacherClassAssignment
      const merged = new Set<string>([...existing.subjects, ...normalizedSubjects])
      existing.subjects = Array.from(merged)
      classMap.set(key, existing)
    } else {
      classMap.set(key, { id: resolvedId, name: resolvedName, subjects: normalizedSubjects })
    }

    normalizedSubjects.forEach((subject) => subjectSet.add(subject))
  }

  const teachingAssignments = Array.isArray(user.teachingAssignments) ? user.teachingAssignments : []
  teachingAssignments.forEach((assignment, index) => {
    registerClass(assignment?.classId, assignment?.className, assignment?.subjects, index)
  })

  const assignedSummaries = Array.isArray(user.assignedClasses) ? user.assignedClasses : []
  assignedSummaries.forEach((summary, index) => {
    registerClass(summary?.id, summary?.name, [], teachingAssignments.length + index)
  })

  const fallbackAssignedIds = Array.isArray(user.assignedClassIds) ? user.assignedClassIds : []
  const fallbackAssignedNames = Array.isArray(user.assignedClassNames) ? user.assignedClassNames : []

  fallbackAssignedIds.forEach((identifier, index) => {
    registerClass(
      identifier,
      fallbackAssignedNames[index] ?? identifier,
      [],
      teachingAssignments.length + assignedSummaries.length + index,
    )
  })

  fallbackAssignedNames.forEach((name, index) => {
    registerClass(
      undefined,
      name,
      [],
      teachingAssignments.length + assignedSummaries.length + fallbackAssignedIds.length + index,
    )
  })

  registerClass(
    user.classId,
    user.className,
    user.subjects,
    teachingAssignments.length + assignedSummaries.length + fallbackAssignedIds.length + fallbackAssignedNames.length,
  )

  const explicitSubjects = Array.isArray(user.subjects)
    ? user.subjects
        .map((subject) => (typeof subject === "string" ? subject.trim() : ""))
        .filter((subject) => subject.length > 0)
    : []

  explicitSubjects.forEach((subject) => subjectSet.add(subject))

  const classes = Array.from(classMap.values())
  const subjects =
    explicitSubjects.length > 0
      ? explicitSubjects
      : subjectSet.size > 0
        ? Array.from(subjectSet)
        : []

  return { classes, subjects }
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const branding = useBranding()
  const resolvedLogo = branding.logoUrl
  const resolvedSchoolName = branding.schoolName
  const [teacherAssignments, setTeacherAssignments] = useState(() => buildTeacherAssignmentsFromUser(user))
  const [isTeacherContextLoading, setIsTeacherContextLoading] = useState(false)
  const [teacherContextError, setTeacherContextError] = useState<string | null>(null)
  const [studentClassInfo, setStudentClassInfo] = useState<{ className: string; classId: string | null }>(
    user.role === "student"
      ? {
          className: user.className ?? "",
          classId: user.classId ?? null,
        }
      : { className: "", classId: null },
  )
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (user.role !== "teacher") {
      setTeacherAssignments({ classes: [], subjects: [] })
      setTeacherContextError(null)
      setIsTeacherContextLoading(false)
      return
    }

    setTeacherAssignments(buildTeacherAssignmentsFromUser(user))
  }, [user])

  const refreshTeacherAssignments = useCallback(async () => {
    if (user.role !== "teacher") {
      return
    }

    const token = safeStorage.getItem("vea_auth_token")
    if (!token) {
      if (isMountedRef.current) {
        setTeacherAssignments({ classes: [], subjects: [] })
        setTeacherContextError("Your session has expired. Please log in again.")
      }
      return
    }

    if (isMountedRef.current) {
      setIsTeacherContextLoading(true)
      setTeacherContextError(null)
    }

    try {
      const response = await fetch("/api/teachers/context", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })

      if (!response.ok) {
        let message = "Unable to load your class assignments."
        if (response.status === 401) {
          message = "Your session has expired. Please log in again."
        } else if (response.status === 403) {
          message = "This account does not have teacher access."
        } else if (response.status === 404) {
          message = "You are not assigned to any class. Contact your administrator."
        }

        if (isMountedRef.current) {
          setTeacherAssignments({ classes: [], subjects: [] })
          setTeacherContextError(message)
        }
        return
      }

      const payload = (await response.json().catch(() => ({}))) as {
        classes?: Array<{ id?: unknown; name?: unknown; subjects?: unknown }>
        subjects?: unknown
      }

      const normalizedClasses: TeacherClassAssignment[] = []
      const seenKeys = new Set<string>()
      const subjectSet = new Set<string>()

      if (Array.isArray(payload.classes)) {
        payload.classes.forEach((entry, index) => {
          const rawId = typeof entry?.id === "string" ? entry.id.trim() : ""
          const rawName = typeof entry?.name === "string" ? entry.name.trim() : ""
          const subjects = Array.isArray(entry?.subjects)
            ? entry.subjects
                .map((subject) => (typeof subject === "string" ? subject.trim() : ""))
                .filter((subject) => subject.length > 0)
            : []
          const id = rawId || rawName || `class_${index}`
          const name = rawName || rawId || id

          if (!id && !name) {
            return
          }

          const key = `${id.toLowerCase()}::${name.toLowerCase()}`
          if (seenKeys.has(key)) {
            return
          }

          seenKeys.add(key)
          subjects.forEach((subject) => subjectSet.add(subject))
          normalizedClasses.push({ id, name, subjects })
        })
      }

      if (Array.isArray(payload.subjects)) {
        for (const subject of payload.subjects) {
          if (typeof subject === "string") {
            const trimmed = subject.trim()
            if (trimmed.length > 0) {
              subjectSet.add(trimmed)
            }
          }
        }
      }

      const normalizedSubjects = Array.from(subjectSet)

      if (isMountedRef.current) {
        setTeacherAssignments({ classes: normalizedClasses, subjects: normalizedSubjects })
        setTeacherContextError(
          normalizedClasses.length === 0
            ? "You are not assigned to any class. Contact your administrator."
            : null,
        )

        try {
          const storedUserRaw = safeStorage.getItem("vea_current_user")
          if (storedUserRaw) {
            const storedUser = JSON.parse(storedUserRaw) as Record<string, any>
            storedUser.teachingAssignments = normalizedClasses.map((cls) => ({
              classId: cls.id,
              className: cls.name,
              subjects: cls.subjects,
            }))
            storedUser.subjects = normalizedSubjects
            storedUser.assignedClasses = normalizedClasses.map((cls) => ({ id: cls.id, name: cls.name }))
            storedUser.assignedClassIds = normalizedClasses.map((cls) => cls.id)
            storedUser.assignedClassNames = normalizedClasses.map((cls) => cls.name)
            safeStorage.setItem("vea_current_user", JSON.stringify(storedUser))
          }
        } catch (error) {
          logger.error("Failed to persist refreshed teacher assignments", { error })
        }
      }
    } catch (error) {
      logger.error("Failed to load teacher assignments", { error })
      if (isMountedRef.current) {
        setTeacherAssignments({ classes: [], subjects: [] })
        setTeacherContextError(
          "Unable to load your class assignments. Check your connection or contact your administrator.",
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsTeacherContextLoading(false)
      }
    }
  }, [user.id, user.role])

  useEffect(() => {
    if (user.role !== "teacher") {
      return
    }

    void refreshTeacherAssignments()
  }, [refreshTeacherAssignments, user.role, user.id])

  useEffect(() => {
    if (user.role !== "student") {
      setStudentClassInfo({ className: "", classId: null })
      return
    }

    let isMounted = true

    const loadStudentClass = async () => {
      const classId = typeof user.classId === "string" ? user.classId.trim() : ""
      let className = user.className ?? ""

      if (classId) {
        try {
          const response = await fetch(`/api/classes?id=${encodeURIComponent(classId)}`)
          if (response.ok) {
            const payload = (await response.json()) as {
              class?: { id: string; name: string }
              classes?: Array<{ id: string; name: string }>
            }
            const match = payload.class
              ? payload.class
              : payload.classes?.find((cls) => cls.id === classId)
            if (match?.name) {
              className = match.name
            }
          } else if (response.status !== 404) {
            logger.error("Unable to load student class assignment", {
              status: response.status,
              statusText: response.statusText,
            })
          }
        } catch (error) {
          logger.error("Unable to load student class assignment", { error })
        }
      }

      if (!className && classId) {
        className = classId
      }

      if (isMounted) {
        setStudentClassInfo({ className, classId: classId || null })
      }
    }

    void loadStudentClass()

    return () => {
      isMounted = false
    }
  }, [user])

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case "super-admin":
        return "Super Admin"
      case "admin":
        return "Admin"
      case "teacher":
        return "Teacher"
      case "student":
        return "Student"
      case "parent":
        return "Parent"
      case "librarian":
        return "Librarian"
      case "accountant":
        return "Accountant"
      default:
        return role
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#2d682d] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px:6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              {resolvedLogo ? (
                <Image
                  src={resolvedLogo}
                  alt={`${resolvedSchoolName} logo`}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain rounded-md bg-white/10 p-1"
                />
              ) : (
                <GraduationCap className="h-8 w-8 text-[#b29032]" />
              )}
              <div>
                <h1 className="text-xl font-bold">{resolvedSchoolName}</h1>
                <p className="text-sm text-green-200">{getRoleDisplayName(user.role)} Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">Welcome, {user.name}</span>
              <Button
                onClick={onLogout}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 bg-transparent"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px:6 lg:px-8 py-8">
        {user.role === "super-admin" && <SuperAdminDashboard />}
        {user.role === "admin" && <AdminDashboard user={user} />}
        {user.role === "parent" && <ParentDashboard user={user} />}
        {user.role === "student" && (
          <StudentDashboard
            student={{
              id: user.id,
              name: user.name,
              email: user.email,
              class: studentClassInfo.className || studentClassInfo.classId || "Unassigned",
              admissionNumber:
                typeof user.metadata?.admissionNumber === "string"
                  ? user.metadata.admissionNumber
                  : user.id,
            }}
          />
        )}
        {user.role === "teacher" && (
          <TeacherDashboard
            teacher={{
              id: user.id,
              name: user.name,
              email: user.email,
              subjects: teacherAssignments.subjects,
              classes: teacherAssignments.classes,
            }}
            isContextLoading={isTeacherContextLoading}
            contextError={teacherContextError}
            onRefreshAssignments={refreshTeacherAssignments}
          />
        )}
        {user.role === "librarian" && (
          <LibrarianDashboard
            librarian={{
              id: user.id,
              name: user.name,
              email: user.email,
            }}
          />
        )}
        {user.role === "accountant" && (
          <AccountantDashboard
            accountant={{
              id: user.id,
              name: user.name,
              email: user.email,
            }}
          />
        )}
      </main>
    </div>
  )
}

function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Admin Dashboard</h2>
          <p className="text-sm text-gray-600">Manage daily school operations and oversight</p>
        </div>
        <TutorialLink href="https://www.youtube.com/watch?v=ysz5S6PUM-U" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="grid w-full min-w-max grid-cols-8 lg:grid-cols-16 bg-green-50 gap-1 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Users
            </TabsTrigger>
            <TabsTrigger
              value="classes"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Classes
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Students
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="timetable"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Timetable
            </TabsTrigger>
            <TabsTrigger
              value="exams"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Exams
            </TabsTrigger>
            <TabsTrigger
              value="approval"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Report Approval
            </TabsTrigger>
            <TabsTrigger
              value="promotion"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Promotion
            </TabsTrigger>
            <TabsTrigger
              value="noticeboard"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Noticeboard
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              School Calendar
            </TabsTrigger>
            <TabsTrigger
              value="monitoring"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Monitoring
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-6 xl:col-span-2">
              <SystemOverview />
              <ExamScheduleOverview role="admin" description="Track upcoming school-wide examinations" />
            </div>
            <div className="space-y-6">
              <NotificationCenter userRole={user.role} userId={user.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SystemSettings />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagement hideSuperAdmin />
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <ClassSubjectManagement />
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <StudentManagement />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentManagement />
        </TabsContent>

        <TabsContent value="timetable" className="space-y-6">
          <TimetableManagement />
        </TabsContent>

        <TabsContent value="exams" className="space-y-6">
          <ExamManagement />
        </TabsContent>

        <TabsContent value="approval" className="space-y-6">
          <AdminApprovalDashboard />
        </TabsContent>

        <TabsContent value="promotion" className="space-y-6">
          <AutomaticPromotionSystem />
        </TabsContent>

        <TabsContent value="noticeboard" className="space-y-6">
          <Noticeboard userRole="admin" userName="Admin" />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <SchoolCalendarManager />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <SystemHealthMonitor />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <InternalMessaging currentUser={{ id: user.id, name: user.name, role: user.role }} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ParentDashboard({ user }: { user: User }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [hasAccess, setHasAccess] = useState(user.hasAccess)
  const [showReportCard, setShowReportCard] = useState(false)
  const [adminGrantedAccess, setAdminGrantedAccess] = useState(false)
  const [reportCardData, setReportCardData] = useState<RawReportCardData | null>(null)
  const [academicPeriod, setAcademicPeriod] = useState({ term: "First Term", session: "2024/2025" })
  const [accessNotice, setAccessNotice] = useState<{
    title: string
    description: string
    showPayment?: boolean
  } | null>(null)
  const fallbackMessagingDirectory = useMemo<MessagingParticipant[]>(
    () => [
      { id: "user_teacher", name: "Class Teacher", role: "teacher" },
      { id: "user_admin", name: "School Administrator", role: "admin" },
      { id: "user_super_admin", name: "System Super Admin", role: "super_admin" },
    ],
    [],
  )
  const [messagingParticipants, setMessagingParticipants] = useState<MessagingParticipant[]>(
    fallbackMessagingDirectory,
  )
  const [parentTimetable, setParentTimetable] = useState<TimetableWeeklyViewSlot[]>([])
  const [isParentTimetableLoading, setIsParentTimetableLoading] = useState(false)
  const [studentData, setStudentData] = useState<ParentStudentProfile | null>(null)
  const [academicData, setAcademicData] = useState<ParentAcademicSummaryState | null>(null)
  const [attendanceData, setAttendanceData] = useState<ParentAttendanceSummaryState | null>(null)
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  const linkedStudentId =
    typeof user.metadata?.linkedStudentId === "string"
      ? user.metadata.linkedStudentId
      : Array.isArray((user.metadata as { studentIds?: string[] })?.studentIds) &&
          (user.metadata as { studentIds?: string[] })?.studentIds?.length
        ? String((user.metadata as { studentIds?: string[] })?.studentIds?.[0])
        : "1"

  const activeStudentId = studentData?.id ?? linkedStudentId

  const studentFirstName = useMemo(() => {
    const [first] = (studentData?.name ?? "").split(" ")
    return first && first.trim().length > 0 ? first : "the student"
  }, [studentData?.name])

  const buildFallbackSnapshot = useCallback(() => {
    if (!linkedStudentId) {
      return null
    }

    const currentTerm = academicPeriod.term ?? "First Term"
    const currentSession = academicPeriod.session ?? "2024/2025"

    const fallbackReport =
      getStudentReportCardData(linkedStudentId, currentTerm, currentSession) ??
      getStudentReportCardData(linkedStudentId, currentTerm, "2024/2025") ??
      getStudentReportCardData(linkedStudentId, "First Term", currentSession) ??
      getStudentReportCardData(linkedStudentId, "First Term", "2024/2025")

    if (!fallbackReport) {
      return null
    }

    const toNumber = (value: unknown, fallback = 0): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed) ? fallback : parsed
      }
      return fallback
    }

    const toPositiveInteger = (value: unknown, fallback = 0): number => {
      const parsed = toNumber(value, fallback)
      return parsed > 0 ? Math.round(parsed) : fallback
    }

    const parseRank = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value)
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const match = value.match(/\d+/)
        if (match) {
          const parsed = Number.parseInt(match[0] ?? "", 10)
          return Number.isNaN(parsed) ? null : parsed
        }
      }
      return null
    }

    const studentSource = fallbackReport.student ?? {}
    const className = studentSource.class ?? studentData?.class ?? "JSS 1"
    const section = studentData?.section ?? className
    const fallbackAdmission = studentData?.admissionNumber ?? `VEA/${linkedStudentId}`

    const studentProfile: ParentStudentProfile = {
      id: String(studentSource.id ?? linkedStudentId),
      name: studentSource.name ?? studentData?.name ?? user.name,
      class: className,
      section,
      admissionNumber: studentSource.admissionNumber ?? fallbackAdmission,
      dateOfBirth: studentSource.dateOfBirth ?? studentData?.dateOfBirth ?? "",
      address: studentData?.address ?? "Address not provided",
      phone: studentData?.phone ?? "",
      email: studentData?.email ?? user.email ?? "",
      status: "active",
      avatar: (studentSource as { photo?: string | null })?.photo ?? studentData?.avatar ?? null,
    }

    const summary = fallbackReport.summary ?? {}
    const overallAverage = toNumber(summary.averageScore ?? fallbackReport.average, 0)
    const overallGrade =
      typeof summary.grade === "string" && summary.grade.trim().length > 0
        ? summary.grade
        : deriveGradeFromScore(overallAverage)
    const totalStudents = Math.max(toPositiveInteger(summary.numberOfStudents, 25), 1)
    const classPosition = Math.min(
      parseRank(summary.position ?? fallbackReport.position) ?? 1,
      totalStudents,
    )

    const rawSubjects = Array.isArray(fallbackReport.subjects)
      ? (fallbackReport.subjects as Array<Record<string, unknown>>)
      : []

    const subjectSummaries = rawSubjects.map((entry, index) => {
      const subjectName =
        typeof entry.subject === "string"
          ? entry.subject
          : typeof entry.name === "string"
            ? entry.name
            : `Subject ${index + 1}`
      const rawScore = toNumber(
        entry.total ?? entry.score ?? entry.percentage ?? entry.averageScore ?? 0,
        0,
      )
      const score = Number(rawScore.toFixed(1))
      const grade =
        typeof entry.grade === "string" && entry.grade.trim().length > 0
          ? entry.grade
          : deriveGradeFromScore(score)
      const position = parseRank(entry.position)

      return {
        name: subjectName,
        score,
        grade,
        position,
        totalStudents,
      }
    })

    const attendanceSource = fallbackReport.attendance ?? {}
    const presentDays = toPositiveInteger(attendanceSource.present, 0)
    const recordedTotal = toPositiveInteger(attendanceSource.total, presentDays)
    const recordedAbsent = toPositiveInteger(attendanceSource.absent, 0)
    const totalDays = recordedTotal > 0 ? recordedTotal : presentDays + recordedAbsent
    const absentDays = Math.min(totalDays, Math.max(recordedAbsent, totalDays - presentDays))
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    const recentAttendanceCount = Math.max(1, Math.min(5, totalDays || presentDays || 1))
    const recentAttendance = Array.from({ length: recentAttendanceCount }).map((_, offset) => {
      const date = new Date()
      date.setDate(date.getDate() - (recentAttendanceCount - 1 - offset))
      const status: "present" | "absent" | "late" =
        offset < absentDays ? "absent" : "present"
      return { date: date.toISOString().slice(0, 10), status }
    })

    const academicSummary: ParentAcademicSummaryState = {
      subjects: subjectSummaries.length > 0
        ? subjectSummaries
        : [
            {
              name: "Overall Performance",
              score: overallAverage,
              grade: overallGrade,
              position: classPosition,
              totalStudents,
            },
          ],
      overallAverage,
      overallGrade,
      classPosition: classPosition,
      totalStudents,
    }

    const attendanceSummary: ParentAttendanceSummaryState = {
      totalDays,
      presentDays,
      absentDays,
      lateArrivals: 0,
      attendancePercentage,
      recentAttendance,
    }

    return {
      student: studentProfile,
      academic: academicSummary,
      attendance: attendanceSummary,
    }
  }, [academicPeriod.session, academicPeriod.term, linkedStudentId, studentData, user.email, user.name])

  const loadParentSnapshot = useCallback(async () => {
    if (!linkedStudentId) {
      setStudentData(null)
      setAcademicData(null)
      setAttendanceData(null)
      setIsSnapshotLoading(false)
      return
    }

    setIsSnapshotLoading(true)
    setSnapshotError(null)

    try {
      const params = new URLSearchParams({ studentId: linkedStudentId })
      if (academicPeriod.term) {
        params.set("term", academicPeriod.term)
      }
      if (academicPeriod.session) {
        params.set("session", academicPeriod.session)
      }

      const response = await fetch(`/api/parents/dashboard?${params.toString()}`, { cache: "no-store" })

      if (!response.ok) {
        let errorMessage = `Failed to load dashboard snapshot (status ${response.status})`
        try {
          const payload = await response.json()
          if (typeof payload?.error === "string") {
            errorMessage = payload.error
          }
        } catch (error) {
          logger.warn("Unable to parse dashboard snapshot error response", { error })
        }
        throw new Error(errorMessage)
      }

      const payload = (await response.json()) as {
        snapshot: {
          student: ParentStudentProfile
          academic: ParentAcademicSummaryState
          attendance: ParentAttendanceSummaryState
        }
      }

      setStudentData(payload.snapshot.student)
      setAcademicData(payload.snapshot.academic)
      setAttendanceData(payload.snapshot.attendance)
    } catch (error) {
      logger.error("Unable to load parent dashboard snapshot", { error })
      const fallback = buildFallbackSnapshot()
      if (fallback) {
        setStudentData(fallback.student)
        setAcademicData(fallback.academic)
        setAttendanceData(fallback.attendance)
        const baseMessage = error instanceof Error ? error.message : "Unable to load dashboard data"
        setSnapshotError(`${baseMessage}. Displaying cached data.`)
      } else {
        setSnapshotError(error instanceof Error ? error.message : "Unable to load dashboard data")
      }
    } finally {
      setIsSnapshotLoading(false)
    }
  }, [academicPeriod.session, academicPeriod.term, buildFallbackSnapshot, linkedStudentId])

  useEffect(() => {
    void loadParentSnapshot()
  }, [loadParentSnapshot])

  const setAccessFromRecords = useCallback(
    (records: ReportCardAccessRecord[], term?: string, session?: string) => {
      const activeTerm = term ?? academicPeriod.term
      const activeSession = session ?? academicPeriod.session
      if (!activeStudentId) {
        setHasAccess(false)
        setAdminGrantedAccess(false)
        return
      }
      const matchingRecord = records
        .filter((record) => record.term === activeTerm && record.session === activeSession)
        .find((record) => record.parentId === user.id && record.studentId === activeStudentId)

      setHasAccess(Boolean(matchingRecord))
      setAdminGrantedAccess(matchingRecord?.grantedBy === "manual")
    },
    [academicPeriod.session, academicPeriod.term, activeStudentId, user.id],
  )

  useEffect(() => {
    safeStorage.removeItem("grantedAccess")
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadMessagingDirectory = async () => {
      const collected: MessagingParticipant[] = []
      const seen = new Set<string>()

      const addParticipant = (candidate: { id?: unknown; name?: unknown; email?: unknown; role?: unknown }) => {
        const rawId = candidate.id
        const id =
          typeof rawId === "string" && rawId.trim().length > 0
            ? rawId.trim()
            : rawId !== undefined
              ? String(rawId)
              : null
        if (!id || id === user.id || seen.has(id)) {
          return
        }

        const rawName = candidate.name
        const name =
          typeof rawName === "string" && rawName.trim().length > 0
            ? rawName.trim()
            : typeof candidate.email === "string" && candidate.email.trim().length > 0
              ? (candidate.email as string).trim()
              : id
        const role =
          typeof candidate.role === "string" && candidate.role.trim().length > 0
            ? candidate.role
            : "member"
        const email =
          typeof candidate.email === "string" && candidate.email.trim().length > 0
            ? (candidate.email as string).trim()
            : undefined

        collected.push({ id, name, role, email })
        seen.add(id)
      }

      const addFallbackEntries = (entries: MessagingParticipant[]) => {
        entries.forEach((entry) => addParticipant(entry))
      }

      const safeFetch = async (url: string) => {
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        return (await response.json()) as { users?: Array<Record<string, any>> }
      }

      let studentClassId: string | null = null
      let studentClassName: string | null = studentData?.class ?? null

      if (linkedStudentId) {
        try {
          const payload = await safeFetch(`/api/users?userId=${linkedStudentId}`)
          const studentRecord = Array.isArray(payload.users) ? payload.users[0] : undefined
          if (studentRecord) {
            const rawClassId =
              typeof studentRecord.classId === "string"
                ? studentRecord.classId
                : typeof studentRecord.class_id === "string"
                  ? studentRecord.class_id
                  : typeof studentRecord.metadata?.classId === "string"
                    ? studentRecord.metadata.classId
                    : null
            if (rawClassId && rawClassId.trim().length > 0) {
              studentClassId = rawClassId.trim()
            }

            const rawClassName =
              typeof studentRecord.metadata?.assignedClassName === "string"
                ? studentRecord.metadata.assignedClassName
                : typeof studentRecord.className === "string"
                  ? studentRecord.className
                  : typeof studentRecord.class_name === "string"
                    ? studentRecord.class_name
                    : null
            if (rawClassName && rawClassName.trim().length > 0) {
              studentClassName = rawClassName.trim()
            }
          }
        } catch (error) {
          logger.error("Unable to load linked student for messaging directory", { error })
        }
      }

      const fallbackTeacher = fallbackMessagingDirectory.filter((entry) => entry.role === "teacher")
      const fallbackAdmins = fallbackMessagingDirectory.filter((entry) => entry.role === "admin")
      const fallbackSuperAdmins = fallbackMessagingDirectory.filter((entry) => entry.role === "super_admin")

      try {
        const payload = await safeFetch("/api/users?role=teacher")
        const teachers = Array.isArray(payload.users) ? payload.users : []
        let matches = teachers.filter((teacher) => {
          const teacherClassId =
            typeof teacher.classId === "string"
              ? teacher.classId
              : typeof teacher.class_id === "string"
                ? teacher.class_id
                : typeof teacher.metadata?.classId === "string"
                  ? teacher.metadata.classId
                  : null
          const teacherClassName =
            typeof teacher.metadata?.assignedClassName === "string"
              ? teacher.metadata.assignedClassName
              : null

          return (
            (studentClassId && teacherClassId === studentClassId) ||
            (studentClassName && teacherClassName === studentClassName)
          )
        })

        if (matches.length === 0 && teachers.length > 0) {
          matches = teachers.slice(0, 1)
        }

        if (matches.length === 0) {
          addFallbackEntries(fallbackTeacher)
        } else {
          matches.forEach((teacher) => addParticipant(teacher))
        }
      } catch (error) {
        logger.error("Unable to load teacher directory for messaging", { error })
        addFallbackEntries(fallbackTeacher)
      }

      const loadRoleDirectory = async (roleParam: string, fallbacks: MessagingParticipant[]) => {
        try {
          const payload = await safeFetch(`/api/users?role=${roleParam}`)
          const records = Array.isArray(payload.users) ? payload.users : []
          if (records.length === 0) {
            addFallbackEntries(fallbacks)
          } else {
            records.forEach((record) => addParticipant(record))
          }
        } catch (error) {
          logger.error(`Unable to load ${roleParam} directory for messaging`, { error })
          addFallbackEntries(fallbacks)
        }
      }

      await loadRoleDirectory("admin", fallbackAdmins)
      await loadRoleDirectory("super_admin", fallbackSuperAdmins)

      if (collected.length === 0) {
        addFallbackEntries(fallbackMessagingDirectory)
      }

      if (isMounted) {
        setMessagingParticipants(collected.length > 0 ? collected : fallbackMessagingDirectory)
      }
    }

    void loadMessagingDirectory()

    return () => {
      isMounted = false
    }
  }, [fallbackMessagingDirectory, linkedStudentId, studentData, user.id])

  useEffect(() => {
    let isMounted = true

    const loadTimetable = async () => {
      try {
        const className = studentData?.class
        if (!className) {
          if (isMounted) {
            setParentTimetable([])
          }
          return
        }

        if (isMounted) {
          setIsParentTimetableLoading(true)
        }

        const response = await fetch(`/api/timetable?className=${encodeURIComponent(className)}`)
        if (!isMounted) {
          return
        }

        if (response.ok) {
          const payload: unknown = await response.json()
          const normalized = normalizeTimetableCollection(
            (payload as Record<string, unknown>)?.timetable,
          ).map(({ id, day, time, subject, teacher, location }) => ({
            id,
            day,
            time,
            subject,
            teacher,
            location,
          }))
          setParentTimetable(normalized)
        } else {
          setParentTimetable([])
        }
      } catch (error) {
        logger.error("Failed to load parent timetable", { error })
        if (isMounted) {
          setParentTimetable([])
        }
      } finally {
        if (isMounted) {
          setIsParentTimetableLoading(false)
        }
      }
    }

    void loadTimetable()

    return () => {
      isMounted = false
    }
  }, [studentData?.class])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/system/settings")
        if (!response.ok) {
          throw new Error("Unable to load settings")
        }

        const payload = (await response.json()) as {
          settings?: { currentTerm?: string; academicYear?: string }
        }

        const term = normalizeTermLabel(payload.settings?.currentTerm ?? "First Term")
        const session = payload.settings?.academicYear ?? "2024/2025"

        setAcademicPeriod({ term, session })
        const records = syncReportCardAccess(term, session)
        setAccessFromRecords(records, term, session)
      } catch (error) {
        logger.error("Unable to load academic period", { error })
        const records = syncReportCardAccess(academicPeriod.term, academicPeriod.session)
        setAccessFromRecords(records)
      }
    }

    void loadSettings()
  }, [academicPeriod.session, academicPeriod.term, setAccessFromRecords])

  useEffect(() => {
    if (!academicPeriod.term || !academicPeriod.session) {
      return
    }

    const paymentSuccess = safeStorage.getItem("paymentSuccess")
    const paymentDataRaw = safeStorage.getItem("paymentData")

    if (paymentSuccess === "true" && paymentDataRaw) {
      try {
        const paymentData = JSON.parse(paymentDataRaw) as { metadata?: Record<string, unknown> }
        const studentId = String(
          paymentData.metadata?.student_id ?? activeStudentId ?? linkedStudentId ?? "",
        )
        const term = normalizeTermLabel((paymentData.metadata?.term as string | undefined) ?? academicPeriod.term)
        const session = (paymentData.metadata?.session as string | undefined) ?? academicPeriod.session

        if (!studentId) {
          throw new Error("Missing student identifier for payment confirmation")
        }

        const updated = grantReportCardAccess({
          parentId: user.id,
          studentId,
          term,
          session,
          grantedBy: "payment",
        })
        setAccessFromRecords(updated, term, session)
      } catch (error) {
        logger.error("Unable to process payment confirmation", { error })
      } finally {
        safeStorage.removeItem("paymentSuccess")
      }
    } else {
      const records = syncReportCardAccess(academicPeriod.term, academicPeriod.session)
      setAccessFromRecords(records)
    }
  }, [academicPeriod.session, academicPeriod.term, activeStudentId, linkedStudentId, setAccessFromRecords, user.id])

  useEffect(() => {
    const globalScope = typeof globalThis === "undefined" ? undefined : (globalThis as Window)
    if (!globalScope || typeof globalScope.addEventListener !== "function") {
      return
    }

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ records?: ReportCardAccessRecord[] }>).detail
      if (!detail) {
        return
      }

      const incoming = Array.isArray(detail.records) ? detail.records : []
      setAccessFromRecords(incoming)
    }

    globalScope.addEventListener(REPORT_CARD_ACCESS_EVENT, handleUpdate as EventListener)
    return () => {
      globalScope.removeEventListener(REPORT_CARD_ACCESS_EVENT, handleUpdate as EventListener)
    }
  }, [setAccessFromRecords])

  const handlePaymentSuccess = () => {
    if (!activeStudentId) {
      return
    }

    const updated = grantReportCardAccess({
      parentId: user.id,
      studentId: activeStudentId,
      term: academicPeriod.term,
      session: academicPeriod.session,
      grantedBy: "payment",
    })
    setAccessFromRecords(updated)
    setShowPaymentModal(false)
  }

  const resolveApprovalStatus = useCallback(() => {
    try {
      const approvedReports = JSON.parse(safeStorage.getItem("approvedReports") || "[]") as string[]
      const releasedCumulative = JSON.parse(
        safeStorage.getItem("releasedCumulativeReports") || "[]",
      ) as string[]
      const approvalKeys = [activeStudentId, linkedStudentId, "1"]
        .filter((value, index, array): value is string => typeof value === "string" && value.length > 0 && array.indexOf(value) === index)

      return {
        isApproved: approvalKeys.some((key) => approvedReports.includes(key)),
        hasCumulative: approvalKeys.some((key) => releasedCumulative.includes(key)),
      }
    } catch (error) {
      logger.error("Unable to resolve report approval state", { error })
      return { isApproved: false, hasCumulative: false }
    }
  }, [activeStudentId, linkedStudentId])

  const handleViewReportCard = async () => {
    if (!activeStudentId || !studentData) {
      setAccessNotice({
        title: "Student information unavailable",
        description: "We couldn't determine which student record to open. Please refresh and try again.",
      })
      return
    }

    try {
      const { isApproved } = resolveApprovalStatus()

      if (!hasAccess) {
        setAccessNotice(
          isApproved
            ? {
                title: "Report card awaiting release",
                description:
                  "The school has prepared this report card but it hasn't been shared to your dashboard yet. Please contact the administrator for assistance.",
              }
            : {
                title: "Report card not available yet",
                description:
                  "This report card hasn't been sent to your dashboard. You'll be notified once it's ready. If you still need to complete payment, you can proceed now.",
                showPayment: true,
              },
        )
        return
      }

      if (!isApproved) {
        setAccessNotice({
          title: "Report card pending approval",
          description:
            "Please wait for the school administrator to approve and publish this report card. You'll be able to view it once approval is complete.",
        })
        return
      }

      const brandingInfo = getBrandingFromStorage()

      const augmentReportData = (data: RawReportCardData): RawReportCardData => {
        const fallbackTotalStudents = academicData?.totalStudents ?? 0
        const summary = data.summary
          ? { ...data.summary, numberOfStudents: data.summary.numberOfStudents ?? fallbackTotalStudents }
          : {
              totalMarksObtainable: data.totalObtainable ?? 0,
              totalMarksObtained: data.totalObtained ?? 0,
              averageScore: data.average ?? 0,
              position: data.position,
              numberOfStudents: fallbackTotalStudents,
            }

        const classTeacherRemark = data.classTeacherRemark ?? data.formTeacherRemark ?? data.remark ?? ""
        const headTeacherRemark = data.headTeacherRemark ?? data.principalRemark ?? brandingInfo.defaultRemark

        const attendanceSummary =
          data.attendance ?? {
            present: attendanceData?.presentDays ?? 0,
            absent:
              attendanceData?.absentDays ??
              Math.max((attendanceData?.totalDays ?? 0) - (attendanceData?.presentDays ?? 0), 0),
            total: attendanceData?.totalDays ?? 0,
          }

        return {
          ...data,
          summary,
          attendance: attendanceSummary,
          remarks: {
            classTeacher: classTeacherRemark,
            headTeacher: headTeacherRemark ?? "",
          },
          branding: {
            logo: data.branding?.logo ?? brandingInfo.logoUrl ?? null,
            signature: data.branding?.signature ?? brandingInfo.signatureUrl ?? null,
            headmasterName: data.branding?.headmasterName ?? brandingInfo.headmasterName,
            schoolName: data.branding?.schoolName ?? brandingInfo.schoolName,
            address: data.branding?.address ?? brandingInfo.schoolAddress,
            defaultRemark: data.branding?.defaultRemark ?? brandingInfo.defaultRemark,
          },
        }
      }

      const fetchedData =
        getStudentReportCardData(activeStudentId, academicPeriod.term, academicPeriod.session) ??
        (activeStudentId !== "1"
          ? getStudentReportCardData("1", academicPeriod.term, academicPeriod.session)
          : null)

      if (fetchedData && fetchedData.subjects && fetchedData.subjects.length > 0) {
        setReportCardData(augmentReportData(fetchedData))
        setShowReportCard(true)
      } else {
        toast({
          variant: "destructive",
          title: "No report card data",
          description: "Please ensure teachers have entered marks for this student before trying again.",
        })
      }
    } catch (error) {
      logger.error("Error loading report card data", { error })
      toast({
        variant: "destructive",
        title: "Unable to load report card",
        description: "Please try again later or contact the administrator if the issue persists.",
      })
    }
  }

  const getAccessStatus = () => {
    if (adminGrantedAccess) {
      return {
        type: "admin-granted",
        message: "Access granted by Administrator",
        icon: <Key className="w-4 h-4" />,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      }
    } else if (hasAccess) {
      return {
        type: "payment-verified",
        message: "Payment verified - Full access granted",
        icon: <DollarSign className="w-4 h-4" />,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      }
    } else {
      return {
        type: "payment-required",
        message: "Payment required for full access",
        icon: <DollarSign className="w-4 h-4" />,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      }
    }
  }

  const accessStatus = getAccessStatus()
  const approvalStatus = resolveApprovalStatus()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#2d682d]">Parent Dashboard</h2>
        {!hasAccess && (
          <Button className="bg-[#b29032] hover:bg-[#b29032]/90 text-white" onClick={() => setShowPaymentModal(true)}>
            Pay School Fees
          </Button>
        )}
      </div>

      <Card className={`${accessStatus.borderColor} ${accessStatus.bgColor}`}>
        <CardHeader>
          <CardTitle className={`${accessStatus.color} flex items-center gap-2`}>
            {accessStatus.icon}
            Access Status
          </CardTitle>
          <CardDescription className={accessStatus.color}>{accessStatus.message}</CardDescription>
        </CardHeader>
        {!hasAccess && (
          <CardContent>
            <Button className="bg-[#b29032] hover:bg-[#b29032]/90 text-white" onClick={() => setShowPaymentModal(true)}>
              Pay School Fees - ₦50,000
            </Button>
          </CardContent>
        )}
      </Card>

      {snapshotError && !isSnapshotLoading ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load live dashboard data</AlertTitle>
          <AlertDescription>{snapshotError}</AlertDescription>
        </Alert>
      ) : null}

      {showReportCard && studentData ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-blue-900">Student Report Card</h3>
            <Button variant="outline" onClick={() => setShowReportCard(false)}>
              Back to Dashboard
            </Button>
          </div>
          <ReportCardViewer
            studentId={studentData.id}
            studentName={studentData.name}
            userRole="parent"
            hasAccess={hasAccess || false}
            initialReportCard={reportCardData}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isSnapshotLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : studentData ? (
              <StudentProfileCard student={studentData} />
            ) : (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-700">Student profile unavailable</CardTitle>
                  <CardDescription>Refresh the page or contact the administrator for assistance.</CardDescription>
                </CardHeader>
              </Card>
            )}

            {isSnapshotLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : academicData ? (
              <AcademicProgress
                subjects={academicData.subjects}
                overallAverage={academicData.overallAverage}
                overallGrade={academicData.overallGrade}
                classPosition={academicData.classPosition}
                totalStudents={academicData.totalStudents}
                hasAccess={hasAccess || false}
              />
            ) : (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-yellow-700">Academic progress unavailable</CardTitle>
                  <CardDescription>We couldn't load live result summaries. Please try again shortly.</CardDescription>
                </CardHeader>
              </Card>
            )}

            {isSnapshotLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : attendanceData ? (
              <AttendanceTracker attendance={attendanceData} hasAccess={hasAccess || false} />
            ) : (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-yellow-700">Attendance record unavailable</CardTitle>
                  <CardDescription>Attendance logs will appear here once the system reconnects.</CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card className="border-blue-200 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-blue-900">Class Timetable</CardTitle>
                <CardDescription>{`Stay updated with ${studentFirstName}'s daily lessons.`}</CardDescription>
              </CardHeader>
              <CardContent>
                {isParentTimetableLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-blue-900/70">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading timetable...
                  </div>
                ) : (
                  <TimetableWeeklyView
                    slots={parentTimetable}
                    emptyMessage="No timetable has been shared for this class yet."
                    renderDetails={(slot) => (
                      <p className="text-sm text-blue-900/80">
                        {slot.teacher && slot.teacher.trim().length > 0
                          ? `Teacher: ${slot.teacher}`
                          : "Teacher to be announced"}
                        {slot.location && slot.location.trim().length > 0 ? ` • Location: ${slot.location}` : ""}
                      </p>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Quick Actions</CardTitle>
                <CardDescription>Common parent portal actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className={cn(
                    "w-full bg-[#2d682d] hover:bg-[#2d682d]/90 text-white",
                    !hasAccess && "opacity-80",
                  )}
                  onClick={handleViewReportCard}
                  aria-disabled={!hasAccess}
                >
                  View Report Card
                </Button>
                {studentData ? (
                  <CumulativeReportTrigger
                    hasAccess={hasAccess || false}
                    studentId={studentData.id}
                    className={studentData.class}
                    isReleased={approvalStatus.hasCumulative}
                    onUnavailable={(message) =>
                      setAccessNotice({
                        title: "Cumulative report unavailable",
                        description:
                          message ??
                          "The cumulative performance summary hasn't been shared to your dashboard yet. Please reach out to the school for an update.",
                      })
                    }
                    onAvailable={(message) =>
                      setAccessNotice({
                        title: "Cumulative report ready",
                        description: message,
                      })
                    }
                  >
                    <Button
                      className={cn(
                        "w-full bg-[#b29032] hover:bg-[#b29032]/90 text-white",
                        !hasAccess && "opacity-80",
                      )}
                      onClick={(event) => {
                        if (hasAccess) {
                          return
                        }

                        event.preventDefault()
                        event.stopPropagation()

                        const { isApproved, hasCumulative } = resolveApprovalStatus()
                        setAccessNotice(
                          isApproved
                            ? hasCumulative
                              ? {
                                  title: "Unlock with payment",
                                  description:
                                    "Please complete the school fee payment to view the cumulative performance summary.",
                                  showPayment: true,
                                }
                              : {
                                  title: "Cumulative report unavailable",
                                  description:
                                    "The cumulative performance summary hasn't been shared to your dashboard yet. Please reach out to the school for an update.",
                                }
                            : {
                                title: "Cumulative report locked",
                                description:
                                  "Complete the report card release process to unlock the cumulative performance summary for this student.",
                                showPayment: true,
                              },
                        )
                      }}
                      aria-disabled={!hasAccess}
                    >
                      View Cumulative Report
                    </Button>
                  </CumulativeReportTrigger>
                ) : (
                  <Button className="w-full bg-[#b29032] text-white" variant="outline" disabled>
                    View Cumulative Report
                  </Button>
                )}
                <Button className="w-full bg-transparent" variant="outline">
                  View Payment History
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  Contact Teacher
                </Button>
                <Button className="w-full bg-transparent" variant="outline">
                  School Calendar
                </Button>
              </CardContent>
            </Card>

            <ExamScheduleOverview
              role="parent"
              classNames={studentData ? [studentData.class] : undefined}
              description="Upcoming exams relevant to your child"
            />

          <SchoolCalendarViewer role="parent" />
        </div>

        <div className="mt-8">
          <NotificationCenter
            userRole="parent"
            userId={user.id}
            studentIds={studentData ? [studentData.id] : []}
          />
        </div>

        <div className="mt-8">
          <Noticeboard userRole="parent" userName={user.name} />
        </div>

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Messages</CardTitle>
                <CardDescription>Communicate with teachers and school administration</CardDescription>
              </CardHeader>
              <CardContent>
                <InternalMessaging
                  currentUser={{ id: user.id, name: user.name, role: "parent" }}
                  participants={messagingParticipants}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={Boolean(accessNotice)} onOpenChange={(open) => !open && setAccessNotice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{accessNotice?.title}</AlertDialogTitle>
            <AlertDialogDescription>{accessNotice?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {accessNotice?.showPayment ? (
              <>
                <AlertDialogCancel onClick={() => setAccessNotice(null)}>Close</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setAccessNotice(null)
                    setShowPaymentModal(true)
                  }}
                >
                  Complete Payment
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => setAccessNotice(null)}>Okay</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        studentName={studentData?.name ?? ""}
        studentId={activeStudentId ?? ""}
        parentName={user.name}
        parentEmail={user.email}
      />
    </div>
  )
}
