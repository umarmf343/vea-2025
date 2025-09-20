"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2 } from "lucide-react"

interface Class {
  id: string
  name: string
  level: string
  section: string
  capacity: number
  currentStudents: number
  classTeacher: string
  subjects: string[]
}

interface Subject {
  id: string
  name: string
  code: string
  description: string
  classes: string[]
  teachers: string[]
}

export function ClassSubjectManagement() {
  const [classes, setClasses] = useState<Class[]>([
    {
      id: "1",
      name: "JSS 1A",
      level: "JSS 1",
      section: "A",
      capacity: 40,
      currentStudents: 35,
      classTeacher: "Mrs. Sarah Johnson",
      subjects: ["Mathematics", "English", "Science"],
    },
    {
      id: "2",
      name: "JSS 2B",
      level: "JSS 2",
      section: "B",
      capacity: 40,
      currentStudents: 38,
      classTeacher: "Mr. David Wilson",
      subjects: ["Mathematics", "English", "Physics", "Chemistry"],
    },
  ])

  const [subjects, setSubjects] = useState<Subject[]>([
    {
      id: "1",
      name: "Mathematics",
      code: "MATH",
      description: "Core Mathematics curriculum",
      classes: ["JSS 1A", "JSS 2B"],
      teachers: ["Mr. John Smith", "Mrs. Mary Brown"],
    },
    {
      id: "2",
      name: "English Language",
      code: "ENG",
      description: "English Language and Literature",
      classes: ["JSS 1A", "JSS 2B"],
      teachers: ["Mrs. Sarah Johnson"],
    },
  ])

  const [newClass, setNewClass] = useState({
    name: "",
    level: "",
    section: "",
    capacity: 40,
    classTeacher: "",
  })

  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
    description: "",
    classes: [] as string[],
  })

  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false)
  const [isEditClassOpen, setIsEditClassOpen] = useState(false)
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false)

  const availableTeachers = [
    "Mrs. Sarah Johnson",
    "Mr. David Wilson",
    "Mr. John Smith",
    "Mrs. Mary Brown",
    "Dr. Patricia Davis",
    "Mr. Michael Thompson",
    "Mrs. Jennifer Garcia",
    "Mr. Robert Martinez",
    "Ms. Lisa Anderson",
    "Mr. James Taylor",
  ]

  const handleAddClass = () => {
    const classData: Class = {
      id: Date.now().toString(),
      name: `${newClass.level} ${newClass.section}`,
      level: newClass.level,
      section: newClass.section,
      capacity: newClass.capacity,
      currentStudents: 0,
      classTeacher: newClass.classTeacher,
      subjects: [],
    }
    setClasses([...classes, classData])
    setNewClass({ name: "", level: "", section: "", capacity: 40, classTeacher: "" })
    setIsAddClassOpen(false)
  }

  const handleAddSubject = () => {
    const subjectData: Subject = {
      id: Date.now().toString(),
      name: newSubject.name,
      code: newSubject.code,
      description: newSubject.description,
      classes: newSubject.classes,
      teachers: [],
    }
    setSubjects([...subjects, subjectData])
    setNewSubject({ name: "", code: "", description: "", classes: [] })
    setIsAddSubjectOpen(false)
  }

  const handleDeleteClass = (classId: string) => {
    setClasses(classes.filter((c) => c.id !== classId))
  }

  const handleDeleteSubject = (subjectId: string) => {
    setSubjects(subjects.filter((s) => s.id !== subjectId))
  }

  const handleEditClass = (classItem: Class) => {
    setEditingClass(classItem)
    setIsEditClassOpen(true)
  }

  const handleUpdateClass = () => {
    if (editingClass) {
      setClasses(classes.map((c) => (c.id === editingClass.id ? editingClass : c)))
      setEditingClass(null)
      setIsEditClassOpen(false)
    }
  }

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setIsEditSubjectOpen(true)
  }

  const handleUpdateSubject = () => {
    if (editingSubject) {
      setSubjects(subjects.map((s) => (s.id === editingSubject.id ? editingSubject : s)))
      setEditingSubject(null)
      setIsEditSubjectOpen(false)
    }
  }

  const handleAssignTeacherToSubject = (subjectId: string, teacherName: string) => {
    setSubjects(subjects.map((s) => (s.id === subjectId ? { ...s, teachers: [...s.teachers, teacherName] } : s)))
  }

  const handleAssignSubjectToClass = (classId: string, subjectName: string) => {
    setClasses(classes.map((c) => (c.id === classId ? { ...c, subjects: [...c.subjects, subjectName] } : c)))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#2d682d]">Class & Subject Management</h3>
        <p className="text-sm text-gray-600">Manage classes, subjects, and their assignments</p>
      </div>

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#2d682d]/10">
          <TabsTrigger value="classes" className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white">
            Classes
          </TabsTrigger>
          <TabsTrigger value="subjects" className="data-[state=active]:bg-[#2d682d] data-[state=active]:text-white">
            Subjects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-md font-medium">All Classes ({classes.length})</h4>
            <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Class</DialogTitle>
                  <DialogDescription>Create a new class for students</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="level">Level</Label>
                    <Select
                      value={newClass.level}
                      onValueChange={(value) => setNewClass({ ...newClass, level: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JSS 1">JSS 1</SelectItem>
                        <SelectItem value="JSS 2">JSS 2</SelectItem>
                        <SelectItem value="JSS 3">JSS 3</SelectItem>
                        <SelectItem value="SS 1">SS 1</SelectItem>
                        <SelectItem value="SS 2">SS 2</SelectItem>
                        <SelectItem value="SS 3">SS 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="section">Section</Label>
                    <Select
                      value={newClass.section}
                      onValueChange={(value) => setNewClass({ ...newClass, section: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={newClass.capacity}
                      onChange={(e) => setNewClass({ ...newClass, capacity: Number.parseInt(e.target.value) })}
                      placeholder="Enter class capacity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="classTeacher">Class Teacher</Label>
                    <Select
                      value={newClass.classTeacher}
                      onValueChange={(value) => setNewClass({ ...newClass, classTeacher: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeachers.map((teacher) => (
                          <SelectItem key={teacher} value={teacher}>
                            {teacher}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddClass} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                    Create Class
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((classItem) => (
              <Card key={classItem.id} className="border-[#2d682d]/20">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-[#2d682d]">{classItem.name}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditClass(classItem)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClass(classItem.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>Class Teacher: {classItem.classTeacher}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Students:</span>
                      <Badge variant="outline">
                        {classItem.currentStudents}/{classItem.capacity}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Subjects:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {classItem.subjects.map((subject, index) => (
                          <Badge key={index} className="bg-[#b29032]/10 text-[#b29032]">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-md font-medium">All Subjects ({subjects.length})</h4>
            <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Subject</DialogTitle>
                  <DialogDescription>Create a new subject</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="subjectName">Subject Name</Label>
                    <Input
                      id="subjectName"
                      value={newSubject.name}
                      onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                      placeholder="Enter subject name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subjectCode">Subject Code</Label>
                    <Input
                      id="subjectCode"
                      value={newSubject.code}
                      onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                      placeholder="Enter subject code (e.g., MATH)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newSubject.description}
                      onChange={(e) => setNewSubject({ ...newSubject, description: e.target.value })}
                      placeholder="Enter subject description"
                    />
                  </div>
                  <Button onClick={handleAddSubject} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                    Create Subject
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Teachers</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subject.code}</Badge>
                      </TableCell>
                      <TableCell>{subject.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {subject.classes.map((className, index) => (
                            <Badge key={index} className="bg-[#2d682d]/10 text-[#2d682d]">
                              {className}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {subject.teachers.map((teacher, index) => (
                            <Badge key={index} className="bg-[#b29032]/10 text-[#b29032]">
                              {teacher}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditSubject(subject)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="text-red-600"
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
        </TabsContent>
      </Tabs>

      <Dialog open={isEditClassOpen} onOpenChange={setIsEditClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update class information</DialogDescription>
          </DialogHeader>
          {editingClass && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editLevel">Level</Label>
                <Select
                  value={editingClass.level}
                  onValueChange={(value) =>
                    setEditingClass({ ...editingClass, level: value, name: `${value} ${editingClass.section}` })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JSS 1">JSS 1</SelectItem>
                    <SelectItem value="JSS 2">JSS 2</SelectItem>
                    <SelectItem value="JSS 3">JSS 3</SelectItem>
                    <SelectItem value="SS 1">SS 1</SelectItem>
                    <SelectItem value="SS 2">SS 2</SelectItem>
                    <SelectItem value="SS 3">SS 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editSection">Section</Label>
                <Select
                  value={editingClass.section}
                  onValueChange={(value) =>
                    setEditingClass({ ...editingClass, section: value, name: `${editingClass.level} ${value}` })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editCapacity">Capacity</Label>
                <Input
                  id="editCapacity"
                  type="number"
                  value={editingClass.capacity}
                  onChange={(e) => setEditingClass({ ...editingClass, capacity: Number.parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="editClassTeacher">Class Teacher</Label>
                <Select
                  value={editingClass.classTeacher}
                  onValueChange={(value) => setEditingClass({ ...editingClass, classTeacher: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.map((teacher) => (
                      <SelectItem key={teacher} value={teacher}>
                        {teacher}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign Subjects</Label>
                <Select onValueChange={(value) => handleAssignSubjectToClass(editingClass.id, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects
                      .filter((s) => !editingClass.subjects.includes(s.name))
                      .map((subject) => (
                        <SelectItem key={subject.id} value={subject.name}>
                          {subject.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUpdateClass} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                Update Class
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditSubjectOpen} onOpenChange={setIsEditSubjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update subject information</DialogDescription>
          </DialogHeader>
          {editingSubject && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editSubjectName">Subject Name</Label>
                <Input
                  id="editSubjectName"
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editSubjectCode">Subject Code</Label>
                <Input
                  id="editSubjectCode"
                  value={editingSubject.code}
                  onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Input
                  id="editDescription"
                  value={editingSubject.description}
                  onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Assign Classes</Label>
                <Select
                  onValueChange={(value) =>
                    setEditingSubject({ ...editingSubject, classes: [...editingSubject.classes, value] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes
                      .filter((c) => !editingSubject.classes.includes(c.name))
                      .map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.name}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign Teachers</Label>
                <Input
                  placeholder="Enter teacher name and press Enter"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const teacherName = e.currentTarget.value.trim()
                      if (teacherName && !editingSubject.teachers.includes(teacherName)) {
                        setEditingSubject({ ...editingSubject, teachers: [...editingSubject.teachers, teacherName] })
                        e.currentTarget.value = ""
                      }
                    }
                  }}
                />
              </div>
              <Button onClick={handleUpdateSubject} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a]">
                Update Subject
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
