"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GraduationCap, Download, Printer, Award, Calendar, MapPin, Phone, Mail } from "lucide-react"

interface Subject {
  name: string
  firstTest: number
  secondTest: number
  exam: number
  total: number
  grade: string
  position: number
  teacherComment: string
}

interface ReportCardData {
  student: {
    name: string
    class: string
    section: string
    admissionNumber: string
    session: string
    term: string
    avatar?: string
    dateOfBirth: string
    address: string
    phone: string
    email: string
  }
  subjects: Subject[]
  attendance: {
    totalDays: number
    presentDays: number
    absentDays: number
    percentage: number
  }
  overallPerformance: {
    totalMarks: number
    obtainedMarks: number
    percentage: number
    grade: string
    position: number
    totalStudents: number
  }
  principalComment: string
  classTeacherComment: string
  nextTermBegins: string
}

const mockReportData: ReportCardData = {
  student: {
    name: "John Doe",
    class: "10",
    section: "A",
    admissionNumber: "VEA2025001",
    session: "2024/2025",
    term: "First Term",
    dateOfBirth: "2008-05-15",
    address: "123 Main Street, Lagos, Nigeria",
    phone: "+234 801 234 5678",
    email: "john.doe@student.vea.edu.ng",
  },
  subjects: [
    {
      name: "Mathematics",
      firstTest: 18,
      secondTest: 16,
      exam: 51,
      total: 85,
      grade: "A",
      position: 3,
      teacherComment: "Excellent performance in algebra and geometry.",
    },
    {
      name: "English Language",
      firstTest: 15,
      secondTest: 17,
      exam: 46,
      total: 78,
      grade: "B+",
      position: 8,
      teacherComment: "Good comprehension skills, needs improvement in essay writing.",
    },
    {
      name: "Physics",
      firstTest: 19,
      secondTest: 18,
      exam: 55,
      total: 92,
      grade: "A+",
      position: 1,
      teacherComment: "Outstanding understanding of concepts and practical work.",
    },
    {
      name: "Chemistry",
      firstTest: 16,
      secondTest: 15,
      exam: 49,
      total: 80,
      grade: "B+",
      position: 5,
      teacherComment: "Good laboratory skills, improve theoretical knowledge.",
    },
    {
      name: "Biology",
      firstTest: 17,
      secondTest: 19,
      exam: 52,
      total: 88,
      grade: "A",
      position: 2,
      teacherComment: "Excellent in practical work and diagrams.",
    },
    {
      name: "Geography",
      firstTest: 14,
      secondTest: 16,
      exam: 45,
      total: 75,
      grade: "B",
      position: 12,
      teacherComment: "Good map work, needs more focus on physical geography.",
    },
  ],
  attendance: {
    totalDays: 120,
    presentDays: 115,
    absentDays: 5,
    percentage: 95.8,
  },
  overallPerformance: {
    totalMarks: 600,
    obtainedMarks: 498,
    percentage: 83.0,
    grade: "A",
    position: 4,
    totalStudents: 45,
  },
  principalComment: "John has shown excellent academic performance this term. Keep up the good work!",
  classTeacherComment:
    "A dedicated student with good leadership qualities. Encourage more participation in class discussions.",
  nextTermBegins: "January 15, 2025",
}

interface ReportCardProps {
  data: ReportCardData
  isOpen: boolean
  onClose: () => void
}

