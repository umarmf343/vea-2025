"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DollarSign,
  Download,
  Edit,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Search,
  TrendingUp,
  Users,
} from "lucide-react"
import { useBranding } from "@/hooks/use-branding"

type BrowserRuntime = typeof globalThis & Partial<Window>

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  return globalThis as BrowserRuntime
}

interface AccountantDashboardProps {
  accountant: {
    id: string
    name: string
    email: string
  }
}

interface ParentRecipient {
  studentId: string
  studentName: string
  parentName: string
  parentEmail: string
}

interface ApiPaymentRecord {
  id: string
  amount: number
  status: "pending" | "completed" | "failed"
  paymentType: string
  studentId: string | null
  email: string
  reference: string
  createdAt: string
  metadata?: Record<string, unknown>
}

interface PaymentRecord {
  id: string
  studentName: string
  parentName: string
  className: string
  amount: number
  status: "paid" | "pending" | "failed"
  method: "online" | "offline"
  date: string
  reference?: string
  hasAccess: boolean
  email?: string
  paymentType: string
}

interface ApiReceiptRecord {
  id: string
  paymentId: string
  receiptNumber: string
  studentName: string
  amount: number
  dateIssued: string
  reference?: string | null
  issuedBy?: string | null
  metadata?: Record<string, unknown> | null
}

interface ReceiptRecord {
  id: string
  paymentId: string
  receiptNumber: string
  studentName: string
  amount: number
  dateIssued: string
  reference?: string
  issuedBy?: string
  className?: string
  method?: string
}

interface ApiFeeStructureRecord {
  id: string
  className: string
  tuition: number
  development: number
  exam: number
  sports: number
  library: number
  total: number
}

