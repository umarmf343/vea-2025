"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Search, CheckCircle, XCircle, Clock, DollarSign, Loader2 } from "lucide-react"
import { ParentAccessManager } from "@/components/parent-access-manager"

interface PaymentRecord {
  id: string
  studentName: string
  parentName: string
  amount: number
  status: "paid" | "pending" | "failed"
  method: "online" | "offline"
  date: string
  reference?: string
  hasAccess: boolean
  email?: string
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
  metadata?: Record<string, any>
}

function mapPayment(record: ApiPaymentRecord): PaymentRecord {
  const metadata = record.metadata ?? {}
  const rawMethod =
    (metadata.payment_channel as string | undefined) ??
    (metadata.method as string | undefined) ??
    record.paymentType ??
    "online"
  const normalizedMethod = rawMethod.toLowerCase()
  const method: PaymentRecord["method"] =
    normalizedMethod === "offline" || normalizedMethod === "manual" ? "offline" : "online"
  const hasAccess = Boolean((metadata as Record<string, unknown>).accessGranted)
  const studentName =
    (metadata.studentName as string | undefined) ??
    (metadata.student_name as string | undefined) ??
    "Unknown Student"
  const parentName =
    (metadata.parentName as string | undefined) ??
    (metadata.parent_name as string | undefined) ??
    "Parent"
  const parentEmail =
    (metadata.parentEmail as string | undefined) ??
    (metadata.parent_email as string | undefined) ??
    record.email
  const status: PaymentRecord["status"] =
    record.status === "completed" ? "paid" : record.status === "failed" ? "failed" : "pending"

  return {
    id: record.id,
    studentName,
    parentName,
    amount: Number(record.amount ?? 0),
    status,
    method,
    date: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "--",
    reference: record.reference,
    hasAccess,
    email: parentEmail,
  }
}

type StatusFilter = "all" | PaymentRecord["status"]

