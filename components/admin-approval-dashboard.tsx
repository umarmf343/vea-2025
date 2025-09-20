"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Download, Check, X, Calendar, Clock, User, BookOpen } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"

interface StudentReportCard {
  studentId: string
  studentName: string
  class: string
  term: string
  session: string
  status: "draft" | "pending" | "approved" | "revoked"
  teacherName: string
  submittedDate: string
  message?: string
  subjects: string[]
}

export function AdminApprovalDashboard() {
  const [reportCards, setReportCards] = useState<StudentReportCard[]>([])
  const [filteredReports, setFilteredReports] = useState<StudentReportCard[]>([])
  const [revokeMessage, setRevokeMessage] = useState("")
  const [selectedReport, setSelectedReport] = useState<StudentReportCard | null>(null)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [submissionDeadline, setSubmissionDeadline] = useState("")
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterClass, setFilterClass] = useState<string>("all")

  const mockStudents = [
    { id: "1", name: "John Doe", class: "JSS1A" },
    { id: "2", name: "Jane Smith", class: "JSS1A" },
    { id: "3", name: "Mike Johnson", class: "JSS1B" },
    { id: "4", name: "Sarah Wilson", class: "JSS2A" },
    { id: "5", name: "David Brown", class: "JSS2B" },
  ]

  useEffect(() => {
    loadReportCards()
    const savedDeadline = safeStorage.getItem("reportCardDeadline")
    if (savedDeadline) {
      setSubmissionDeadline(savedDeadline)
    }
  }, [])

  useEffect(() => {
    filterReportCards()
  }, [reportCards, filterStatus, filterClass])

  const loadReportCards = () => {
    const savedStatus = safeStorage.getItem("reportCardStatus")
    const reportCardData: StudentReportCard[] = []

    mockStudents.forEach((student) => {
      const key = `${student.id}-2024-1st-2024/2025`
      let status = "draft"
      let message = ""
      let submittedDate = ""

      if (savedStatus) {
        const statusData = JSON.parse(savedStatus)
        if (statusData[key]) {
          status = statusData[key].status
          message = statusData[key].message || ""
          submittedDate = statusData[key].submittedDate || new Date().toLocaleDateString()
        }
      }

      reportCardData.push({
        studentId: student.id,
        studentName: student.name,
        class: student.class,
        term: "1st Term",
        session: "2024/2025",
        status: status as "draft" | "pending" | "approved" | "revoked",
        teacherName: "Class Teacher",
        submittedDate: submittedDate || new Date().toLocaleDateString(),
        message,
        subjects: ["Mathematics", "English", "Science", "Social Studies"],
      })
    })

    setReportCards(reportCardData)
  }

  const filterReportCards = () => {
    let filtered = reportCards

    if (filterStatus !== "all") {
      filtered = filtered.filter((report) => report.status === filterStatus)
    }

    if (filterClass !== "all") {
      filtered = filtered.filter((report) => report.class === filterClass)
    }

    setFilteredReports(filtered)
  }

  const handleSetDeadline = () => {
    if (!submissionDeadline) {
      alert("Please select a deadline date.")
      return
    }

    safeStorage.setItem("reportCardDeadline", submissionDeadline)
    setShowDeadlineDialog(false)
    alert("Report card submission deadline has been set successfully!")
  }

  const isDeadlinePassed = () => {
    if (!submissionDeadline) return false
    return new Date() > new Date(submissionDeadline)
  }

  const handleApprove = (studentId: string) => {
    const key = `${studentId}-2024-1st-2024/2025`
    const savedStatus = JSON.parse(safeStorage.getItem("reportCardStatus") || "{}")
    savedStatus[key] = {
      status: "approved",
      submittedDate: new Date().toLocaleDateString(),
    }
    safeStorage.setItem("reportCardStatus", JSON.stringify(savedStatus))

    const approvedReports = JSON.parse(safeStorage.getItem("approvedReports") || "[]")
    if (!approvedReports.includes(studentId)) {
      approvedReports.push(studentId)
    }
    safeStorage.setItem("approvedReports", JSON.stringify(approvedReports))

    loadReportCards()
    alert("Report card approved and made available to parents!")
  }

  const handleRevoke = () => {
    if (!selectedReport || !revokeMessage.trim()) {
      alert("Please provide a reason for revoking the report card.")
      return
    }

    const key = `${selectedReport.studentId}-2024-1st-2024/2025`
    const savedStatus = JSON.parse(safeStorage.getItem("reportCardStatus") || "{}")
    savedStatus[key] = {
      status: "revoked",
      message: revokeMessage,
      submittedDate: new Date().toLocaleDateString(),
    }
    safeStorage.setItem("reportCardStatus", JSON.stringify(savedStatus))

    setShowRevokeDialog(false)
    setRevokeMessage("")
    setSelectedReport(null)
    loadReportCards()
    alert("Report card revoked and sent back to teacher with feedback.")
  }

  const handleDownload = (report: StudentReportCard) => {
    alert(`Downloading report card for ${report.studentName} (${report.class})`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "approved":
        return "bg-green-100 text-green-800"
      case "revoked":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getUniqueClasses = () => {
    const classes = [...new Set(reportCards.map((report) => report.class))]
    return classes.sort()
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold">Report Card Approval Center</h1>
        <p className="text-white/90">Review and approve student report cards submitted by teachers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Submission Deadline Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Current Deadline:</span>
                <span className="font-semibold">
                  {submissionDeadline ? new Date(submissionDeadline).toLocaleDateString() : "Not Set"}
                </span>
              </div>
              {submissionDeadline && (
                <Badge variant={isDeadlinePassed() ? "destructive" : "secondary"}>
                  {isDeadlinePassed() ? "Deadline Passed" : "Active"}
                </Badge>
              )}
            </div>
            <Button onClick={() => setShowDeadlineDialog(true)} variant="outline">
              Set Deadline
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter Report Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="class-filter">Filter by Class</Label>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {getUniqueClasses().map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">No report cards match the current filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={`${report.studentId}-${report.term}-${report.session}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="bg-[#2d682d] text-white p-2 rounded-full">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.studentName}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {report.class}
                        </span>
                        <span>
                          {report.term}, {report.session}
                        </span>
                        <span>Teacher: {report.teacherName}</span>
                      </CardDescription>
                      <div className="mt-1 text-xs text-gray-500">Subjects: {report.subjects.join(", ")}</div>
                      {report.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <strong>Admin Feedback:</strong> {report.message}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className={getStatusColor(report.status)}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(report)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  {report.status === "pending" && (
                    <>
                      <Button
                        onClick={() => handleApprove(report.studentId)}
                        size="sm"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedReport(report)
                          setShowRevokeDialog(true)
                        }}
                        variant="destructive"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showDeadlineDialog} onOpenChange={setShowDeadlineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Report Card Submission Deadline</DialogTitle>
            <DialogDescription>Set the deadline for teachers to submit report cards for approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deadline">Submission Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadlineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetDeadline}>Set Deadline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Report Card</DialogTitle>
            <DialogDescription>
              Please provide a reason for revoking this report card. The teacher will see this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Reason for Revocation</Label>
              <Textarea
                id="message"
                value={revokeMessage}
                onChange={(e) => setRevokeMessage(e.target.value)}
                placeholder="Explain why this report card needs to be revised..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke}>
              Revoke Report Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