interface FeeStructureEntry extends ApiFeeStructureRecord {}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`
}

function mapPayment(record: ApiPaymentRecord): PaymentRecord {
  const metadata = record.metadata ?? {}
  const method = (metadata.method as string | undefined)?.toLowerCase() === "offline" ? "offline" : "online"
  const hasAccess = Boolean((metadata as Record<string, unknown>).accessGranted)
  const studentName = (metadata.studentName as string | undefined) ?? "Unknown Student"
  const parentName = (metadata.parentName as string | undefined) ?? "Parent"
  const className =
    (metadata.className as string | undefined) ??
    (metadata.class as string | undefined) ??
    (metadata.classroom as string | undefined) ??
    "--"

  const status: PaymentRecord["status"] =
    record.status === "completed" ? "paid" : record.status === "failed" ? "failed" : "pending"

  return {
    id: record.id,
    studentName,
    parentName,
    className,
    amount: Number(record.amount ?? 0),
    status,
    method,
    date: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "--",
    reference: record.reference,
    hasAccess,
    email: record.email,
    paymentType: record.paymentType,
  }
}

function mapReceipt(record: ApiReceiptRecord): ReceiptRecord {
  const metadata = record.metadata ?? {}

  return {
    id: record.id,
    paymentId: record.paymentId,
    receiptNumber: record.receiptNumber,
    studentName: record.studentName,
    amount: Number(record.amount ?? 0),
    dateIssued: record.dateIssued ? new Date(record.dateIssued).toLocaleDateString() : "--",
    reference: record.reference ?? undefined,
    issuedBy: record.issuedBy ?? undefined,
    className: (metadata.className as string | undefined) ?? undefined,
    method: (metadata.method as string | undefined) ?? undefined,
  }
}

export function AccountantDashboard({ accountant }: AccountantDashboardProps) {
  const branding = useBranding()
  const resolvedLogo = branding.logoUrl
  const resolvedSignature = branding.signatureUrl
  const resolvedSchoolName = branding.schoolName
  const resolvedAddress = branding.schoolAddress
  const resolvedHeadmasterName = branding.headmasterName

  const [selectedTab, setSelectedTab] = useState("overview")
  const [showFeeDialog, setShowFeeDialog] = useState(false)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([])
  const [feeStructure, setFeeStructure] = useState<FeeStructureEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [feeForm, setFeeForm] = useState({
    className: "",
    tuition: "0",
    development: "0",
    exam: "0",
    sports: "0",
    library: "0",
  })
  const [updatingFee, setUpdatingFee] = useState(false)
  const [processingReceiptId, setProcessingReceiptId] = useState<string | null>(null)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [feeToSend, setFeeToSend] = useState<FeeStructureEntry | null>(null)
  const [parentOptions, setParentOptions] = useState<ParentRecipient[]>([])
  const [selectedParentEmail, setSelectedParentEmail] = useState("")
  const [isLoadingParents, setIsLoadingParents] = useState(false)
  const [isSendingFee, setIsSendingFee] = useState(false)

  const feeFormTotal = useMemo(() => {
    return [feeForm.tuition, feeForm.development, feeForm.exam, feeForm.sports, feeForm.library]
      .map((value) => Number(value) || 0)
      .reduce((sum, value) => sum + value, 0)
  }, [feeForm])

  const resetFeeForm = useCallback(() => {
    setFeeForm({ className: "", tuition: "0", development: "0", exam: "0", sports: "0", library: "0" })
    setEditingFeeId(null)
  }, [])

  const loadFinancialData = useCallback(async () => {
    setLoading(true)
    setBanner(null)

    try {
      const [paymentsResponse, receiptsResponse, feeResponse] = await Promise.all([
        fetch("/api/payments/records"),
        fetch("/api/payments/receipts"),
        fetch("/api/payments/fee-structure"),
      ])

      if (!paymentsResponse.ok) {
        throw new Error("Unable to load payment records")
      }

      if (!receiptsResponse.ok) {
        throw new Error("Unable to load receipts")
      }

      if (!feeResponse.ok) {
        throw new Error("Unable to load fee structure")
      }

      const paymentsData = (await paymentsResponse.json()) as { payments: ApiPaymentRecord[] }
      const receiptsData = (await receiptsResponse.json()) as { receipts: ApiReceiptRecord[] }
      const feeData = (await feeResponse.json()) as { feeStructure: ApiFeeStructureRecord[] }

      setPayments(paymentsData.payments.map(mapPayment))
      setReceipts(receiptsData.receipts.map(mapReceipt))
      setFeeStructure(feeData.feeStructure)
    } catch (error) {
      console.error("Accountant dashboard load failed:", error)
      const message = error instanceof Error ? error.message : "Unable to load accountant data"
      setBanner({ type: "error", message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFinancialData()
  }, [loadFinancialData])

  const handleEditFeeStructure = useCallback((fee: FeeStructureEntry) => {
    setFeeForm({
      className: fee.className,
      tuition: String(fee.tuition ?? 0),
      development: String(fee.development ?? 0),
      exam: String(fee.exam ?? 0),
      sports: String(fee.sports ?? 0),
      library: String(fee.library ?? 0),
    })
    setEditingFeeId(fee.id)
    setShowFeeDialog(true)
  }, [])

  const totalRevenue = useMemo(
    () => payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  )

  const pendingPayments = useMemo(
    () => payments.filter((payment) => payment.status === "pending").length,
    [payments],
  )

  const handleDeleteFeeStructure = useCallback(
    async (fee: FeeStructureEntry) => {
      const runtime = getBrowserRuntime()
      const confirmDelete = runtime?.confirm
        ? runtime.confirm(`Remove fee structure for ${fee.className}? This action cannot be undone.`)
        : true
      if (!confirmDelete) {
        return
      }

      setDeletingFeeId(fee.id)
      setBanner(null)

      try {
        const response = await fetch(`/api/payments/fee-structure?id=${encodeURIComponent(fee.id)}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? "Unable to delete fee structure")
        }

        setFeeStructure((previous) => previous.filter((entry) => entry.id !== fee.id))
        setBanner({ type: "success", message: `${fee.className} fee structure deleted successfully.` })
      } catch (error) {
        console.error("Failed to delete fee structure:", error)
        const message = error instanceof Error ? error.message : "Unable to delete fee structure"
        setBanner({ type: "error", message })
      } finally {
        setDeletingFeeId(null)
      }
    },
    [],
  )

  const loadParentsForClass = useCallback(async (className: string) => {
    try {
      setIsLoadingParents(true)
      const response = await fetch(`/api/students?class=${encodeURIComponent(className)}`)

      if (!response.ok) {
        throw new Error("Unable to load parents for the selected class")
      }

      const payload = (await response.json()) as { students: Array<{ id: string; name: string; parentName: string; parentEmail: string }> }

      const recipients: ParentRecipient[] = Array.isArray(payload.students)
        ? payload.students
            .filter((student) => Boolean(student.parentEmail))
            .map((student) => ({
              studentId: student.id,
              studentName: student.name,
              parentName: student.parentName,
              parentEmail: student.parentEmail,
            }))
        : []

      setParentOptions(recipients)
      if (recipients.length === 1) {
        setSelectedParentEmail(recipients[0]!.parentEmail)
      }
    } catch (error) {
      console.error("Failed to load parents for class:", error)
      setParentOptions([])
      setBanner({
        type: "error",
        message: "Unable to load parents for the selected class. Please try again.",
      })
    } finally {
      setIsLoadingParents(false)
    }
  }, [setBanner])

  const handleOpenSendDialog = useCallback(
    (fee: FeeStructureEntry) => {
      setFeeToSend(fee)
      setSelectedParentEmail("")
      setParentOptions([])
      setSendDialogOpen(true)
      void loadParentsForClass(fee.className)
    },
    [loadParentsForClass],
  )

  const handleSendFeeStructure = useCallback(async () => {
    if (!feeToSend) {
      return
    }

    if (!selectedParentEmail) {
      setBanner({ type: "error", message: "Select a parent to send the fee structure." })
      return
    }

    const recipient = parentOptions.find((option) => option.parentEmail === selectedParentEmail)
    if (!recipient) {
      setBanner({ type: "error", message: "The selected parent could not be found." })
      return
    }

    setIsSendingFee(true)
    setBanner(null)

    try {
      const response = await fetch("/api/payments/fee-structure/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: feeToSend.id,
          className: feeToSend.className,
          parentEmail: recipient.parentEmail,
          parentName: recipient.parentName,
          studentName: recipient.studentName,
          sentBy: accountant.name,
          breakdown: {
            tuition: feeToSend.tuition,
            development: feeToSend.development,
            exam: feeToSend.exam,
            sports: feeToSend.sports,
            library: feeToSend.library,
            total: feeToSend.total,
          },
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Unable to send fee structure")
      }

      setBanner({
        type: "success",
        message: `Fee structure sent to ${recipient.parentName}.`,
      })
      setSendDialogOpen(false)
      setFeeToSend(null)
      setParentOptions([])
      setSelectedParentEmail("")
    } catch (error) {
      console.error("Failed to send fee structure:", error)
      const message = error instanceof Error ? error.message : "Unable to send fee structure"
      setBanner({ type: "error", message })
    } finally {
      setIsSendingFee(false)
    }
  }, [accountant.name, feeToSend, parentOptions, selectedParentEmail, setBanner])

  const ensureReceipt = useCallback(
    async (payment: PaymentRecord): Promise<ReceiptRecord | null> => {
      setProcessingReceiptId(payment.id)
      setBanner(null)

      try {
        const response = await fetch("/api/payments/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: payment.id,
            studentName: payment.studentName,
            amount: payment.amount,
            reference: payment.reference,
            issuedBy: accountant.name,
            metadata: {
              className: payment.className,
              method: payment.method,
              email: payment.email,
              paymentType: payment.paymentType,
            },
          }),
        })

        if (!response.ok) {
          const errorPayload = (await response.json()) as { error?: string }
          throw new Error(errorPayload.error ?? "Unable to generate receipt")
        }

        const data = (await response.json()) as { receipt: ApiReceiptRecord }
        const mapped = mapReceipt(data.receipt)

        setReceipts((previous) => {
          const index = previous.findIndex((item) => item.id === mapped.id)
          if (index === -1) {
            return [...previous, mapped]
          }

          const clone = [...previous]
          clone[index] = mapped
          return clone
        })

        return mapped
      } catch (error) {
        console.error("Receipt generation failed:", error)
        const message = error instanceof Error ? error.message : "Unable to generate receipt"
        setBanner({ type: "error", message })
        return null
      } finally {
        setProcessingReceiptId(null)
      }
    },
    [accountant.name],
  )

  const handleDownloadReceipt = useCallback(
    async (payment: PaymentRecord) => {
      const receipt = await ensureReceipt(payment)
      if (!receipt) {
        return
      }

      const runtime = getBrowserRuntime()
      if (!runtime?.document || !runtime.URL?.createObjectURL) {
        console.log("Generated receipt", receipt)
        setBanner({ type: "success", message: "Receipt generated" })
        return
      }

      const receiptPayload = {
        receiptNumber: receipt.receiptNumber,
        studentName: receipt.studentName,
        amount: receipt.amount,
        className: receipt.className ?? payment.className,
        method: receipt.method ?? payment.method,
        reference: receipt.reference,
        issuedBy: receipt.issuedBy ?? accountant.name,
        dateIssued: receipt.dateIssued,
      }

      const blob = new Blob([JSON.stringify(receiptPayload, null, 2)], { type: "application/json" })
      const url = runtime.URL.createObjectURL(blob)
      const link = runtime.document.createElement("a")
      link.href = url
      link.download = `receipt-${receipt.receiptNumber.replace(/\W+/g, "-")}.json`
      runtime.document.body?.appendChild(link)
      link.click()
      runtime.document.body?.removeChild(link)
      runtime.URL.revokeObjectURL(url)
      setBanner({ type: "success", message: "Receipt downloaded" })
    },
    [accountant.name, ensureReceipt],
  )

  const handlePrintReceipt = useCallback(
    async (payment: PaymentRecord) => {
      const receipt = await ensureReceipt(payment)
      if (!receipt) {
        return
      }

      setSelectedReceipt(receipt)
      setShowReceiptDialog(true)
    },
    [ensureReceipt],
  )

  const handleUpdateFeeStructure = useCallback(async () => {
    if (!feeForm.className) {
      setBanner({ type: "error", message: "Please select a class before saving the fee structure." })
      return
    }

    setUpdatingFee(true)
    setBanner(null)

    try {
      const response = await fetch("/api/payments/fee-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          className: feeForm.className,
          tuition: Number(feeForm.tuition) || 0,
          development: Number(feeForm.development) || 0,
          exam: Number(feeForm.exam) || 0,
          sports: Number(feeForm.sports) || 0,
          library: Number(feeForm.library) || 0,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Unable to update fee structure")
      }

      const data = (await response.json()) as { fee: ApiFeeStructureRecord }

      setFeeStructure((previous) => {
        const index = previous.findIndex((entry) => entry.id === data.fee.id || entry.className === data.fee.className)
        if (index === -1) {
          return [...previous, data.fee]
        }

        const clone = [...previous]
        clone[index] = data.fee
        return clone
      })

      setShowFeeDialog(false)
      resetFeeForm()
      setBanner({ type: "success", message: "Fee structure saved successfully." })
    } catch (error) {
      console.error("Failed to update fee structure:", error)
      const message = error instanceof Error ? error.message : "Unable to update fee structure"
      setBanner({ type: "error", message })
    } finally {
      setUpdatingFee(false)
    }
  }, [feeForm])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#2d682d]"></div>
          <p className="mt-2 text-gray-600">Loading financial data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-[#2d682d] to-[#b29032] p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, {accountant.name}</h1>
        <p className="text-green-100">Financial Management - VEA 2025</p>
      </div>

      {banner && (
        <div
          className={`rounded-md border p-4 text-sm ${
            banner.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{formatCurrency(totalRevenue)}</p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{pendingPayments}</p>
                <p className="text-sm text-gray-600">Pending Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Receipt className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{receipts.length}</p>
                <p className="text-sm text-gray-600">Receipts Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">
                  {payments.length > 0
                    ? Math.round((payments.filter((payment) => payment.status === "paid").length / payments.length) * 100)
                    : 0}
                  %
                </p>
                <p className="text-sm text-gray-600">Collection Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="fees">Fee Structure</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.slice(0, 3).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded bg-gray-50 p-2">
                      <div>
                        <p className="text-sm font-medium">{payment.studentName}</p>
                        <p className="text-xs text-gray-600">
                          {formatCurrency(payment.amount)} - {payment.paymentType}
                        </p>
                      </div>
                      <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{payment.status}</Badge>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <p className="text-sm text-gray-500">No payment activity recorded yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Online Payments</span>
                    <span className="text-sm font-bold text-[#2d682d]">
                      {payments.filter((payment) => payment.method === "online").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Offline Payments</span>
                    <span className="text-sm font-bold text-[#b29032]">
                      {payments.filter((payment) => payment.method === "offline").length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Payment Management</CardTitle>
              <CardDescription>Track and manage all student payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input placeholder="Search payments..." className="pl-8" />
                  </div>
                  <Button className="bg-[#b29032] hover:bg-[#b29032]/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                </div>

                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex-1">
                        <h3 className="font-medium">{payment.studentName}</h3>
                        <p className="text-sm text-gray-600">
                          {payment.className} - {payment.paymentType}
                        </p>
                        <p className="text-xs text-gray-500">
                          Date: {payment.date} | Ref: {payment.reference ?? "--"}
                        </p>
                      </div>
                      <div className="mr-4 text-center">
                        <p className="text-lg font-bold text-[#2d682d]">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-gray-500">{payment.method}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{payment.status}</Badge>
                        {payment.status === "paid" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDownloadReceipt(payment)}
                              disabled={processingReceiptId === payment.id}
                            >
                              <Download className="mr-1 h-4 w-4" />
                              Download Receipt
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                              onClick={() => void handlePrintReceipt(payment)}
                              disabled={processingReceiptId === payment.id}
                            >
                              <Printer className="mr-1 h-4 w-4" />
                              Print
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <Card className="border-dashed border-gray-200">
                      <CardContent className="py-6 text-center text-sm text-gray-500">
                        No payments recorded yet.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Receipt Management</CardTitle>
              <CardDescription>Generate, print, and download payment receipts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <h3 className="font-medium">Receipt #{receipt.receiptNumber}</h3>
                      <p className="text-sm text-gray-600">{receipt.studentName}</p>
                      <p className="text-xs text-gray-500">
                        Date: {receipt.dateIssued} | Ref: {receipt.reference ?? "--"}
                      </p>
                    </div>
                    <div className="mr-4 text-center">
                      <p className="text-lg font-bold text-[#2d682d]">{formatCurrency(receipt.amount)}</p>
                    </div>
                    <div className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const payment = payments.find((item) => item.id === receipt.paymentId)
                          if (payment) {
                            void handleDownloadReceipt(payment)
                          }
                        }}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Download Receipt
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                        onClick={() => {
                          setSelectedReceipt(receipt)
                          setShowReceiptDialog(true)
                        }}
                      >
                        <Printer className="mr-1 h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
                {receipts.length === 0 && (
                  <Card className="border-dashed border-gray-200">
                    <CardContent className="py-6 text-center text-sm text-gray-500">
                      No receipts have been issued yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#2d682d]">Fee Structure</CardTitle>
                <CardDescription>Manage tuition and levies across classes</CardDescription>
              </div>
              <Button
                className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                onClick={() => {
                  resetFeeForm()
                  setShowFeeDialog(true)
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Update Structure
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {feeStructure.map((fee) => (
                  <Card key={fee.id} className="border border-[#2d682d]/10">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#2d682d]">{fee.className}</CardTitle>
                      <CardDescription>Total: {formatCurrency(fee.total)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Tuition</span>
                        <span>{formatCurrency(fee.tuition)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Development</span>
                        <span>{formatCurrency(fee.development)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Exam</span>
                        <span>{formatCurrency(fee.exam)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sports</span>
                        <span>{formatCurrency(fee.sports)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Library</span>
                        <span>{formatCurrency(fee.library)}</span>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 border-t pt-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditFeeStructure(fee)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteFeeStructure(fee)}
                            disabled={deletingFeeId === fee.id}
                          >
                            {deletingFeeId === fee.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                          onClick={() => handleOpenSendDialog(fee)}
                        >
                          <Users className="mr-2 h-4 w-4" /> Send to Parent
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {feeStructure.length === 0 && <p className="text-sm text-gray-500">No fee structure configured yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Financial Reports</CardTitle>
              <CardDescription>Download detailed financial statements and analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  className="flex h-20 flex-col bg-[#2d682d] hover:bg-[#2d682d]/90"
                  onClick={() => setBanner({ type: "success", message: "Monthly revenue report generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Monthly Revenue Report
                </Button>
                <Button
                  className="flex h-20 flex-col bg-[#b29032] hover:bg-[#b29032]/90"
                  onClick={() => setBanner({ type: "success", message: "Outstanding payments report generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Outstanding Payments
                </Button>
                <Button
                  className="flex h-20 flex-col bg-[#2d682d] hover:bg-[#2d682d]/90"
                  onClick={() => setBanner({ type: "success", message: "Class-wise collection report generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Class-wise Collection
                </Button>
                <Button
                  className="flex h-20 flex-col bg-[#b29032] hover:bg-[#b29032]/90"
                  onClick={() => setBanner({ type: "success", message: "Payment method analysis generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Payment Method Analysis
                </Button>
                <Button
                  className="flex h-20 flex-col bg-[#2d682d] hover:bg-[#2d682d]/90"
                  onClick={() => setBanner({ type: "success", message: "Fee defaulters report generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Fee Defaulters Report
                </Button>
                <Button
                  className="flex h-20 flex-col bg-[#b29032] hover:bg-[#b29032]/90"
                  onClick={() => setBanner({ type: "success", message: "Annual financial summary generated." })}
                >
                  <Download className="mb-2 h-6 w-6" />
                  Annual Financial Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={showFeeDialog}
        onOpenChange={(open) => {
          setShowFeeDialog(open)
          if (!open) {
            resetFeeForm()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFeeId ? "Edit Fee Structure" : "Update Fee Structure"}</DialogTitle>
            <DialogDescription>Set fee amounts for each category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="class">Class</Label>
              <Select
                value={feeForm.className}
                onValueChange={(value) => setFeeForm((previous) => ({ ...previous, className: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JSS 1">JSS 1</SelectItem>
                  <SelectItem value="JSS 2">JSS 2</SelectItem>
                  <SelectItem value="JSS 3">JSS 3</SelectItem>
                  <SelectItem value="SS 1">SS 1</SelectItem>
                  <SelectItem value="SS 2">SS 2</SelectItem>
                  <SelectItem value="SS 3">SS 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tuition">Tuition (₦)</Label>
                <Input
                  id="tuition"
                  type="number"
                  value={feeForm.tuition}
                  onChange={(event) => setFeeForm((previous) => ({ ...previous, tuition: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="development">Development (₦)</Label>
                <Input
                  id="development"
                  type="number"
                  value={feeForm.development}
                  onChange={(event) => setFeeForm((previous) => ({ ...previous, development: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="exam">Exam (₦)</Label>
                <Input
                  id="exam"
                  type="number"
                  value={feeForm.exam}
                  onChange={(event) => setFeeForm((previous) => ({ ...previous, exam: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="sports">Sports (₦)</Label>
                <Input
                  id="sports"
                  type="number"
                  value={feeForm.sports}
                  onChange={(event) => setFeeForm((previous) => ({ ...previous, sports: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="library">Library (₦)</Label>
                <Input
                  id="library"
                  type="number"
                  value={feeForm.library}
                  onChange={(event) => setFeeForm((previous) => ({ ...previous, library: event.target.value }))}
                />
              </div>
              <div>
                <Label>Total Payable</Label>
                <div className="rounded bg-gray-100 p-2 font-bold text-[#2d682d]">₦{feeFormTotal.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)} disabled={updatingFee}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateFeeStructure()}
              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
              disabled={updatingFee}
            >
              {updatingFee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Fee Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open)
          if (!open) {
            setFeeToSend(null)
            setParentOptions([])
            setSelectedParentEmail("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Fee Structure to Parent</DialogTitle>
            <DialogDescription>
              {feeToSend
                ? `Share the ${feeToSend.className} fee breakdown with a parent.`
                : "Select a parent to receive the fee details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-select">Parent</Label>
              {isLoadingParents ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading parents...
                </div>
              ) : parentOptions.length > 0 ? (
                <Select value={selectedParentEmail} onValueChange={setSelectedParentEmail}>
                  <SelectTrigger id="parent-select">
                    <SelectValue placeholder="Select a parent" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent.parentEmail} value={parent.parentEmail}>
                        {parent.parentName} — {parent.studentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                  No parents found for this class yet.
                </p>
              )}
            </div>
            {feeToSend && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium text-[#2d682d]">{feeToSend.className} Fee Summary</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Tuition</span>
                    <span>{formatCurrency(feeToSend.tuition)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Development</span>
                    <span>{formatCurrency(feeToSend.development)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exam</span>
                    <span>{formatCurrency(feeToSend.exam)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sports</span>
                    <span>{formatCurrency(feeToSend.sports)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Library</span>
                    <span>{formatCurrency(feeToSend.library)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 font-medium text-[#2d682d]">
                    <span>Total</span>
                    <span>{formatCurrency(feeToSend.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={isSendingFee}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
              onClick={() => void handleSendFeeStructure()}
              disabled={isSendingFee || !feeToSend || parentOptions.length === 0}
            >
              {isSendingFee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Fee Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print Receipt</DialogTitle>
            <DialogDescription>Receipt for {selectedReceipt?.studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
            <div className="flex flex-col gap-4 border-b border-dashed border-gray-300 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {resolvedLogo ? (
                    <img
                      src={resolvedLogo}
                      alt={`${resolvedSchoolName} logo`}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full border border-[#2d682d]/40 flex items-center justify-center text-[10px] font-bold text-[#2d682d]">
                      LOGO
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-[#2d682d] uppercase tracking-wide">{resolvedSchoolName}</h3>
                    <p className="text-xs text-gray-600 max-w-[220px]">{resolvedAddress}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p className="font-semibold text-[#2d682d]">
                    Receipt #{selectedReceipt?.receiptNumber ?? "--"}
                  </p>
                  <p>{selectedReceipt?.dateIssued ?? "--"}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 text-center uppercase tracking-wide">
                Official Payment Receipt
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-medium">{selectedReceipt?.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-medium">{selectedReceipt ? formatCurrency(selectedReceipt.amount) : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span>Reference:</span>
                <span className="font-medium">{selectedReceipt?.reference ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium">{selectedReceipt?.dateIssued ?? "--"}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-dashed border-gray-300">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-[#2d682d]">Accountant:</span> {selectedReceipt?.issuedBy ?? accountant.name}
                  </p>
                  <p className="text-xs text-gray-500">Thank you for keeping your account up to date.</p>
                </div>
                <div className="text-right">
                  {resolvedSignature ? (
                    <img
                      src={resolvedSignature}
                      alt={`${resolvedHeadmasterName} signature`}
                      className="h-12 w-32 object-contain ml-auto"
                    />
                  ) : (
                    <div className="h-12 w-32 border-b border-[#2d682d]/60 ml-auto"></div>
                  )}
                  <p className="mt-2 text-xs font-semibold text-[#2d682d] uppercase">{resolvedHeadmasterName}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Headmaster</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const runtime = getBrowserRuntime()
                if (runtime?.open && selectedReceipt) {
                  const printWindow = runtime.open("", "PRINT", "height=600,width=400")
                  if (printWindow && printWindow.document) {
                    const logoMarkup = resolvedLogo
                      ? `<div style="text-align:center;margin-bottom:12px;"><img src="${resolvedLogo}" alt="${resolvedSchoolName} logo" style="height:64px;object-fit:contain;" /></div>`
                      : `<h2 style="color:#2d682d;text-align:center;margin-bottom:4px;">${resolvedSchoolName}</h2>`
                    const headerMarkup = `
                      <div style="text-align:center;">
                        ${logoMarkup}
                        <p style="margin:0;font-weight:700;color:#2d682d;text-transform:uppercase;">${resolvedSchoolName}</p>
                        <p style="margin:0;color:#555;font-size:12px;">${resolvedAddress}</p>
                        <p style="margin-top:8px;font-size:13px;font-weight:600;color:#444;">Official Payment Receipt</p>
                      </div>
                    `
                    const signatureMarkup = resolvedSignature
                      ? `<div style="margin-top:32px;text-align:right;">
                          <img src="${resolvedSignature}" alt="${resolvedHeadmasterName} signature" style="height:48px;width:160px;object-fit:contain;margin-bottom:4px;" />
                          <div style="font-size:11px;font-weight:bold;color:#2d682d;text-transform:uppercase;">${resolvedHeadmasterName}</div>
                          <div style="font-size:10px;color:#777;">Headmaster</div>
                        </div>`
                      : `<div style="margin-top:32px;text-align:right;">
                          <div style="height:48px;width:160px;border-bottom:1px solid #2d682d66;margin-left:auto;"></div>
                          <div style="font-size:11px;font-weight:bold;color:#2d682d;text-transform:uppercase;margin-top:4px;">${resolvedHeadmasterName}</div>
                          <div style="font-size:10px;color:#777;">Headmaster</div>
                        </div>`

                    printWindow.document.write("<html><head><title>Receipt</title></head><body style=\"font-family:Arial,sans-serif;padding:24px;color:#222;\">")
                    printWindow.document.write(headerMarkup)
                    printWindow.document.write(`<p style="margin-top:16px;"><strong>Receipt Number:</strong> ${selectedReceipt.receiptNumber}</p>`)
                    printWindow.document.write(`<p><strong>Student:</strong> ${selectedReceipt.studentName}</p>`)
                    printWindow.document.write(`<p><strong>Amount:</strong> ${formatCurrency(selectedReceipt.amount)}</p>`)
                    printWindow.document.write(`<p><strong>Reference:</strong> ${selectedReceipt.reference ?? "--"}</p>`)
                    printWindow.document.write(`<p><strong>Date:</strong> ${selectedReceipt.dateIssued}</p>`)
                    printWindow.document.write(`<p><strong>Accountant:</strong> ${selectedReceipt.issuedBy ?? accountant.name}</p>`)
                    printWindow.document.write(signatureMarkup)
                    printWindow.document.write("</body></html>")
                    printWindow.document.close()
                    printWindow.focus()
                    printWindow.print()
                    printWindow.close()
                  }
                }
                setShowReceiptDialog(false)
              }}
              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
