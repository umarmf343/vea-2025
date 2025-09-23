"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Download, Check, X, Calendar, Clock, User, BookOpen, Loader2 } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"
import { TutorialLink } from "@/components/tutorial-link"
import {
  REPORT_CARD_WORKFLOW_EVENT,
  getWorkflowRecords,
  updateReportCardWorkflowStatus,
  type ReportCardWorkflowRecord,
} from "@/lib/report-card-workflow"
import { useToast } from "@/hooks/use-toast"

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Published" },
  { value: "revoked", label: "Needs Revision" },
]

const STATUS_STYLES: Record<ReportCardWorkflowRecord["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  pending: { label: "Pending Approval", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Published", className: "bg-green-100 text-green-800" },
  revoked: { label: "Needs Revision", className: "bg-red-100 text-red-800" },
}

const ADMIN_METADATA = { id: "admin-panel", name: "Administrator" }

const formatDate = (value?: string) => {
  if (!value) {
    return "—"
  }

  try {
    return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value))
  } catch (error) {
    return value
  }
}

export function AdminApprovalDashboard() {
  const { toast } = useToast()
  const [records, setRecords] = useState<ReportCardWorkflowRecord[]>([])
  const [filterStatus, setFilterStatus] = useState<string>("pending")
  const [filterClass, setFilterClass] = useState<string>("all")
  const [revokeMessage, setRevokeMessage] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<ReportCardWorkflowRecord | null>(null)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [submissionDeadline, setSubmissionDeadline] = useState("")
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false)
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null)

  const loadRecords = useCallback(() => {
    setRecords(getWorkflowRecords())
  }, [])

  useEffect(() => {
    loadRecords()
    const savedDeadline = safeStorage.getItem("reportCardDeadline")
    if (savedDeadline) {
      setSubmissionDeadline(savedDeadline)
    }
  }, [loadRecords])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ records?: ReportCardWorkflowRecord[] }>).detail
      if (Array.isArray(detail?.records)) {
        setRecords(detail.records)
      } else {
        loadRecords()
      }
    }

    window.addEventListener(REPORT_CARD_WORKFLOW_EVENT, handleUpdate as EventListener)
    return () => {
      window.removeEventListener(REPORT_CARD_WORKFLOW_EVENT, handleUpdate as EventListener)
    }
  }, [loadRecords])

  const actionableRecords = useMemo(
    () => records.filter((record) => record.status !== "draft"),
    [records],
  )

  const classOptions = useMemo(() => {
    const classes = new Set<string>()
    actionableRecords.forEach((record) => {
      if (record.className) {
        classes.add(record.className)
      }
    })
    return Array.from(classes).sort()
  }, [actionableRecords])

  const filteredRecords = useMemo(() => {
    let scoped = actionableRecords

    if (filterStatus !== "all") {
      scoped = scoped.filter((record) => record.status === filterStatus)
    }

    if (filterClass !== "all") {
      scoped = scoped.filter((record) => record.className === filterClass)
    }

    return scoped
  }, [actionableRecords, filterClass, filterStatus])

  const stats = useMemo(
    () => ({
      pending: actionableRecords.filter((record) => record.status === "pending").length,
      published: actionableRecords.filter((record) => record.status === "approved").length,
      revisions: actionableRecords.filter((record) => record.status === "revoked").length,
    }),
    [actionableRecords],
  )

  const handleSetDeadline = useCallback(() => {
    if (!submissionDeadline) {
      toast({
        variant: "destructive",
        title: "Select a deadline",
        description: "Please pick a deadline date before saving.",
      })
      return
    }

    safeStorage.setItem("reportCardDeadline", submissionDeadline)
    setShowDeadlineDialog(false)
    toast({
      title: "Deadline saved",
      description: "Teachers will see the updated submission deadline.",
    })
  }, [submissionDeadline, toast])

  const isDeadlinePassed = useMemo(() => {
    if (!submissionDeadline) {
      return false
    }
    return new Date() > new Date(submissionDeadline)
  }, [submissionDeadline])

  const handleDownload = useCallback(
    (record: ReportCardWorkflowRecord) => {
      toast({
        title: "Preparing report",
        description: `Generating report card for ${record.studentName}.`,
      })
    },
    [toast],
  )

  const handleApprove = useCallback(
    (record: ReportCardWorkflowRecord) => {
      try {
        setProcessingRecordId(record.id)
        const updated = updateReportCardWorkflowStatus({
          studentId: record.studentId,
          className: record.className,
          subject: record.subject,
          term: record.term,
          session: record.session,
          status: "approved",
          adminId: ADMIN_METADATA.id,
          adminName: ADMIN_METADATA.name,
        })
        setRecords(updated)
        toast({
          title: "Report published",
          description: `${record.studentName}'s results are now available to parents.`,
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Unable to publish",
          description: error instanceof Error ? error.message : "Please try again.",
        })
      } finally {
        setProcessingRecordId(null)
      }
    },
    [toast],
  )

  const handleOpenRevoke = useCallback((record: ReportCardWorkflowRecord) => {
    setSelectedRecord(record)
    setRevokeMessage(record.feedback ?? "")
    setShowRevokeDialog(true)
  }, [])

  const handleConfirmRevoke = useCallback(() => {
    if (!selectedRecord) {
      return
    }

    if (!revokeMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Feedback required",
        description: "Provide guidance so the teacher knows what to correct.",
      })
      return
    }

    try {
      setProcessingRecordId(selectedRecord.id)
      const updated = updateReportCardWorkflowStatus({
        studentId: selectedRecord.studentId,
        className: selectedRecord.className,
        subject: selectedRecord.subject,
        term: selectedRecord.term,
        session: selectedRecord.session,
        status: "revoked",
        feedback: revokeMessage.trim(),
        adminId: ADMIN_METADATA.id,
        adminName: ADMIN_METADATA.name,
      })
      setRecords(updated)
      setShowRevokeDialog(false)
      setSelectedRecord(null)
      setRevokeMessage("")
      toast({
        title: "Sent for revision",
        description: "The teacher has been notified to update this report card.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to send back",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setProcessingRecordId(null)
    }
  }, [revokeMessage, selectedRecord, toast])

  const closeRevokeDialog = useCallback(() => {
    setShowRevokeDialog(false)
    setSelectedRecord(null)
    setRevokeMessage("")
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Report Card Approval Center</h1>
            <p className="text-white/90">
              {stats.pending} pending • {stats.revisions} needs revision • {stats.published} published
            </p>
          </div>
          <TutorialLink
            href="https://www.youtube.com/watch?v=ysz5S6PUM-U"
            variant="inverse"
            className="self-start text-white"
          />
        </div>
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
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                  {classOptions.map((className) => (
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
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">No report cards match the current filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => {
            const statusStyle = STATUS_STYLES[record.status]
            return (
              <Card key={record.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="bg-[#2d682d] text-white p-2 rounded-full">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{record.studentName}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {record.className}
                          </span>
                          <span>
                            {record.term}, {record.session}
                          </span>
                          <span>Teacher: {record.teacherName}</span>
                        </CardDescription>
                        <div className="mt-1 text-xs text-gray-500">
                          Submitted: {formatDate(record.submittedAt)} • Last update: {formatDate(record.updatedAt)}
                        </div>
                        {record.feedback && record.status === "revoked" && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <strong>Admin Feedback:</strong> {record.feedback}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={statusStyle.className}>{statusStyle.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleDownload(record)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    {record.status === "pending" && (
                      <>
                        <Button
                          onClick={() => handleApprove(record)}
                          size="sm"
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                          disabled={processingRecordId === record.id}
                        >
                          {processingRecordId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Publish to Parents
                        </Button>
                        <Button
                          onClick={() => handleOpenRevoke(record)}
                          variant="destructive"
                          size="sm"
                          disabled={processingRecordId === record.id}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Request Changes
                        </Button>
                      </>
                    )}
                    {record.status === "approved" && (
                      <Button
                        onClick={() => handleOpenRevoke(record)}
                        variant="outline"
                        size="sm"
                        disabled={processingRecordId === record.id}
                        className="flex items-center gap-2"
                      >
                        {processingRecordId === record.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Revoke Access
                      </Button>
                    )}
                    {record.status === "revoked" && (
                      <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                        Awaiting teacher updates
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
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

      <Dialog
        open={showRevokeDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeRevokeDialog()
          } else {
            setShowRevokeDialog(true)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Back for Revision</DialogTitle>
            <DialogDescription>
              {selectedRecord
                ? `Provide guidance for ${selectedRecord.studentName}’s report card. The teacher will see this message.`
                : "Provide guidance so the teacher understands the required corrections."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Admin Feedback</Label>
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
            <Button variant="outline" onClick={closeRevokeDialog}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={processingRecordId === selectedRecord?.id}
            >
              {processingRecordId === selectedRecord?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send Back to Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
