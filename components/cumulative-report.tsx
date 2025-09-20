"use client"

import type React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GraduationCap, Download, Printer, TrendingUp, Calendar } from "lucide-react"

interface TermData {
  term: string
  session: string
  subjects: Array<{
    name: string
    ca1: number
    ca2: number
    assignment: number
    exam: number
    total: number
    grade: string
    position: number
  }>
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
}

interface CumulativeData {
  student: {
    name: string
    class: string
    admissionNumber: string
    session: string
  }
  terms: TermData[]
  cumulativeAverage: number
  cumulativeGrade: string
  cumulativePosition: number
  totalStudents: number
  subjectAverages: Array<{
    name: string
    average: number
    grade: string
    trend: "up" | "down" | "stable"
  }>
}

const mockCumulativeData: CumulativeData = {
  student: {
    name: "John Doe",
    class: "JSS 2A",
    admissionNumber: "VEA2025001",
    session: "2024/2025",
  },
  terms: [
    {
      term: "First Term",
      session: "2024/2025",
      subjects: [
        { name: "Mathematics", ca1: 18, ca2: 16, assignment: 8, exam: 51, total: 93, grade: "A+", position: 1 },
        { name: "English Language", ca1: 15, ca2: 17, assignment: 7, exam: 46, total: 85, grade: "A", position: 5 },
        { name: "Physics", ca1: 19, ca2: 18, assignment: 9, exam: 55, total: 101, grade: "A+", position: 1 },
      ],
      overallAverage: 93.0,
      overallGrade: "A+",
      classPosition: 2,
      totalStudents: 45,
    },
    {
      term: "Second Term",
      session: "2024/2025",
      subjects: [
        { name: "Mathematics", ca1: 17, ca2: 18, assignment: 9, exam: 48, total: 92, grade: "A+", position: 2 },
        { name: "English Language", ca1: 16, ca2: 15, assignment: 8, exam: 44, total: 83, grade: "A", position: 6 },
        { name: "Physics", ca1: 18, ca2: 19, assignment: 8, exam: 52, total: 97, grade: "A+", position: 1 },
      ],
      overallAverage: 90.7,
      overallGrade: "A+",
      classPosition: 3,
      totalStudents: 45,
    },
  ],
  cumulativeAverage: 91.8,
  cumulativeGrade: "A+",
  cumulativePosition: 2,
  totalStudents: 45,
  subjectAverages: [
    { name: "Mathematics", average: 92.5, grade: "A+", trend: "stable" },
    { name: "English Language", average: 84.0, grade: "A", trend: "down" },
    { name: "Physics", average: 99.0, grade: "A+", trend: "up" },
  ],
}

interface CumulativeReportProps {
  data: CumulativeData
}

export function CumulativeReport({ data }: CumulativeReportProps) {
  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // In a real app, this would generate and download a PDF
    alert("Cumulative report PDF download functionality would be implemented here")
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />
    }
  }

  return (
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
      <DialogHeader className="print:hidden">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-[#2d682d]">Cumulative Academic Report</DialogTitle>
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
          <div className="mt-4">
            <h2 className="text-xl font-semibold text-[#b29032]">CUMULATIVE ACADEMIC REPORT</h2>
            <p className="text-sm text-gray-600">{data.student.session} Academic Session</p>
          </div>
        </div>

        {/* Student Information */}
        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Student Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Name:</span>
                <p className="font-semibold text-[#2d682d]">{data.student.name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Class:</span>
                <p className="font-semibold">{data.student.class}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Admission No:</span>
                <p className="font-semibold">{data.student.admissionNumber}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Session:</span>
                <p className="font-semibold">{data.student.session}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cumulative Summary */}
        <Card className="border-[#b29032]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#b29032]">Cumulative Performance Summary</h3>
          </CardHeader>
          <CardContent>
            <div className="bg-[#b29032]/5 p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-[#2d682d]">{data.cumulativeAverage}%</p>
                  <p className="text-sm text-gray-600">Cumulative Average</p>
                </div>
                <div>
                  <Badge className={`${getGradeColor(data.cumulativeGrade)} text-2xl px-4 py-2 border-0`}>
                    {data.cumulativeGrade}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-2">Overall Grade</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#b29032]">
                    {data.cumulativePosition}/{data.totalStudents}
                  </p>
                  <p className="text-sm text-gray-600">Class Position</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subject Performance Trends */}
        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Subject Performance Trends</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.subjectAverages.map((subject, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{subject.name}</h4>
                    {getTrendIcon(subject.trend)}
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#2d682d]">{subject.average}%</p>
                    <Badge className={`${getGradeColor(subject.grade)} mt-2`}>{subject.grade}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Term-by-Term Performance */}
        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Term-by-Term Performance</h3>
          </CardHeader>
          <CardContent>
            {data.terms.map((term, termIndex) => (
              <div key={termIndex} className="mb-8 last:mb-0">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-[#b29032]" />
                  <h4 className="text-lg font-semibold text-[#b29032]">
                    {term.term} - {term.session}
                  </h4>
                  <Badge className={`${getGradeColor(term.overallGrade)} ml-auto`}>
                    {term.overallAverage}% - {term.overallGrade}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead className="bg-[#2d682d]/5">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold">Subject</th>
                        <th className="text-center py-2 px-3 font-semibold">1st C.A.</th>
                        <th className="text-center py-2 px-3 font-semibold">2nd C.A.</th>
                        <th className="text-center py-2 px-3 font-semibold">Assignment</th>
                        <th className="text-center py-2 px-3 font-semibold">Exam</th>
                        <th className="text-center py-2 px-3 font-semibold">Total</th>
                        <th className="text-center py-2 px-3 font-semibold">Grade</th>
                        <th className="text-center py-2 px-3 font-semibold">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {term.subjects.map((subject, subjectIndex) => (
                        <tr key={subjectIndex} className="border-t">
                          <td className="py-2 px-3 font-medium">{subject.name}</td>
                          <td className="text-center py-2 px-3">{subject.ca1}</td>
                          <td className="text-center py-2 px-3">{subject.ca2}</td>
                          <td className="text-center py-2 px-3">{subject.assignment}</td>
                          <td className="text-center py-2 px-3">{subject.exam}</td>
                          <td className="text-center py-2 px-3 font-semibold">{subject.total}</td>
                          <td className="text-center py-2 px-3">
                            <Badge className={`${getGradeColor(subject.grade)} text-xs`}>{subject.grade}</Badge>
                          </td>
                          <td className="text-center py-2 px-3 font-medium">{subject.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 bg-[#2d682d]/5 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span>
                      Term Average: <strong>{term.overallAverage}%</strong>
                    </span>
                    <span>
                      Class Position:{" "}
                      <strong>
                        {term.classPosition}/{term.totalStudents}
                      </strong>
                    </span>
                    <Badge className={getGradeColor(term.overallGrade)}>{term.overallGrade}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center border-t-2 border-[#2d682d] pt-6">
          <p className="text-xs text-gray-500 mb-2">
            This cumulative report is automatically generated based on term results
          </p>
          <div className="text-xs text-gray-400">
            <p>Victory Educational Academy • Excellence in Education • www.vea2025.edu.ng</p>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

export function CumulativeReportTrigger({ children, hasAccess }: { children: React.ReactNode; hasAccess: boolean }) {
  if (!hasAccess) {
    return <div>{children}</div>
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <CumulativeReport data={mockCumulativeData} />
    </Dialog>
  )
}
