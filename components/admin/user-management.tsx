"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, UserPlus, Edit, Trash2, UserCheck, Shield, Key, Eye } from "lucide-react"

type UserRole = "super-admin" | "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: "active" | "suspended" | "inactive"
  createdAt: string
  lastLogin?: string
  assignedClasses?: string[]
  assignedSubjects?: string[]
  parentId?: string
  studentIds?: string[]
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "John Admin",
      email: "admin@vea.edu.ng",
      role: "admin",
      status: "active",
      createdAt: "2024-01-15",
      lastLogin: "2024-12-08",
    },
    {
      id: "2",
      name: "Sarah Teacher",
      email: "sarah@vea.edu.ng",
      role: "teacher",
      status: "active",
      createdAt: "2024-02-20",
      lastLogin: "2024-12-07",
      assignedClasses: ["JSS1A", "JSS2B"],
      assignedSubjects: ["Mathematics", "Physics"],
    },
    {
      id: "3",
      name: "Mike Parent",
      email: "mike@parent.com",
      role: "parent",
      status: "active",
      createdAt: "2024-03-10",
      lastLogin: "2024-12-06",
      studentIds: ["4", "5"],
    },
  ])

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "teacher" as UserRole,
    password: "",
    studentIds: [] as string[], // Changed from studentId to studentIds array for multiple assignment
  })

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false)
  const [isProfileViewOpen, setIsProfileViewOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const availableClasses = [
    "JSS1A",
    "JSS1B",
    "JSS2A",
    "JSS2B",
    "JSS3A",
    "JSS3B",
    "SS1A",
    "SS1B",
    "SS2A",
    "SS2B",
    "SS3A",
    "SS3B",
  ]
  const availableSubjects = [
    "Mathematics",
    "English",
    "Physics",
    "Chemistry",
    "Biology",
    "Geography",
    "History",
    "Economics",
  ]
  const availableParents = users.filter((u) => u.role === "parent")
  const availableStudents = users.filter((u) => u.role === "student")

  const handleAddUser = () => {
    const user: User = {
      id: Date.now().toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
      studentIds: newUser.role === "parent" ? newUser.studentIds : undefined, // Use studentIds array
    }
    setUsers([...users, user])
    setNewUser({ name: "", email: "", role: "teacher", password: "", studentIds: [] }) // Reset to empty array
    setIsAddDialogOpen(false)
  }

  const handleEditUser = () => {
    if (editingUser) {
      setUsers(users.map((u) => (u.id === editingUser.id ? editingUser : u)))
      setEditingUser(null)
      setIsEditDialogOpen(false)
    }
  }

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId))
  }

  const handleSuspendUser = (userId: string) => {
    setUsers(
      users.map((u) => (u.id === userId ? { ...u, status: u.status === "suspended" ? "active" : "suspended" } : u)),
    )
  }

  const handlePasswordReset = () => {
    if (selectedUser && newPassword) {
      // In a real app, this would call an API
      console.log(`Password reset for ${selectedUser.email}: ${newPassword}`)
      setNewPassword("")
      setIsPasswordResetOpen(false)
      setSelectedUser(null)
    }
  }

  const getRoleColor = (role: UserRole) => {
    const colors = {
      "super-admin": "bg-red-100 text-red-800",
      admin: "bg-blue-100 text-blue-800",
      teacher: "bg-green-100 text-green-800",
      student: "bg-purple-100 text-purple-800",
      parent: "bg-orange-100 text-orange-800",
      librarian: "bg-cyan-100 text-cyan-800",
      accountant: "bg-yellow-100 text-yellow-800",
    }
    return colors[role]
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-red-100 text-red-800",
      inactive: "bg-gray-100 text-gray-800",
    }
    return colors[status as keyof typeof colors]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#2d682d]">User Management</h3>
          <p className="text-sm text-gray-600">Manage all system users and their roles</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              {newUser.role === "parent" && (
                <div className="space-y-3">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      <Label className="text-orange-800 font-medium">Parent-Student Assignment</Label>
                    </div>
                    <p className="text-sm text-orange-700 mb-3">
                      Assign students (children) to this parent for fee payment and report card access
                    </p>

                    <div>
                      <Label htmlFor="student-assignment" className="text-sm font-medium">
                        Select Students (Children) *
                      </Label>
                      <div className="mt-2 space-y-2">
                        {availableStudents.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                            {availableStudents.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                              >
                                <Checkbox
                                  id={`new-student-${student.id}`}
                                  checked={newUser.studentIds.includes(student.id)}
                                  onCheckedChange={(checked) => {
                                    const updatedStudents = checked
                                      ? [...newUser.studentIds, student.id]
                                      : newUser.studentIds.filter((id) => id !== student.id)
                                    setNewUser({ ...newUser, studentIds: updatedStudents })
                                  }}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`new-student-${student.id}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {student.name}
                                  </Label>
                                  <p className="text-xs text-gray-500">{student.email}</p>
                                  {student.assignedClasses && (
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {student.assignedClasses[0]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No students available</p>
                            <p className="text-xs">Create student accounts first</p>
                          </div>
                        )}

                        {newUser.studentIds.length > 0 && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                            <p className="text-sm text-green-800">
                              ✓ {newUser.studentIds.length} student{newUser.studentIds.length > 1 ? "s" : ""} selected
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <Button onClick={handleAddUser} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleColor(user.role)}>{user.role.replace("-", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                  </TableCell>
                  <TableCell>{user.createdAt}</TableCell>
                  <TableCell>{user.lastLogin || "Never"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user)
                          setIsProfileViewOpen(true)
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
                          setIsPasswordResetOpen(true)
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSuspendUser(user.id)}
                        className={user.status === "suspended" ? "bg-green-50" : "bg-red-50"}
                      >
                        {user.status === "suspended" ? (
                          <UserCheck className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800"
                      >
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role-specific assignments</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingUser.role === "teacher" && (
                <div className="space-y-4">
                  <div>
                    <Label>Assigned Classes</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {availableClasses.map((className) => (
                        <div key={className} className="flex items-center space-x-2">
                          <Checkbox
                            id={`class-${className}`}
                            checked={editingUser.assignedClasses?.includes(className) || false}
                            onCheckedChange={(checked) => {
                              const currentClasses = editingUser.assignedClasses || []
                              const updatedClasses = checked
                                ? [...currentClasses, className]
                                : currentClasses.filter((c) => c !== className)
                              setEditingUser({ ...editingUser, assignedClasses: updatedClasses })
                            }}
                          />
                          <Label htmlFor={`class-${className}`} className="text-sm">
                            {className}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Assigned Subjects</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {availableSubjects.map((subject) => (
                        <div key={subject} className="flex items-center space-x-2">
                          <Checkbox
                            id={`subject-${subject}`}
                            checked={editingUser.assignedSubjects?.includes(subject) || false}
                            onCheckedChange={(checked) => {
                              const currentSubjects = editingUser.assignedSubjects || []
                              const updatedSubjects = checked
                                ? [...currentSubjects, subject]
                                : currentSubjects.filter((s) => s !== subject)
                              setEditingUser({ ...editingUser, assignedSubjects: updatedSubjects })
                            }}
                          />
                          <Label htmlFor={`subject-${subject}`} className="text-sm">
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {editingUser.role === "student" && (
                <div className="space-y-4">
                  <div>
                    <Label>Assigned Class</Label>
                    <Select
                      value={editingUser.assignedClasses?.[0] || ""}
                      onValueChange={(value) => setEditingUser({ ...editingUser, assignedClasses: [value] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Assigned Parent</Label>
                    <Select
                      value={editingUser.parentId || ""}
                      onValueChange={(value) => setEditingUser({ ...editingUser, parentId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParents.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {editingUser.role === "parent" && (
                <div className="space-y-3">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      <Label className="text-orange-800 font-medium">Parent-Student Assignment</Label>
                    </div>
                    <p className="text-sm text-orange-700 mb-3">
                      Manage student assignments for fee payment and report card access
                    </p>

                    <div>
                      <Label className="text-sm font-medium">Assigned Students (Children)</Label>
                      <div className="mt-2 space-y-2">
                        {availableStudents.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                            {availableStudents.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                              >
                                <Checkbox
                                  id={`edit-student-${student.id}`}
                                  checked={editingUser.studentIds?.includes(student.id) || false}
                                  onCheckedChange={(checked) => {
                                    const currentStudents = editingUser.studentIds || []
                                    const updatedStudents = checked
                                      ? [...currentStudents, student.id]
                                      : currentStudents.filter((s) => s !== student.id)
                                    setEditingUser({ ...editingUser, studentIds: updatedStudents })
                                  }}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`edit-student-${student.id}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {student.name}
                                  </Label>
                                  <p className="text-xs text-gray-500">{student.email}</p>
                                  {student.assignedClasses && (
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {student.assignedClasses[0]}
                                    </Badge>
                                  )}
                                </div>
                                {editingUser.studentIds?.includes(student.id) && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Assigned</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No students available</p>
                          </div>
                        )}

                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-800">
                            Currently assigned to {editingUser.studentIds?.length || 0} student
                            {(editingUser.studentIds?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleEditUser} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                Update User
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePasswordReset} className="flex-1 bg-[#2d682d] hover:bg-[#1a4a1a]">
                Reset Password
              </Button>
              <Button variant="outline" onClick={() => setIsPasswordResetOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileViewOpen} onOpenChange={setIsProfileViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>View detailed user information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-sm font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Badge className={getRoleColor(selectedUser.role)}>{selectedUser.role.replace("-", " ")}</Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedUser.status)}>{selectedUser.status}</Badge>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{selectedUser.createdAt}</p>
                </div>
                <div>
                  <Label>Last Login</Label>
                  <p className="text-sm">{selectedUser.lastLogin || "Never"}</p>
                </div>
              </div>

              {selectedUser.role === "teacher" && (
                <div className="space-y-2">
                  <Label>Assigned Classes</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedUser.assignedClasses?.map((className) => (
                      <Badge key={className} variant="outline">
                        {className}
                      </Badge>
                    )) || <p className="text-sm text-gray-500">No classes assigned</p>}
                  </div>
                  <Label>Assigned Subjects</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedUser.assignedSubjects?.map((subject) => (
                      <Badge key={subject} variant="outline">
                        {subject}
                      </Badge>
                    )) || <p className="text-sm text-gray-500">No subjects assigned</p>}
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
