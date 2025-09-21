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
  metadata: Record<string, any>
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
    metadata: apiUser.metadata ?? {},
  }
}

interface NewUserState {
  name: string
  email: string
  role: UserRole
  password: string
  studentIds: string[]
}

const INITIAL_USER_STATE: NewUserState = {
  name: "",
  email: "",
  role: "teacher",
  password: "",
  studentIds: [],
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
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: ROLE_OPTIONS.find((option) => option.value === newUser.role)?.api ?? "Teacher",
          password: newUser.password,
          studentIds: newUser.role === "parent" ? newUser.studentIds : undefined,
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
  }, [hideSuperAdmin, newUser])

  const handleUpdateUser = useCallback(async () => {
    if (!editingUser) return

    try {
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
  }, [editingUser, hideSuperAdmin])

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
                <Select value={newUser.role} onValueChange={(value: UserRole) => setNewUser((prev) => ({ ...prev, role: value }))}>
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
                  onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
