"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Edit, Save } from "lucide-react"

export default function GradeManagement() {
  const [selectedClass, setSelectedClass] = useState("Grade 10A")
  const [selectedSubject, setSelectedSubject] = useState("Mathematics")
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const classes = ["Grade 10A", "Grade 10B", "Grade 11A", "Grade 11B", "Grade 12A", "Grade 12B"]
  const subjects = ["Mathematics", "English", "Physics", "Chemistry", "Biology", "History"]

  const [students, setStudents] = useState([
    {
      id: 1,
      name: "John Doe",
      rollNo: "001",
      firstCA: 15,
      secondCA: 18,
      noteAssignment: 20,
      caTotal: 53,
      exam: 35,
      grandTotal: 88,
      grade: "A",
      teacherRemarks: "Excellent performance",
    },
    {
      id: 2,
      name: "Jane Smith",
      rollNo: "002",
      firstCA: 12,
      secondCA: 15,
      noteAssignment: 18,
      caTotal: 45,
      exam: 37,
      grandTotal: 82,
      grade: "B",
      teacherRemarks: "Good work, keep improving",
    },
    {
      id: 3,
      name: "Mike Johnson",
      rollNo: "003",
      firstCA: 18,
      secondCA: 19,
      noteAssignment: 20,
      caTotal: 57,
      exam: 33,
      grandTotal: 90,
      grade: "A",
      teacherRemarks: "Outstanding student",
    },
    {
      id: 4,
      name: "Sarah Wilson",
      rollNo: "004",
      firstCA: 10,
      secondCA: 13,
      noteAssignment: 16,
      caTotal: 39,
      exam: 40,
      grandTotal: 79,
      grade: "B",
      teacherRemarks: "Shows improvement",
    },
  ])

  const getGradeColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getGradeLetter = (score: number) => {
    if (score >= 90) return "A"
    if (score >= 80) return "B"
    if (score >= 70) return "C"
    if (score >= 60) return "D"
    return "F"
  }

  const calculateTotals = (firstCA: number, secondCA: number, noteAssignment: number, exam: number) => {
    const caTotal = firstCA + secondCA + noteAssignment
    const grandTotal = caTotal + exam
    const grade = getGradeLetter(grandTotal)
    return { caTotal, grandTotal, grade }
  }

  const handleEditGrade = (student: any) => {
    setEditingStudent({ ...student })
    setIsEditDialogOpen(true)
  }

  const handleSaveGrade = () => {
    if (!editingStudent) return

    const { caTotal, grandTotal, grade } = calculateTotals(
      editingStudent.firstCA,
      editingStudent.secondCA,
      editingStudent.noteAssignment,
      editingStudent.exam,
    )

    const updatedStudent = {
      ...editingStudent,
      caTotal,
      grandTotal,
      grade,
    }

    setStudents(students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)))
    setIsEditDialogOpen(false)
    setEditingStudent(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#2d682d]">Grade Management</h2>
        <Button className="bg-[#b29032] hover:bg-[#9a7c2a] text-white">
          <Download className="w-4 h-4 mr-2" />
          Export Grades
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="class-select">Select Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="subject-select">Select Subject</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#2d682d]">
            {selectedClass} - {selectedSubject}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Roll No</th>
                  <th className="text-left p-2">Student Name</th>
                  <th className="text-center p-2">1st C.A.</th>
                  <th className="text-center p-2">2nd C.A.</th>
                  <th className="text-center p-2">NOTE/ASSIGNMENT</th>
                  <th className="text-center p-2">C.A. TOTAL</th>
                  <th className="text-center p-2">EXAM</th>
                  <th className="text-center p-2">GRAND TOTAL</th>
                  <th className="text-center p-2">GRADE</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{student.rollNo}</td>
                    <td className="p-2">{student.name}</td>
                    <td className="p-2 text-center">{student.firstCA}</td>
                    <td className="p-2 text-center">{student.secondCA}</td>
                    <td className="p-2 text-center">{student.noteAssignment}</td>
                    <td className="p-2 text-center font-semibold">{student.caTotal}</td>
                    <td className="p-2 text-center">{student.exam}</td>
                    <td className={`p-2 text-center font-bold ${getGradeColor(student.grandTotal)}`}>
                      {student.grandTotal}
                    </td>
                    <td className={`p-2 text-center font-bold ${getGradeColor(student.grandTotal)}`}>
                      {student.grade}
                    </td>
                    <td className="p-2 text-center">
                      <Button variant="outline" size="sm" onClick={() => handleEditGrade(student)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2d682d]">Edit Grades - {editingStudent?.name}</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>1st C.A. (Max: 20)</Label>
                  <Input
                    type="number"
                    max="20"
                    value={editingStudent.firstCA}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        firstCA: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>2nd C.A. (Max: 20)</Label>
                  <Input
                    type="number"
                    max="20"
                    value={editingStudent.secondCA}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        secondCA: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>NOTE/ASSIGNMENT (Max: 20)</Label>
                  <Input
                    type="number"
                    max="20"
                    value={editingStudent.noteAssignment}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        noteAssignment: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>EXAM (Max: 40)</Label>
                  <Input
                    type="number"
                    max="40"
                    value={editingStudent.exam}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        exam: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Calculated Totals</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    <div>
                      C.A. Total: {editingStudent.firstCA + editingStudent.secondCA + editingStudent.noteAssignment}
                    </div>
                    <div>
                      Grand Total:{" "}
                      {editingStudent.firstCA +
                        editingStudent.secondCA +
                        editingStudent.noteAssignment +
                        editingStudent.exam}
                    </div>
                    <div>
                      Grade:{" "}
                      {getGradeLetter(
                        editingStudent.firstCA +
                          editingStudent.secondCA +
                          editingStudent.noteAssignment +
                          editingStudent.exam,
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label>Teacher's Remarks</Label>
                <Textarea
                  value={editingStudent.teacherRemarks}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      teacherRemarks: e.target.value,
                    })
                  }
                  placeholder="Enter teacher's remarks..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveGrade} className="bg-[#2d682d] hover:bg-[#245a24] text-white">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid max-[359px]:grid-cols-2 grid-cols-3 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{students.filter((s) => s.grade === "A").length}</div>
            <div className="text-sm text-gray-600">A Grades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{students.filter((s) => s.grade === "B").length}</div>
            <div className="text-sm text-gray-600">B Grades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{students.filter((s) => s.grade === "C").length}</div>
            <div className="text-sm text-gray-600">C Grades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#b29032]">
              {Math.round(students.reduce((acc, s) => acc + s.grandTotal, 0) / students.length)}%
            </div>
            <div className="text-sm text-gray-600">Class Average</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
