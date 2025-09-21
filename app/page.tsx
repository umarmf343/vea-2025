"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { AccountantDashboard } from "@/components/accountant-dashboard"
import TimetableManagement from "@/components/timetable-management"
import ExamManagement from "@/components/exam-management"
import GradeManagement from "@/components/grade-management"
import SuperAdminDashboard from "@/components/super-admin-dashboard"
import { ReportCardConfig } from "@/components/admin/report-card-config"
import { Noticeboard } from "@/components/noticeboard"
import { UserManagement } from "@/components/admin/user-management"
import { ClassSubjectManagement } from "@/components/admin/class-subject-management"
import { SystemSettings } from "@/components/admin/system-settings"
import { CumulativeReportTrigger } from "@/components/cumulative-report"
import { SystemHealthMonitor } from "@/components/system-health-monitor"
import { NotificationCenter } from "@/components/notification-center"
import { ReportCardViewer } from "@/components/report-card-viewer"
import { AutomaticPromotionSystem } from "@/components/automatic-promotion-system"
import { getStudentReportCardData } from "@/lib/report-card-data"
import { InternalMessaging } from "@/components/internal-messaging"
import { AdminApprovalDashboard } from "@/components/admin-approval-dashboard"
import { getCompleteReportCard } from "@/lib/sample-report-data"
import { safeStorage } from "@/lib/safe-storage"
import { getBrandingFromStorage } from "@/lib/branding"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { toast } from "@/hooks/use-toast"
import type { Viewport } from "next"
import { SchoolCalendarManager } from "@/components/admin/school-calendar-manager"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"

export const dynamic = "force-dynamic"
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

type UserRole = "super-admin" | "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant"