export function PaymentManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/payments/records")
      if (!response.ok) {
        throw new Error("Unable to load payment records")
      }

      const data = (await response.json()) as { payments: ApiPaymentRecord[] }
      setPayments(data.payments.map(mapPayment))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load payments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const url = new URL("/api/realtime/stream", window.location.origin)
    url.searchParams.set("userId", "admin-payments")
    url.searchParams.set("role", "admin")

    const eventSource = new EventSource(url.toString())
    eventSourceRef.current = eventSource

    const handleNotification = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as {
          category?: string
          meta?: Record<string, unknown>
        }

        if (payload.category?.toLowerCase() === "payment") {
          void loadPayments()
        }
      } catch (parseError) {
        console.error("Failed to parse realtime notification:", parseError)
      }
    }

    eventSource.addEventListener("notification", handleNotification)

    eventSource.addEventListener("error", () => {
      console.warn("Realtime connection for payments interrupted. Retrying sync…")
      setTimeout(() => {
        void loadPayments()
      }, 1000)
    })

    return () => {
      eventSource.removeEventListener("notification", handleNotification)
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [loadPayments])

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter) {
        return false
      }

      const term = searchTerm.trim().toLowerCase()
      if (!term) {
        return true
      }
      return (
        payment.studentName.toLowerCase().includes(term) ||
        payment.parentName.toLowerCase().includes(term) ||
        (payment.reference ?? "").toLowerCase().includes(term)
      )
    })
  }, [payments, searchTerm, statusFilter])

  const totals = useMemo(() => {
    const totalRevenue = payments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0)

    const pendingCount = payments.filter((payment) => payment.status === "pending").length
    const failedCount = payments.filter((payment) => payment.status === "failed").length

    return {
      totalRevenue,
      pendingCount,
      failedCount,
    }
  }, [payments])

  const updateAccess = useCallback(
    async (paymentId: string, hasAccess: boolean) => {
      setUpdatingId(paymentId)
      setError(null)

      try {
        const response = await fetch("/api/payments/records", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          status: hasAccess ? "completed" : "pending",
          accessGranted: hasAccess,
          metadata: {
            accessUpdatedBy: "admin",
            accessUpdateReason: hasAccess ? "manual-grant" : "manual-revoke",
          },
        }),
        })

        if (!response.ok) {
          throw new Error("Failed to update payment access")
        }

        const data = (await response.json()) as { payment: ApiPaymentRecord }
        setPayments((previous) => previous.map((payment) => (payment.id === paymentId ? mapPayment(data.payment) : payment)))
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to update payment access")
      } finally {
        setUpdatingId(null)
      }
    },
    [],
  )

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#2d682d]" />
          <span className="text-[#2d682d]">Loading payment data…</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-red-700">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadPayments()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 [@media(min-width:420px)]:grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Total Revenue"
          icon={DollarSign}
          value={`₦${totals.totalRevenue.toLocaleString()}`}
          description="Completed transactions"
          tone="text-[#2d682d]"
        />
        <StatCard
          title="Paid"
          icon={CheckCircle}
          value={payments.filter((payment) => payment.status === "paid").length.toString()}
          description="Successful payments"
          tone="text-green-600"
        />
        <StatCard
          title="Pending"
          icon={Clock}
          value={totals.pendingCount.toString()}
          description="Awaiting confirmation"
          tone="text-yellow-600"
        />
        <StatCard
          title="Failed"
          icon={XCircle}
          value={totals.failedCount.toString()}
          description="Failed or reversed"
          tone="text-red-600"
        />
      </div>

      <Card className="border-[#b29032]/20">
        <CardHeader className="space-y-3 md:flex md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#2d682d]">
              <CreditCard className="h-5 w-5" /> Payment Records
            </CardTitle>
            <CardDescription>Review and manage fee payments from parents</CardDescription>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search student, parent, or reference"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-0">
          <div className="px-4 pt-4">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              className="w-full"
            >
              <div className="w-full overflow-x-auto">
                <TabsList className="flex w-max flex-nowrap gap-1 rounded-md bg-green-50 p-1">
                  <TabsTrigger
                    value="all"
                    className="min-w-[100px] px-3 py-2 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="paid"
                    className="min-w-[100px] px-3 py-2 text-xs capitalize data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
                  >
                    Paid
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className="min-w-[100px] px-3 py-2 text-xs capitalize data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
                  >
                    Pending
                  </TabsTrigger>
                  <TabsTrigger
                    value="failed"
                    className="min-w-[100px] px-3 py-2 text-xs capitalize data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
                  >
                    Failed
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Student</TableHead>
                  <TableHead className="whitespace-nowrap">Parent</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Method</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="hidden whitespace-nowrap md:table-cell">Reference</TableHead>
                  <TableHead className="whitespace-nowrap">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-[#2d682d]/20">
                          <AvatarFallback>{payment.studentName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-[#2d682d]">{payment.studentName}</p>
                          <p className="text-xs text-gray-500">{payment.email ?? "No email"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{payment.parentName}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium text-[#2d682d]">
                      ₦{payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(payment.status)}>{payment.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {payment.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{payment.date}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-gray-500 md:table-cell">
                      {payment.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {payment.hasAccess ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void updateAccess(payment.id, false)}
                            disabled={updatingId === payment.id}
                          >
                            {updatingId === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="ml-1">Revoke</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-[#2d682d] hover:bg-[#1a4a1a]"
                            onClick={() => void updateAccess(payment.id, true)}
                            disabled={updatingId === payment.id}
                          >
                            {updatingId === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            <span className="ml-1">Grant</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-gray-500">
                      No payment records match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ParentAccessManager description="Toggle report card access for parents who paid offline." />
    </div>
  )
}

function getStatusBadge(status: PaymentRecord["status"]) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "failed":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function StatCard({
  title,
  icon: Icon,
  value,
  description,
  tone,
}: {
  title: string
  icon: typeof CreditCard
  value: string
  description: string
  tone: string
}) {
  return (
    <Card className="border-[#2d682d]/20">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-full bg-[#2d682d]/10 p-2 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{description}</p>
          <p className="text-xl font-bold text-[#2d682d]">{value}</p>
          <p className="text-xs text-gray-500">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}
