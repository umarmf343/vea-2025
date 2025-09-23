"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  className?: string | null
  metadata: Record<string, any>
}

interface ClassOption {
  id: string
  name: string
}

interface SubjectOption {
  id: string
  name: string
  code: string
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
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: normalizeRole(apiUser.role),
    status: normalizeStatus(apiUser.status, apiUser.isActive),
    createdAt: apiUser.createdAt ? new Date(apiUser.createdAt).toLocaleDateString() : "—",
    lastLogin: apiUser.lastLogin ?? undefined,
    studentIds: apiUser.studentIds ?? [],
    subjects: apiUser.subjects ?? [],
    classId: apiUser.classId ?? (apiUser.metadata?.classId ?? null),
    className: typeof apiUser.metadata?.assignedClassName === "string" ? apiUser.metadata.assignedClassName : undefined,
    metadata: apiUser.metadata ?? {},
  }
}

interface NewUserState {
  name: string
  email: string
  role: UserRole
  password: string
  studentIds: string[]
  classId: string
  subjects: string[]
}

const INITIAL_USER_STATE: NewUserState = {
  name: "",
  email: "",
  role: "teacher",
  password: "",
  studentIds: [],
  classId: "",
  subjects: [],
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
  const [availableSubjects, setAvailableSubjects] = useState<SubjectOption[]>([])

  useEffect(() => {
    const loadAuxiliaryData = async () => {
      try {
        const [classResponse, subjectResponse] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/subjects"),
        ])

        if (classResponse.ok) {
          const classPayload = (await classResponse.json()) as { classes?: Array<{ id: string; name: string }> }
          setAvailableClasses(
            Array.isArray(classPayload.classes)
              ? classPayload.classes.map((entry) => ({ id: entry.id, name: entry.name }))
              : [],
          )
        }

        if (subjectResponse.ok) {
          const subjectPayload = (await subjectResponse.json()) as {
            subjects?: Array<{ id: string; name: string; code: string }>
          }
          setAvailableSubjects(
            Array.isArray(subjectPayload.subjects)
              ? subjectPayload.subjects.map((entry) => ({ id: entry.id, name: entry.name, code: entry.code }))
              : [],
          )
        }
      } catch (error) {
        console.error("Failed to load classes or subjects", error)
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

      if (newUser.role === "parent" && newUser.studentIds.length === 0) {
        setError("Please assign at least one student to the parent account")
        return
      }

      if (shouldAssignClass(newUser.role) && !normalizedClassId) {
        setError("Please select a class before creating this account")
        return
      }

      const classMetadata = shouldAssignClass(newUser.role)
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

      const metadata = classMetadata || parentMetadata ? { ...parentMetadata, ...classMetadata } : undefined
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: ROLE_OPTIONS.find((option) => option.value === newUser.role)?.api ?? "Teacher",
          password: newUser.password,
          studentIds: newUser.role === "parent" ? newUser.studentIds : undefined,
          classId: shouldAssignClass(newUser.role) ? (normalizedClassId || null) : undefined,
          subjects: newUser.role === "teacher" ? newUser.subjects : undefined,
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
      const metadataPayload: Record<string, any> = editingUser.metadata ? { ...editingUser.metadata } : {}

      if (shouldAssignClass(editingUser.role)) {
        metadataPayload.assignedClassName = selectedClass?.name ?? null
      } else if ("assignedClassName" in metadataPayload) {
        delete metadataPayload.assignedClassName
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
          classId: shouldAssignClass(editingUser.role) ? normalizedClassId : undefined,
          subjects: editingUser.role === "teacher" ? editingUser.subjects : undefined,
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
                <Label>Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: value,
                      studentIds: value === "parent" ? prev.studentIds : [],
                      classId: shouldAssignClass(value) ? prev.classId : "",
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
              {shouldAssignClass(newUser.role) && (
                <div className="space-y-4">
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
                  {newUser.role === "teacher" && (
                    <div className="space-y-2">
                      <Label>Assign Subjects</Label>
                      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                        {availableSubjects.length === 0 ? (
                          <p className="text-sm text-gray-500">Create subjects before assigning them to teachers.</p>
                        ) : (
                          availableSubjects.map((subject) => (
                            <label key={subject.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={newUser.subjects.includes(subject.name)}
                                onCheckedChange={(checked) =>
                                  setNewUser((prev) => ({
                                    ...prev,
                                    subjects: checked
                                      ? [...prev.subjects, subject.name]
                                      : prev.subjects.filter((item) => item !== subject.name),
                                  }))
                                }
                              />
                              <span>
                                {subject.name}
                                <span className="ml-1 text-xs text-gray-500">({subject.code})</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                  <TableCell className="max-w-[160px] truncate">
                    {shouldAssignClass(user.role)
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
                            classId: shouldAssignClass(value) ? prev.classId : null,
                            subjects: value === "teacher" ? prev.subjects : [],
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
              {shouldAssignClass(editingUser.role) && (
                <div className="space-y-4">
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
                  {editingUser.role === "teacher" && (
                    <div className="space-y-2">
                      <Label>Assigned Subjects</Label>
                      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                        {availableSubjects.length === 0 ? (
                          <p className="text-sm text-gray-500">No subjects available.</p>
                        ) : (
                          availableSubjects.map((subject) => (
                            <label key={subject.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={editingUser.subjects.includes(subject.name)}
                                onCheckedChange={(checked) =>
                                  setEditingUser((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          subjects: checked
                                            ? [...prev.subjects, subject.name]
                                            : prev.subjects.filter((item) => item !== subject.name),
                                        }
                                      : prev,
                                  )
                                }
                              />
                              <span>
                                {subject.name}
                                <span className="ml-1 text-xs text-gray-500">({subject.code})</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                    <Label>Assigned Class</Label>
                    <p className="text-sm text-gray-700">
                      {selectedUser.className ?? selectedUser.classId ?? "No class assigned"}
                    </p>
                  </div>
                  <div>
                    <Label>Assigned Subjects</Label>
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
