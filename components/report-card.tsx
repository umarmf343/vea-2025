"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GraduationCap, Download, Printer, Award, Calendar, MapPin, Phone, Mail } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"

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

interface ReportBranding {
  schoolName?: string
  address?: string
  logo?: string | null
  headmasterSignature?: string | null
  headmasterName?: string
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
  branding?: ReportBranding
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
  branding: {
    schoolName: "Victory Educational Academy",
    address: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
    headmasterName: "Dr. Emmanuel Adebayo",
  },
}

interface ReportCardProps {
  data: ReportCardData
  isOpen: boolean
  onClose: () => void
}

export function ReportCard({ data, isOpen, onClose }: ReportCardProps) {
  const branding = useBranding()

  const pickText = (overrideValue: string | undefined, fallbackValue: string) =>
    overrideValue && overrideValue.trim().length > 0 ? overrideValue : fallbackValue

  const pickOptional = (overrideValue: string | null | undefined, fallbackValue: string | null) => {
    if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
      return overrideValue
    }
    return fallbackValue
  }

  const resolvedSchoolName = pickText(data.branding?.schoolName, branding.schoolName)
  const resolvedAddress = pickText(data.branding?.address, branding.schoolAddress)
  const resolvedLogo = pickOptional(data.branding?.logo ?? null, branding.logoUrl)
  const resolvedSignature = pickOptional(data.branding?.headmasterSignature ?? null, branding.signatureUrl)
  const resolvedHeadmasterName = pickText(data.branding?.headmasterName, branding.headmasterName)

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
      <DialogContent className="max-w-[230mm] border-none bg-transparent p-0 shadow-none focus-visible:outline-none print:m-0 print:max-w-none print:rounded-none print:border-none">
        <DialogHeader className="flex flex-col gap-3 px-6 pt-6 pb-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-slate-800">Academic Report Card</DialogTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} size="sm" className="bg-[#b29032] px-3 text-xs font-medium text-white hover:bg-[#8a6b25]">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handlePrint} size="sm" variant="outline" className="border-slate-300 px-3 text-xs font-medium text-slate-700">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 print:p-0">
          <div className="mx-auto w-full max-w-[210mm] rounded-xl border border-slate-200 bg-white p-6 text-[13px] leading-tight text-slate-800 shadow-lg transition-shadow md:p-8 print:w-[210mm] print:max-w-none print:rounded-none print:border print:border-slate-300 print:p-[16mm] print:shadow-none">
            <div className="space-y-6">
              <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-4 text-center md:text-left">
                  <div className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-200 bg-white">
                    {resolvedLogo ? (
                      <img src={resolvedLogo} alt={`${resolvedSchoolName} logo`} className="h-14 w-14 object-contain" />
                    ) : (
                      <GraduationCap className="h-10 w-10 text-[#b29032]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h1 className="text-xl font-semibold uppercase tracking-[0.18em] text-slate-900">
                      {resolvedSchoolName}
                    </h1>
                    <p className="text-sm text-slate-600">{resolvedAddress}</p>
                    {branding.defaultRemark ? (
                      <p className="text-xs text-slate-500">{branding.defaultRemark}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-sm font-medium text-slate-700 md:items-end">
                  <span className="uppercase tracking-[0.2em] text-slate-700">Academic Report Card</span>
                  <span className="text-xs text-slate-500">
                    {data.student.session} • {data.student.term}
                  </span>
                </div>
              </header>

              <section className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-700">Student Information</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Name</p>
                      <p className="font-semibold text-slate-800">{data.student.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Admission No.</p>
                      <p className="font-semibold text-slate-800">{data.student.admissionNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Class</p>
                      <p className="font-semibold text-slate-800">
                        {data.student.class} – {data.student.section}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date of Birth</p>
                      <p className="font-semibold text-slate-800">{data.student.dateOfBirth}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Session</p>
                      <p className="font-semibold text-slate-800">{data.student.session}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Term</p>
                      <p className="font-semibold text-slate-800">{data.student.term}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {data.student.address}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {data.student.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {data.student.email}
                    </span>
                  </div>
                </div>
                <div className="flex items-stretch justify-center">
                  <div className="flex w-full max-w-[140px] flex-col items-center rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-center">
                    <Avatar className="h-20 w-20 border border-slate-200 bg-white">
                      <AvatarImage src={data.student.avatar || "/placeholder.svg"} alt={data.student.name} />
                      <AvatarFallback className="bg-[#2d682d] text-lg font-semibold text-white">
                        {data.student.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Student Passport</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <Award className="h-4 w-4 text-[#2d682d]" />
                  Academic Performance
                </div>
                <div className="overflow-x-auto px-3 pb-3">
                  <table className="w-full border-collapse text-xs text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-600">
                        <th className="py-2 pr-2 text-left">Subject</th>
                        <th className="px-2 py-2 text-center">1st Test (20)</th>
                        <th className="px-2 py-2 text-center">2nd Test (20)</th>
                        <th className="px-2 py-2 text-center">Exam (60)</th>
                        <th className="px-2 py-2 text-center">Total (100)</th>
                        <th className="px-2 py-2 text-center">Grade</th>
                        <th className="px-2 py-2 text-center">Position</th>
                        <th className="py-2 pl-2 text-left">Teacher&apos;s Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((subject, index) => (
                        <tr key={index} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-2 font-semibold text-slate-800">{subject.name}</td>
                          <td className="px-2 py-2 text-center font-medium">{subject.firstTest}</td>
                          <td className="px-2 py-2 text-center font-medium">{subject.secondTest}</td>
                          <td className="px-2 py-2 text-center font-medium">{subject.exam}</td>
                          <td className="px-2 py-2 text-center font-semibold text-slate-900">{subject.total}</td>
                          <td className="px-2 py-2 text-center">
                            <Badge className={`${getGradeColor(subject.grade)} border-0 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide`}>
                              {subject.grade}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-center font-medium">{subject.position}</td>
                          <td className="py-2 pl-2 text-left text-[11px] text-slate-600">{subject.teacherComment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#b29032]/40 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-[#b29032]">Overall Performance</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Marks</p>
                      <p className="text-lg font-semibold text-slate-900">{data.overallPerformance.totalMarks}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Obtained Marks</p>
                      <p className="text-lg font-semibold text-[#b29032]">{data.overallPerformance.obtainedMarks}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Percentage</p>
                      <p className="text-lg font-semibold text-slate-900">{data.overallPerformance.percentage}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Class Position</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {data.overallPerformance.position} of {data.overallPerformance.totalStudents}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Badge className={`${getGradeColor(data.overallPerformance.grade)} border-0 px-4 py-1 text-sm font-semibold uppercase tracking-wide`}>
                      Grade {data.overallPerformance.grade}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-[#2d682d]/40 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#2d682d]">
                    <Calendar className="h-4 w-4" />
                    Attendance Summary
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="rounded-md bg-[#2d682d]/5 p-3">
                      <p className="text-lg font-semibold text-[#2d682d]">{data.attendance.totalDays}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Days</p>
                    </div>
                    <div className="rounded-md bg-emerald-50 p-3">
                      <p className="text-lg font-semibold text-emerald-700">{data.attendance.presentDays}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Present</p>
                    </div>
                    <div className="rounded-md bg-rose-50 p-3">
                      <p className="text-lg font-semibold text-rose-600">{data.attendance.absentDays}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Absent</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 p-3 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance Rate</p>
                    <p className="text-lg font-semibold text-[#2d682d]">{data.attendance.percentage}%</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-[#2d682d]">Class Teacher&apos;s Comment</h3>
                  <p className="mt-2 text-sm italic text-slate-700">{data.classTeacherComment}</p>
                  <div className="mt-4 grid gap-2 text-[11px] text-slate-500">
                    <div className="h-8 border-b border-dashed border-slate-400"></div>
                    <span>Signature</span>
                    <div className="h-8 border-b border-dashed border-slate-400"></div>
                    <span>Date</span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#b29032]/40 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-[#b29032]">Principal&apos;s Comment</h3>
                  <p className="mt-2 text-sm italic text-slate-700">{data.principalComment}</p>
                </div>
              </section>

              <section className="flex flex-col gap-6 border-t border-slate-200 pt-6 md:flex-row md:items-end md:justify-between">
                <div className="text-center md:text-left">
                  <div className="mb-2 h-12 w-48 border-b border-slate-400"></div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Class Teacher</p>
                </div>
                <div className="flex flex-col items-center text-center md:items-end md:text-right">
                  {resolvedSignature ? (
                    <img
                      src={resolvedSignature}
                      alt={`${resolvedHeadmasterName} signature`}
                      className="mb-2 h-12 w-48 object-contain"
                    />
                  ) : (
                    <div className="mb-2 h-12 w-48 border-b border-slate-400"></div>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {resolvedHeadmasterName.toUpperCase()}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Headmaster</p>
                </div>
              </section>

              <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Next Term Begins: {data.nextTermBegins}</p>
                <p className="mt-1">For enquiries, please contact the school administration.</p>
                <p className="mt-1 text-[11px] text-slate-500">{resolvedSchoolName} • {resolvedAddress}</p>
              </footer>
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
