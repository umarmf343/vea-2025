"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Key, Edit, Eye, Shield, Trash2, UserCheck, UserPlus } from "lucide-react"

interface ApiTeacherAssignment {
  classId?: string | null
  className?: string | null
  subjects?: string[]
}

interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  status?: string
  createdAt?: string
  updatedAt?: string
  lastLogin?: string | null
  studentIds?: string[]
  subjects?: string[]
  classId?: string | null
  classIds?: string[]
  teachingClassIds?: string[]
  teachingAssignments?: ApiTeacherAssignment[]
  metadata?: Record<string, any> | null
  isActive?: boolean
}

type UserRole = "super-admin" | "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant"

type UserStatus = "active" | "inactive" | "suspended"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  lastLogin?: string
  studentIds: string[]
  subjects: string[]
  classId: string | null
  classIds: string[]
  className?: string | null
  metadata: Record<string, any>
  contactPhonePrimary?: string
  contactPhoneSecondary?: string
  contactAddress?: string
  teachingAssignments: { classId: string; className: string; subjects: string[] }[]
}

interface ClassOption {
  id: string
  name: string
  subjects: string[]
}

const ROLE_OPTIONS: { value: UserRole; label: string; api: string }[] = [
  { value: "super-admin", label: "Super Admin", api: "super_admin" },
  { value: "admin", label: "Admin", api: "admin" },
  { value: "teacher", label: "Teacher", api: "teacher" },
  { value: "student", label: "Student", api: "student" },
  { value: "parent", label: "Parent", api: "parent" },
  { value: "librarian", label: "Librarian", api: "librarian" },
  { value: "accountant", label: "Accountant", api: "accountant" },
]

const NO_CLASS_SELECT_VALUE = "__no_class__"

const shouldAssignClass = (role: UserRole) => role === "teacher" || role === "student"

const STATUS_BADGE: Record<UserStatus, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  suspended: "bg-red-100 text-red-800",
}

const ROLE_BADGE: Record<UserRole, string> = {
  "super-admin": "bg-red-100 text-red-800",
  admin: "bg-blue-100 text-blue-800",
  teacher: "bg-green-100 text-green-800",
  student: "bg-purple-100 text-purple-800",
  parent: "bg-orange-100 text-orange-800",
  librarian: "bg-cyan-100 text-cyan-800",
  accountant: "bg-yellow-100 text-yellow-800",
}

function normalizeRole(role: string): UserRole {
  const normalized = role.toLowerCase().replace(/[_\s]+/g, "-")
  if (
    normalized === "super-admin" ||
    normalized === "admin" ||
    normalized === "teacher" ||
    normalized === "student" ||
    normalized === "parent" ||
    normalized === "librarian" ||
    normalized === "accountant"
  ) {
    return normalized
  }
  return "teacher"
}

function normalizeStatus(status?: string, isActive?: boolean): UserStatus {
  if (!status) {
    return isActive === false ? "inactive" : "active"
  }

  const normalized = status.toLowerCase()
  if (normalized === "inactive" || normalized === "suspended") {
    return normalized
  }
  return "active"
}

function mapUser(apiUser: ApiUser): User {
  const role = normalizeRole(apiUser.role)
  const metadata = apiUser.metadata ?? {}
  const normalizedAssignments: { classId: string; className: string; subjects: string[] }[] = Array.isArray(
    apiUser.teachingAssignments,
  )
    ? apiUser.teachingAssignments
        .map((assignment) => {
          const rawId = typeof assignment.classId === "string" ? assignment.classId.trim() : ""
          const rawName = typeof assignment.className === "string" ? assignment.className.trim() : ""
          const identifier = rawId || rawName

          if (!identifier) {
            return null
          }

          const name = rawName || rawId || identifier
          const subjects = Array.isArray(assignment.subjects)
            ? Array.from(
                new Set(
                  assignment.subjects
                    .map((subject) => subject?.toString().trim())
                    .filter((subject): subject is string => Boolean(subject && subject.length > 0)),
                ),
              )
            : []

          return { classId: identifier, className: name, subjects }
        })
        .filter((assignment): assignment is { classId: string; className: string; subjects: string[] } => Boolean(assignment))
    : []

  const normalizedSubjects = Array.isArray(apiUser.subjects)
    ? Array.from(
        new Set(
          apiUser.subjects
            .map((subject) => subject?.toString().trim())
            .filter((subject): subject is string => Boolean(subject && subject.length > 0)),
        ),
      )
    : []

  const derivedSubjects =
    role === "teacher"
      ? Array.from(
          new Set([
            ...normalizedSubjects,
            ...normalizedAssignments.flatMap((assignment) => assignment.subjects),
          ]),
        )
      : normalizedSubjects

  const resolvedClassId =
    role === "teacher"
      ? null
      : typeof apiUser.classId === "string"
        ? apiUser.classId
        : typeof metadata.classId === "string"
          ? metadata.classId
          : null

  const classIds =
    role === "teacher"
      ? Array.from(
          new Set([
            ...(Array.isArray(apiUser.teachingClassIds)
              ? apiUser.teachingClassIds.map((value) => value.toString())
              : []),
            ...(Array.isArray(apiUser.classIds)
              ? apiUser.classIds.map((value) => value.toString())
              : []),
            ...normalizedAssignments.map((assignment) => assignment.classId),
          ]),
        )
      : resolvedClassId
        ? [resolvedClassId]
        : []

  const className =
    role === "teacher"
      ? normalizedAssignments.length > 0
        ? normalizedAssignments.map((assignment) => assignment.className).join(", ")
        : undefined
      : typeof metadata.assignedClassName === "string"
        ? metadata.assignedClassName
        : undefined

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role,
    status: normalizeStatus(apiUser.status, apiUser.isActive),
    createdAt: apiUser.createdAt ? new Date(apiUser.createdAt).toLocaleDateString() : "—",
    lastLogin: apiUser.lastLogin ?? undefined,
    studentIds: apiUser.studentIds ?? [],
    subjects: derivedSubjects,
    classId: resolvedClassId,
    classIds,
    className,
    metadata,
    contactPhonePrimary:
      typeof metadata.contactPhonePrimary === "string" ? metadata.contactPhonePrimary : undefined,
    contactPhoneSecondary:
      typeof metadata.contactPhoneSecondary === "string" ? metadata.contactPhoneSecondary : undefined,
    contactAddress: typeof metadata.contactAddress === "string" ? metadata.contactAddress : undefined,
    teachingAssignments: normalizedAssignments,
  }
}

