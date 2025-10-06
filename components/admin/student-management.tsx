"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AlertCircle, Edit, Loader2, Plus, Trash2, UserRound } from "lucide-react"
import { dbManager } from "@/lib/database-manager"
import { safeStorage } from "@/lib/safe-storage"

interface StudentRecord {
  id: string
  name: string
  email: string
  class: string
  section: string
  admissionNumber: string
  parentName: string
  parentEmail: string
  paymentStatus: "paid" | "pending" | "overdue"
  status: "active" | "inactive"
  dateOfBirth: string
  address: string
  phone: string
  guardianPhone: string
  bloodGroup: string
  admissionDate: string
  subjects: string[]
  attendance: { present: number; total: number }
  grades: { subject: string; ca1: number; ca2: number; exam: number; total: number; grade: string }[]
}

const PAYMENT_BADGE: Record<StudentRecord["paymentStatus"], string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
}

const STATUS_BADGE: Record<StudentRecord["status"], string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
}

const INITIAL_STUDENT: StudentRecord = {
  id: "",
  name: "",
  email: "",
  class: "",
  section: "",
  admissionNumber: "",
  parentName: "",
  parentEmail: "",
  paymentStatus: "pending",
  status: "active",
  dateOfBirth: "",
  address: "",
  phone: "",
  guardianPhone: "",
  bloodGroup: "",
  admissionDate: "",
  subjects: [],
  attendance: { present: 0, total: 0 },
  grades: [],
}

