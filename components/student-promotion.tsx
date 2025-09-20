"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUp, Users, CheckCircle, AlertCircle } from "lucide-react"

interface Student {
  id: string
  name: string
  currentClass: string
  nextClass: string
  averageScore: number
  status: "promoted" | "repeated" | "pending"
}

export function StudentPromotion() {
  const [currentSession, setCurrentSession] = useState("2024/2025")
  const [nextSession, setNextSession] = useState("2025/2026")
  const [students, setStudents] = useState<Student[]>([
    {
      id: "1",
      name: "John Doe",
      currentClass: "JSS1A",
      nextClass: "JSS2A",
      averageScore: 85,
      status: "pending",
    },
    {
      id: "2",
      name: "Jane Smith",
      currentClass: "JSS1A",
      nextClass: "JSS2A",
      averageScore: 92,
      status: "pending",
    },
    {
      id: "3",
      name: "Mike Johnson",
      currentClass: "JSS2B",
      nextClass: "JSS3B",
      averageScore: 45,
      status: "pending",
    },
  ])

  const handlePromoteAll = () => {
    setStudents(
      students.map((student) => ({
        ...student,
        status: student.averageScore >= 50 ? "promoted" : ("repeated" as "promoted" | "repeated"),
      })),
    )
  }

  const handlePromoteStudent = (studentId: string) => {
    setStudents(
      students.map((student) => (student.id === studentId ? { ...student, status: "promoted" as const } : student)),
    )
  }

  const handleRepeatStudent = (studentId: string) => {
    setStudents(
      students.map((student) =>
        student.id === studentId
          ? { ...student, status: "repeated" as const, nextClass: student.currentClass }
          : student,
      ),
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "promoted":
        return "bg-green-100 text-green-800"
      case "repeated":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "promoted":
        return <CheckCircle className="h-4 w-4" />
      case "repeated":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <ArrowUp className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#2d682d]">Student Promotion</h3>
          <p className="text-sm text-gray-600">Manage student promotion to next academic session</p>
        </div>
        <Button onClick={handlePromoteAll} className="bg-[#2d682d] hover:bg-[#1a4a1a]">
          <ArrowUp className="h-4 w-4 mr-2" />
          Auto Promote All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={currentSession} onValueChange={setCurrentSession}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024/2025">2024/2025</SelectItem>
                <SelectItem value="2023/2024">2023/2024</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Next Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={nextSession} onValueChange={setNextSession}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025/2026">2025/2026</SelectItem>
                <SelectItem value="2024/2025">2024/2025</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Promotion Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Promoted:</span>
                <Badge className="bg-green-100 text-green-800">
                  {students.filter((s) => s.status === "promoted").length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Repeated:</span>
                <Badge className="bg-red-100 text-red-800">
                  {students.filter((s) => s.status === "repeated").length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pending:</span>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {students.filter((s) => s.status === "pending").length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Promotion List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Current Class</TableHead>
                <TableHead>Next Class</TableHead>
                <TableHead>Average Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.currentClass}</TableCell>
                  <TableCell>{student.nextClass}</TableCell>
                  <TableCell>
                    <span className={student.averageScore >= 50 ? "text-green-600" : "text-red-600"}>
                      {student.averageScore}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(student.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(student.status)}
                        {student.status}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePromoteStudent(student.id)}
                        disabled={student.status === "promoted"}
                        className="text-green-600 hover:text-green-800"
                      >
                        Promote
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRepeatStudent(student.id)}
                        disabled={student.status === "repeated"}
                        className="text-red-600 hover:text-red-800"
                      >
                        Repeat
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
