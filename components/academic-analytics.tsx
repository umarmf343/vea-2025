"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"
import { TrendingUp, Users, Award, Download, Printer, Target, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"

interface ClassPerformanceEntry {
  class: string
  average: number
  students: number
  topScore: number
  lowScore: number
}

interface SubjectPerformanceEntry {
  subject: string
  average: number
  passRate: number
  excellentRate?: number
  teacher?: string | null
}

interface TermComparisonEntry {
  term: string
  average: number
  passRate: number
  attendance: number
}

interface TopPerformerEntry {
  name: string
  class: string
  subjects: number
  average: number
}

interface PerformanceRadarEntry {
  subject: string
  average: number
  passRate: number
  excellenceRate: number
}

interface SummaryStats {
  overallAverage: number
  totalStudents: number
  passRate: number
  excellenceRate: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function parseClassPerformance(entries: unknown): ClassPerformanceEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map((entry) => {
    if (!isRecord(entry)) {
      return {
        class: "Class",
        average: 0,
        students: 0,
        topScore: 0,
        lowScore: 0,
      }
    }

    return {
      class: typeof entry.class === "string" ? entry.class : "Class",
      average: asNumber(entry.average),
      students: asNumber(entry.students),
      topScore: asNumber(entry.topScore),
      lowScore: asNumber(entry.lowScore),
    }
  })
}

function parseSubjectPerformance(entries: unknown): SubjectPerformanceEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map((entry) => {
    if (!isRecord(entry)) {
      return { subject: "Subject", average: 0, passRate: 0, excellentRate: 0, teacher: null }
    }

    return {
      subject: typeof entry.subject === "string" ? entry.subject : "Subject",
      average: asNumber(entry.average),
      passRate: asNumber(entry.passRate),
      excellentRate: asNumber(entry.excellentRate),
      teacher: typeof entry.teacher === "string" ? entry.teacher : null,
    }
  })
}

function parseTermComparison(entries: unknown): TermComparisonEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map((entry) => {
    if (!isRecord(entry)) {
      return { term: "Term", average: 0, passRate: 0, attendance: 0 }
    }

    return {
      term: typeof entry.term === "string" ? entry.term : "Term",
      average: asNumber(entry.average),
      passRate: asNumber(entry.passRate),
      attendance: asNumber(entry.attendance),
    }
  })
}

function parseTopPerformers(entries: unknown): TopPerformerEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map((entry) => {
    if (!isRecord(entry)) {
      return { name: "Student", class: "Class", subjects: 0, average: 0 }
    }

    return {
      name: typeof entry.name === "string" ? entry.name : "Student",
      class: typeof entry.class === "string" ? entry.class : "Class",
      subjects: asNumber(entry.subjects),
      average: asNumber(entry.average),
    }
  })
}

function parseRadarData(entries: unknown): PerformanceRadarEntry[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map((entry) => {
    if (!isRecord(entry)) {
      return { subject: "Subject", average: 0, passRate: 0, excellenceRate: 0 }
    }

    return {
      subject: typeof entry.subject === "string" ? entry.subject : "Subject",
      average: asNumber(entry.average),
      passRate: asNumber(entry.passRate),
      excellenceRate: asNumber(entry.excellenceRate),
    }
  })
}

function parseSummaryStats(value: unknown): SummaryStats {
  if (!isRecord(value)) {
    return { overallAverage: 0, totalStudents: 0, passRate: 0, excellenceRate: 0 }
  }

  return {
    overallAverage: asNumber(value.overallAverage),
    totalStudents: Math.max(0, Math.round(asNumber(value.totalStudents))),
    passRate: asNumber(value.passRate),
    excellenceRate: asNumber(value.excellenceRate),
  }
}

interface AcademicAnalyticsProps {
  userRole: string
}