interface NewUserState {
  name: string
  email: string
  role: UserRole
  password: string
  studentIds: string[]
  classId: string
  classIds: string[]
  teachingAssignments: { classId: string; subjects: string[] }[]
  subjects: string[]
  phoneNumber1: string
  phoneNumber2: string
  address: string
}

const INITIAL_USER_STATE: NewUserState = {
  name: "",
  email: "",
  role: "teacher",
  password: "",
  studentIds: [],
  classId: "",
  classIds: [],
  teachingAssignments: [],
  subjects: [],
  phoneNumber1: "",
  phoneNumber2: "",
  address: "",
}

interface UserManagementProps {
  hideSuperAdmin?: boolean
}

export function UserManagement({ hideSuperAdmin = false }: UserManagementProps = {}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)

  const [newUser, setNewUser] = useState<NewUserState>(INITIAL_USER_STATE)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/users")
      if (!response.ok) {
        throw new Error("Unable to load user records")
      }
      const data = (await response.json()) as { users: ApiUser[] }
      const mappedUsers = data.users.map(mapUser)
      setUsers(hideSuperAdmin ? mappedUsers.filter((user) => user.role !== "super-admin") : mappedUsers)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to fetch users")
    } finally {
      setLoading(false)
    }
  }, [hideSuperAdmin])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const availableStudents = useMemo(() => users.filter((user) => user.role === "student"), [users])
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([])

  const selectedNewTeacherSubjects = useMemo(
    () =>
      Array.from(
        new Set(newUser.teachingAssignments.flatMap((assignment) => assignment.subjects ?? [])),
      ).filter((subject): subject is string => subject.length > 0),
    [newUser.teachingAssignments],
  )

  const selectedEditingTeacherSubjects = useMemo(
    () =>
      editingUser?.role === "teacher"
        ? Array.from(
            new Set(
              editingUser.teachingAssignments.flatMap((assignment) => assignment.subjects ?? []),
            ),
          ).filter((subject): subject is string => subject.length > 0)
        : [],
    [editingUser?.role, editingUser?.teachingAssignments],
  )

  useEffect(() => {
    const loadAuxiliaryData = async () => {
      try {
        const classResponse = await fetch("/api/classes")

        if (classResponse.ok) {
          const classPayload = (await classResponse.json()) as {
            classes?: Array<{ id: string; name: string; subjects?: string[] }>
          }
          setAvailableClasses(
            Array.isArray(classPayload.classes)
              ? classPayload.classes.map((entry) => ({
                  id: entry.id,
                  name: entry.name,
                  subjects: Array.isArray(entry.subjects)
                    ? entry.subjects.map((subject) => subject.toString())
                    : [],
                }))
              : [],
          )
        }
      } catch (error) {
        console.error("Failed to load classes", error)
      }
    }

    void loadAuxiliaryData()
  }, [])

  const roleOptions = useMemo(
    () => (hideSuperAdmin ? ROLE_OPTIONS.filter((option) => option.value !== "super-admin") : ROLE_OPTIONS),
    [hideSuperAdmin],
  )

  const displayedUsers = useMemo(
    () => (hideSuperAdmin ? users.filter((user) => user.role !== "super-admin") : users),
    [hideSuperAdmin, users],
  )

  const resolveRoleLabel = useCallback(
    (role: UserRole) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role,
    [],
  )

  const handleCreateUser = useCallback(async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError("Name, email, and password are required")
      return
    }

    try {
      const normalizedClassId = newUser.classId.trim()
      const selectedClass = availableClasses.find((cls) => cls.id === normalizedClassId)

      let teacherAssignmentPayload: { classId: string; className: string; subjects: string[] }[] = []

      if (newUser.role === "parent" && newUser.studentIds.length === 0) {
        setError("Please assign at least one student to the parent account")
        return
      }

      if (newUser.role === "teacher") {
        if (newUser.teachingAssignments.length === 0) {
          setError("Select at least one class before creating a teacher account")
          return
        }

        const processedAssignments = new Map<string, { classId: string; className: string; subjects: string[] }>()

        for (const assignment of newUser.teachingAssignments) {
          const classOption = availableClasses.find((cls) => cls.id === assignment.classId)
          if (!classOption) {
            setError("One of the selected classes is no longer available. Please refresh and try again.")
            return
          }

          const canonicalSubjects = Array.from(
            new Set(
              (classOption.subjects ?? [])
                .map((subject) => subject.toString().trim())
                .filter((subject) => subject.length > 0),
            ),
          )

          if (canonicalSubjects.length === 0) {
            setError(`Add subjects to ${classOption.name} before assigning it to a teacher`)
            return
          }

          const canonicalTokens = canonicalSubjects.map((subject) => subject.toLowerCase())
          const sanitizedSubjects = Array.from(
            new Set(
              (assignment.subjects ?? [])
                .map((subject) => subject.trim())
                .filter((subject) => subject.length > 0 && canonicalTokens.includes(subject.toLowerCase())),
            ),
          )

          if (sanitizedSubjects.length === 0) {
            setError(`Select at least one subject for ${classOption.name}`)
            return
          }

          processedAssignments.set(classOption.id, {
            classId: classOption.id,
            className: classOption.name,
            subjects: sanitizedSubjects,
          })
        }

        teacherAssignmentPayload = Array.from(processedAssignments.values())

        if (teacherAssignmentPayload.length === 0) {
          setError("Select at least one class before creating a teacher account")
          return
        }
      } else if (shouldAssignClass(newUser.role) && !normalizedClassId) {
        setError("Please select a class before creating this account")
        return
      }

      const primaryPhone = newUser.phoneNumber1.trim()
      const secondaryPhone = newUser.phoneNumber2.trim()
      const address = newUser.address.trim()

      if (newUser.role !== "student" && !primaryPhone) {
        setError("Enter a primary phone number for this user")
        return
      }

      if (!address) {
        setError("Enter an address for this user")
        return
      }

      const assignmentClassIds = teacherAssignmentPayload.map((assignment) => assignment.classId)

      const classMetadata =
        newUser.role === "teacher"
          ? {
              assignedClassIds: assignmentClassIds,
              assignedClassNames: teacherAssignmentPayload.map((assignment) => assignment.className),
              teachingSubjects: Array.from(
                new Set(teacherAssignmentPayload.flatMap((assignment) => assignment.subjects)),
              ),
            }
          : shouldAssignClass(newUser.role)
            ? {
                assignedClassName: selectedClass?.name ?? null,
              }
            : undefined

      const parentMetadata =
        newUser.role === "parent" && newUser.studentIds.length > 0
          ? {
              linkedStudentId: newUser.studentIds[0],
              linkedStudentIds: [...newUser.studentIds],
            }
          : undefined

      const contactMetadata: Record<string, string> = {}
      if (primaryPhone) {
        contactMetadata.contactPhonePrimary = primaryPhone
      }
      if (secondaryPhone) {
        contactMetadata.contactPhoneSecondary = secondaryPhone
      }
      contactMetadata.contactAddress = address

      const metadataPayload = { ...parentMetadata, ...classMetadata, ...contactMetadata }
      const metadata = Object.keys(metadataPayload).length > 0 ? metadataPayload : undefined
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: ROLE_OPTIONS.find((option) => option.value === newUser.role)?.api ?? "Teacher",
          password: newUser.password,
          studentIds: newUser.role === "parent" ? newUser.studentIds : undefined,
          classId: newUser.role === "student" ? (normalizedClassId || null) : undefined,
          classIds: newUser.role === "teacher" ? assignmentClassIds : undefined,
          subjects: newUser.role === "teacher" ? undefined : newUser.subjects,
          teachingAssignments:
            newUser.role === "teacher"
              ? teacherAssignmentPayload.map((assignment) => ({
                  classId: assignment.classId,
                  subjects: assignment.subjects,
                }))
              : undefined,
          metadata,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error ?? "Failed to create user")
      }

      const data = (await response.json()) as { user: ApiUser }
      const createdUser = mapUser(data.user)
      setUsers((previous) => {
        if (hideSuperAdmin && createdUser.role === "super-admin") {
          return previous
        }
        return [...previous, createdUser]
      })
      setNewUser(INITIAL_USER_STATE)
      setIsAddDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to create user")
    }
  }, [availableClasses, hideSuperAdmin, newUser])

  const handleUpdateUser = useCallback(async () => {
    if (!editingUser) return

    try {
      const normalizedClassId =
        typeof editingUser.classId === "string" && editingUser.classId.trim().length > 0
          ? editingUser.classId.trim()
          : null
      const selectedClass =
        normalizedClassId !== null
          ? availableClasses.find((cls) => cls.id === normalizedClassId)
          : undefined
      let teacherAssignmentPayload: { classId: string; className: string; subjects: string[] }[] = []
      const metadataPayload: Record<string, any> = editingUser.metadata ? { ...editingUser.metadata } : {}

      const primaryPhone = editingUser.contactPhonePrimary?.trim() ?? ""
      const secondaryPhone = editingUser.contactPhoneSecondary?.trim() ?? ""
      const address = editingUser.contactAddress?.trim() ?? ""

      if (editingUser.role !== "student" && !primaryPhone) {
        setError("Enter a primary phone number for this user")
        return
      }

      if (!address) {
        setError("Enter an address for this user")
        return
      }

      if (editingUser.role === "teacher") {
        if (editingUser.teachingAssignments.length === 0) {
          setError("Select at least one class before saving this teacher")
          return
        }

        const processedAssignments = new Map<string, { classId: string; className: string; subjects: string[] }>()

        for (const assignment of editingUser.teachingAssignments) {
          const classOption = availableClasses.find((cls) => cls.id === assignment.classId)
          if (!classOption) {
            setError("One of the selected classes is no longer available. Please refresh and try again.")
            return
          }

          const canonicalSubjects = Array.from(
            new Set(
              (classOption.subjects ?? [])
                .map((subject) => subject.toString().trim())
                .filter((subject) => subject.length > 0),
            ),
          )

          if (canonicalSubjects.length === 0) {
            setError(`Add subjects to ${classOption.name} before assigning it to a teacher`)
            return
          }

          const canonicalTokens = canonicalSubjects.map((subject) => subject.toLowerCase())
          const sanitizedSubjects = Array.from(
            new Set(
              (assignment.subjects ?? [])
                .map((subject) => subject.trim())
                .filter((subject) => subject.length > 0 && canonicalTokens.includes(subject.toLowerCase())),
            ),
          )

          if (sanitizedSubjects.length === 0) {
            setError(`Select at least one subject for ${classOption.name}`)
            return
          }

          processedAssignments.set(classOption.id, {
            classId: classOption.id,
            className: classOption.name,
            subjects: sanitizedSubjects,
          })
        }

        teacherAssignmentPayload = Array.from(processedAssignments.values())

        if (teacherAssignmentPayload.length === 0) {
          setError("Select at least one class before saving this teacher")
          return
        }

        metadataPayload.assignedClassIds = teacherAssignmentPayload.map((assignment) => assignment.classId)
        metadataPayload.assignedClassNames = teacherAssignmentPayload.map((assignment) => assignment.className)
        metadataPayload.teachingSubjects = Array.from(
          new Set(teacherAssignmentPayload.flatMap((assignment) => assignment.subjects)),
        )

        if ("assignedClassName" in metadataPayload) {
          delete metadataPayload.assignedClassName
        }
      } else if (shouldAssignClass(editingUser.role)) {
        metadataPayload.assignedClassName = selectedClass?.name ?? null
        if ("assignedClassIds" in metadataPayload) {
          delete metadataPayload.assignedClassIds
        }
        if ("assignedClassNames" in metadataPayload) {
          delete metadataPayload.assignedClassNames
        }
        if ("teachingSubjects" in metadataPayload) {
          delete metadataPayload.teachingSubjects
        }
      } else {
        if ("assignedClassName" in metadataPayload) {
          delete metadataPayload.assignedClassName
        }
        if ("assignedClassIds" in metadataPayload) {
          delete metadataPayload.assignedClassIds
        }
        if ("assignedClassNames" in metadataPayload) {
          delete metadataPayload.assignedClassNames
        }
        if ("teachingSubjects" in metadataPayload) {
          delete metadataPayload.teachingSubjects
        }
      }

      if (editingUser.role === "parent") {
        metadataPayload.linkedStudentId = editingUser.studentIds[0] ?? null
        metadataPayload.linkedStudentIds = [...editingUser.studentIds]
      } else {
        if ("linkedStudentId" in metadataPayload) {
          delete metadataPayload.linkedStudentId
        }
        if ("linkedStudentIds" in metadataPayload) {
          delete metadataPayload.linkedStudentIds
        }
      }

      if (primaryPhone) {
        metadataPayload.contactPhonePrimary = primaryPhone
      } else {
        delete metadataPayload.contactPhonePrimary
      }

      if (secondaryPhone) {
        metadataPayload.contactPhoneSecondary = secondaryPhone
      } else {
        delete metadataPayload.contactPhoneSecondary
      }

      metadataPayload.contactAddress = address

      const assignmentClassIds = teacherAssignmentPayload.map((assignment) => assignment.classId)

      const metadata = Object.keys(metadataPayload).length > 0 ? metadataPayload : undefined
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          name: editingUser.name,
          email: editingUser.email,
          role: ROLE_OPTIONS.find((option) => option.value === editingUser.role)?.api ?? "Teacher",
          status: editingUser.status,
          studentIds: editingUser.role === "parent" ? editingUser.studentIds : undefined,
          classId: editingUser.role === "student" ? normalizedClassId : undefined,
          classIds: editingUser.role === "teacher" ? assignmentClassIds : undefined,
          subjects: editingUser.role === "teacher" ? undefined : editingUser.subjects,
          teachingAssignments:
            editingUser.role === "teacher"
              ? teacherAssignmentPayload.map((assignment) => ({
                  classId: assignment.classId,
                  subjects: assignment.subjects,
                }))
              : undefined,
          metadata,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error ?? "Failed to update user")
      }

      const data = (await response.json()) as { user: ApiUser }
      const updatedUser = mapUser(data.user)
      setUsers((previous) => {
        if (hideSuperAdmin && updatedUser.role === "super-admin") {
          return previous.filter((user) => user.id !== updatedUser.id)
        }

        if (previous.some((user) => user.id === updatedUser.id)) {
          return previous.map((user) => (user.id === updatedUser.id ? updatedUser : user))
        }

        return [...previous, updatedUser]
      })
      setEditingUser(null)
      setIsEditDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to update user")
    }
  }, [availableClasses, editingUser, hideSuperAdmin])

  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error ?? "Failed to delete user")
      }

      setUsers((previous) => previous.filter((user) => user.id !== userId))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to delete user")
    }
  }, [])

  const handleToggleSuspension = useCallback(async (user: User) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended"

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: nextStatus }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error ?? "Failed to update user status")
      }

      const data = (await response.json()) as { user: ApiUser }
      const toggledUser = mapUser(data.user)
      setUsers((previous) => {
        if (hideSuperAdmin && toggledUser.role === "super-admin") {
          return previous.filter((item) => item.id !== toggledUser.id)
        }

        return previous.map((item) => (item.id === toggledUser.id ? toggledUser : item))
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to update user status")
    }
  }, [hideSuperAdmin])

  const handleResetPassword = useCallback(async () => {
    if (!selectedUser || !newPassword) return

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUser.id, password: newPassword }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error ?? "Failed to reset password")
      }

      setNewPassword("")
      setIsPasswordDialogOpen(false)
      setSelectedUser(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to reset password")
    }
  }, [newPassword, selectedUser])

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-10 text-[#2d682d]">
          Loading users…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#2d682d]">User Management</h3>
          <p className="text-sm text-gray-600">Manage system users, roles, and access</p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setNewUser(INITIAL_USER_STATE)
            }
            setIsAddDialogOpen(open)
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>Provide user credentials and assign a role.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-name">Full Name</Label>
                <Input
                  id="new-name"
                  value={newUser.name}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-phone1">Primary Phone Number</Label>
                <Input
                  id="new-phone1"
                  type="tel"
                  value={newUser.phoneNumber1}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, phoneNumber1: event.target.value }))}
                  required={newUser.role !== "student"}
                />
                <p className="mt-1 text-xs text-gray-500">Optional for student accounts.</p>
              </div>
              <div>
                <Label htmlFor="new-phone2">Secondary Phone Number (Optional)</Label>
                <Input
                  id="new-phone2"
                  type="tel"
                  value={newUser.phoneNumber2}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, phoneNumber2: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-address">Address</Label>
                <Textarea
                  id="new-address"
                  value={newUser.address}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, address: event.target.value }))}
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: value,
                      studentIds: value === "parent" ? prev.studentIds : [],
                      classId: value === "student" ? prev.classId : "",
                      classIds: value === "teacher" ? prev.classIds : [],
                      subjects: value === "teacher" ? prev.subjects : [],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-password">Temporary Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              {newUser.role === "parent" && (
                <div>
                  <Label>Assign Students</Label>
                  <div className="mt-2 space-y-2 rounded-md border p-3">
                    {availableStudents.length === 0 ? (
                      <p className="text-sm text-gray-500">No students available. Create student accounts first.</p>
                    ) : (
                      availableStudents.map((student) => (
                        <label key={student.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={newUser.studentIds.includes(student.id)}
                            onCheckedChange={(checked) =>
                              setNewUser((prev) => ({
                                ...prev,
                                studentIds: checked
                                  ? [...prev.studentIds, student.id]
                                  : prev.studentIds.filter((id) => id !== student.id),
                              }))
                            }
                          />
                          <span>{student.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              {newUser.role === "teacher" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assign Classes</Label>
                    <div className="space-y-3 rounded-md border p-3">
                      {availableClasses.length === 0 ? (
                        <p className="text-sm text-gray-500">Create classes with subjects before assigning teachers.</p>
                      ) : (
                        availableClasses.map((cls) => {
                          const canonicalSubjects = Array.from(
                            new Set(
                              (cls.subjects ?? []).map((subject) => subject.toString().trim()).filter((subject) => subject.length > 0),
                            ),
                          )
                          const assignment = newUser.teachingAssignments.find((entry) => entry.classId === cls.id)
                          const isSelected = Boolean(assignment)
                          const isDisabled = canonicalSubjects.length === 0
                          const canonicalSubjectTokens = canonicalSubjects.map((subject) => subject.toLowerCase())
                          const selectedSubjectTokens = new Set(
                            (assignment?.subjects ?? []).map((subject) => subject.trim().toLowerCase()),
                          )

                          return (
                            <div key={cls.id} className="space-y-2">
                              <label className="flex items-start gap-2 text-sm">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onCheckedChange={(checked) =>
                                    setNewUser((prev) => {
                                      const nextAssignments = prev.teachingAssignments.filter(
                                        (entry) => entry.classId !== cls.id,
                                      )

                                      if (checked === true && !isDisabled) {
                                        nextAssignments.push({
                                          classId: cls.id,
                                          subjects: [...canonicalSubjects],
                                        })
                                      }

                                      const nextClassIds = Array.from(
                                        new Set(nextAssignments.map((entry) => entry.classId)),
                                      )

                                      return {
                                        ...prev,
                                        classIds: nextClassIds,
                                        teachingAssignments: nextAssignments,
                                      }
                                    })
                                  }
                                />
                                <span className="flex flex-col">
                                  <span className="font-medium">{cls.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {canonicalSubjects.length > 0
                                      ? `Subjects: ${canonicalSubjects.join(", ")}`
                                      : "Add subjects before assigning this class."}
                                  </span>
                                </span>
                              </label>
                              {isSelected ? (
                                <div className="ml-6 space-y-1">
                                  {canonicalSubjects.length === 0 ? (
                                    <p className="text-xs text-amber-600">
                                      Add subjects to this class before assigning it to a teacher.
                                    </p>
                                  ) : (
                                    canonicalSubjects.map((subject) => {
                                      const normalizedSubject = subject.trim()
                                      const subjectToken = normalizedSubject.toLowerCase()
                                      const isSubjectSelected = selectedSubjectTokens.has(subjectToken)

                                      return (
                                        <label key={`${cls.id}-${subject}`} className="flex items-center gap-2 text-xs">
                                          <Checkbox
                                            checked={isSubjectSelected}
                                            onCheckedChange={(checked) =>
                                              setNewUser((prev) => {
                                                const existing = prev.teachingAssignments.find(
                                                  (entry) => entry.classId === cls.id,
                                                )
                                                const others = prev.teachingAssignments.filter(
                                                  (entry) => entry.classId !== cls.id,
                                                )

                                                let nextSubjects = existing?.subjects ?? []

                                                if (checked === true) {
                                                  if (!nextSubjects.some((entry) => entry.trim().toLowerCase() === subjectToken)) {
                                                    nextSubjects = [...nextSubjects, normalizedSubject]
                                                  }
                                                } else {
                                                  nextSubjects = nextSubjects.filter(
                                                    (entry) => entry.trim().toLowerCase() !== subjectToken,
                                                  )
                                                }

                                                const sanitizedSubjects = Array.from(
                                                  new Set(
                                                    nextSubjects
                                                      .map((entry) => entry.trim())
                                                      .filter((entry) => entry.length > 0)
                                                      .filter((entry) =>
                                                        canonicalSubjectTokens.includes(entry.toLowerCase()),
                                                      ),
                                                  ),
                                                )

                                                const nextAssignments =
                                                  sanitizedSubjects.length === 0
                                                    ? others
                                                    : [...others, { classId: cls.id, subjects: sanitizedSubjects }]

                                                const nextClassIds = Array.from(
                                                  new Set(nextAssignments.map((entry) => entry.classId)),
                                                )

                                                return {
                                                  ...prev,
                                                  classIds: nextClassIds,
                                                  teachingAssignments: nextAssignments,
                                                }
                                              })
                                            }
                                          />
                                          <span>{subject}</span>
                                        </label>
                                      )
                                    })
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 text-xs text-gray-600">
                    {selectedNewTeacherSubjects.length > 0 ? (
                      <p>
                        Assigning these classes grants access to: {" "}
                        <span className="font-medium">{selectedNewTeacherSubjects.join(", ")}</span>
                      </p>
                    ) : (
                      <p>Select at least one class to preview assigned subjects.</p>
                    )}
                  </div>
                </div>
              ) : shouldAssignClass(newUser.role) ? (
                <div className="space-y-2">
                  <Label>Assign Class</Label>
                  <Select
                    value={
                      newUser.classId && newUser.classId.trim().length > 0
                        ? newUser.classId
                        : NO_CLASS_SELECT_VALUE
                    }
                    onValueChange={(value) =>
                      setNewUser((prev) => ({
                        ...prev,
                        classId: value === NO_CLASS_SELECT_VALUE ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CLASS_SELECT_VALUE}>No class assigned</SelectItem>
                      {availableClasses.length === 0 ? (
                        <SelectItem value="__no_classes__" disabled>
                          No classes available
                        </SelectItem>
                      ) : (
                        availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button onClick={() => void handleCreateUser()} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="border-[#2d682d]/20">
        <CardHeader>
          <CardTitle className="text-[#2d682d]">All Users ({displayedUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE[user.role]}>{resolveRoleLabel(user.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[user.status]}>{user.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {user.role === "teacher"
                      ? user.teachingAssignments.length > 0
                        ? user.teachingAssignments.map((assignment) => assignment.className).join(", ")
                        : "Unassigned"
                      : shouldAssignClass(user.role)
                        ? user.className ?? user.classId ?? "Unassigned"
                        : "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {user.role === "teacher" && user.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.subjects.map((subject) => (
                          <Badge key={subject} variant="outline" className="text-xs font-normal">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{user.createdAt}</TableCell>
                  <TableCell>{user.lastLogin ?? "Never"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user)
                          setIsProfileDialogOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(user)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user)
                          setIsPasswordDialogOpen(true)
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleToggleSuspension(user)}
                      >
                        {user.status === "suspended" ? <UserCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void handleDeleteUser(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUser(null)
          }
          setIsEditDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role-specific assignments.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email}
                    onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-phone1">Primary Phone Number</Label>
                  <Input
                    id="edit-phone1"
                    type="tel"
                    value={editingUser.contactPhonePrimary ?? ""}
                    onChange={(event) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, contactPhonePrimary: event.target.value } : prev,
                      )
                    }
                    required={editingUser.role !== "student"}
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional for student accounts.</p>
                </div>
                <div>
                  <Label htmlFor="edit-phone2">Secondary Phone Number (Optional)</Label>
                  <Input
                    id="edit-phone2"
                    type="tel"
                    value={editingUser.contactPhoneSecondary ?? ""}
                    onChange={(event) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, contactPhoneSecondary: event.target.value } : prev,
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editingUser.contactAddress ?? ""}
                  onChange={(event) =>
                    setEditingUser((prev) => (prev ? { ...prev, contactAddress: event.target.value } : prev))
                  }
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={editingUser.role}
                          onValueChange={(value: UserRole) =>
                    setEditingUser((prev) =>
                      prev
                        ? {
                            ...prev,
                            role: value,
                            studentIds: value === "parent" ? prev.studentIds : [],
                            classId: value === "student" ? prev.classId : null,
                            classIds: value === "teacher" ? prev.classIds : [],
                            subjects: value === "teacher" ? prev.subjects : [],
                            teachingAssignments:
                              value === "teacher" ? prev.teachingAssignments : [],
                          }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(value: UserStatus) => setEditingUser({ ...editingUser, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.role === "parent" && (
                <div>
                  <Label>Assigned Students</Label>
                  <div className="mt-2 space-y-2 rounded-md border p-3">
                    {availableStudents.length === 0 ? (
                      <p className="text-sm text-gray-500">No students available.</p>
                    ) : (
                      availableStudents.map((student) => (
                        <label key={student.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editingUser.studentIds.includes(student.id)}
                            onCheckedChange={(checked) =>
                              setEditingUser((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      studentIds: checked
                                        ? [...prev.studentIds, student.id]
                                        : prev.studentIds.filter((id) => id !== student.id),
                                    }
                                  : prev,
                              )
                            }
                          />
                          <span>{student.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              {editingUser.role === "teacher" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assigned Classes</Label>
                    <div className="space-y-3 rounded-md border p-3">
                      {availableClasses.length === 0 ? (
                        <p className="text-sm text-gray-500">Create classes with subjects before assigning teachers.</p>
                      ) : (
                        availableClasses.map((cls) => {
                          const canonicalSubjects = Array.from(
                            new Set(
                              (cls.subjects ?? []).map((subject) => subject.toString().trim()).filter((subject) => subject.length > 0),
                            ),
                          )
                          const assignment = editingUser.teachingAssignments.find((entry) => entry.classId === cls.id)
                          const isSelected = Boolean(assignment)
                          const isDisabled = canonicalSubjects.length === 0
                          const canonicalSubjectTokens = canonicalSubjects.map((subject) => subject.toLowerCase())
                          const selectedSubjectTokens = new Set(
                            (assignment?.subjects ?? []).map((subject) => subject.trim().toLowerCase()),
                          )

                          return (
                            <div key={cls.id} className="space-y-2">
                              <label className="flex items-start gap-2 text-sm">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onCheckedChange={(checked) =>
                                    setEditingUser((prev) => {
                                      if (!prev) {
                                        return prev
                                      }

                                      const remainingAssignments = prev.teachingAssignments.filter(
                                        (entry) => entry.classId !== cls.id,
                                      )

                                      const nextAssignments =
                                        checked === true && !isDisabled
                                          ? [
                                              ...remainingAssignments,
                                              { classId: cls.id, subjects: [...canonicalSubjects] },
                                            ]
                                          : remainingAssignments

                                      const nextClassIds = Array.from(
                                        new Set(nextAssignments.map((entry) => entry.classId)),
                                      )

                                      return {
                                        ...prev,
                                        classIds: nextClassIds,
                                        teachingAssignments: nextAssignments,
                                      }
                                    })
                                  }
                                />
                                <span className="flex flex-col">
                                  <span className="font-medium">{cls.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {canonicalSubjects.length > 0
                                      ? `Subjects: ${canonicalSubjects.join(", ")}`
                                      : "Add subjects before assigning this class."}
                                  </span>
                                </span>
                              </label>
                              {isSelected ? (
                                <div className="ml-6 space-y-1">
                                  {canonicalSubjects.length === 0 ? (
                                    <p className="text-xs text-amber-600">
                                      Add subjects to this class before assigning it to a teacher.
                                    </p>
                                  ) : (
                                    canonicalSubjects.map((subject) => {
                                      const normalizedSubject = subject.trim()
                                      const subjectToken = normalizedSubject.toLowerCase()
                                      const isSubjectSelected = selectedSubjectTokens.has(subjectToken)

                                      return (
                                        <label key={`${cls.id}-${subject}`} className="flex items-center gap-2 text-xs">
                                          <Checkbox
                                            checked={isSubjectSelected}
                                            onCheckedChange={(checked) =>
                                              setEditingUser((prev) => {
                                                if (!prev) {
                                                  return prev
                                                }

                                                const existing = prev.teachingAssignments.find(
                                                  (entry) => entry.classId === cls.id,
                                                )
                                                const others = prev.teachingAssignments.filter(
                                                  (entry) => entry.classId !== cls.id,
                                                )

                                                let nextSubjects = existing?.subjects ?? []

                                                if (checked === true) {
                                                  if (!nextSubjects.some((entry) => entry.trim().toLowerCase() === subjectToken)) {
                                                    nextSubjects = [...nextSubjects, normalizedSubject]
                                                  }
                                                } else {
                                                  nextSubjects = nextSubjects.filter(
                                                    (entry) => entry.trim().toLowerCase() !== subjectToken,
                                                  )
                                                }

                                                const sanitizedSubjects = Array.from(
                                                  new Set(
                                                    nextSubjects
                                                      .map((entry) => entry.trim())
                                                      .filter((entry) => entry.length > 0)
                                                      .filter((entry) =>
                                                        canonicalSubjectTokens.includes(entry.toLowerCase()),
                                                      ),
                                                  ),
                                                )

                                                const nextAssignments =
                                                  sanitizedSubjects.length === 0
                                                    ? others
                                                    : [...others, { classId: cls.id, subjects: sanitizedSubjects }]

                                                const nextClassIds = Array.from(
                                                  new Set(nextAssignments.map((entry) => entry.classId)),
                                                )

                                                return {
                                                  ...prev,
                                                  classIds: nextClassIds,
                                                  teachingAssignments: nextAssignments,
                                                }
                                              })
                                            }
                                          />
                                          <span>{subject}</span>
                                        </label>
                                      )
                                    })
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 text-xs text-gray-600">
                    {selectedEditingTeacherSubjects.length > 0 ? (
                      <p>
                        This teacher will have access to: {" "}
                        <span className="font-medium">{selectedEditingTeacherSubjects.join(", ")}</span>
                      </p>
                    ) : (
                      <p>Select at least one class to preview assigned subjects.</p>
                    )}
                  </div>
                </div>
              ) : shouldAssignClass(editingUser.role) ? (
                <div className="space-y-2">
                  <Label>Assigned Class</Label>
                  <Select
                    value={
                      editingUser.classId && editingUser.classId.trim().length > 0
                        ? editingUser.classId
                        : NO_CLASS_SELECT_VALUE
                    }
                    onValueChange={(value) =>
                      setEditingUser((prev) =>
                        prev
                          ? {
                              ...prev,
                              classId: value === NO_CLASS_SELECT_VALUE ? null : value,
                            }
                          : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CLASS_SELECT_VALUE}>No class assigned</SelectItem>
                      {availableClasses.length === 0 ? (
                        <SelectItem value="__no_classes__" disabled>
                          No classes available
                        </SelectItem>
                      ) : (
                        availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button onClick={() => void handleUpdateUser()} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null)
            setNewPassword("")
          }
          setIsPasswordDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Set a new password for ${selectedUser.name}` : "Select a user to reset password."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
            />
            <div className="flex gap-2">
              <Button onClick={() => void handleResetPassword()} className="flex-1 bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
                Reset Password
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isProfileDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null)
          }
          setIsProfileDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Detailed information about the selected user.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Name</Label>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Badge className={ROLE_BADGE[selectedUser.role]}>{resolveRoleLabel(selectedUser.role)}</Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={STATUS_BADGE[selectedUser.status]}>{selectedUser.status}</Badge>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{selectedUser.createdAt}</p>
                </div>
                <div>
                  <Label>Last Login</Label>
                  <p>{selectedUser.lastLogin ?? "Never"}</p>
                </div>
                <div>
                  <Label>Primary Phone</Label>
                  <p>{selectedUser.contactPhonePrimary ?? "—"}</p>
                </div>
                <div>
                  <Label>Secondary Phone</Label>
                  <p>{selectedUser.contactPhoneSecondary ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <p>{selectedUser.contactAddress ?? "—"}</p>
                </div>
              </div>
              {selectedUser.role === "parent" && (
                <div>
                  <Label>Linked Students</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.studentIds.length === 0 ? (
                      <p className="text-sm text-gray-500">No students assigned.</p>
                    ) : (
                      selectedUser.studentIds.map((studentId) => {
                        const student = availableStudents.find((item) => item.id === studentId)
                        return (
                          <Badge key={studentId} variant="outline">
                            {student ? student.name : studentId}
                          </Badge>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
              {selectedUser.role === "teacher" && (
                <div className="space-y-4">
                  <div>
                    <Label>Assigned Classes</Label>
                    {selectedUser.teachingAssignments.length === 0 ? (
                      <p className="text-sm text-gray-500">No classes assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.teachingAssignments.map((assignment) => (
                          <Badge key={assignment.classId} variant="outline">
                            {assignment.className}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Subject Coverage</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.subjects.length === 0 ? (
                        <p className="text-sm text-gray-500">No subjects assigned.</p>
                      ) : (
                        selectedUser.subjects.map((subject) => (
                          <Badge key={subject} variant="outline">
                            {subject}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