export function StudentManagement() {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null)
  const [availableClasses, setAvailableClasses] = useState<string[]>([])

  const syncStudentCaches = useCallback((records: StudentRecord[]) => {
    try {
      safeStorage.setItem("students", JSON.stringify(records))
    } catch (storageError) {
      console.error("Unable to persist student cache", storageError)
    }

    try {
      dbManager.triggerEvent("studentsRefreshed", records)
    } catch (eventError) {
      console.error("Unable to broadcast student refresh event", eventError)
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/students")
      if (!response.ok) {
        throw new Error("Unable to load student records")
      }

      const data = (await response.json()) as { students: StudentRecord[] }
      setStudents(data.students)
      syncStudentCaches(data.students)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to fetch students")
    } finally {
      setLoading(false)
    }
  }, [syncStudentCaches])

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes")
      if (!response.ok) {
        throw new Error("Unable to load classes")
      }

      const data = (await response.json()) as { classes: Array<{ name?: string } | string> }
      const normalized = Array.from(
        new Set(
          data.classes
            .map((classEntry) => {
              if (typeof classEntry === "string") {
                return classEntry
              }
              return typeof classEntry?.name === "string" ? classEntry.name : ""
            })
            .filter((name): name is string => Boolean(name && name.trim())),
        ),
      )

      setAvailableClasses(normalized)
      setError((previous) =>
        previous && previous.toLowerCase().includes("class") ? null : previous,
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load classes")
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  useEffect(() => {
    void loadClasses()

    const handleClassesRefresh = (payload?: unknown) => {
      if (Array.isArray(payload)) {
        const normalized = Array.from(
          new Set(
            payload
              .map((classEntry: any) => {
                if (typeof classEntry === "string") {
                  return classEntry
                }

                if (classEntry && typeof classEntry.name === "string") {
                  return classEntry.name
                }

                if (classEntry && typeof classEntry.label === "string") {
                  return classEntry.label
                }

                return ""
              })
              .filter((name): name is string => Boolean(name && name.trim())),
          ),
        )

        setAvailableClasses(normalized)
      } else {
        void loadClasses()
      }
    }

    dbManager.on("classesRefreshed", handleClassesRefresh)

    return () => {
      dbManager.off("classesRefreshed", handleClassesRefresh)
    }
  }, [loadClasses])

  const handleSaveStudent = async (student: StudentRecord) => {
    try {
      const payload = {
        ...student,
        id: undefined,
      }

      if (editingStudent?.id) {
        const response = await fetch("/api/students", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingStudent.id }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? "Failed to update student")
        }

        const data = (await response.json()) as { student: StudentRecord }
        setStudents((previous) => {
          const updated = previous.map((item) => (item.id === data.student.id ? data.student : item))
          syncStudentCaches(updated)
          return updated
        })
      } else {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? "Failed to create student")
        }

        const data = (await response.json()) as { student: StudentRecord }
        setStudents((previous) => {
          const updated = [...previous, data.student]
          syncStudentCaches(updated)
          return updated
        })
      }

      setEditingStudent(null)
      setIsDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to save student")
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const response = await fetch(`/api/students?id=${studentId}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? "Failed to delete student")
      }

      setStudents((previous) => {
        const updated = previous.filter((student) => student.id !== studentId)
        syncStudentCaches(updated)
        return updated
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to delete student")
    }
  }

  const classOptions = useMemo(() => {
    const unique = new Set(availableClasses)
    students.forEach((student) => {
      if (student.class) {
        unique.add(student.class)
      }
    })
    return Array.from(unique)
  }, [availableClasses, students])

  const openCreateDialog = () => {
    setEditingStudent({ ...INITIAL_STUDENT, class: classOptions[0] ?? "" })
    setIsDialogOpen(true)
  }

  const openEditDialog = (student: StudentRecord) => {
    setEditingStudent({ ...student })
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-[#2d682d]">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading student records…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-[#2d682d]/20">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#2d682d]">
              <UserRound className="h-5 w-5" /> Student Management
            </CardTitle>
            <CardDescription>Manage student enrollment details</CardDescription>
          </div>
          <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Student
          </Button>
        </CardHeader>

        {error && (
          <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void loadStudents()
                void loadClasses()
              }}
              className="ml-auto"
            >
              Reload
            </Button>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Admission No.</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-[#2d682d]/20">
                        <AvatarFallback>{student.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[#2d682d]">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{student.class}</span>
                      <span className="text-xs text-gray-500">Section {student.section}</span>
                    </div>
                  </TableCell>
                  <TableCell>{student.admissionNumber}</TableCell>
                  <TableCell>
                    <Badge className={PAYMENT_BADGE[student.paymentStatus]}>{student.paymentStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[student.status]}>{student.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{student.parentName}</p>
                      <p className="text-xs text-gray-500">{student.parentEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(student)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void handleDeleteStudent(student.id)}>
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
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingStudent(null)
          }
          setIsDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStudent?.id ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>Provide or update the student’s enrollment information.</DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="student-name">Full Name</Label>
                <Input
                  id="student-name"
                  value={editingStudent.name}
                  onChange={(event) => setEditingStudent({ ...editingStudent, name: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-email">Email</Label>
                <Input
                  id="student-email"
                  value={editingStudent.email}
                  onChange={(event) => setEditingStudent({ ...editingStudent, email: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-class">Class</Label>
                {classOptions.length > 0 ? (
                  <Select
                    value={editingStudent.class}
                    onValueChange={(value) => setEditingStudent({ ...editingStudent, class: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map((className) => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="student-class"
                    value={editingStudent.class}
                    onChange={(event) => setEditingStudent({ ...editingStudent, class: event.target.value })}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="student-section">Section</Label>
                <Input
                  id="student-section"
                  value={editingStudent.section}
                  onChange={(event) => setEditingStudent({ ...editingStudent, section: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-admission">Admission Number</Label>
                <Input
                  id="student-admission"
                  value={editingStudent.admissionNumber}
                  onChange={(event) => setEditingStudent({ ...editingStudent, admissionNumber: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-dob">Date of Birth</Label>
                <Input
                  id="student-dob"
                  type="date"
                  value={editingStudent.dateOfBirth}
                  onChange={(event) => setEditingStudent({ ...editingStudent, dateOfBirth: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-address">Address</Label>
                <Input
                  id="student-address"
                  value={editingStudent.address}
                  onChange={(event) => setEditingStudent({ ...editingStudent, address: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="student-phone">Phone</Label>
                <Input
                  id="student-phone"
                  value={editingStudent.phone}
                  onChange={(event) => setEditingStudent({ ...editingStudent, phone: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="guardian-phone">Guardian Phone</Label>
                <Input
                  id="guardian-phone"
                  value={editingStudent.guardianPhone}
                  onChange={(event) => setEditingStudent({ ...editingStudent, guardianPhone: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="blood-group">Blood Group</Label>
                <Input
                  id="blood-group"
                  value={editingStudent.bloodGroup}
                  onChange={(event) => setEditingStudent({ ...editingStudent, bloodGroup: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="admission-date">Admission Date</Label>
                <Input
                  id="admission-date"
                  type="date"
                  value={editingStudent.admissionDate}
                  onChange={(event) => setEditingStudent({ ...editingStudent, admissionDate: event.target.value })}
                />
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select
                  value={editingStudent.paymentStatus}
                  onValueChange={(value: StudentRecord["paymentStatus"]) =>
                    setEditingStudent({ ...editingStudent, paymentStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editingStudent.status}
                  onValueChange={(value: StudentRecord["status"]) =>
                    setEditingStudent({ ...editingStudent, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="parent-name">Parent/Guardian Name</Label>
                <Input
                  id="parent-name"
                  value={editingStudent.parentName}
                  onChange={(event) => setEditingStudent({ ...editingStudent, parentName: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="parent-email">Parent Email</Label>
                <Input
                  id="parent-email"
                  value={editingStudent.parentEmail}
                  onChange={(event) => setEditingStudent({ ...editingStudent, parentEmail: event.target.value })}
                />
              </div>
              <div className="col-span-full flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white" onClick={() => void handleSaveStudent(editingStudent)}>
                  {editingStudent.id ? "Save Changes" : "Create Student"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
