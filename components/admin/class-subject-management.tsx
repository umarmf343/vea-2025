"use client"

import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Edit, Plus, Trash2 } from "lucide-react"
import { dbManager } from "@/lib/database-manager"

interface ClassRecord {
  id: string
  name: string
  level: string
  capacity?: number | null
  classTeacherId?: string | null
  status: string
  subjects?: string[]
}

interface SubjectRecord {
  id: string
  name: string
  code: string
  description?: string | null
  classes: string[]
  teachers: string[]
}

const classStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const teacherDirectory = [
  "Mrs. Sarah Johnson",
  "Mr. David Wilson",
  "Mr. John Smith",
  "Mrs. Mary Brown",
  "Dr. Patricia Davis",
  "Mr. Michael Thompson",
  "Mrs. Jennifer Garcia",
]

export function ClassSubjectManagement() {
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [subjects, setSubjects] = useState<SubjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null)

  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null)

  const [newClass, setNewClass] = useState({ name: "", level: "", capacity: 40, status: "active" })
  const [newSubject, setNewSubject] = useState({ name: "", code: "", description: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [classResponse, subjectResponse] = await Promise.all([fetch("/api/classes"), fetch("/api/subjects")])

      if (!classResponse.ok) {
        throw new Error("Unable to fetch classes")
      }

      if (!subjectResponse.ok) {
        throw new Error("Unable to fetch subjects")
      }

      const classData = (await classResponse.json()) as { classes: ClassRecord[] }
      const subjectData = (await subjectResponse.json()) as { subjects: SubjectRecord[] }

      setClasses(classData.classes)
      setSubjects(subjectData.subjects)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load class and subject data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const handleRefresh = () => {
      void loadData()
    }

    dbManager.on("classesRefreshed", handleRefresh)

    return () => {
      dbManager.off("classesRefreshed", handleRefresh)
    }
  }, [loadData])

  const handleCreateClass = useCallback(async () => {
    if (!newClass.name || !newClass.level) {
      setError("Class name and level are required")
      return
    }

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClass.name,
          level: newClass.level,
          capacity: newClass.capacity,
          status: newClass.status,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create class")
      }

      const data = (await response.json()) as { class: ClassRecord }
      setClasses((previous) => [...previous, data.class])
      setNewClass({ name: "", level: "", capacity: 40, status: "active" })
      setIsClassDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to create class")
    }
  }, [newClass])

  const handleUpdateClass = useCallback(async () => {
    if (!editingClass) return

    try {
      const response = await fetch("/api/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClass.id,
          name: editingClass.name,
          level: editingClass.level,
          capacity: editingClass.capacity,
          classTeacherId: editingClass.classTeacherId,
          status: editingClass.status,
          subjects: editingClass.subjects ?? [],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update class")
      }

      const data = (await response.json()) as { class: ClassRecord }
      setClasses((previous) => previous.map((item) => (item.id === data.class.id ? data.class : item)))
      setEditingClass(null)
      setIsClassDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to update class")
    }
  }, [editingClass])

  const handleDeleteClass = useCallback(
    async (classId: string) => {
      try {
        const response = await fetch(`/api/classes?id=${classId}`, { method: "DELETE" })
        if (!response.ok) {
          throw new Error("Failed to delete class")
        }

        setClasses((previous) => previous.filter((item) => item.id !== classId))
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to delete class")
      }
    },
    [],
  )

  const handleCreateSubject = useCallback(async () => {
    if (!newSubject.name || !newSubject.code) {
      setError("Subject name and code are required")
      return
    }

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubject.name,
          code: newSubject.code,
          description: newSubject.description,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create subject")
      }

      const data = (await response.json()) as { subject: SubjectRecord }
      setSubjects((previous) => [...previous, data.subject])
      setNewSubject({ name: "", code: "", description: "" })
      setIsSubjectDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to create subject")
    }
  }, [newSubject])

  const handleUpdateSubject = useCallback(async () => {
    if (!editingSubject) return

    try {
      const response = await fetch("/api/subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSubject.id,
          name: editingSubject.name,
          code: editingSubject.code,
          description: editingSubject.description,
          classes: editingSubject.classes,
          teachers: editingSubject.teachers,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update subject")
      }

      const data = (await response.json()) as { subject: SubjectRecord }
      setSubjects((previous) => previous.map((item) => (item.id === data.subject.id ? data.subject : item)))
      setEditingSubject(null)
      setIsSubjectDialogOpen(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to update subject")
    }
  }, [editingSubject])

  const handleDeleteSubject = useCallback(
    async (subjectId: string) => {
      try {
        const response = await fetch(`/api/subjects?id=${subjectId}`, { method: "DELETE" })
        if (!response.ok) {
          throw new Error("Failed to delete subject")
        }

        setSubjects((previous) => previous.filter((item) => item.id !== subjectId))
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to delete subject")
      }
    },
    [],
  )

  const handleAssignSubjectToClass = useCallback(
    async (classId: string, subjectName: string) => {
      const classRecord = classes.find((item) => item.id === classId)
      if (!classRecord) return

      const updatedSubjects = Array.from(new Set([...(classRecord.subjects ?? []), subjectName]))

      try {
        const response = await fetch("/api/classes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: classRecord.id,
            subjects: updatedSubjects,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to assign subject to class")
        }

        const data = (await response.json()) as { class: ClassRecord }
        setClasses((previous) => previous.map((item) => (item.id === data.class.id ? data.class : item)))

        const subjectRecord = subjects.find((item) => item.name === subjectName)
        if (subjectRecord) {
          const updatedClasses = Array.from(new Set([...(subjectRecord.classes ?? []), classRecord.name]))
          const subjectResponse = await fetch("/api/subjects", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: subjectRecord.id,
              classes: updatedClasses,
            }),
          })

          if (subjectResponse.ok) {
            const subjectData = (await subjectResponse.json()) as { subject: SubjectRecord }
            setSubjects((previous) => previous.map((item) => (item.id === subjectData.subject.id ? subjectData.subject : item)))
          }
        }
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to assign subject")
      }
    },
    [classes, subjects],
  )

  const handleAssignTeacherToSubject = useCallback(
    async (subjectId: string, teacherName: string) => {
      const subjectRecord = subjects.find((item) => item.id === subjectId)
      if (!subjectRecord) return

      const updatedTeachers = Array.from(new Set([...(subjectRecord.teachers ?? []), teacherName]))

      try {
        const response = await fetch("/api/subjects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: subjectRecord.id,
            teachers: updatedTeachers,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to assign teacher to subject")
        }

        const data = (await response.json()) as { subject: SubjectRecord }
        setSubjects((previous) => previous.map((item) => (item.id === data.subject.id ? data.subject : item)))
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to assign teacher")
      }
    },
    [subjects],
  )

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-10 text-[#2d682d]">
          Loading class and subject data…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#2d682d]">Class &amp; Subject Management</h3>
        <p className="text-sm text-gray-600">Manage classes, subjects, and their assignments</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void loadData()} className="ml-auto">
            Reload
          </Button>
        </div>
      )}

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#2d682d]/10">
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-6">
          <Card className="border-[#2d682d]/20">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-[#2d682d]">Classes</CardTitle>
                <CardDescription>Overview of available classes</CardDescription>
              </div>
              <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Class
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingClass ? "Edit Class" : "Create Class"}</DialogTitle>
                    <DialogDescription>Provide class details to {editingClass ? "update" : "create"}.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="class-name">Class Name</Label>
                      <Input
                        id="class-name"
                        value={editingClass ? editingClass.name : newClass.name}
                        onChange={(event) =>
                          editingClass
                            ? setEditingClass({ ...editingClass, name: event.target.value })
                            : setNewClass((previous) => ({ ...previous, name: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="class-level">Level</Label>
                      <Input
                        id="class-level"
                        value={editingClass ? editingClass.level : newClass.level}
                        onChange={(event) =>
                          editingClass
                            ? setEditingClass({ ...editingClass, level: event.target.value })
                            : setNewClass((previous) => ({ ...previous, level: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="class-capacity">Capacity</Label>
                      <Input
                        id="class-capacity"
                        type="number"
                        min={10}
                        value={editingClass ? editingClass.capacity ?? 0 : newClass.capacity}
                        onChange={(event) =>
                          editingClass
                            ? setEditingClass({ ...editingClass, capacity: Number(event.target.value) })
                            : setNewClass((previous) => ({ ...previous, capacity: Number(event.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={editingClass ? editingClass.status : newClass.status}
                        onValueChange={(value) =>
                          editingClass
                            ? setEditingClass({ ...editingClass, status: value })
                            : setNewClass((previous) => ({ ...previous, status: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {classStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => (editingClass ? setEditingClass(null) : setIsClassDialogOpen(false))}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => (editingClass ? void handleUpdateClass() : void handleCreateClass())}
                        className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
                      >
                        {editingClass ? "Update Class" : "Create Class"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classItem) => (
                    <TableRow key={classItem.id}>
                      <TableCell className="font-medium">{classItem.name}</TableCell>
                      <TableCell>{classItem.level}</TableCell>
                      <TableCell>{classItem.capacity ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(classItem.subjects ?? []).map((subject) => (
                            <Badge key={subject} variant="outline">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={classItem.status === "active" ? "default" : "outline"}>
                          {classItem.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingClass(classItem)
                              setIsClassDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void handleDeleteClass(classItem.id)}>
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

          <Card className="border-[#2d682d]/20">
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Assign Subjects to Classes</CardTitle>
              <CardDescription>Link subjects to the appropriate classes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {classes.length === 0 || subjects.length === 0 ? (
                <p className="text-sm text-gray-500">Create classes and subjects to manage assignments.</p>
              ) : (
                classes.map((classItem) => (
                  <div key={classItem.id} className="rounded-lg border border-[#2d682d]/10 p-4">
                    <p className="font-semibold text-[#2d682d]">{classItem.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {subjects.map((subject) => (
                        <Button
                          key={subject.id}
                          variant="outline"
                          size="sm"
                          onClick={() => void handleAssignSubjectToClass(classItem.id, subject.name)}
                        >
                          {subject.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-6">
          <Card className="border-[#b29032]/20">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-[#b29032]">Subjects</CardTitle>
                <CardDescription>Manage academic subjects and teacher assignments</CardDescription>
              </div>
              <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSubject ? "Edit Subject" : "Create Subject"}</DialogTitle>
                    <DialogDescription>Set the subject details and optional description.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject-name">Subject Name</Label>
                      <Input
                        id="subject-name"
                        value={editingSubject ? editingSubject.name : newSubject.name}
                        onChange={(event) =>
                          editingSubject
                            ? setEditingSubject({ ...editingSubject, name: event.target.value })
                            : setNewSubject((previous) => ({ ...previous, name: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject-code">Code</Label>
                      <Input
                        id="subject-code"
                        value={editingSubject ? editingSubject.code : newSubject.code}
                        onChange={(event) =>
                          editingSubject
                            ? setEditingSubject({ ...editingSubject, code: event.target.value })
                            : setNewSubject((previous) => ({ ...previous, code: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject-description">Description</Label>
                      <Input
                        id="subject-description"
                        value={editingSubject ? editingSubject.description ?? "" : newSubject.description}
                        onChange={(event) =>
                          editingSubject
                            ? setEditingSubject({ ...editingSubject, description: event.target.value })
                            : setNewSubject((previous) => ({ ...previous, description: event.target.value }))
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => (editingSubject ? setEditingSubject(null) : setIsSubjectDialogOpen(false))}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => (editingSubject ? void handleUpdateSubject() : void handleCreateSubject())}
                        className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
                      >
                        {editingSubject ? "Update Subject" : "Create Subject"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Teachers</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {subject.classes.map((className) => (
                            <Badge key={`${subject.id}-${className}`} variant="outline">
                              {className}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {subject.teachers.map((teacher) => (
                            <Badge key={`${subject.id}-${teacher}`} variant="outline">
                              {teacher}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSubject(subject)
                              setIsSubjectDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void handleDeleteSubject(subject.id)}>
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

          <Card className="border-[#b29032]/20">
            <CardHeader>
              <CardTitle className="text-[#b29032]">Assign Teachers</CardTitle>
              <CardDescription>Connect teachers with their respective subjects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-500">Create subjects to assign teachers.</p>
              ) : (
                subjects.map((subject) => (
                  <div key={subject.id} className="rounded-lg border border-[#b29032]/10 p-4">
                    <p className="font-semibold text-[#b29032]">{subject.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {teacherDirectory.map((teacher) => (
                        <Button
                          key={`${subject.id}-${teacher}`}
                          variant="outline"
                          size="sm"
                          onClick={() => void handleAssignTeacherToSubject(subject.id, teacher)}
                        >
                          {teacher}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
