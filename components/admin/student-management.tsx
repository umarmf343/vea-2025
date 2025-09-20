"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Plus, Search, Edit, Trash2, Eye, User, Calendar, CreditCard, Loader2 } from "lucide-react"
import { dbManager } from "@/lib/database-manager"
import { safeStorage } from "@/lib/safe-storage"

interface Student {
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
  photoUrl?: string
}

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  useEffect(() => {
    loadStudents()

    // Real-time event listeners
    const handleStudentUpdate = () => loadStudents()
    dbManager.on("studentUpdated", handleStudentUpdate)
    dbManager.on("studentCreated", handleStudentUpdate)
    dbManager.on("studentDeleted", handleStudentUpdate)

    return () => {
      dbManager.off("studentUpdated", handleStudentUpdate)
      dbManager.off("studentCreated", handleStudentUpdate)
      dbManager.off("studentDeleted", handleStudentUpdate)
    }
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      setError(null)
      const studentsData = await dbManager.getStudents()
      setStudents(studentsData)
    } catch (err) {
      setError("Failed to load students")
      console.error("Error loading students:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = selectedClass === "all" || student.class === selectedClass
    return matchesSearch && matchesClass
  })

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleViewProfile = (student: Student) => {
    setSelectedStudent(student)
    setIsProfileDialogOpen(true)
  }

  const handleEditStudent = (student: Student) => {
    setEditingStudent({ ...student })
    setIsEditDialogOpen(true)
  }

  const handleSaveStudent = async (updatedStudent: Student) => {
    try {
      await dbManager.updateStudent(updatedStudent.id, updatedStudent)
      setIsEditDialogOpen(false)
      setEditingStudent(null)
      // Data will be updated via event listener
    } catch (err) {
      console.error("Error saving student:", err)
      setError("Failed to save student changes")
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (confirm("Are you sure you want to delete this student?")) {
      try {
        await dbManager.deleteStudent(studentId)
        // Data will be updated via event listener
      } catch (err) {
        console.error("Error deleting student:", err)
        setError("Failed to delete student")
      }
    }
  }

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#2d682d]" />
          <span className="ml-2 text-[#2d682d]">Loading students...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={loadStudents} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-[#2d682d]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                <Users className="h-5 w-5" />
                Student Management
              </CardTitle>
              <CardDescription>Manage student records and information</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                  <DialogDescription>Enter student information to create a new record</DialogDescription>
                </DialogHeader>
                <AddStudentForm onClose={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-32 border-[#2d682d]/20 focus:border-[#b29032]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="9">Class 9</SelectItem>
                <SelectItem value="10">Class 10</SelectItem>
                <SelectItem value="11">Class 11</SelectItem>
                <SelectItem value="12">Class 12</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Students Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.photoUrl || "/placeholder.svg"} alt={student.name} />
                          <AvatarFallback className="bg-[#2d682d] text-white text-xs">
                            {student.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.admissionNumber}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {student.class}-{student.section}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{student.parentName}</p>
                        <p className="text-xs text-gray-500">{student.parentEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentStatusColor(student.paymentStatus)}>{student.paymentStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === "active" ? "default" : "secondary"}>{student.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 bg-transparent"
                          onClick={() => handleViewProfile(student)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 bg-transparent"
                          onClick={() => handleEditStudent(student)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 bg-transparent"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Student Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2d682d]">
              <User className="h-5 w-5" />
              Student Profile
            </DialogTitle>
            <DialogDescription>Detailed information for {selectedStudent?.name}</DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="academic">Academic</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-[#2d682d] text-white text-lg">
                          {selectedStudent.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedStudent.name}</h3>
                        <p className="text-sm text-gray-600">{selectedStudent.admissionNumber}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Email</Label>
                        <p className="text-sm">{selectedStudent.email}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                        <p className="text-sm">{selectedStudent.dateOfBirth}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Blood Group</Label>
                        <p className="text-sm">{selectedStudent.bloodGroup}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Phone</Label>
                        <p className="text-sm">{selectedStudent.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Class & Section</Label>
                      <p className="text-sm">
                        {selectedStudent.class}-{selectedStudent.section}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Admission Date</Label>
                      <p className="text-sm">{selectedStudent.admissionDate}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Address</Label>
                      <p className="text-sm">{selectedStudent.address}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Parent/Guardian</Label>
                      <p className="text-sm font-medium">{selectedStudent.parentName}</p>
                      <p className="text-xs text-gray-600">{selectedStudent.parentEmail}</p>
                      <p className="text-xs text-gray-600">{selectedStudent.guardianPhone}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="academic" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Enrolled Subjects</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedStudent.subjects.map((subject) => (
                        <Badge key={subject} variant="outline" className="bg-[#2d682d]/10">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Current Grades</Label>
                    <div className="mt-2 border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>1st C.A.</TableHead>
                            <TableHead>2nd C.A.</TableHead>
                            <TableHead>Exam</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStudent.grades.map((grade) => (
                            <TableRow key={grade.subject}>
                              <TableCell className="font-medium">{grade.subject}</TableCell>
                              <TableCell>{grade.ca1}/20</TableCell>
                              <TableCell>{grade.ca2}/20</TableCell>
                              <TableCell>{grade.exam}/100</TableCell>
                              <TableCell className="font-medium">{grade.total}/140</TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    grade.grade === "A" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                                  }
                                >
                                  {grade.grade}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                        <Calendar className="h-5 w-5" />
                        Attendance Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Days Present:</span>
                          <span className="font-medium text-green-600">{selectedStudent.attendance.present}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Days:</span>
                          <span className="font-medium">{selectedStudent.attendance.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Attendance Rate:</span>
                          <span className="font-medium text-[#2d682d]">
                            {Math.round((selectedStudent.attendance.present / selectedStudent.attendance.total) * 100)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-[#2d682d]">Attendance Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Badge
                          className={
                            selectedStudent.attendance.present / selectedStudent.attendance.total >= 0.9
                              ? "bg-green-100 text-green-800"
                              : selectedStudent.attendance.present / selectedStudent.attendance.total >= 0.75
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }
                        >
                          {selectedStudent.attendance.present / selectedStudent.attendance.total >= 0.9
                            ? "Excellent"
                            : selectedStudent.attendance.present / selectedStudent.attendance.total >= 0.75
                              ? "Good"
                              : "Needs Improvement"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                      <CreditCard className="h-5 w-5" />
                      Payment Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Payment Status:</span>
                        <Badge className={getPaymentStatusColor(selectedStudent.paymentStatus)}>
                          {selectedStudent.paymentStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Report Card Access:</span>
                        <Badge
                          className={
                            selectedStudent.paymentStatus === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {selectedStudent.paymentStatus === "paid" ? "Granted" : "Restricted"}
                        </Badge>
                      </div>
                      {selectedStudent.paymentStatus !== "paid" && (
                        <Button className="w-full bg-[#b29032] hover:bg-[#8a6b26]">
                          Grant Access (Offline Payment)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2d682d]">
              <Edit className="h-5 w-5" />
              Edit Student Details
            </DialogTitle>
            <DialogDescription>Update student information and save changes</DialogDescription>
          </DialogHeader>

          {editingStudent && (
            <EditStudentForm
              student={editingStudent}
              onSave={handleSaveStudent}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddStudentForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    class: "",
    section: "",
    parentName: "",
    parentEmail: "",
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const newStudent = {
        ...formData,
        id: Date.now().toString(),
        admissionNumber: `VEA${new Date().getFullYear()}${String(Date.now()).slice(-3)}`,
        paymentStatus: "pending" as const,
        status: "active" as const,
        dateOfBirth: "",
        address: "",
        phone: "",
        guardianPhone: "",
        bloodGroup: "",
        admissionDate: new Date().toISOString().split("T")[0],
        subjects: [],
        attendance: { present: 0, total: 0 },
        grades: [],
      }

      await dbManager.createStudent(newStudent)
      onClose()
    } catch (err) {
      console.error("Error adding student:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Student Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="border-[#2d682d]/20 focus:border-[#b29032]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="border-[#2d682d]/20 focus:border-[#b29032]"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="class">Class</Label>
          <Select value={formData.class} onValueChange={(value) => setFormData((prev) => ({ ...prev, class: value }))}>
            <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">Class 9</SelectItem>
              <SelectItem value="10">Class 10</SelectItem>
              <SelectItem value="11">Class 11</SelectItem>
              <SelectItem value="12">Class 12</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="section">Section</Label>
          <Select
            value={formData.section}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, section: value }))}
          >
            <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">Section A</SelectItem>
              <SelectItem value="B">Section B</SelectItem>
              <SelectItem value="C">Section C</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="parentName">Parent Name</Label>
          <Input
            id="parentName"
            value={formData.parentName}
            onChange={(e) => setFormData((prev) => ({ ...prev, parentName: e.target.value }))}
            className="border-[#2d682d]/20 focus:border-[#b29032]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parentEmail">Parent Email</Label>
          <Input
            id="parentEmail"
            type="email"
            value={formData.parentEmail}
            onChange={(e) => setFormData((prev) => ({ ...prev, parentEmail: e.target.value }))}
            className="border-[#2d682d]/20 focus:border-[#b29032]"
            required
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent" disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-[#2d682d] hover:bg-[#1a4a1a]" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Adding...
            </>
          ) : (
            "Add Student"
          )}
        </Button>
      </div>
    </form>
  )
}

function EditStudentForm({
  student,
  onSave,
  onCancel,
}: {
  student: Student
  onSave: (student: Student) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<Student>(student)
  const [photoPreview, setPhotoPreview] = useState<string>(student.photoUrl || "")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await onSave(formData)
    } catch (err) {
      console.error("Error saving student:", err)
    } finally {
      setSaving(false)
    }
  }

  const updateFormData = (field: keyof Student, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPhotoPreview(result)
      updateFormData("photoUrl", result)

      // Save to safeStorage for persistence
      const studentPhotos = JSON.parse(safeStorage.getItem("studentPhotos") || "{}")
      studentPhotos[student.id] = result
      safeStorage.setItem("studentPhotos", JSON.stringify(studentPhotos))
    }
    reader.readAsDataURL(file)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Student Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => updateFormData("name", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-admission">Admission Number</Label>
              <Input
                id="edit-admission"
                value={formData.admissionNumber}
                onChange={(e) => updateFormData("admissionNumber", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input
                id="edit-dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-blood">Blood Group</Label>
              <Select value={formData.bloodGroup} onValueChange={(value) => updateFormData("bloodGroup", value)}>
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              value={formData.address}
              onChange={(e) => updateFormData("address", e.target.value)}
              className="border-[#2d682d]/20 focus:border-[#b29032]"
            />
          </div>
        </TabsContent>

        <TabsContent value="photo" className="space-y-4">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={photoPreview || "/placeholder.svg"} alt={formData.name} />
                <AvatarFallback className="bg-[#2d682d] text-white text-2xl">
                  {formData.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo-upload">Student Photo</Label>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handlePhotoUpload(file)
                }}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
              <p className="text-sm text-gray-600">Upload a passport-style photo for the student</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class">Class</Label>
              <Select value={formData.class} onValueChange={(value) => updateFormData("class", value)}>
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">Class 9</SelectItem>
                  <SelectItem value="10">Class 10</SelectItem>
                  <SelectItem value="11">Class 11</SelectItem>
                  <SelectItem value="12">Class 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-section">Section</Label>
              <Select value={formData.section} onValueChange={(value) => updateFormData("section", value)}>
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Section A</SelectItem>
                  <SelectItem value="B">Section B</SelectItem>
                  <SelectItem value="C">Section C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-admission-date">Admission Date</Label>
              <Input
                id="edit-admission-date"
                type="date"
                value={formData.admissionDate}
                onChange={(e) => updateFormData("admissionDate", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-parent-name">Parent Name</Label>
              <Input
                id="edit-parent-name"
                value={formData.parentName}
                onChange={(e) => updateFormData("parentName", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent-email">Parent Email</Label>
              <Input
                id="edit-parent-email"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => updateFormData("parentEmail", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guardian-phone">Guardian Phone</Label>
              <Input
                id="edit-guardian-phone"
                value={formData.guardianPhone}
                onChange={(e) => updateFormData("guardianPhone", e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-payment-status">Payment Status</Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(value: "paid" | "pending" | "overdue") => updateFormData("paymentStatus", value)}
              >
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Student Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "active" | "inactive") => updateFormData("status", value)}
              >
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent" disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-[#2d682d] hover:bg-[#1a4a1a]" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  )
}
