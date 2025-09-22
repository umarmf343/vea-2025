"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, CheckCircle, Users, ArrowUp, Calendar, GraduationCap } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { dbManager } from "@/lib/database-manager"

interface Student {
  id: string
  name: string
  currentClass: string
  nextClass: string
  academicAverage: number
  attendanceRate: number
  status: "eligible" | "review" | "repeat"
  remarks?: string
}

interface PromotionCriteria {
  minimumAverage: number
  minimumAttendance: number
  currentSession: string
  nextSession: string
}

export function AutomaticPromotionSystem() {
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [promotionCriteria, setPromotionCriteria] = useState<PromotionCriteria>({
    minimumAverage: 50,
    minimumAttendance: 75,
    currentSession: "2024/2025",
    nextSession: "2025/2026",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [promotionResults, setPromotionResults] = useState<Student[]>([])
  const [showResults, setShowResults] = useState(false)
  const [classes, setClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classData = await dbManager.getClasses()
        setClasses(classData.map((c) => c.name))
      } catch (error) {
        console.error("Error loading classes:", error)
        // Fallback to default classes
        setClasses([
          "JSS 1A",
          "JSS 1B",
          "JSS 2A",
          "JSS 2B",
          "JSS 3A",
          "JSS 3B",
          "SS 1A",
          "SS 1B",
          "SS 2A",
          "SS 2B",
          "SS 3A",
          "SS 3B",
        ])
      } finally {
        setLoading(false)
      }
    }

    loadClasses()

    // Real-time listeners for data changes
    const handleDataUpdate = () => {
      if (selectedClass && showResults) {
        handlePromotionAnalysis()
      }
    }

    dbManager.on("studentUpdated", handleDataUpdate)
    dbManager.on("marksUpdated", handleDataUpdate)
    dbManager.on("attendanceUpdated", handleDataUpdate)

    return () => {
      dbManager.off("studentUpdated", handleDataUpdate)
      dbManager.off("marksUpdated", handleDataUpdate)
      dbManager.off("attendanceUpdated", handleDataUpdate)
    }
  }, [selectedClass, showResults])

  const handlePromotionAnalysis = async () => {
    if (!selectedClass) return

    setIsProcessing(true)

    try {
      // Get real student data for the selected class
      const students = await dbManager.getStudentsByClass(selectedClass)

      // Process each student for promotion eligibility
      const results: Student[] = []

      for (const student of students) {
        // Get academic performance data
        const academicData = await dbManager.getStudentAcademicData(student.id)
        const attendanceData = await dbManager.getStudentAttendance(student.id)

        const currentClass = student.class ?? student.className ?? student.metadata?.className ?? selectedClass

        // Calculate academic average from all subjects
        const academicAverage =
          academicData.length > 0
            ? academicData.reduce((sum, subject) => sum + subject.totalPercentage, 0) / academicData.length
            : 0

        // Calculate attendance rate
        const attendanceRate =
          typeof attendanceData?.percentage === "number"
            ? attendanceData.percentage
            : attendanceData?.totalDays > 0
              ? (attendanceData.presentDays / attendanceData.totalDays) * 100
              : 0

        // Determine promotion status
        let status: "eligible" | "review" | "repeat" = "eligible"
        let remarks = ""
        let nextClass = getNextClass(currentClass)

        if (academicAverage < promotionCriteria.minimumAverage) {
          if (academicAverage < 40) {
            status = "repeat"
            remarks = "Academic average below 40%"
            nextClass = currentClass
          } else {
            status = "review"
            remarks = "Academic average below minimum requirement"
          }
        }

        if (attendanceRate < promotionCriteria.minimumAttendance) {
          if (status === "eligible") {
            status = "review"
            remarks = "Attendance below minimum requirement"
          } else {
            remarks += " and low attendance"
          }
        }

        results.push({
          id: student.id,
          name: student.name,
          currentClass: currentClass,
          nextClass,
          academicAverage: Math.round(academicAverage),
          attendanceRate: Math.round(attendanceRate),
          status,
          remarks: remarks || undefined,
        })
      }

      setPromotionResults(results)
      setShowResults(true)

      // Save promotion analysis to database
      await dbManager.savePromotionAnalysis({
        class: selectedClass,
        session: promotionCriteria.currentSession,
        criteria: promotionCriteria,
        results,
        analyzedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error analyzing promotions:", error)
      alert("Error analyzing student promotions. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBatchPromotion = async () => {
    const eligibleStudents = promotionResults.filter((s) => s.status === "eligible")

    if (eligibleStudents.length === 0) return

    try {
      setIsProcessing(true)

      // Update student records in database
      for (const student of eligibleStudents) {
        await dbManager.promoteStudent(student.id, {
          fromClass: student.currentClass,
          toClass: student.nextClass,
          session: promotionCriteria.nextSession,
          promotedAt: new Date().toISOString(),
        })
      }

      // Save promotion batch record
      await dbManager.saveBatchPromotion({
        class: selectedClass,
        session: promotionCriteria.currentSession,
        nextSession: promotionCriteria.nextSession,
        promotedStudents: eligibleStudents.map((s) => s.id),
        promotedAt: new Date().toISOString(),
      })

      alert(`Successfully promoted ${eligibleStudents.length} students to the next class!`)

      // Refresh the analysis
      await handlePromotionAnalysis()
    } catch (error) {
      console.error("Error promoting students:", error)
      alert("Error promoting students. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper function to determine next class
  const getNextClass = (currentClass: string): string => {
    if (!currentClass) {
      return "Graduate"
    }

    const classMap: { [key: string]: string } = {
      JSS1A: "JSS 2A",
      JSS1B: "JSS 2B",
      JSS2A: "JSS 3A",
      JSS2B: "JSS 3B",
      JSS3A: "SS 1A",
      JSS3B: "SS 1B",
      SS1A: "SS 2A",
      SS1B: "SS 2B",
      SS2A: "SS 3A",
      SS2B: "SS 3B",
      SS3A: "Graduate",
      SS3B: "Graduate",
    }
    const normalized = currentClass.replace(/\s+/g, "").toUpperCase()
    return classMap[normalized] ?? currentClass
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "eligible":
        return "bg-green-100 text-green-800"
      case "review":
        return "bg-yellow-100 text-yellow-800"
      case "repeat":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "eligible":
        return <CheckCircle className="h-4 w-4" />
      case "review":
        return <AlertCircle className="h-4 w-4" />
      case "repeat":
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const eligibleCount = promotionResults.filter((s) => s.status === "eligible").length
  const reviewCount = promotionResults.filter((s) => s.status === "review").length
  const repeatCount = promotionResults.filter((s) => s.status === "repeat").length

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d]"></div>
        <span className="ml-2">Loading promotion system...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-[#2d682d]" />
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Student Promotion System</h2>
          <p className="text-gray-600">Manage automatic student promotion for new academic session</p>
        </div>
      </div>

      {/* Promotion Criteria */}
      <Card className="border-[#2d682d]/20">
        <CardHeader>
          <CardTitle className="text-[#2d682d] flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Promotion Criteria
          </CardTitle>
          <CardDescription>Set the requirements for student promotion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Session</label>
              <Select
                value={promotionCriteria.currentSession}
                onValueChange={(value) => setPromotionCriteria((prev) => ({ ...prev, currentSession: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024/2025">2024/2025</SelectItem>
                  <SelectItem value="2023/2024">2023/2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Next Session</label>
              <Select
                value={promotionCriteria.nextSession}
                onValueChange={(value) => setPromotionCriteria((prev) => ({ ...prev, nextSession: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025/2026">2025/2026</SelectItem>
                  <SelectItem value="2024/2025">2024/2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Average (%)</label>
              <Select
                value={promotionCriteria.minimumAverage.toString()}
                onValueChange={(value) =>
                  setPromotionCriteria((prev) => ({ ...prev, minimumAverage: Number.parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="40">40%</SelectItem>
                  <SelectItem value="45">45%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="55">55%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Attendance (%)</label>
              <Select
                value={promotionCriteria.minimumAttendance.toString()}
                onValueChange={(value) =>
                  setPromotionCriteria((prev) => ({ ...prev, minimumAttendance: Number.parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="85">85%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Selection and Analysis */}
      <Card className="border-[#b29032]/20">
        <CardHeader>
          <CardTitle className="text-[#b29032] flex items-center gap-2">
            <Users className="h-5 w-5" />
            Promotion Analysis
          </CardTitle>
          <CardDescription>Select class and analyze student promotion eligibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
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
            <Button
              onClick={handlePromotionAnalysis}
              disabled={!selectedClass || isProcessing}
              className="bg-[#2d682d] hover:bg-[#1a4a1a]"
            >
              {isProcessing ? "Analyzing..." : "Analyze Promotion"}
            </Button>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2d682d]"></div>
                Processing student records...
              </div>
              <Progress value={75} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Eligible for Promotion</p>
                    <p className="text-2xl font-bold text-green-700">{eligibleCount}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600">Needs Review</p>
                    <p className="text-2xl font-bold text-yellow-700">{reviewCount}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">Repeat Class</p>
                    <p className="text-2xl font-bold text-red-700">{repeatCount}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Batch Actions */}
          {eligibleCount > 0 && (
            <Alert>
              <ArrowUp className="h-4 w-4" />
              <AlertTitle>Ready for Batch Promotion</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{eligibleCount} students are eligible for automatic promotion.</span>
                <Button
                  onClick={handleBatchPromotion}
                  disabled={isProcessing}
                  className="bg-[#2d682d] hover:bg-[#1a4a1a]"
                >
                  {isProcessing ? "Promoting..." : "Promote All Eligible Students"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle>Promotion Results - {selectedClass}</CardTitle>
              <CardDescription>Individual student promotion status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {promotionResults.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-gray-600">ID: {student.id}</p>
                      </div>
                      <div className="text-sm">
                        <p>Academic: {student.academicAverage}%</p>
                        <p>Attendance: {student.attendanceRate}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="font-medium">
                          {student.currentClass} → {student.nextClass}
                        </p>
                        {student.remarks && <p className="text-gray-600">{student.remarks}</p>}
                      </div>
                      <Badge className={`${getStatusColor(student.status)} flex items-center gap-1`}>
                        {getStatusIcon(student.status)}
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