interface User {
  id: string
  email: string
  role: UserRole
  name: string
  hasAccess?: boolean
  classId?: string | null
  className?: string | null
  subjects?: string[]
  metadata?: Record<string, unknown> | null
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

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ email: "", password: "", role: "parent" as UserRole })
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "parent" as UserRole,
    studentId: "",
  })
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

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
        const response = await fetch("/api/system/settings")
        if (!response.ok) {
          throw new Error(`Settings request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as { settings?: { registrationEnabled?: boolean } }
        const enabled = Boolean(payload.settings?.registrationEnabled ?? true)
        setRegistrationEnabled(enabled)
        safeStorage.setItem("registrationEnabled", JSON.stringify(enabled))
      } catch (error) {
        logger.error("Unable to load system settings", { error })
      }
    }

    void fetchSettings()
  }, [currentUser])

  useEffect(() => {
    const storedUser = safeStorage.getItem("vea_current_user")
    const storedToken = safeStorage.getItem("vea_auth_token")

    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser) as User
        if (parsed.role === "teacher" || parsed.role === "student" || parsed.role === "parent") {
          setCurrentUser(parsed)
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
      if (userRole !== loginForm.role) {
        setLoginError("This account does not match the selected role.")
        return
      }
      const user: User = {
        id: String(payload.user?.id ?? ""),
        email: payload.user?.email ?? loginForm.email,
        role: userRole,
        name: payload.user?.name ?? loginForm.email.split("@")[0],
        hasAccess: roleHasPortalAccess(userRole),
        classId: payload.user?.classId ?? payload.user?.class_id ?? null,
        className:
          typeof payload.user?.metadata?.assignedClassName === "string"
            ? payload.user.metadata.assignedClassName
            : null,
        subjects: Array.isArray(payload.user?.subjects) ? payload.user.subjects : [],
        metadata: payload.user?.metadata ?? null,
      }

      setCurrentUser(user)
      if (payload.token) {
        safeStorage.setItem("vea_auth_token", payload.token)
      }
      safeStorage.setItem("vea_current_user", JSON.stringify(user))
    } catch (error) {
      logger.error("Login failed", { error })
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          role: mapUiRoleToApi(registerForm.role),
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
            <GraduationCap className="h-12 w-12 text-[#2d682d]" />
          </div>
          <h1 className="text-3xl font-bold text-[#2d682d] mb-2">VEA 2025</h1>
          <p className="text-[#b29032]">School Management Portal</p>
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
                        onValueChange={(value: UserRole) => setRegisterForm((prev) => ({ ...prev, role: value }))}
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
                        />
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

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [teacherAssignments, setTeacherAssignments] = useState({
    classes: user.role === "teacher" && user.className ? [user.className] : [],
    subjects: user.role === "teacher" && Array.isArray(user.subjects) ? user.subjects : [],
  })

  useEffect(() => {
    if (user.role !== "teacher") {
      setTeacherAssignments({ classes: [], subjects: [] })
      return
    }

    let isMounted = true

    const loadTeacherAssignments = async () => {
      const subjects = Array.isArray(user.subjects) ? user.subjects : []
      let classes: string[] = []

      const classId = typeof user.classId === "string" ? user.classId.trim() : ""

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
              classes = [match.name]
            }
          } else if (response.status !== 404) {
            logger.error("Unable to load class assignments", {
              status: response.status,
              statusText: response.statusText,
            })
          }
        } catch (error) {
          logger.error("Unable to load class assignments", { error })
        }
      }

      if (classes.length === 0 && user.className) {
        classes = [user.className]
      }

      if (isMounted) {
        setTeacherAssignments({ classes, subjects })
      }
    }

    void loadTeacherAssignments()

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
              <GraduationCap className="h-8 w-8 text-[#b29032]" />
              <div>
                <h1 className="text-xl font-bold">VEA 2025</h1>
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
        {user.role === "admin" && <AdminDashboard />}
        {user.role === "parent" && <ParentDashboard user={user} />}
        {user.role === "student" && (
          <StudentDashboard
            student={{
              id: user.id,
              name: user.name,
              email: user.email,
              class: "JSS 2A",
              admissionNumber: "VEA2025001",
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

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#2d682d]">Admin Dashboard</h2>

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
              value="grades"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Grades
            </TabsTrigger>
            <TabsTrigger
              value="reportcards"
              className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white text-xs px-2"
            >
              Report Cards
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SystemOverview />
            </div>
            <div>
              <NotificationCenter userRole="admin" />
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

        <TabsContent value="grades" className="space-y-6">
          <GradeManagement />
        </TabsContent>

        <TabsContent value="reportcards" className="space-y-6">
          <ReportCardConfig />
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
          <InternalMessaging currentUser={{ id: "admin", name: "Admin", role: "admin" }} />
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
  const [reportCardData, setReportCardData] = useState<any>(null)

  useEffect(() => {
    const paymentSuccess = safeStorage.getItem("paymentSuccess")
    const grantedAccess = safeStorage.getItem("grantedAccess")

    let accessGranted = false

    if (paymentSuccess === "true") {
      accessGranted = true
      safeStorage.removeItem("paymentSuccess")
    }

    if (grantedAccess) {
      const accessData = JSON.parse(grantedAccess)
      if (accessData[user.id]) {
        setAdminGrantedAccess(true)
        accessGranted = true
      }
    }

    if (accessGranted) {
      setHasAccess(true)
    }
  }, [user.id])

  const handlePaymentSuccess = () => {
    const grantedAccess = JSON.parse(safeStorage.getItem("grantedAccess") || "{}")
    grantedAccess[user.id] = true
    safeStorage.setItem("grantedAccess", JSON.stringify(grantedAccess))

    setHasAccess(true)
    setShowPaymentModal(false)
  }

  const studentData = {
    id: "1",
    name: "John Doe",
    class: "10",
    section: "A",
    admissionNumber: "VEA2025001",
    dateOfBirth: "2008-05-15",
    address: "123 Main Street, Lagos, Nigeria",
    phone: "+234 801 234 5678",
    email: "john.doe@student.vea.edu.ng",
    status: "active" as const,
  }

  const academicData = {
    subjects: [
      { name: "Mathematics", score: 85, grade: "A", position: 3, totalStudents: 45 },
      { name: "English Language", score: 78, grade: "B+", position: 8, totalStudents: 45 },
      { name: "Physics", score: 92, grade: "A+", position: 1, totalStudents: 45 },
      { name: "Chemistry", score: 80, grade: "B+", position: 5, totalStudents: 45 },
      { name: "Biology", score: 88, grade: "A", position: 2, totalStudents: 45 },
    ],
    overallAverage: 84.6,
    overallGrade: "A",
    classPosition: 4,
    totalStudents: 45,
  }

  const attendanceData = {
    totalDays: 120,
    presentDays: 115,
    absentDays: 3,
    lateArrivals: 2,
    attendancePercentage: 95.8,
    recentAttendance: [
      { date: "2025-01-08", status: "present" as const },
      { date: "2025-01-07", status: "present" as const },
      { date: "2025-01-06", status: "late" as const },
      { date: "2025-01-05", status: "present" as const },
      { date: "2025-01-04", status: "absent" as const },
    ],
  }

  const handleViewReportCard = async () => {
    if (hasAccess) {
      try {
        const brandingInfo = getBrandingFromStorage()

        const approvedReports = JSON.parse(safeStorage.getItem("approvedReports") || "[]")

        if (!approvedReports.includes(studentData.id)) {
          toast({
            variant: "destructive",
            title: "Report card pending approval",
            description: "Please wait for the administrator to approve this report card before viewing.",
          })
          return
        }

        const completeData = getCompleteReportCard(
          Number.parseInt(studentData.id),
          "JSS 1A",
          "Mathematics",
          "first",
          "2024/2025",
        )

        if (completeData) {
          setReportCardData(completeData)
          setShowReportCard(true)
          return
        }

        const data = await getStudentReportCardData(studentData.id, "First Term", "2024/2025")

        if (data && data.subjects && data.subjects.length > 0) {
          setReportCardData({
            student: {
              name: data.student.name,
              admissionNumber: data.student.admissionNumber,
              class: data.student.class,
              term: data.student.term,
              session: data.student.session,
              position: data.position,
              totalStudents: academicData.totalStudents,
              photo: "/diverse-students.png",
            },
            subjects: data.subjects,
            summary: {
              totalObtainable: data.totalObtainable,
              totalObtained: data.totalObtained,
              average: data.average,
            },
            affectiveDomain: data.affectiveDomain,
            psychomotorDomain: data.psychomotorDomain,
            remarks: {
              classTeacher: data.classTeacherRemarks,
              headmaster:
                brandingInfo.defaultRemark ||
                "An exemplary student who continues to excel in academics and character development.",
            },
            branding: {
              logo: brandingInfo.logoUrl ?? "",
              signature: brandingInfo.signatureUrl ?? "",
              headmasterName: brandingInfo.headmasterName,
              schoolName: brandingInfo.schoolName,
              address: brandingInfo.schoolAddress,
            },
            attendance: {
              present: attendanceData.presentDays,
              absent: attendanceData.absentDays,
              total: attendanceData.totalDays,
            },
          })
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
    } else {
      setShowPaymentModal(true)
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

      {showReportCard ? (
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
            reportCardData={reportCardData}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StudentProfileCard student={studentData} />

            <AcademicProgress
              subjects={academicData.subjects}
              overallAverage={academicData.overallAverage}
              overallGrade={academicData.overallGrade}
              classPosition={academicData.classPosition}
              totalStudents={academicData.totalStudents}
              hasAccess={hasAccess || false}
            />

            <AttendanceTracker attendance={attendanceData} hasAccess={hasAccess || false} />

            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Quick Actions</CardTitle>
                <CardDescription>Common parent portal actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90 text-white"
                  onClick={handleViewReportCard}
                  disabled={!hasAccess}
                >
                  View Report Card
                </Button>
                <CumulativeReportTrigger
                  hasAccess={hasAccess || false}
                  studentId={studentData.id}
                  className={studentData.class}
                >
                  <Button className="w-full bg-[#b29032] hover:bg-[#b29032]/90 text-white" disabled={!hasAccess}>
                    View Cumulative Report
                  </Button>
                </CumulativeReportTrigger>
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

            <SchoolCalendarViewer role="parent" />
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
                <InternalMessaging currentUser={{ id: user.id, name: user.name, role: "parent" }} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        studentName={studentData.name}
        studentId={studentData.id}
        amount={50000}
      />
    </div>
  )
}
