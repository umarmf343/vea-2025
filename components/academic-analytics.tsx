"use client"

import { useState, useEffect } from "react"
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
import { dbManager } from "@/lib/database-manager"

interface AcademicAnalyticsProps {
  userRole: string
}

export function AcademicAnalytics({ userRole }: AcademicAnalyticsProps) {
  const [selectedTerm, setSelectedTerm] = useState("current")
  const [selectedClass, setSelectedClass] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Real-time data states
  const [classPerformance, setClassPerformance] = useState<any[]>([])
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([])
  const [termComparison, setTermComparison] = useState<any[]>([])
  const [topPerformers, setTopPerformers] = useState<any[]>([])
  const [performanceRadarData, setPerformanceRadarData] = useState<any[]>([])
  const [summaryStats, setSummaryStats] = useState({
    overallAverage: 0,
    totalStudents: 0,
    passRate: 0,
    excellenceRate: 0,
  })

  useEffect(() => {
    loadAcademicData()

    // Real-time listeners for data updates
    const handleDataUpdate = () => {
      loadAcademicData()
    }

    dbManager.on("academicDataUpdated", handleDataUpdate)
    dbManager.on("reportCardUpdated", handleDataUpdate)
    dbManager.on("marksUpdated", handleDataUpdate)

    return () => {
      dbManager.off("academicDataUpdated", handleDataUpdate)
      dbManager.off("reportCardUpdated", handleDataUpdate)
      dbManager.off("marksUpdated", handleDataUpdate)
    }
  }, [selectedTerm, selectedClass])

  const loadAcademicData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load academic analytics data from database
      const analytics = await dbManager.getAcademicAnalytics(selectedTerm, selectedClass)

      setClassPerformance(analytics.classPerformance || [])
      setSubjectPerformance(analytics.subjectPerformance || [])
      setTermComparison(analytics.termComparison || [])
      setTopPerformers(analytics.topPerformers || [])
      setPerformanceRadarData(analytics.performanceRadarData || [])
      setSummaryStats(
        analytics.summaryStats || {
          overallAverage: 0,
          totalStudents: 0,
          passRate: 0,
          excellenceRate: 0,
        },
      )
    } catch (err) {
      console.error("Error loading academic data:", err)
      setError("Failed to load academic analytics data")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
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

      await dbManager.saveAnalyticsReport(reportData)

      // Generate and download PDF
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `academic-analytics-${selectedTerm}-${selectedClass}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error downloading report:", err)
      alert("Failed to download analytics report")
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
            <Button onClick={handlePrint} size="sm" variant="outline" className="flex-1 sm:flex-none bg-transparent">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleDownload} size="sm" className="bg-[#b29032] hover:bg-[#8a6b25] flex-1 sm:flex-none">
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
