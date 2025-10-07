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
  AlertTriangle,
  BarChart2,
  BookOpenCheck,
  DollarSign,
  Loader2,
  Plus,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
} from "recharts"

import { TutorialLink } from "@/components/tutorial-link"
import { NotificationCenter } from "@/components/notification-center"
import { FeeConfigurationPanel } from "@/components/accountant/fee-configuration-panel"
import { logger } from "@/lib/logger"
import { safeStorage } from "@/lib/safe-storage"
import type {
  DefaulterAnalyticsEntry,
  ExpenseCategory,
  ExpenseRecord,
  FeePaymentRecord,
  FeeWaiverRecord,
  FinancialAnalyticsSnapshot,
} from "@/lib/database"

interface AccountantDashboardProps {
  accountant: {
    id: string
    name: string
    email: string
  }
}

interface BannerState {
  type: "success" | "error"
  message: string
}

interface CollectionFormState {
  studentId: string
  studentName: string
  classId: string
  className: string
  feeType: string
  amount: string
  paymentMethod: string
  paymentDate: string
  receiptNumber: string
  paymentReference: string
  term: string
}

interface ExpenseFormState {
  category: ExpenseCategory
  amount: string
  expenseDate: string
  description: string
  receiptReference: string
  approvedBy: string
  documentUrl: string
}

interface WaiverFormState {
  amount: string
  reason: string
  notes: string
}

interface FinancialFilters {
  term: string
  startDate: string
  endDate: string
  className: string
}

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "POS", "Cheque", "Scholarship"]

const FEE_TYPES = [
  "Tuition",
  "Exam",
  "Uniform",
  "Development",
  "Library",
  "Technology",
  "Transport",
  "Other",
]

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Salaries",
  "Utilities",
  "Supplies",
  "Maintenance",
  "Transport",
  "Training",
  "Technology",
  "Miscellaneous",
]

const PIE_COLORS = ["#2d682d", "#49a84d", "#7bc47f", "#a5d6a7", "#dcedc8", "#8bc34a", "#558b2f", "#33691e"]

