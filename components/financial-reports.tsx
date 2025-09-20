"use client"

import { useState, useEffect } from "react"
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

interface FinancialReportsProps {
  userRole: string
}

export function FinancialReports({ userRole }: FinancialReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("current-term")
  const [selectedClass, setSelectedClass] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [feeCollectionData, setFeeCollectionData] = useState<any[]>([])
  const [classWiseCollection, setClassWiseCollection] = useState<any[]>([])
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [defaultersData, setDefaultersData] = useState<any[]>([])
  const [summaryStats, setSummaryStats] = useState({
    totalCollected: 0,
    collectionRate: 0,
    studentsPaid: 0,
    defaultersCount: 0,
    outstandingAmount: 0,
    avgCollectionTime: 0,
    onTimePaymentRate: 0,
  })

  useEffect(() => {
    loadFinancialData()

    // Real-time listeners for data updates
    const handleFinancialUpdate = () => {
      loadFinancialData()
    }

    dbManager.on("financialDataUpdated", handleFinancialUpdate)
    dbManager.on("paymentProcessed", handleFinancialUpdate)
    dbManager.on("expenseAdded", handleFinancialUpdate)

    return () => {
      dbManager.off("financialDataUpdated", handleFinancialUpdate)
      dbManager.off("paymentProcessed", handleFinancialUpdate)
      dbManager.off("expenseAdded", handleFinancialUpdate)
    }
  }, [selectedPeriod, selectedClass])

  const loadFinancialData = async () => {
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

      setFeeCollectionData(feeCollection)
      setClassWiseCollection(classCollection)
      setExpenseData(expenses)
      setDefaultersData(defaulters)
      setSummaryStats(stats)
    } catch (err) {
      setError("Failed to load financial data")
      console.error("Error loading financial data:", err)
    } finally {
      setLoading(false)
    }
  }

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
      const link = document.createElement("a")
      link.href = url
      link.download = `financial-report-${selectedPeriod}-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error generating report:", err)
      alert("Failed to generate report")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#2d682d]" />
        <span className="ml-2 text-[#2d682d]">Loading financial data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadFinancialData} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
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
          <h2 className="text-2xl font-bold text-[#2d682d]">Financial Reports</h2>
          <p className="text-gray-600">Comprehensive fee collection and expense tracking</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
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
                <p className="text-2xl font-bold text-[#2d682d]">₦{summaryStats.totalCollected.toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-green-600">{summaryStats.collectionRate}%</p>
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
                <p className="text-2xl font-bold text-[#b29032]">{summaryStats.studentsPaid}</p>
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
                <p className="text-2xl font-bold text-red-500">{summaryStats.defaultersCount}</p>
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
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{item.class}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-[#2d682d]">{item.percentage}%</span>
                          <p className="text-xs text-gray-500">
                            ₦{item.collected.toLocaleString()} / ₦{item.expected.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-[#2d682d] h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium">{expense.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#2d682d]">₦{expense.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{expense.percentage}%</p>
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
                    key={index}
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
                        ₦{defaulter.amount.toLocaleString()} Outstanding
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

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      ₦{summaryStats.outstandingAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Outstanding Amount</p>
                  </div>
                  <div className="text-center p-4 bg-[#b29032]/5 rounded-lg">
                    <p className="text-3xl font-bold text-[#b29032]">{summaryStats.avgCollectionTime} Days</p>
                    <p className="text-sm text-gray-600">Average Collection Time</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{summaryStats.onTimePaymentRate}%</p>
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