export function ReportCard({ data, isOpen, onClose }: ReportCardProps) {
  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // In a real app, this would generate and download a PDF
    alert("PDF download functionality would be implemented here")
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "text-green-600 bg-green-50"
      case "B+":
      case "B":
        return "text-blue-600 bg-blue-50"
      case "C+":
      case "C":
        return "text-yellow-600 bg-yellow-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[#2d682d]">Academic Report Card</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm" className="bg-[#b29032] hover:bg-[#8a6b25]">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="print:p-8 print:bg-white">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-[#2d682d] pb-6">
            <div className="flex items-center justify-center mb-4">
              <GraduationCap className="h-16 w-16 text-[#b29032]" />
            </div>
            <h1 className="text-3xl font-bold text-[#2d682d] mb-2">VEA 2025</h1>
            <p className="text-lg text-gray-600 mb-1">Victory Educational Academy</p>
            <p className="text-sm text-gray-500">Excellence in Education Since 2020</p>
            <div className="mt-4">
              <h2 className="text-xl font-semibold text-[#b29032]">ACADEMIC REPORT CARD</h2>
              <p className="text-sm text-gray-600">
                {data.student.session} Academic Session - {data.student.term}
              </p>
            </div>
          </div>

          {/* Student Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2">
              <Card className="border-[#2d682d]/20">
                <CardHeader className="pb-3">
                  <h3 className="text-lg font-semibold text-[#2d682d]">Student Information</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Name:</span>
                      <p className="font-semibold text-[#2d682d]">{data.student.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Admission No:</span>
                      <p className="font-semibold">{data.student.admissionNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Class:</span>
                      <p className="font-semibold">
                        {data.student.class} - {data.student.section}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Date of Birth:</span>
                      <p className="font-semibold">{data.student.dateOfBirth}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <MapPin className="h-3 w-3" />
                      <span>{data.student.address}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{data.student.phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{data.student.email}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Card className="border-[#b29032]/20 w-fit">
                <CardContent className="p-4 text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-3">
                    <AvatarImage src={data.student.avatar || "/placeholder.svg"} alt={data.student.name} />
                    <AvatarFallback className="bg-[#2d682d] text-white text-2xl">
                      {data.student.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-gray-500">Student Photo</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Academic Performance */}
          <Card className="border-[#2d682d]/20 mb-6">
            <CardHeader>
              <h3 className="text-lg font-semibold text-[#2d682d] flex items-center gap-2">
                <Award className="h-5 w-5" />
                Academic Performance
              </h3>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#2d682d]">
                      <th className="text-left py-2 font-semibold text-[#2d682d]">Subject</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">1st Test (20)</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">2nd Test (20)</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">Exam (60)</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">Total (100)</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">Grade</th>
                      <th className="text-center py-2 font-semibold text-[#2d682d]">Position</th>
                      <th className="text-left py-2 font-semibold text-[#2d682d]">Teacher's Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((subject, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-3 font-medium">{subject.name}</td>
                        <td className="text-center py-3">{subject.firstTest}</td>
                        <td className="text-center py-3">{subject.secondTest}</td>
                        <td className="text-center py-3">{subject.exam}</td>
                        <td className="text-center py-3 font-semibold">{subject.total}</td>
                        <td className="text-center py-3">
                          <Badge className={`${getGradeColor(subject.grade)} border-0`}>{subject.grade}</Badge>
                        </td>
                        <td className="text-center py-3 font-medium">{subject.position}</td>
                        <td className="py-3 text-xs text-gray-600 max-w-xs">{subject.teacherComment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary and Attendance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="border-[#b29032]/20">
              <CardHeader>
                <h3 className="text-lg font-semibold text-[#b29032]">Overall Performance</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-[#b29032]/5 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Marks</p>
                      <p className="text-xl font-bold text-[#2d682d]">{data.overallPerformance.totalMarks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Obtained Marks</p>
                      <p className="text-xl font-bold text-[#b29032]">{data.overallPerformance.obtainedMarks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Percentage</p>
                      <p className="text-xl font-bold text-[#2d682d]">{data.overallPerformance.percentage}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Class Position</p>
                      <p className="text-xl font-bold text-[#b29032]">
                        {data.overallPerformance.position}/{data.overallPerformance.totalStudents}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <Badge className={`${getGradeColor(data.overallPerformance.grade)} text-lg px-4 py-2 border-0`}>
                      Grade: {data.overallPerformance.grade}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#2d682d]/20">
              <CardHeader>
                <h3 className="text-lg font-semibold text-[#2d682d] flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Attendance Record
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-[#2d682d]/5 p-4 rounded-lg">
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-[#2d682d]">{data.attendance.percentage}%</p>
                    <p className="text-sm text-gray-600">Attendance Rate</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-center">
                    <div>
                      <p className="font-semibold text-[#2d682d]">{data.attendance.totalDays}</p>
                      <p className="text-gray-600">Total Days</p>
                    </div>
                    <div>
                      <p className="font-semibold text-green-600">{data.attendance.presentDays}</p>
                      <p className="text-gray-600">Present</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600">{data.attendance.absentDays}</p>
                      <p className="text-gray-600">Absent</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="border-[#2d682d]/20">
              <CardHeader>
                <h3 className="text-lg font-semibold text-[#2d682d]">Class Teacher's Comment</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 italic">{data.classTeacherComment}</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">Signature: _________________</p>
                  <p className="text-xs text-gray-500 mt-1">Date: _________________</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#b29032]/20">
              <CardHeader>
                <h3 className="text-lg font-semibold text-[#b29032]">Principal's Comment</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 italic">{data.principalComment}</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">Signature: _________________</p>
                  <p className="text-xs text-gray-500 mt-1">Date: _________________</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center border-t-2 border-[#2d682d] pt-6">
            <p className="text-sm font-semibold text-[#2d682d] mb-2">Next Term Begins: {data.nextTermBegins}</p>
            <p className="text-xs text-gray-500">
              This report card is computer generated and does not require a signature
            </p>
            <div className="mt-4 text-xs text-gray-400">
              <p>Victory Educational Academy • Excellence in Education • www.vea2025.edu.ng</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ReportCardTrigger({ children, hasAccess }: { children: React.ReactNode; hasAccess: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!hasAccess) {
    return <div>{children}</div>
  }

  return (
    <>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>
        {children}
      </DialogTrigger>
      <ReportCard data={mockReportData} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
