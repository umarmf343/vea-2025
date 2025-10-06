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
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Check, X, Calendar, Clock, User, BookOpen, Loader2, Eye, Sparkles } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"
import { TutorialLink } from "@/components/tutorial-link"
import {
  REPORT_CARD_WORKFLOW_EVENT,
  getWorkflowRecords,
  updateReportCardWorkflowStatus,
  type ParentRecipientInfo,
  type ReportCardWorkflowRecord,
} from "@/lib/report-card-workflow"
import { grantReportCardAccess, normalizeTermLabel } from "@/lib/report-card-access"
import { useToast } from "@/hooks/use-toast"
import { EnhancedReportCard } from "@/components/enhanced-report-card"
import { mapReportCardRecordToRaw } from "@/lib/report-card-transformers"
import type { RawReportCardData } from "@/lib/report-card-types"
import type { ReportCardRecord } from "@/lib/database"
import { buildReportCardHtml } from "@/lib/report-card-html"
import { ReportCardPreviewOverlay } from "@/components/report-card-preview-overlay"

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  const sanitized = trimmed.replace(/[^a-z0-9\-_.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return sanitized.length > 0 ? sanitized : "report-card"
}

const STATUS_STYLES: Record<ReportCardWorkflowRecord["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  pending: { label: "Pending Approval", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Published", className: "bg-green-100 text-green-800" },
  revoked: { label: "Needs Revision", className: "bg-red-100 text-red-800" },
}

type StatusFilterValue = ReportCardWorkflowRecord["status"] | "all"

