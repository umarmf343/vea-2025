"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  ArrowUpRight,
  DollarSign,
  Download,
  Loader2,
  Printer,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts"

import { safeStorage } from "@/lib/safe-storage"
import { logger } from "@/lib/logger"
import type {
  DefaulterAnalyticsEntry,
  ExpenseRecord,
  FeePaymentRecord,
  FinancialAnalyticsSnapshot,
} from "@/lib/database"

interface FinancialReportsProps {
  userRole?: string
}

interface FinancialFilters {
  term: string
  startDate: string
  endDate: string
  className: string
}

const DEFAULT_ANALYTICS: FinancialAnalyticsSnapshot = {
  summary: {
    totalCollected: 0,
    totalExpenses: 0,
    netIncome: 0,
    collectionRate: 0,
    studentsPaid: 0,
    defaultersCount: 0,
    outstandingAmount: 0,
    avgCollectionTime: 0,
    onTimePaymentRate: 0,
  },
  monthly: [],
  classCollection: [],
  expenses: [],
  feeTypeBreakdown: [],
  defaulters: [],
  topDefaulters: [],
}

const PIE_COLORS = ["#14532d", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0"]

const TERM_OPTIONS = [
  { label: "All Terms", value: "" },
  { label: "Term 1", value: "Term 1" },
  { label: "Term 2", value: "Term 2" },
  { label: "Term 3", value: "Term 3" },
  { label: "Summer", value: "Summer" },
]

const CLASS_OPTIONS = [
  { label: "All Classes", value: "" },
  { label: "Nursery", value: "Nursery" },
  { label: "Primary", value: "Primary" },
  { label: "Junior Secondary", value: "Junior Secondary" },
  { label: "Senior Secondary", value: "Senior Secondary" },
]

const formatCurrency = (value: number): string => `₦${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

function buildRequestInit(init: RequestInit = {}): RequestInit {
  const token = safeStorage.getItem("vea_auth_token")
  const headers = new Headers(init.headers ?? {})

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return { ...init, headers, cache: "no-store" }
}

function normalizeFeePayments(records: unknown): FeePaymentRecord[] {
  if (!Array.isArray(records)) {
    return []
  }

  return records
    .filter((entry): entry is FeePaymentRecord => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      ...entry,
      amount: Number((entry as FeePaymentRecord).amount ?? 0),
    }))
}

function normalizeExpenses(records: unknown): ExpenseRecord[] {
  if (!Array.isArray(records)) {
    return []
  }

  return records
    .filter((entry): entry is ExpenseRecord => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      ...entry,
      amount: Number((entry as ExpenseRecord).amount ?? 0),
    }))
}

function normalizeAnalytics(snapshot: unknown): FinancialAnalyticsSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    return DEFAULT_ANALYTICS
  }

  const parsed = snapshot as FinancialAnalyticsSnapshot
  return {
    summary: {
      totalCollected: Number(parsed.summary?.totalCollected ?? 0),
      totalExpenses: Number(parsed.summary?.totalExpenses ?? 0),
      netIncome: Number(parsed.summary?.netIncome ?? 0),
      collectionRate: Number(parsed.summary?.collectionRate ?? 0),
      studentsPaid: Number(parsed.summary?.studentsPaid ?? 0),
      defaultersCount: Number(parsed.summary?.defaultersCount ?? 0),
      outstandingAmount: Number(parsed.summary?.outstandingAmount ?? 0),
      avgCollectionTime: Number(parsed.summary?.avgCollectionTime ?? 0),
      onTimePaymentRate: Number(parsed.summary?.onTimePaymentRate ?? 0),
    },
    monthly: Array.isArray(parsed.monthly) ? parsed.monthly : [],
    classCollection: Array.isArray(parsed.classCollection) ? parsed.classCollection : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    feeTypeBreakdown: Array.isArray(parsed.feeTypeBreakdown) ? parsed.feeTypeBreakdown : [],
    defaulters: Array.isArray(parsed.defaulters) ? parsed.defaulters : [],
    topDefaulters: Array.isArray(parsed.topDefaulters) ? parsed.topDefaulters : [],
  }
}

const ensureString = (value: unknown): string => (typeof value === "string" ? value : "")

export function FinancialReports({ userRole = "super_admin" }: FinancialReportsProps) {
  const normalizedRole = userRole.trim().toLowerCase().replace(/[\s-]+/g, "_")
  const [filters, setFilters] = useState<FinancialFilters>({ term: "", startDate: "", endDate: "", className: "" })
  const [analytics, setAnalytics] = useState<FinancialAnalyticsSnapshot>(DEFAULT_ANALYTICS)
  const [collections, setCollections] = useState<FeePaymentRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [defaulters, setDefaulters] = useState<DefaulterAnalyticsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [defaulterDialogOpen, setDefaulterDialogOpen] = useState(false)
  const [selectedDefaulter, setSelectedDefaulter] = useState<DefaulterAnalyticsEntry | null>(null)

  const hasFinancialData = useMemo(() => {
    return (
      analytics.summary.totalCollected > 0 ||
      analytics.summary.totalExpenses > 0 ||
      analytics.summary.outstandingAmount > 0 ||
      collections.length > 0 ||
      expenses.length > 0
    )
  }, [analytics.summary, collections.length, expenses.length])

  const loadFinancialData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (filters.term) {
      params.set("term", filters.term)
    }
    if (filters.startDate) {
      params.set("startDate", filters.startDate)
    }
    if (filters.endDate) {
      params.set("endDate", filters.endDate)
    }

    const classParams = new URLSearchParams(params)
    if (filters.className) {
      classParams.set("class", filters.className)
    }

    try {
      const [analyticsResponse, collectionsResponse, expensesResponse, defaultersResponse] = await Promise.all([
        fetch(`/api/finance/analytics?${classParams.toString()}`, buildRequestInit()),
        fetch(`/api/finance/collections?${params.toString()}`, buildRequestInit()),
        fetch(`/api/finance/expenses?${params.toString()}`, buildRequestInit()),
        fetch(`/api/finance/defaulters?${classParams.toString()}`, buildRequestInit()),
      ])

      if ([analyticsResponse, collectionsResponse, expensesResponse, defaultersResponse].some((response) => response.status === 401)) {
        throw new Error("You are not authorised to view financial reports.")
      }

      const analyticsPayload = (await analyticsResponse.json().catch(() => ({}))) as { analytics?: unknown }
      const collectionsPayload = (await collectionsResponse.json().catch(() => ({}))) as { collections?: unknown }
      const expensesPayload = (await expensesResponse.json().catch(() => ({}))) as { expenses?: unknown }
      const defaultersPayload = (await defaultersResponse.json().catch(() => ({}))) as { defaulters?: unknown }

      const resolvedAnalytics = normalizeAnalytics(analyticsPayload.analytics)
      setAnalytics(resolvedAnalytics)
      setCollections(normalizeFeePayments(collectionsPayload.collections))
      setExpenses(normalizeExpenses(expensesPayload.expenses))
      setDefaulters(
        Array.isArray(defaultersPayload.defaulters)
          ? (defaultersPayload.defaulters as DefaulterAnalyticsEntry[])
          : resolvedAnalytics.defaulters,
      )
    } catch (err) {
      logger.error("Failed to load financial reports", { error: err instanceof Error ? err.message : err })
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial reports. Please contact your accountant for assistance.",
      )
      setAnalytics(DEFAULT_ANALYTICS)
      setCollections([])
      setExpenses([])
      setDefaulters([])
    } finally {
      setLoading(false)
    }
  }, [filters.className, filters.endDate, filters.startDate, filters.term])

  useEffect(() => {
    if (normalizedRole !== "super_admin") {
      setError("Only super administrators can access financial reports.")
      setLoading(false)
      return
    }

    void loadFinancialData()
  }, [loadFinancialData, normalizedRole])

  const selectDefaulter = useCallback((entry: DefaulterAnalyticsEntry) => {
    setSelectedDefaulter(entry)
    setDefaulterDialogOpen(true)
  }, [])

  const defaulterHistory = useMemo(() => {
    if (!selectedDefaulter) {
      return []
    }

    const studentId = ensureString(selectedDefaulter.studentId).toLowerCase()
    const studentName = ensureString(selectedDefaulter.studentName).toLowerCase()

    return collections.filter((payment) => {
      const idMatches = ensureString(payment.studentId).toLowerCase() === studentId && studentId.length > 0
      const nameMatches = ensureString(payment.studentName).toLowerCase() === studentName && studentName.length > 0
      return idMatches || nameMatches
    })
  }, [collections, selectedDefaulter])

  const handleExportCsv = useCallback(() => {
    const runtime =
      typeof globalThis === "undefined"
        ? null
        : (globalThis as typeof globalThis & { document?: Document; URL?: typeof URL })

    if (!runtime?.document) {
      logger.warn("CSV export requested outside of browser runtime")
      return
    }

    const rows: string[][] = []
    rows.push(["Section", "Metric", "Value"])
    rows.push(["Summary", "Total Collected", analytics.summary.totalCollected.toString()])
    rows.push(["Summary", "Total Expenses", analytics.summary.totalExpenses.toString()])
    rows.push(["Summary", "Net Income", analytics.summary.netIncome.toString()])
    rows.push(["Summary", "Collection Rate", `${analytics.summary.collectionRate}%`])
    rows.push(["Summary", "Outstanding", analytics.summary.outstandingAmount.toString()])

    rows.push([])
    rows.push(["Collections", "Student", "Amount", "Fee Type", "Method", "Date"])
    for (const payment of collections) {
      rows.push([
        "Collections",
        payment.studentName,
        payment.amount.toString(),
        payment.feeType,
        payment.paymentMethod,
        payment.paymentDate,
      ])
    }

    rows.push([])
    rows.push(["Expenses", "Category", "Amount", "Description", "Date"])
    for (const expense of expenses) {
      rows.push(["Expenses", expense.category, expense.amount.toString(), expense.description, expense.expenseDate])
    }

    rows.push([])
    rows.push(["Defaulters", "Student", "Class", "Outstanding", "Expected", "Paid", "Waived"])
    for (const entry of defaulters) {
      rows.push([
        "Defaulters",
        entry.studentName,
        entry.className ?? "",
        entry.outstanding.toString(),
        entry.expected.toString(),
        entry.paid.toString(),
        entry.waived.toString(),
      ])
    }

    const csvContent = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = (runtime.URL ?? URL).createObjectURL(blob)
    const link = runtime.document.createElement("a")
    link.href = url
    link.download = "financial-reports.csv"
    link.click()
    ;(runtime.URL ?? URL).revokeObjectURL(url)
  }, [analytics.summary, collections, expenses, defaulters])

  const handleExportPdf = useCallback(() => {
    const runtime =
      typeof globalThis === "undefined"
        ? null
        : (globalThis as typeof globalThis & { open?: Window["open"] })

    if (!runtime?.open) {
      logger.warn("PDF export requested outside of browser runtime")
      return
    }

    const win = runtime.open("", "_blank")
    if (!win) {
      return
    }

    const summary = analytics.summary
    const summaryTable = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">Metric</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="border:1px solid #ccc;padding:8px;">Total Collected</td><td style="border:1px solid #ccc;padding:8px;">${formatCurrency(summary.totalCollected)}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Total Expenses</td><td style="border:1px solid #ccc;padding:8px;">${formatCurrency(summary.totalExpenses)}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Net Income</td><td style="border:1px solid #ccc;padding:8px;">${formatCurrency(summary.netIncome)}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Collection Rate</td><td style="border:1px solid #ccc;padding:8px;">${summary.collectionRate.toFixed(2)}%</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Outstanding</td><td style="border:1px solid #ccc;padding:8px;">${formatCurrency(summary.outstandingAmount)}</td></tr>
        </tbody>
      </table>
    `

    const topDefaultersRows = defaulters
      .slice(0, 10)
      .map(
        (entry) => `
        <tr>
          <td style="border:1px solid #ccc;padding:8px;">${entry.studentName}</td>
          <td style="border:1px solid #ccc;padding:8px;">${entry.className ?? ""}</td>
          <td style="border:1px solid #ccc;padding:8px;">${formatCurrency(entry.outstanding)}</td>
        </tr>
      `,
      )
      .join("")

    win.document.write(`
      <html>
        <head>
          <title>Financial Reports</title>
        </head>
        <body style="font-family:Arial, sans-serif;padding:24px;">
          <h1 style="color:#14532d;">Financial Reports</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          ${summaryTable}
          <h2 style="margin-top:24px;">Top Defaulters</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
              <tr>
                <th style="border:1px solid #ccc;padding:8px;text-align:left;">Student</th>
                <th style="border:1px solid #ccc;padding:8px;text-align:left;">Class</th>
                <th style="border:1px solid #ccc;padding:8px;text-align:left;">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${topDefaultersRows || "<tr><td colspan=3 style='border:1px solid #ccc;padding:8px;'>No defaulters recorded.</td></tr>"}
            </tbody>
          </table>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }, [analytics.summary, defaulters])

  const outstandingTrend = useMemo(() => {
    return analytics.topDefaulters.slice(0, 5)
  }, [analytics.topDefaulters])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#14532d]">Financial Reports</h2>
          <p className="text-sm text-muted-foreground">
            Live analytics built directly from accountant-submitted collections and expenses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={loading || normalizedRole !== "super_admin"}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={loading || normalizedRole !== "super_admin"}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading financial reports…
          </CardContent>
        </Card>
      ) : null}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">Unable to load reports</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !hasFinancialData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold">No financial records found.</p>
            <p className="text-sm text-muted-foreground">
              Ask your accountant to record collections or expenses in the Accountant Dashboard to populate these
              reports.
            </p>
            <Button asChild>
              <a href="#accountant-dashboard">Go to Accountant Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && hasFinancialData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.summary.totalCollected)}</div>
                <p className="text-xs text-muted-foreground">Captured from accountant ledger</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <Printer className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.summary.totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">Approved and logged by accountant</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.summary.collectionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Percentage of fees collected vs expected</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.summary.outstandingAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  Across {analytics.summary.defaultersCount} students with unpaid balances
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter reports by term, class, or date range.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label>Term</Label>
                  <Select value={filters.term} onValueChange={(value) => setFilters((prev) => ({ ...prev, term: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Class</Label>
                  <Select
                    value={filters.className}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, className: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="report-start">Start Date</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="report-end">End Date</Label>
                  <Input
                    id="report-end"
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void loadFinancialData()} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({ term: "", className: "", startDate: "", endDate: "" })
                    void loadFinancialData()
                  }}
                  disabled={loading}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="collections" className="w-full">
            <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-4">
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="defaulters">Defaulters</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="collections" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Collections</CardTitle>
                  <CardDescription>All fee payments logged by the accountant.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Class</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Fee Type</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Method</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Receipt</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {collections.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{payment.studentName}</div>
                              <div className="text-xs text-muted-foreground">Term: {payment.term || "—"}</div>
                            </td>
                            <td className="px-3 py-2">{payment.className || "—"}</td>
                            <td className="px-3 py-2">{payment.feeType}</td>
                            <td className="px-3 py-2 font-semibold">{formatCurrency(payment.amount)}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline">{payment.paymentMethod}</Badge>
                            </td>
                            <td className="px-3 py-2 text-xs">{payment.receiptNumber || "—"}</td>
                            <td className="px-3 py-2 text-xs">
                              {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>Operational spend logged by the accountant.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Approved By</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <Badge variant="secondary">{expense.category}</Badge>
                            </td>
                            <td className="px-3 py-2 font-semibold">{formatCurrency(expense.amount)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{expense.description}</td>
                            <td className="px-3 py-2">{expense.approvedBy}</td>
                            <td className="px-3 py-2 text-xs">
                              {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="defaulters" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Defaulters</CardTitle>
                  <CardDescription>Computed from total fees, payments, and waivers.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  {defaulters.map((entry) => (
                    <Card key={`${entry.studentId}-${entry.term}`} className="border border-red-100">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-base">{entry.studentName}</CardTitle>
                          <CardDescription>
                            {entry.className || "Class unknown"} • {entry.term || "Term not specified"}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">{formatCurrency(entry.outstanding)}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Expected</p>
                            <p className="font-semibold">{formatCurrency(entry.expected)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Paid</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(entry.paid)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Waived</p>
                            <p className="font-semibold">{formatCurrency(entry.waived)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Contact</p>
                            <p className="font-semibold">{entry.parentEmail || entry.parentPhone || "Unavailable"}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => selectDefaulter(entry)}>
                          View Payment History <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Income vs Expenses</CardTitle>
                    <CardDescription>Real-time cash flow sourced from accountant data.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    {analytics.monthly.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No monthly data for the selected filters.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.monthly}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} />
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          <Line type="monotone" dataKey="collected" stroke="#15803d" strokeWidth={2} />
                          <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Fee Type Breakdown</CardTitle>
                    <CardDescription>How collections are distributed across fee types.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    {analytics.feeTypeBreakdown.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No fee type data available.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.feeTypeBreakdown}
                            dataKey="amount"
                            nameKey="feeType"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={4}
                          >
                            {analytics.feeTypeBreakdown.map((entry, index) => (
                              <Cell key={entry.feeType} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Class Collections</CardTitle>
                    <CardDescription>Expected vs collected per class.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    {analytics.classCollection.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No class collection analytics available.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.classCollection}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="className" />
                          <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} />
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="collected" fill="#14532d" name="Collected" />
                          <Bar dataKey="expected" fill="#86efac" name="Expected" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Expense Categories</CardTitle>
                    <CardDescription>Monitor spending distribution.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-72">
                    {analytics.expenses.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No expense analytics available.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.expenses}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} />
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#f97316" name="Amount" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Defaulters</CardTitle>
                  <CardDescription>Students with the largest outstanding balances.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {outstandingTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outstanding balances 🎉</p>
                  ) : (
                    outstandingTrend.map((entry) => (
                      <div key={`${entry.studentId}-${entry.term}`} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{entry.studentName}</p>
                          <p className="text-xs text-muted-foreground">{entry.className || "Class unknown"}</p>
                        </div>
                        <Badge variant="outline">{formatCurrency(entry.outstanding)}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={defaulterDialogOpen} onOpenChange={setDefaulterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
          </DialogHeader>
          {selectedDefaulter ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="text-lg font-semibold">{selectedDefaulter.studentName}</p>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Fee Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Method</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {defaulterHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No recorded payments for this student within the selected filters.
                        </td>
                      </tr>
                    ) : (
                      defaulterHistory.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-2 text-xs">
                            {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-3 py-2">{payment.feeType}</td>
                          <td className="px-3 py-2 font-semibold">{formatCurrency(payment.amount)}</td>
                          <td className="px-3 py-2 text-xs">{payment.paymentMethod}</td>
                          <td className="px-3 py-2 text-xs">{payment.receiptNumber || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