const formatCurrency = (value: number): string => `₦${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

const todayIso = () => new Date().toISOString().slice(0, 10)

const normaliseString = (value: string): string => value.trim()

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

const parseDateForDisplay = (value: string | null | undefined): string => {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleDateString()
}

function extractStudentInitials(name: string): string {
  if (!name) {
    return "?"
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3)
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

function normalizeFeePayment(records: unknown): FeePaymentRecord[] {
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

function normalizeExpenseRecords(records: unknown): ExpenseRecord[] {
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

function normalizeWaiverRecords(records: unknown): FeeWaiverRecord[] {
  if (!Array.isArray(records)) {
    return []
  }

  return records.filter((entry): entry is FeeWaiverRecord => typeof entry === "object" && entry !== null)
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

function useFinancialFilters(): [FinancialFilters, (updater: Partial<FinancialFilters>) => void] {
  const [filters, setFilters] = useState<FinancialFilters>({
    term: "",
    startDate: "",
    endDate: "",
    className: "",
  })

  const updateFilters = useCallback((update: Partial<FinancialFilters>) => {
    setFilters((previous) => ({ ...previous, ...update }))
  }, [])

  return [filters, updateFilters]
}

export function AccountantDashboard({ accountant }: AccountantDashboardProps) {
  const [filters, updateFilters] = useFinancialFilters()
  const [collections, setCollections] = useState<FeePaymentRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [waivers, setWaivers] = useState<FeeWaiverRecord[]>([])
  const [defaulters, setDefaulters] = useState<DefaulterAnalyticsEntry[]>([])
  const [analytics, setAnalytics] = useState<FinancialAnalyticsSnapshot>(DEFAULT_ANALYTICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [activeTab, setActiveTab] = useState("collections")

  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [waiverDialogOpen, setWaiverDialogOpen] = useState(false)
  const [partialPaymentDialogOpen, setPartialPaymentDialogOpen] = useState(false)
  const [selectedDefaulter, setSelectedDefaulter] = useState<DefaulterAnalyticsEntry | null>(null)

  const [collectionForm, setCollectionForm] = useState<CollectionFormState>({
    studentId: "",
    studentName: "",
    classId: "",
    className: "",
    feeType: FEE_TYPES[0] ?? "Tuition",
    amount: "",
    paymentMethod: PAYMENT_METHODS[0] ?? "Cash",
    paymentDate: todayIso(),
    receiptNumber: "",
    paymentReference: "",
    term: "",
  })

  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    category: (EXPENSE_CATEGORIES[0] ?? "Salaries") as ExpenseCategory,
    amount: "",
    expenseDate: todayIso(),
    description: "",
    receiptReference: "",
    approvedBy: accountant.name,
    documentUrl: "",
  })

  const [waiverForm, setWaiverForm] = useState<WaiverFormState>({ amount: "", reason: "", notes: "" })

  const [isSavingCollection, setIsSavingCollection] = useState(false)
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [isSavingWaiver, setIsSavingWaiver] = useState(false)

  const hasFinancialData =
    collections.length > 0 ||
    expenses.length > 0 ||
    waivers.length > 0 ||
    analytics.summary.totalCollected > 0 ||
    analytics.summary.totalExpenses > 0

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
      const [collectionsResponse, expensesResponse, waiversResponse, analyticsResponse, defaultersResponse] =
        await Promise.all([
          fetch(`/api/finance/collections?${params.toString()}`, buildRequestInit()),
          fetch(`/api/finance/expenses?${params.toString()}`, buildRequestInit()),
          fetch(`/api/finance/waivers?${params.toString()}`, buildRequestInit()),
          fetch(`/api/finance/analytics?${classParams.toString()}`, buildRequestInit()),
          fetch(`/api/finance/defaulters?${classParams.toString()}`, buildRequestInit()),
        ])

      if (collectionsResponse.status === 401 || expensesResponse.status === 401) {
        throw new Error("You are not authorized to view financial data.")
      }

      const collectionsPayload = (await collectionsResponse.json().catch(() => ({}))) as {
        collections?: unknown
      }
      const expensesPayload = (await expensesResponse.json().catch(() => ({}))) as {
        expenses?: unknown
      }
      const waiversPayload = (await waiversResponse.json().catch(() => ({}))) as {
        waivers?: unknown
      }
      const analyticsPayload = (await analyticsResponse.json().catch(() => ({}))) as {
        analytics?: unknown
      }
      const defaultersPayload = (await defaultersResponse.json().catch(() => ({}))) as {
        defaulters?: unknown
      }

      setCollections(normalizeFeePayment(collectionsPayload.collections))
      setExpenses(normalizeExpenseRecords(expensesPayload.expenses))
      setWaivers(normalizeWaiverRecords(waiversPayload.waivers))

      const resolvedAnalytics = normalizeAnalytics(analyticsPayload.analytics)
      setAnalytics(resolvedAnalytics)

      const resolvedDefaulters = Array.isArray(defaultersPayload.defaulters)
        ? (defaultersPayload.defaulters as DefaulterAnalyticsEntry[])
        : resolvedAnalytics.defaulters
      setDefaulters(resolvedDefaulters)
    } catch (err) {
      logger.error("Failed to load financial data", { error: err instanceof Error ? err.message : err })
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial records. Please try again or contact your administrator.",
      )
      setCollections([])
      setExpenses([])
      setWaivers([])
      setDefaulters([])
      setAnalytics(DEFAULT_ANALYTICS)
    } finally {
      setLoading(false)
    }
  }, [filters.className, filters.endDate, filters.startDate, filters.term])

  useEffect(() => {
    void loadFinancialData()
  }, [loadFinancialData])

  const resetCollectionForm = useCallback(() => {
    setCollectionForm({
      studentId: "",
      studentName: "",
      classId: "",
      className: "",
      feeType: FEE_TYPES[0] ?? "Tuition",
      amount: "",
      paymentMethod: PAYMENT_METHODS[0] ?? "Cash",
      paymentDate: todayIso(),
      receiptNumber: "",
      paymentReference: "",
      term: filters.term,
    })
  }, [filters.term])

  const resetExpenseForm = useCallback(() => {
    setExpenseForm({
      category: (EXPENSE_CATEGORIES[0] ?? "Salaries") as ExpenseCategory,
      amount: "",
      expenseDate: todayIso(),
      description: "",
      receiptReference: "",
      approvedBy: accountant.name,
      documentUrl: "",
    })
  }, [accountant.name])

  const resetWaiverForm = useCallback(() => {
    setWaiverForm({ amount: "", reason: "", notes: "" })
  }, [])

  const openCollectionDialog = useCallback(() => {
    resetCollectionForm()
    setCollectionDialogOpen(true)
  }, [resetCollectionForm])

  const handleCollectionFieldChange = useCallback((field: keyof CollectionFormState, value: string) => {
    setCollectionForm((previous) => ({ ...previous, [field]: value }))
  }, [])

  const handleExpenseFieldChange = useCallback((field: keyof ExpenseFormState, value: string) => {
    setExpenseForm((previous) => ({ ...previous, [field]: value }))
  }, [])

  const handleWaiverFieldChange = useCallback((field: keyof WaiverFormState, value: string) => {
    setWaiverForm((previous) => ({ ...previous, [field]: value }))
  }, [])

  const submitCollection = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault()
      if (isSavingCollection) {
        return
      }

      const amountValue = Number(collectionForm.amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setBanner({ type: "error", message: "Amount must be greater than zero." })
        return
      }

      if (!collectionForm.studentName.trim()) {
        setBanner({ type: "error", message: "Student name is required." })
        return
      }

      if (!collectionForm.term.trim()) {
        setBanner({ type: "error", message: "Please specify the academic term." })
        return
      }

      setIsSavingCollection(true)
      setBanner(null)

      try {
        const response = await fetch(
          "/api/finance/collections",
          buildRequestInit({
            method: "POST",
            body: JSON.stringify({
              studentId: normaliseString(collectionForm.studentId) || null,
              studentName: normaliseString(collectionForm.studentName),
              classId: normaliseString(collectionForm.classId) || null,
              className: normaliseString(collectionForm.className) || null,
              feeType: normaliseString(collectionForm.feeType) || "General",
              amount: amountValue,
              paymentDate: collectionForm.paymentDate || new Date().toISOString(),
              paymentMethod: normaliseString(collectionForm.paymentMethod) || "Cash",
              receiptNumber: normaliseString(collectionForm.receiptNumber) || undefined,
              paymentReference: normaliseString(collectionForm.paymentReference) || undefined,
              term: normaliseString(collectionForm.term),
            }),
          }),
        )

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? "Unable to record collection")
        }

        setBanner({ type: "success", message: "Collection recorded successfully." })
        setCollectionDialogOpen(false)
        setPartialPaymentDialogOpen(false)
        resetCollectionForm()
        await loadFinancialData()
      } catch (err) {
        logger.error("Failed to record collection", { error: err instanceof Error ? err.message : err })
        setBanner({
          type: "error",
          message: err instanceof Error ? err.message : "Unable to record collection. Please try again.",
        })
      } finally {
        setIsSavingCollection(false)
      }
    },
    [collectionForm, isSavingCollection, loadFinancialData, resetCollectionForm],
  )

  const submitExpense = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault()
      if (isSavingExpense) {
        return
      }

      const amountValue = Number(expenseForm.amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setBanner({ type: "error", message: "Expense amount must be greater than zero." })
        return
      }

      if (!expenseForm.description.trim()) {
        setBanner({ type: "error", message: "Please provide a description for this expense." })
        return
      }

      setIsSavingExpense(true)
      setBanner(null)

      try {
        const response = await fetch(
          "/api/finance/expenses",
          buildRequestInit({
            method: "POST",
            body: JSON.stringify({
              category: expenseForm.category,
              amount: amountValue,
              expenseDate: expenseForm.expenseDate || new Date().toISOString(),
              description: normaliseString(expenseForm.description),
              receiptReference: normaliseString(expenseForm.receiptReference) || undefined,
              approvedBy: normaliseString(expenseForm.approvedBy) || accountant.name,
              documentUrl: normaliseString(expenseForm.documentUrl) || undefined,
            }),
          }),
        )

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? "Unable to record expense")
        }

        setBanner({ type: "success", message: "Expense recorded successfully." })
        setExpenseDialogOpen(false)
        resetExpenseForm()
        await loadFinancialData()
      } catch (err) {
        logger.error("Failed to record expense", { error: err instanceof Error ? err.message : err })
        setBanner({
          type: "error",
          message: err instanceof Error ? err.message : "Unable to record expense. Please try again.",
        })
      } finally {
        setIsSavingExpense(false)
      }
    },
    [accountant.name, expenseForm, isSavingExpense, loadFinancialData, resetExpenseForm],
  )

  const submitWaiver = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault()
      if (isSavingWaiver) {
        return
      }

      if (!selectedDefaulter) {
        setBanner({ type: "error", message: "Select a defaulter to apply a waiver." })
        return
      }

      const amountValue = Number(waiverForm.amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setBanner({ type: "error", message: "Waiver amount must be greater than zero." })
        return
      }

      if (!waiverForm.reason.trim()) {
        setBanner({ type: "error", message: "Please provide a reason for the waiver." })
        return
      }

      setIsSavingWaiver(true)
      setBanner(null)

      try {
        const response = await fetch(
          "/api/finance/waivers",
          buildRequestInit({
            method: "POST",
            body: JSON.stringify({
              studentId: selectedDefaulter.studentId || null,
              studentName: selectedDefaulter.studentName,
              classId: null,
              className: selectedDefaulter.className,
              term: filters.term || selectedDefaulter.term,
              amount: amountValue,
              reason: normaliseString(waiverForm.reason),
              notes: normaliseString(waiverForm.notes) || undefined,
            }),
          }),
        )

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? "Unable to record waiver")
        }

        setBanner({ type: "success", message: "Waiver recorded successfully." })
        setWaiverDialogOpen(false)
        resetWaiverForm()
        await loadFinancialData()
      } catch (err) {
        logger.error("Failed to record waiver", { error: err instanceof Error ? err.message : err })
        setBanner({
          type: "error",
          message: err instanceof Error ? err.message : "Unable to record waiver. Please try again.",
        })
      } finally {
        setIsSavingWaiver(false)
      }
    },
    [filters.term, isSavingWaiver, loadFinancialData, resetWaiverForm, selectedDefaulter, waiverForm.amount, waiverForm.notes, waiverForm.reason],
  )

  const openPartialPaymentDialog = useCallback(
    (defaulter: DefaulterAnalyticsEntry) => {
      setSelectedDefaulter(defaulter)
      setCollectionForm({
        studentId: defaulter.studentId || "",
        studentName: defaulter.studentName,
        classId: "",
        className: defaulter.className ?? "",
        feeType: FEE_TYPES[0] ?? "Tuition",
        amount: String(defaulter.outstanding.toFixed(2)),
        paymentMethod: PAYMENT_METHODS[0] ?? "Cash",
        paymentDate: todayIso(),
        receiptNumber: "",
        paymentReference: "",
        term: filters.term || defaulter.term,
      })
      setPartialPaymentDialogOpen(true)
    },
    [filters.term],
  )

  const openWaiverDialog = useCallback(
    (defaulter: DefaulterAnalyticsEntry) => {
      setSelectedDefaulter(defaulter)
      resetWaiverForm()
      setWaiverDialogOpen(true)
    },
    [resetWaiverForm],
  )

  const outstandingTotal = useMemo(
    () => defaulters.reduce((sum, entry) => sum + (entry.outstanding ?? 0), 0),
    [defaulters],
  )

  const partialPaymentTitle = selectedDefaulter
    ? `Record payment for ${selectedDefaulter.studentName}`
    : "Record payment"

  const waiverTitle = selectedDefaulter ? `Record waiver for ${selectedDefaulter.studentName}` : "Record waiver"

  return (
    <div className="space-y-6" id="accountant-dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Accountant Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Manage financial collections, expenses, and defaulters with full audit trails.
          </p>
        </div>
        <TutorialLink href="https://www.youtube.com/watch?v=ysz5S6PUM-U" />
      </div>

      <NotificationCenter userRole="accountant" />

      {banner && (
        <div
          className={`rounded-md border p-4 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.summary.totalCollected)}</div>
            <p className="text-xs text-muted-foreground">Recorded across all payment channels</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.summary.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Approved expenditures this period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.collectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Of assigned fees collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.summary.outstandingAmount)}</div>
            <p className="text-xs text-muted-foreground">Across {analytics.summary.defaultersCount} defaulters</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Filters</CardTitle>
          <CardDescription>
            Apply filters to collections, expenses, defaulters, and analytics. All changes refresh the data instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="term">Term</Label>
              <Input
                id="term"
                placeholder="e.g. 2024 Term 1"
                value={filters.term}
                onChange={(event) => updateFilters({ term: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(event) => updateFilters({ startDate: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(event) => updateFilters({ endDate: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="classFilter">Class</Label>
              <Input
                id="classFilter"
                placeholder="e.g. Grade 5"
                value={filters.className}
                onChange={(event) => updateFilters({ className: event.target.value })}
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
                updateFilters({ term: "", startDate: "", endDate: "", className: "" })
                void loadFinancialData()
              }}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-5">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="defaulters">Defaulters</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="fees">Fee Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Fee Collections</h3>
              <p className="text-sm text-muted-foreground">Record income received from students and guardians.</p>
            </div>
            <Button onClick={openCollectionDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Record Collection
            </Button>
          </div>

          {collections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No collections found.</p>
                <p className="text-sm text-muted-foreground">
                  {hasFinancialData
                    ? "Adjust the filters or record a new collection to see it here."
                    : "Start by recording your first collection to populate the reports."}
                </p>
              </CardContent>
            </Card>
          ) : (
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
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                            {extractStudentInitials(payment.studentName)}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{payment.studentName}</p>
                            <p className="text-xs text-muted-foreground">Term: {payment.term || "Unspecified"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{payment.className || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{payment.feeType}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">{formatCurrency(payment.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="outline">{payment.paymentMethod}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{payment.receiptNumber || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {parseDateForDisplay(payment.paymentDate || payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Expenses</h3>
              <p className="text-sm text-muted-foreground">Track approved operational spending.</p>
            </div>
            <Button onClick={() => {
              resetExpenseForm()
              setExpenseDialogOpen(true)
            }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Record Expense
            </Button>
          </div>

          {expenses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No expenses recorded.</p>
                <p className="text-sm text-muted-foreground">
                  Record a new expense to begin tracking operational spending.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Approved By</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Receipt / Invoice</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="secondary">{expense.category}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">{formatCurrency(expense.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{expense.approvedBy}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{expense.description}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {expense.receiptReference || expense.documentUrl ? (
                          <a
                            href={expense.documentUrl ?? undefined}
                            target={expense.documentUrl ? "_blank" : undefined}
                            rel="noreferrer"
                            className="text-emerald-700 underline"
                          >
                            {expense.receiptReference || "View"}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {parseDateForDisplay(expense.expenseDate || expense.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="defaulters" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Defaulters</h3>
              <p className="text-sm text-muted-foreground">
                Students with outstanding balances are computed automatically from collections, waivers, and fee
                structures.
              </p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
              Outstanding total: <span className="font-semibold">{formatCurrency(outstandingTotal)}</span>
            </div>
          </div>

          {defaulters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No defaulters 🎉</p>
                <p className="text-sm text-muted-foreground">
                  All students are up to date with payments for the selected filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {defaulters.map((entry) => (
                <Card key={`${entry.studentId}-${entry.term}`}>
                  <CardHeader className="flex flex-col gap-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">{entry.studentName}</CardTitle>
                        <CardDescription>
                          {entry.className || "Class unknown"} • {entry.term || "Term not specified"}
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">{formatCurrency(entry.outstanding)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Expected</p>
                        <p className="font-medium">{formatCurrency(entry.expected)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-medium text-emerald-700">{formatCurrency(entry.paid)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Waived</p>
                        <p className="font-medium">{formatCurrency(entry.waived)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Parent Contact</p>
                        <p className="font-medium">
                          {entry.parentEmail || entry.parentPhone || entry.parentName || "Unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openPartialPaymentDialog(entry)}>
                        <DollarSign className="mr-2 h-4 w-4" /> Record Payment
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openWaiverDialog(entry)}>
                        <BookOpenCheck className="mr-2 h-4 w-4" /> Record Waiver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income vs Expenses</CardTitle>
                <CardDescription>Track cash flow trends across the selected period.</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {analytics.monthly.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No data available for the selected filters.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Line type="monotone" dataKey="collected" stroke="#2d682d" strokeWidth={2} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fee Type Breakdown</CardTitle>
                <CardDescription>Distribution of collections per fee type.</CardDescription>
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
                <CardDescription>Compare expected vs collected amounts by class.</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {analytics.classCollection.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No class analytics available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.classCollection}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="className" />
                      <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="collected" fill="#2d682d" name="Collected" />
                      <Bar dataKey="expected" fill="#a7f3d0" name="Expected" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>Monitor operational spending by category.</CardDescription>
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
        </TabsContent>
        <TabsContent value="fees" className="space-y-4">
          <FeeConfigurationPanel accountantName={accountant.name} />
        </TabsContent>
      </Tabs>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">Failed to load financial data.</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !hasFinancialData && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No financial records found.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Start by recording collections or expenses. All Super Admin reports are powered by the records you create
              here.
            </p>
            <Button onClick={openCollectionDialog}>
              <Plus className="mr-2 h-4 w-4" /> Record first collection
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(event) => void submitCollection(event)}>
            <DialogHeader>
              <DialogTitle>Record Collection</DialogTitle>
              <DialogDescription>
                Capture income received from a student. Receipt numbers are validated for uniqueness automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="collection-student-name">Student Name</Label>
                <Input
                  id="collection-student-name"
                  value={collectionForm.studentName}
                  onChange={(event) => handleCollectionFieldChange("studentName", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-student-id">Student ID</Label>
                <Input
                  id="collection-student-id"
                  value={collectionForm.studentId}
                  onChange={(event) => handleCollectionFieldChange("studentId", event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-class-name">Class</Label>
                <Input
                  id="collection-class-name"
                  value={collectionForm.className}
                  onChange={(event) => handleCollectionFieldChange("className", event.target.value)}
                  placeholder="e.g. Grade 9"
                />
              </div>
              <div className="space-y-2">
                <Label>Fee Type</Label>
                <Select
                  value={collectionForm.feeType}
                  onValueChange={(value) => handleCollectionFieldChange("feeType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a fee type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-amount">Amount</Label>
                <Input
                  id="collection-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectionForm.amount}
                  onChange={(event) => handleCollectionFieldChange("amount", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={collectionForm.paymentMethod}
                  onValueChange={(value) => handleCollectionFieldChange("paymentMethod", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-date">Payment Date</Label>
                <Input
                  id="collection-date"
                  type="date"
                  value={collectionForm.paymentDate}
                  onChange={(event) => handleCollectionFieldChange("paymentDate", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-term">Term</Label>
                <Input
                  id="collection-term"
                  value={collectionForm.term}
                  onChange={(event) => handleCollectionFieldChange("term", event.target.value)}
                  placeholder="e.g. 2024 Term 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-receipt">Receipt Number</Label>
                <Input
                  id="collection-receipt"
                  value={collectionForm.receiptNumber}
                  onChange={(event) => handleCollectionFieldChange("receiptNumber", event.target.value)}
                  placeholder="Auto-generated if left blank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-reference">Payment Reference</Label>
                <Input
                  id="collection-reference"
                  value={collectionForm.paymentReference}
                  onChange={(event) => handleCollectionFieldChange("paymentReference", event.target.value)}
                  placeholder="Optional bank reference"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCollectionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCollection}>
                {isSavingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Collection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={partialPaymentDialogOpen} onOpenChange={setPartialPaymentDialogOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={(event) => void submitCollection(event)}>
            <DialogHeader>
              <DialogTitle>{partialPaymentTitle}</DialogTitle>
              <DialogDescription>
                Partial payments immediately reduce the outstanding balance and refresh the defaulters list.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partial-student">Student</Label>
                <Input
                  id="partial-student"
                  value={collectionForm.studentName}
                  onChange={(event) => handleCollectionFieldChange("studentName", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partial-amount">Amount</Label>
                <Input
                  id="partial-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectionForm.amount}
                  onChange={(event) => handleCollectionFieldChange("amount", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partial-method">Method</Label>
                <Select
                  value={collectionForm.paymentMethod}
                  onValueChange={(value) => handleCollectionFieldChange("paymentMethod", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partial-date">Payment Date</Label>
                <Input
                  id="partial-date"
                  type="date"
                  value={collectionForm.paymentDate}
                  onChange={(event) => handleCollectionFieldChange("paymentDate", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partial-term">Term</Label>
                <Input
                  id="partial-term"
                  value={collectionForm.term}
                  onChange={(event) => handleCollectionFieldChange("term", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partial-receipt">Receipt Number</Label>
                <Input
                  id="partial-receipt"
                  value={collectionForm.receiptNumber}
                  onChange={(event) => handleCollectionFieldChange("receiptNumber", event.target.value)}
                  placeholder="Auto-generated if left blank"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPartialPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCollection}>
                {isSavingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(event) => void submitExpense(event)}>
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
              <DialogDescription>Only approved expenses should be recorded to maintain accurate ledgers.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(value: ExpenseCategory) => handleExpenseFieldChange("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(event) => handleExpenseFieldChange("amount", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-date">Expense Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(event) => handleExpenseFieldChange("expenseDate", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-approved">Approved By</Label>
                <Input
                  id="expense-approved"
                  value={expenseForm.approvedBy}
                  onChange={(event) => handleExpenseFieldChange("approvedBy", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expense-description">Description</Label>
                <Input
                  id="expense-description"
                  value={expenseForm.description}
                  onChange={(event) => handleExpenseFieldChange("description", event.target.value)}
                  placeholder="Provide a brief description of the expense"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-receipt">Receipt / Invoice Number</Label>
                <Input
                  id="expense-receipt"
                  value={expenseForm.receiptReference}
                  onChange={(event) => handleExpenseFieldChange("receiptReference", event.target.value)}
                  placeholder="Required for audit"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-document">Document URL</Label>
                <Input
                  id="expense-document"
                  type="url"
                  value={expenseForm.documentUrl}
                  onChange={(event) => handleExpenseFieldChange("documentUrl", event.target.value)}
                  placeholder="Optional link to supporting document"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingExpense}>
                {isSavingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={waiverDialogOpen} onOpenChange={setWaiverDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={(event) => void submitWaiver(event)}>
            <DialogHeader>
              <DialogTitle>{waiverTitle}</DialogTitle>
              <DialogDescription>Waivers reduce outstanding balances and are fully audited.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Input value={selectedDefaulter?.studentName ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waiver-amount">Amount</Label>
                <Input
                  id="waiver-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={waiverForm.amount}
                  onChange={(event) => handleWaiverFieldChange("amount", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waiver-reason">Reason</Label>
                <Input
                  id="waiver-reason"
                  value={waiverForm.reason}
                  onChange={(event) => handleWaiverFieldChange("reason", event.target.value)}
                  placeholder="Explain why the waiver was granted"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waiver-notes">Notes</Label>
                <Input
                  id="waiver-notes"
                  value={waiverForm.notes}
                  onChange={(event) => handleWaiverFieldChange("notes", event.target.value)}
                  placeholder="Optional additional information"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWaiverDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingWaiver}>
                {isSavingWaiver ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Waiver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AccountantDashboard