const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: STATUS_STYLES.pending.label },
  { value: "approved", label: STATUS_STYLES.approved.label },
  { value: "revoked", label: STATUS_STYLES.revoked.label },
  { value: "draft", label: STATUS_STYLES.draft.label },
]

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
  const [filterStatus, setFilterStatus] = useState<StatusFilterValue>("pending")
  const [filterClass, setFilterClass] = useState<string>("all")
  const [revokeMessage, setRevokeMessage] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<ReportCardWorkflowRecord | null>(null)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [submissionDeadline, setSubmissionDeadline] = useState("")
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false)
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewRecord, setPreviewRecord] = useState<ReportCardWorkflowRecord | null>(null)
  const [previewData, setPreviewData] = useState<RawReportCardData | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const isPreviewLoading = previewLoadingId !== null
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null)
  const [parentAccounts, setParentAccounts] = useState<ParentAccountRecord[]>([])
  const [studentDirectory, setStudentDirectory] = useState<Map<string, StudentDirectoryRecord>>(new Map())
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishRecord, setPublishRecord] = useState<ReportCardWorkflowRecord | null>(null)
  const [publishRecipients, setPublishRecipients] = useState<ParentRecipientOption[]>([])
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  const closePreviewDialog = useCallback(() => {
    setPreviewDialogOpen(false)
    setPreviewRecord(null)
    setPreviewData(null)
    setPreviewMessage(null)
    setPreviewLoadingId(null)
  }, [])

  const resolveReportCardData = useCallback((record: ReportCardWorkflowRecord): RawReportCardData | null => {
    const stored = safeStorage.getItem("reportCards")
    if (!stored) {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch (error) {
      throw new Error("Stored report card data is corrupted. Ask the teacher to sync again.")
    }

    if (!Array.isArray(parsed)) {
      return null
    }

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue
      }

      const candidate = entry as ReportCardRecord
      if (
        candidate.studentId === record.studentId &&
        candidate.term === record.term &&
        candidate.session === record.session
      ) {
        return mapReportCardRecordToRaw(candidate)
      }
    }

    return null
  }, [])

  const handlePreview = useCallback(
    (record: ReportCardWorkflowRecord) => {
      setPreviewRecord(record)
      setPreviewDialogOpen(true)
      setPreviewLoadingId(record.id)
      setPreviewData(null)
      setPreviewMessage(null)

      try {
        const data = resolveReportCardData(record)
        if (!data) {
          setPreviewMessage("No report card data found for this student yet.")
          return
        }
        setPreviewData(data)
      } catch (error) {
        console.error("Failed to load report card preview", error)
        setPreviewMessage("Failed to load report card preview. Please try again.")
      } finally {
        setPreviewLoadingId(null)
      }
    },
    [resolveReportCardData],
  )

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

  useEffect(() => {
    let cancelled = false

    const parseParentUser = (user: Record<string, any>): ParentAccountRecord | null => {
      const role = typeof user.role === "string" ? user.role.toLowerCase().trim() : ""
      if (role !== "parent") {
        return null
      }

      const id = user.id !== undefined ? String(user.id) : user.email ? String(user.email) : null
      if (!id) {
        return null
      }

      const rawName = typeof user.name === "string" ? user.name.trim() : ""
      const email = typeof user.email === "string" ? user.email.trim() : null
      const metadata = (user.metadata ?? {}) as Record<string, unknown>
      const linkedStudentId =
        typeof metadata?.linkedStudentId === "string" && metadata.linkedStudentId.trim().length > 0
          ? metadata.linkedStudentId.trim()
          : null
      const linkedStudents = Array.isArray(user.studentIds)
        ? user.studentIds.map((value: unknown) => String(value)).filter((value) => value.trim().length > 0)
        : []
      if (linkedStudentId && !linkedStudents.includes(linkedStudentId)) {
        linkedStudents.push(linkedStudentId)
      }
      if (typeof user.studentId === "string" && user.studentId.trim().length > 0) {
        linkedStudents.push(user.studentId.trim())
      }

      const phone =
        typeof metadata?.phone === "string" && metadata.phone.trim().length > 0
          ? metadata.phone.trim()
          : typeof user.phone === "string" && user.phone.trim().length > 0
            ? user.phone.trim()
            : null

      return {
        id,
        name: rawName || email || id,
        email,
        phone,
        studentIds: Array.from(new Set(linkedStudents.map((value) => value.trim()))),
      }
    }

    const parseStudentRecord = (record: Record<string, any>): StudentDirectoryRecord | null => {
      const id = record.id !== undefined ? String(record.id) : null
      if (!id) {
        return null
      }

      const name = typeof record.name === "string" && record.name.trim().length > 0 ? record.name.trim() : id
      const parentName =
        typeof record.parentName === "string" && record.parentName.trim().length > 0
          ? record.parentName.trim()
          : null
      const parentEmail =
        typeof record.parentEmail === "string" && record.parentEmail.trim().length > 0
          ? record.parentEmail.trim()
          : null
      const guardianPhone =
        typeof record.guardianPhone === "string" && record.guardianPhone.trim().length > 0
          ? record.guardianPhone.trim()
          : null
      const className =
        typeof record.class === "string" && record.class.trim().length > 0 ? record.class.trim() : null

      return { id, name, parentName, parentEmail, guardianPhone, className }
    }

    const loadFromStorage = () => {
      const storedParents: ParentAccountRecord[] = []
      const storedStudents = new Map<string, StudentDirectoryRecord>()

      try {
        const rawUsers = safeStorage.getItem("users")
        if (rawUsers) {
          const parsed = JSON.parse(rawUsers)
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => {
              const parent = parseParentUser(entry as Record<string, any>)
              if (parent) {
                storedParents.push(parent)
              }
            })
          }
        }
      } catch (error) {
        console.warn("Unable to parse cached users for parent directory", error)
      }

      try {
        const rawStudents = safeStorage.getItem("students")
        if (rawStudents) {
          const parsed = JSON.parse(rawStudents)
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => {
              const student = parseStudentRecord(entry as Record<string, any>)
              if (student) {
                storedStudents.set(student.id, student)
              }
            })
          }
        }
      } catch (error) {
        console.warn("Unable to parse cached students for parent directory", error)
      }

      return { parents: storedParents, students: storedStudents }
    }

    const hydrateDirectories = async () => {
      setDirectoryError(null)

      try {
        const [parentPayload, studentPayload] = await Promise.all([
          fetchJson<{ users?: Array<Record<string, any>> }>("/api/users?role=parent"),
          fetchJson<{ students?: Array<Record<string, any>> }>("/api/students"),
        ])

        if (cancelled) {
          return
        }

        const mappedParents: ParentAccountRecord[] = Array.isArray(parentPayload.users)
          ? parentPayload.users
              .map((entry) => parseParentUser(entry as Record<string, any>))
              .filter((entry): entry is ParentAccountRecord => Boolean(entry))
          : []

        const mappedStudents = new Map<string, StudentDirectoryRecord>()
        if (Array.isArray(studentPayload.students)) {
          studentPayload.students.forEach((entry) => {
            const student = parseStudentRecord(entry as Record<string, any>)
            if (student) {
              mappedStudents.set(student.id, student)
            }
          })
        }

        if (mappedParents.length === 0 || mappedStudents.size === 0) {
          const fallback = loadFromStorage()
          if (mappedParents.length === 0) {
            mappedParents.push(...fallback.parents)
          }
          if (mappedStudents.size === 0) {
            fallback.students.forEach((value, key) => mappedStudents.set(key, value))
          }
        }

        setParentAccounts(mappedParents)
        setStudentDirectory(mappedStudents)
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error("Failed to load parent directory", error)
        setDirectoryError(error instanceof Error ? error.message : "Unable to load parent directory")

        const fallback = loadFromStorage()
        setParentAccounts(fallback.parents)
        setStudentDirectory(fallback.students)
      }
    }

    hydrateDirectories().catch((error) => {
      console.error("Unable to hydrate parent directory", error)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const resolveParentRecipients = useCallback(
    (record: ReportCardWorkflowRecord): ParentRecipientOption[] => {
      const recipients = new Map<string, ParentRecipientOption>()
      const rawId = String(record.studentId ?? "").trim()
      const variants = new Set<string>()

      if (rawId.length > 0) {
        variants.add(rawId)
        variants.add(rawId.toLowerCase())
      }

      const numericId = Number.parseInt(rawId, 10)
      if (!Number.isNaN(numericId)) {
        variants.add(String(numericId))
      }

      if (rawId.startsWith("student_")) {
        const trimmed = rawId.replace(/^student_/, "")
        variants.add(trimmed)
        variants.add(trimmed.toLowerCase())
      }

      const studentEntry =
        studentDirectory.get(rawId) ??
        Array.from(studentDirectory.values()).find(
          (entry) => entry.name.toLowerCase() === record.studentName.toLowerCase(),
        ) ??
        null

      if (studentEntry) {
        variants.add(studentEntry.id)
        variants.add(studentEntry.id.toLowerCase())
      }

      parentAccounts.forEach((parent) => {
        const hasMatch = parent.studentIds.some((id) => {
          const trimmed = id.trim()
          if (!trimmed) {
            return false
          }
          return variants.has(trimmed) || variants.has(trimmed.toLowerCase())
        })

        if (hasMatch) {
          recipients.set(parent.id, {
            id: parent.id,
            parentId: parent.id,
            name: parent.name,
            email: parent.email ?? null,
            phone: parent.phone ?? null,
            source: "account",
          })
        }
      })

      if (studentEntry && studentEntry.parentEmail) {
        const alreadyIncluded = Array.from(recipients.values()).some(
          (recipient) => recipient.parentId === studentEntry.parentEmail,
        )
        if (!alreadyIncluded) {
          const fallbackId = `contact::${studentEntry.parentEmail.toLowerCase()}`
          recipients.set(fallbackId, {
            id: fallbackId,
            parentId: studentEntry.parentEmail,
            name: studentEntry.parentName ?? studentEntry.parentEmail,
            email: studentEntry.parentEmail,
            phone: studentEntry.guardianPhone ?? null,
            source: "record",
          })
        }
      }

      if (Array.isArray(record.publishedTo)) {
        record.publishedTo.forEach((recipient) => {
          if (!recipient?.parentId || recipients.has(recipient.parentId)) {
            return
          }

          recipients.set(recipient.parentId, {
            id: recipient.parentId,
            parentId: recipient.parentId,
            name: recipient.name,
            email: recipient.email ?? null,
            phone: null,
            source: "account",
          })
        })
      }

      return Array.from(recipients.values())
    },
    [parentAccounts, studentDirectory],
  )

  useEffect(() => {
    if (!publishRecord) {
      return
    }

    setIsLoadingRecipients(true)
    try {
      const recipients = resolveParentRecipients(publishRecord)
      setPublishRecipients(recipients)

      const previouslySelected = new Set(
        (publishRecord.publishedTo ?? []).map((recipient) => recipient.parentId),
      )

      const defaults =
        recipients.length === 0
          ? []
          : previouslySelected.size > 0
            ? recipients
                .filter((recipient) => previouslySelected.has(recipient.parentId))
                .map((recipient) => recipient.id)
            : recipients.map((recipient) => recipient.id)

      setSelectedParentIds(defaults)
    } finally {
      setIsLoadingRecipients(false)
    }
  }, [publishRecord, resolveParentRecipients])

  const openPublishDialog = useCallback((record: ReportCardWorkflowRecord) => {
    setPublishRecord(record)
    setPublishDialogOpen(true)
  }, [])

  const closePublishDialog = useCallback(() => {
    setPublishDialogOpen(false)
    setPublishRecord(null)
    setPublishRecipients([])
    setSelectedParentIds([])
  }, [])

  const toggleSelectAllParents = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedParentIds([])
        return
      }
      setSelectedParentIds(publishRecipients.map((recipient) => recipient.id))
    },
    [publishRecipients],
  )

  const toggleParentSelection = useCallback((id: string, checked: boolean) => {
    setSelectedParentIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id]
      }
      return prev.filter((value) => value !== id)
    })
  }, [])

  const handleConfirmPublish = useCallback(() => {
    if (!publishRecord) {
      return
    }

    if (selectedParentIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Select at least one parent",
        description: "Choose the parents who should receive this report card.",
      })
      return
    }

    try {
      setIsPublishing(true)
      setProcessingRecordId(publishRecord.id)

      const normalizedTerm = normalizeTermLabel(publishRecord.term)
      const selectedRecipients = publishRecipients.filter((recipient) =>
        selectedParentIds.includes(recipient.id),
      )

      selectedRecipients.forEach((recipient) => {
        grantReportCardAccess({
          parentId: recipient.parentId,
          studentId: publishRecord.studentId,
          term: normalizedTerm,
          session: publishRecord.session,
          grantedBy: "manual",
        })
      })

      const updated = updateReportCardWorkflowStatus({
        studentId: publishRecord.studentId,
        className: publishRecord.className,
        subject: publishRecord.subject,
        term: normalizedTerm,
        session: publishRecord.session,
        status: "approved",
        adminId: ADMIN_METADATA.id,
        adminName: ADMIN_METADATA.name,
        parentRecipients: selectedRecipients.map((recipient) => ({
          parentId: recipient.parentId,
          name: recipient.name,
          email: recipient.email ?? undefined,
        })),
      })

      setRecords(updated)
      toast({
        title: "Report published successfully",
        description: publishRecord.cumulativeSummary
          ? `${publishRecord.studentName}'s report card and cumulative summary are now visible to the selected parents.`
          : `${publishRecord.studentName}'s report card is now visible to the selected parents.`,
      })
      closePublishDialog()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsPublishing(false)
      setProcessingRecordId(null)
    }
  }, [
    closePublishDialog,
    publishRecord,
    publishRecipients,
    selectedParentIds,
    toast,
  ])

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

  const handleFilterStatusChange = useCallback((value: string) => {
    setFilterStatus(value as StatusFilterValue)
  }, [])

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
      setDownloadingRecordId(record.id)

      try {
        const data = resolveReportCardData(record)
        if (!data) {
          toast({
            variant: "destructive",
            title: "Report card unavailable",
            description: "No report card data is stored for this student yet.",
          })
          return
        }

        const globalScope =
          typeof globalThis === "undefined" ? null : (globalThis as typeof globalThis & { document?: Document | undefined })
        const doc = globalScope?.document ?? null
        if (!doc) {
          throw new Error("Document context is not available in this environment.")
        }

        const filename = `${sanitizeFileName(
          `${data.student.name}-${data.student.term}-${data.student.session}`,
        )}.html`
        const html = buildReportCardHtml(data)
        const blob = new Blob([html], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = doc.createElement("a")
        link.href = url
        link.download = filename
        doc.body.appendChild(link)
        link.click()
        doc.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast({
          title: "Download ready",
          description: `${data.student.name}'s report card has been saved to your device.`,
        })
      } catch (error) {
        console.error("Failed to download report card", error)
        toast({
          variant: "destructive",
          title: "Download failed",
          description:
            error instanceof Error ? error.message : "Unable to prepare the report card file. Please try again.",
        })
      } finally {
        setDownloadingRecordId(null)
      }
    },
    [resolveReportCardData, toast],
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
              <Select value={filterStatus} onValueChange={handleFilterStatusChange}>
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
                      onClick={() => handlePreview(record)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={previewLoadingId === record.id}
                    >
                      {previewLoadingId === record.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Preview
                    </Button>
                    <Button
                      onClick={() => handleDownload(record)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={downloadingRecordId === record.id}
                    >
                      {downloadingRecordId === record.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {downloadingRecordId === record.id ? "Preparing..." : "Download"}
                    </Button>
                    {record.status === "pending" && (
                      <>
                        <Button
                          onClick={() => openPublishDialog(record)}
                          size="sm"
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                          disabled={processingRecordId === record.id || isPublishing}
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
                {record.cumulativeSummary ? (
                  <div className="mt-4 flex flex-col gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <Sparkles className="h-4 w-4" /> Cumulative Snapshot
                    </div>
                    <div className="text-xs sm:text-sm">
                      Average: <span className="font-semibold">{record.cumulativeSummary.average}%</span> • Grade:
                      <span className="font-semibold"> {record.cumulativeSummary.grade}</span> • Position:
                      <span className="font-semibold">
                        {" "}
                        {record.cumulativeSummary.position}/{record.cumulativeSummary.totalStudents}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <Clock className="h-4 w-4" /> Awaiting cumulative summary from the teacher. Ask them to sync exam results
                    before approving.
                  </div>
                )}
                {record.publishedTo && record.publishedTo.length > 0 ? (
                  <div className="mt-4 rounded-md border border-green-100 bg-green-50 p-3 text-sm text-green-700">
                    <p className="font-medium">Published to:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {record.publishedTo.map((recipient) => (
                          <Badge
                            key={`${record.id}-${recipient.parentId}`}
                            variant="outline"
                            className="border-green-300 bg-white text-green-700"
                          >
                            {recipient.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <ReportCardPreviewOverlay
        isOpen={previewDialogOpen}
        onClose={closePreviewDialog}
        title="Report Card Preview"
        description={
          previewRecord
            ? `${previewRecord.studentName} • ${previewRecord.className} • ${previewRecord.term} (${previewRecord.session})`
            : "Select a report card to preview the final layout before approval."
        }
        actions={
          previewRecord ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => handleDownload(previewRecord)}
              disabled={downloadingRecordId === previewRecord.id}
            >
              {downloadingRecordId === previewRecord.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloadingRecordId === previewRecord.id ? "Preparing…" : "Download"}
            </Button>
          ) : null
        }
      >
        {isPreviewLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing preview…
          </div>
        ) : previewData ? (
          <EnhancedReportCard data={previewData} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {previewMessage ?? "No report card data is available for this student yet."}
          </p>
        )}
      </ReportCardPreviewOverlay>

      <Dialog open={publishDialogOpen} onOpenChange={(open) => (open ? setPublishDialogOpen(true) : closePublishDialog())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish Report Card</DialogTitle>
            <DialogDescription>
              {publishRecord
                ? `Select the parents who should receive ${publishRecord.studentName}’s report card.`
                : "Choose the parents who should receive this report card before publishing."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {publishRecord?.cumulativeSummary ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-semibold">Cumulative summary will be shared with this report card.</p>
                <p className="text-xs sm:text-sm">
                  Average: <span className="font-semibold">{publishRecord.cumulativeSummary.average}%</span> • Grade:
                  <span className="font-semibold"> {publishRecord.cumulativeSummary.grade}</span> • Position:
                  <span className="font-semibold">
                    {" "}
                    {publishRecord.cumulativeSummary.position}/{publishRecord.cumulativeSummary.totalStudents}
                  </span>
                </p>
              </div>
            ) : null}
            {directoryError ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {directoryError}
              </p>
            ) : null}
            {isLoadingRecipients ? (
              <div className="flex items-center justify-center rounded-md border border-dashed border-emerald-200 p-6 text-sm text-emerald-700">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing parent list…
              </div>
            ) : publishRecipients.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                No parent contacts are linked to this student yet. Update the student record with parent or guardian details
                to enable publishing.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="publish-select-all"
                    checked={publishRecipients.length > 0 && selectedParentIds.length === publishRecipients.length}
                    onCheckedChange={(checked) => toggleSelectAllParents(Boolean(checked))}
                  />
                  <Label htmlFor="publish-select-all" className="text-sm text-emerald-900">
                    Select all parents
                  </Label>
                </div>
                <div className="space-y-2">
                  {publishRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900"
                    >
                      <Checkbox
                        id={`publish-${recipient.id}`}
                        checked={selectedParentIds.includes(recipient.id)}
                        onCheckedChange={(checked) => toggleParentSelection(recipient.id, Boolean(checked))}
                      />
                      <div className="space-y-1">
                        <p className="font-semibold leading-tight">{recipient.name}</p>
                        <p className="text-xs text-emerald-800/80">
                          {recipient.email ?? recipient.phone ?? "Contact details unavailable"}
                        </p>
                        <p className="text-xs text-emerald-700/70">
                          {recipient.source === "account" ? "Linked parent account" : "Contact from student record"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePublishDialog}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPublish} disabled={isPublishing || publishRecipients.length === 0}>
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish to Parents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