export function AcademicAnalytics({ userRole }: AcademicAnalyticsProps) {
  const [selectedTerm, setSelectedTerm] = useState("current")
  const [selectedClass, setSelectedClass] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Real-time data states
  const [classPerformance, setClassPerformance] = useState<ClassPerformanceEntry[]>([])
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformanceEntry[]>([])
  const [termComparison, setTermComparison] = useState<TermComparisonEntry[]>([])
  const [topPerformers, setTopPerformers] = useState<TopPerformerEntry[]>([])
  const [performanceRadarData, setPerformanceRadarData] = useState<PerformanceRadarEntry[]>([])
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    overallAverage: 0,
    totalStudents: 0,
    passRate: 0,
    excellenceRate: 0,
  })
  const { toast } = useToast()
  const normalizedRole = userRole.toLowerCase()
  const canExportReports = !["student", "parent"].includes(normalizedRole)

  const loadAcademicData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ term: selectedTerm, class: selectedClass })
      const response = await fetch(`/api/analytics?${params.toString()}`, { cache: "no-store" })

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics (${response.status})`)
      }

      const data: unknown = await response.json()
      const analyticsRaw = isRecord(data) ? data.analytics : undefined
      const analytics = isRecord(analyticsRaw) ? analyticsRaw : {}

      setClassPerformance(parseClassPerformance(analytics.classPerformance))
      setSubjectPerformance(parseSubjectPerformance(analytics.subjectPerformance))
      setTermComparison(parseTermComparison(analytics.termComparison))
      setTopPerformers(parseTopPerformers(analytics.topPerformers))
      setPerformanceRadarData(parseRadarData(analytics.performanceRadarData))
      setSummaryStats(parseSummaryStats(analytics.summaryStats))
    } catch (err) {
      logger.error("Error loading academic analytics data", { error: err })
      setError("Failed to load academic analytics data")
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedTerm])

  useEffect(() => {
    void loadAcademicData()
  }, [loadAcademicData])

  const handlePrint = () => {
    if (!canExportReports) {
      toast({
        variant: "destructive",
        title: "Export restricted",
        description: "Only staff accounts can print analytics reports.",
      })
      return
    }

    const win =
      typeof globalThis !== "undefined" && typeof (globalThis as Window & { print?: () => void }).print === "function"
        ? (globalThis as Window & { print: () => void })
        : null

    if (!win) {
      toast({
        variant: "destructive",
        title: "Print unavailable",
        description: "Printing is only supported within the browser environment.",
      })
      return
    }

    win.print()
  }

  const handleDownload = async () => {
    if (!canExportReports) {
      toast({
        variant: "destructive",
        title: "Export restricted",
        description: "Only staff accounts can export analytics reports.",
      })
      return
    }

    const doc =
      typeof globalThis !== "undefined" && "document" in globalThis
        ? (globalThis as typeof globalThis & { document: Document }).document
        : null
    if (!doc) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: "Analytics export is only available within the browser environment.",
      })
      return
    }

    try {
      const reportData = {
        term: selectedTerm,
        class: selectedClass,
        classPerformance,
        subjectPerformance,
        termComparison,
        topPerformers,
        summaryStats,
        generatedAt: new Date().toISOString(),
      }

      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: selectedTerm,
          class: selectedClass,
          payload: reportData,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        const message = typeof payload.error === "string" ? payload.error : "Unable to persist analytics report"
        throw new Error(message)
      }

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = doc.createElement("a")
      anchor.href = url
      anchor.download = `academic-analytics-${selectedTerm}-${selectedClass}-${Date.now()}.json`
      doc.body.appendChild(anchor)
      anchor.click()
      doc.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast({
        title: "Analytics export ready",
        description: "The analytics report has been saved to your downloads as a JSON file.",
      })
    } catch (err) {
      logger.error("Error downloading analytics report", { error: err })
      toast({
        variant: "destructive",
        title: "Failed to export analytics",
        description: err instanceof Error ? err.message : "Failed to download analytics report",
      })
    }
  }

  const getPerformanceColor = (average: number) => {
    if (average >= 85) return "text-green-600 bg-green-50"
    if (average >= 75) return "text-blue-600 bg-blue-50"
    if (average >= 65) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#2d682d]" />
        <span className="ml-2 text-[#2d682d]">Loading academic analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadAcademicData} className="bg-[#2d682d] hover:bg-[#1e4a1e]">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Academic Performance Analytics</h2>
          <p className="text-gray-600">Class-wise and subject-wise performance analysis</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Term</SelectItem>
              <SelectItem value="last">Last Term</SelectItem>
              <SelectItem value="all">All Terms</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="jss1">JSS 1</SelectItem>
              <SelectItem value="jss2">JSS 2</SelectItem>
              <SelectItem value="jss3">JSS 3</SelectItem>
              <SelectItem value="ss1">SS 1</SelectItem>
              <SelectItem value="ss2">SS 2</SelectItem>
              <SelectItem value="ss3">SS 3</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none bg-transparent"
              disabled={!canExportReports}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleDownload}
              size="sm"
              className="bg-[#b29032] hover:bg-[#8a6b25] flex-1 sm:flex-none"
              disabled={!canExportReports}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{summaryStats.overallAverage.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Overall Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{summaryStats.totalStudents}</p>
                <p className="text-sm text-gray-600">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Award className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{summaryStats.passRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-600">{summaryStats.excellenceRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Excellence Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performers">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Class Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {classPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="class" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}%`, "Average"]} />
                      <Bar dataKey="average" fill="#2d682d" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No class performance data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Class Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {classPerformance.length > 0 ? (
                    classPerformance.map((classData, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">{classData.class}</h3>
                          <Badge className={getPerformanceColor(classData.average)}>{classData.average}%</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm text-gray-600">
                          <div>
                            <p className="font-medium">{classData.students}</p>
                            <p className="text-xs">Students</p>
                          </div>
                          <div>
                            <p className="font-medium text-green-600">{classData.topScore}%</p>
                            <p className="text-xs">Highest</p>
                          </div>
                          <div>
                            <p className="font-medium text-red-600">{classData.lowScore}%</p>
                            <p className="text-xs">Lowest</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No class data available for the selected filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Subject Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {performanceRadarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={performanceRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="Current Term" dataKey="A" stroke="#2d682d" fill="#2d682d" fillOpacity={0.3} />
                      <Radar name="Previous Term" dataKey="B" stroke="#b29032" fill="#b29032" fillOpacity={0.3} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No subject comparison data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Subject Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {subjectPerformance.length > 0 ? (
                    subjectPerformance.map((subject, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h3 className="font-medium">{subject.subject}</h3>
                            <p className="text-sm text-gray-600">{subject.teacher}</p>
                          </div>
                          <Badge className={getPerformanceColor(subject.average)}>{subject.average}%</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-green-600 font-medium">{subject.passRate}%</p>
                            <p className="text-xs text-gray-600">Pass Rate</p>
                          </div>
                          <div>
                            <p className="text-blue-600 font-medium">{subject.excellentRate}%</p>
                            <p className="text-xs text-gray-600">Excellence Rate</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No subject data available for the selected filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {termComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={termComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="term" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="#2d682d" strokeWidth={3} name="Average Score" />
                    <Line type="monotone" dataKey="passRate" stroke="#b29032" strokeWidth={3} name="Pass Rate" />
                    <Line type="monotone" dataKey="attendance" stroke="#4ade80" strokeWidth={3} name="Attendance" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  No trend data available for the selected filters
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d] flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Performing Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.length > 0 ? (
                  topPerformers.map((student, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-[#2d682d]/5 to-[#b29032]/5 rounded-lg border"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-[#2d682d] text-white rounded-full font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-[#2d682d]">{student.name}</h3>
                          <p className="text-sm text-gray-600">
                            {student.class} • {student.subjects} subjects
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-[#b29032] text-white text-lg px-4 py-2">{student.average}%</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No top performers data available for the selected filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
