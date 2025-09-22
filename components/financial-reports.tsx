"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { DollarSign, TrendingUp, Users, Download, Printer, AlertTriangle, Loader2 } from "lucide-react"
import { dbManager } from "@/lib/database-manager"

interface FeeCollectionEntry {
  month: string
  collected: number
  expected: number
  percentage: number
}

interface ClassCollectionEntry {
  class: string
  collected: number
  expected: number
  students?: number
  percentage: number
}

interface ExpenseEntry {
  category: string
  amount: number
  percentage: number
}

interface DefaulterEntry {
  id: string
  name: string
  class: string
  term: string
  contact: string
  amount: number
}

interface FinancialSummary {
  totalCollected: number
  collectionRate: number
  studentsPaid: number
  defaultersCount: number
  outstandingAmount: number
  avgCollectionTime: number
  onTimePaymentRate: number
}

interface FinancialReportsProps {
  userRole: string
}

const defaultSummaryStats: FinancialSummary = {
  totalCollected: 0,
  collectionRate: 0,
  studentsPaid: 0,
  defaultersCount: 0,
  outstandingAmount: 0,
  avgCollectionTime: 0,
  onTimePaymentRate: 0,
}

const ensureNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0

export function FinancialReports({ userRole }: FinancialReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("current-term")
  const [selectedClass, setSelectedClass] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [feeCollectionData, setFeeCollectionData] = useState<FeeCollectionEntry[]>([])
  const [classWiseCollection, setClassWiseCollection] = useState<ClassCollectionEntry[]>([])
  const [expenseData, setExpenseData] = useState<ExpenseEntry[]>([])
  const [defaultersData, setDefaultersData] = useState<DefaulterEntry[]>([])
  const [summaryStats, setSummaryStats] = useState<FinancialSummary>(defaultSummaryStats)

  const loadFinancialData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [feeCollection, classCollection, expenses, defaulters, stats] = await Promise.all([
        dbManager.getFeeCollectionData(selectedPeriod),
        dbManager.getClassWiseCollection(selectedPeriod, selectedClass),
        dbManager.getExpenseData(selectedPeriod),
        dbManager.getFeeDefaulters(),
        dbManager.getFinancialSummary(selectedPeriod),
      ])

      const normalizedFeeCollection = Array.isArray(feeCollection)
        ? feeCollection
            .filter((entry): entry is Partial<FeeCollectionEntry> => Boolean(entry))
            .map((entry) => ({
              month: typeof entry.month === "string" ? entry.month : "",
              collected: ensureNumber(entry.collected),
              expected: ensureNumber(entry.expected),
              percentage: ensureNumber(entry.percentage),
            }))
        : []

      const normalizedClassCollection = Array.isArray(classCollection)
        ? classCollection
            .filter((entry): entry is Partial<ClassCollectionEntry> => Boolean(entry))
            .map((entry) => ({
              class: typeof entry.class === "string" ? entry.class : "",
              collected: ensureNumber(entry.collected),
              expected: ensureNumber(entry.expected),
              students: ensureNumber(entry.students),
              percentage: ensureNumber(entry.percentage),
            }))
        : []

      const normalizedExpenses = Array.isArray(expenses)
        ? expenses
            .filter((entry): entry is Partial<ExpenseEntry> => Boolean(entry))
            .map((entry) => ({
              category: typeof entry.category === "string" ? entry.category : "",
              amount: ensureNumber(entry.amount),
              percentage: ensureNumber(entry.percentage),
            }))
        : []

      const normalizedDefaulters = Array.isArray(defaulters)
        ? defaulters
            .filter((entry): entry is Partial<DefaulterEntry> => Boolean(entry))
            .map((entry) => ({
              id: typeof entry.id === "string" ? entry.id : "",
              name: typeof entry.name === "string" ? entry.name : "",
              class: typeof entry.class === "string" ? entry.class : "",
              term: typeof entry.term === "string" ? entry.term : "",
              contact: typeof entry.contact === "string" ? entry.contact : "",
              amount: ensureNumber(entry.amount),
            }))
        : []

      const normalizedSummary = {
        ...defaultSummaryStats,
        ...(typeof stats === "object" && stats !== null ? stats : {}),
      }

      setFeeCollectionData(normalizedFeeCollection)
      setClassWiseCollection(normalizedClassCollection)
      setExpenseData(normalizedExpenses)
      setDefaultersData(normalizedDefaulters)
      setSummaryStats({
        totalCollected: ensureNumber(normalizedSummary.totalCollected),
        collectionRate: ensureNumber(normalizedSummary.collectionRate),
        studentsPaid: ensureNumber(normalizedSummary.studentsPaid),
        defaultersCount: ensureNumber(normalizedSummary.defaultersCount),
        outstandingAmount: ensureNumber(normalizedSummary.outstandingAmount),
        avgCollectionTime: ensureNumber(normalizedSummary.avgCollectionTime),
        onTimePaymentRate: ensureNumber(normalizedSummary.onTimePaymentRate),
      })
    } catch (err) {
      setError("Failed to load financial data")
      console.error("Error loading financial data:", err)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, selectedClass])

  useEffect(() => {
    void loadFinancialData()

    // Real-time listeners for data updates
    const handleFinancialUpdate = () => {
      void loadFinancialData()
    }

    dbManager.on("financialDataUpdated", handleFinancialUpdate)
    dbManager.on("paymentProcessed", handleFinancialUpdate)
    dbManager.on("expenseAdded", handleFinancialUpdate)

    return () => {
      dbManager.off("financialDataUpdated", handleFinancialUpdate)
      dbManager.off("paymentProcessed", handleFinancialUpdate)
      dbManager.off("expenseAdded", handleFinancialUpdate)
    }
  }, [loadFinancialData])

  const COLORS = ["#2d682d", "#b29032", "#4ade80", "#f59e0b", "#ef4444", "#8b5cf6"]

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
    try {
      const reportData = {
        period: selectedPeriod,
        feeCollection: feeCollectionData,
        classCollection: classWiseCollection,
        expenses: expenseData,
        defaulters: defaultersData,
        summary: summaryStats,
        generatedAt: new Date().toISOString(),
      }

      await dbManager.saveFinancialReport(reportData)

      // Create and download PDF (simplified implementation)
      const dataStr = JSON.stringify(reportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)
@@ -165,230 +269,237 @@ export function FinancialReports({ userRole }: FinancialReportsProps) {
              <SelectItem value="current-term">Current Term</SelectItem>
              <SelectItem value="last-term">Last Term</SelectItem>
              <SelectItem value="current-session">Current Session</SelectItem>
              <SelectItem value="last-session">Last Session</SelectItem>
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
              <DollarSign className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">₦{ensureNumber(summaryStats.totalCollected).toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{ensureNumber(summaryStats.collectionRate)}%</p>
                <p className="text-sm text-gray-600">Collection Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{ensureNumber(summaryStats.studentsPaid)}</p>
                <p className="text-sm text-gray-600">Students Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{ensureNumber(summaryStats.defaultersCount)}</p>
                <p className="text-sm text-gray-600">Defaulters</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="collection" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="defaulters">Defaulters</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="collection" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Monthly Collection Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={feeCollectionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₦${(value as number).toLocaleString()}`, "Amount"]} />
                    <Bar dataKey="collected" fill="#2d682d" />
                    <Bar dataKey="expected" fill="#b29032" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Class-wise Collection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {classWiseCollection.map((item, index) => (
                    <div key={`${item.class}-${index}`} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{item.class}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-[#2d682d]">{ensureNumber(item.percentage)}%</span>
                          <p className="text-xs text-gray-500">
                            ₦{ensureNumber(item.collected).toLocaleString()} / ₦
                            {ensureNumber(item.expected).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#2d682d] h-2 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, ensureNumber(item.percentage)))}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`${entry.category}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₦${(value as number).toLocaleString()}`, "Amount"]} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Expense Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expenseData.map((expense, index) => (
                    <div
                      key={`${expense.category}-${index}`}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium">{expense.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#2d682d]">₦{ensureNumber(expense.amount).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{ensureNumber(expense.percentage)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="defaulters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Fee Defaulters
              </CardTitle>
              <CardDescription>Students with outstanding fee payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {defaultersData.map((defaulter, index) => (
                  <div
                    key={`${defaulter.id || defaulter.name}-${index}`}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-red-200 bg-red-50 rounded-lg gap-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900">{defaulter.name}</h3>
                      <p className="text-sm text-red-700">
                        {defaulter.class} - {defaulter.term}
                      </p>
                      <p className="text-xs text-red-600">{defaulter.contact}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Badge variant="destructive" className="whitespace-nowrap">
                        ₦{ensureNumber(defaulter.amount).toLocaleString()} Outstanding
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs bg-transparent"
                          onClick={() => dbManager.sendPaymentReminder(defaulter.id)}
                        >
                          Send Reminder
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#2d682d] hover:bg-[#2d682d]/90 text-xs"
                          onClick={() => dbManager.contactParent(defaulter.id)}
                        >
                          Contact Parent
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
@@ -398,46 +509,46 @@ export function FinancialReports({ userRole }: FinancialReportsProps) {
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Collection vs Target</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={feeCollectionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, "Collection Rate"]} />
                    <Line type="monotone" dataKey="percentage" stroke="#2d682d" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center p-4 bg-[#2d682d]/5 rounded-lg">
                    <p className="text-3xl font-bold text-[#2d682d]">
                      ₦{ensureNumber(summaryStats.outstandingAmount).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Outstanding Amount</p>
                  </div>
                  <div className="text-center p-4 bg-[#b29032]/5 rounded-lg">
                    <p className="text-3xl font-bold text-[#b29032]">{ensureNumber(summaryStats.avgCollectionTime)} Days</p>
                    <p className="text-sm text-gray-600">Average Collection Time</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{ensureNumber(summaryStats.onTimePaymentRate)}%</p>
                    <p className="text-sm text-gray-600">On-time Payment Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
