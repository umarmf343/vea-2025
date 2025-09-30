"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { dbManager } from "@/lib/database-manager"
import { Download, GraduationCap, Loader2, Printer, TrendingUp, Calendar } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"

interface CumulativeSubject {
  name: string
  ca1?: number
  ca2?: number
  assignment?: number
  exam?: number
  total: number
  grade: string
  position: number | null
}

interface CumulativeTerm {
  term: string
  session: string
  subjects: CumulativeSubject[]
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
}

interface SubjectAverage {
  name: string
  average: number
  grade: string
  trend: "up" | "down" | "stable"
}

interface CumulativeReportData {
  studentId: string
  studentName: string
  className: string
  session: string
  terms: CumulativeTerm[]
  cumulativeAverage: number
  cumulativeGrade: string
  cumulativePosition: number
  totalStudents: number
  subjectAverages: SubjectAverage[]
  updatedAt?: string
}

interface CumulativeReportProps {
  data: CumulativeReportData | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

const gradeColor = (grade: string) => {
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

const trendIcon = (trend: SubjectAverage["trend"]) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case "down":
      return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
    default:
      return <div className="h-4 w-4 bg-gray-400 rounded-full" />
  }
}

function CumulativeReport({ data, isLoading, error, onRetry }: CumulativeReportProps) {
  const branding = useBranding()
  const resolvedSchoolName = branding.schoolName
  const resolvedAddress = branding.schoolAddress
  const resolvedLogo = branding.logoUrl

  const handlePrint = () => window.print()

  if (isLoading) {
    return (
      <DialogContent className="max-w-5xl">
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating cumulative report...
        </div>
      </DialogContent>
    )
  }

  if (error) {
    return (
      <DialogContent className="max-w-3xl">
        <div className="text-center space-y-4 py-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </DialogContent>
    )
  }

  if (!data) {
    return (
      <DialogContent className="max-w-3xl">
        <div className="text-center space-y-4 py-6">
          <p className="text-sm text-gray-600">No cumulative report is available for this student.</p>
          <Button variant="outline" onClick={onRetry}>
            Refresh
          </Button>
        </div>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
      <DialogHeader className="print:hidden">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-[#2d682d]">Cumulative Academic Report</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#b29032] hover:bg-[#8a6b25] text-white" onClick={() => alert("PDF export will be connected to the reporting service.")}>
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
        <div className="text-center mb-8 border-b-2 border-[#2d682d] pb-6">
          <div className="flex items-center justify-center mb-4">
            {resolvedLogo ? (
              <img src={resolvedLogo} alt={`${resolvedSchoolName} logo`} className="h-20 w-20 object-contain" />
            ) : (
              <GraduationCap className="h-16 w-16 text-[#b29032]" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-[#2d682d] mb-2">{resolvedSchoolName}</h1>
          <p className="text-lg text-gray-600 mb-1">{resolvedAddress}</p>
          <p className="text-sm text-gray-500 italic">{branding.defaultRemark}</p>
          <div className="mt-4">
            <h2 className="text-xl font-semibold text-[#b29032]">CUMULATIVE ACADEMIC REPORT</h2>
            <p className="text-sm text-gray-600">{data.session} Academic Session</p>
          </div>
        </div>

        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Student Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Name:</span>
                <p className="font-semibold text-[#2d682d]">{data.studentName}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Class:</span>
                <p className="font-semibold">{data.className}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Student ID:</span>
                <p className="font-semibold">{data.studentId}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Session:</span>
                <p className="font-semibold">{data.session}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#b29032]">Cumulative Performance Summary</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-[#2d682d]">{data.cumulativeAverage}%</p>
                <p className="text-sm text-gray-600">Cumulative Average</p>
              </div>
              <div>
                <Badge className={`${gradeColor(data.cumulativeGrade)} text-2xl px-4 py-2 border-0`}>
                  {data.cumulativeGrade}
                </Badge>
                <p className="text-sm text-gray-600 mt-2">Overall Grade</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#b29032]">{data.cumulativePosition}/{data.totalStudents}</p>
                <p className="text-sm text-gray-600">Class Position</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Subject Performance Trends</h3>
          </CardHeader>
          <CardContent>
            {data.subjectAverages.length === 0 ? (
              <p className="text-sm text-gray-500">No subject trend data available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.subjectAverages.map((subject, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{subject.name}</h4>
                      {trendIcon(subject.trend)}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#2d682d]">{subject.average}%</p>
                      <Badge className={`${gradeColor(subject.grade)} mt-2`}>{subject.grade}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20 mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-[#2d682d]">Term-by-Term Performance</h3>
          </CardHeader>
          <CardContent>
            {data.terms.length === 0 ? (
              <p className="text-sm text-gray-500">No term records available.</p>
            ) : (
              data.terms.map((term, index) => (
                <div key={index} className="mb-8 last:mb-0">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-[#b29032]" />
                    <h4 className="text-lg font-semibold text-[#b29032]">
                      {term.term} - {term.session}
                    </h4>
                    <Badge className={`${gradeColor(term.overallGrade)} ml-auto`}>
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
                            <td className="text-center py-2 px-3">{subject.ca1 ?? "-"}</td>
                            <td className="text-center py-2 px-3">{subject.ca2 ?? "-"}</td>
                            <td className="text-center py-2 px-3">{subject.assignment ?? "-"}</td>
                            <td className="text-center py-2 px-3">{subject.exam ?? "-"}</td>
                            <td className="text-center py-2 px-3 font-semibold">{subject.total}</td>
                            <td className="text-center py-2 px-3">
                              <Badge className={`${gradeColor(subject.grade)} text-xs`}>{subject.grade}</Badge>
                            </td>
                            <td className="text-center py-2 px-3 font-medium">{subject.position ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-3 bg-[#2d682d]/5 rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                      <span>
                        Term Average: <strong>{term.overallAverage}%</strong>
                      </span>
                      <span>
                        Class Position: <strong>{term.classPosition}/{term.totalStudents}</strong>
                      </span>
                      <Badge className={gradeColor(term.overallGrade)}>{term.overallGrade}</Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

          <div className="text-center border-t-2 border-[#2d682d] pt-6">
            <p className="text-xs text-gray-500 mb-2">
              This cumulative report is automatically generated based on approved term results.
            </p>
            <div className="text-xs text-gray-400">
            <p>{resolvedSchoolName} • {resolvedAddress}</p>
            </div>
          </div>
      </div>
    </DialogContent>
  )
}

interface CumulativeReportTriggerProps {
  children: ReactNode
  hasAccess: boolean
  studentId: string
  className: string
  session?: string
  isReleased?: boolean
  onUnavailable?: (reason?: string) => void
}

export function CumulativeReportTrigger({
  children,
  hasAccess,
  studentId,
  className,
  session,
  isReleased,
  onUnavailable,
}: CumulativeReportTriggerProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<CumulativeReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    if (!studentId) {
      setError("Student information is incomplete.")
      setData(null)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const preferredSession =
        session ||
        ((await dbManager.getSystemSettings())?.academicYear as string | undefined) ||
        new Date().getFullYear().toString()
      const report = await dbManager.getStudentCumulativeReport(studentId, preferredSession)

      if (!report) {
        setData(null)
      } else {
        setData({ ...report, className })
      }
    } catch (err) {
      console.error("Failed to fetch cumulative report", err)
      setError("Unable to load cumulative report. Please try again later.")
      toast({
        title: "Unable to load cumulative report",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [studentId, session, className, toast])

  useEffect(() => {
    if (!open) {
      return
    }
    fetchReport()
  }, [open, fetchReport])

  if (!hasAccess) {
    return <div>{children}</div>
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && isReleased === false) {
      if (onUnavailable) {
        onUnavailable("The administrator hasn't released the cumulative report yet. Please check back later.")
      } else {
        toast({
          title: "Cumulative summary not published",
          description: "The administrator hasn't released the cumulative report yet. Please check back later.",
        })
      }
      return
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && <CumulativeReport data={data} isLoading={isLoading} error={error} onRetry={fetchReport} />}
    </Dialog>
  )
}
