"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DollarSign, Receipt, TrendingUp, Users, Download, Search, Plus, Printer, Edit } from "lucide-react"

interface AccountantDashboardProps {
  accountant: {
    id: string
    name: string
    email: string
  }
}

export function AccountantDashboard({ accountant }: AccountantDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showFeeDialog, setShowFeeDialog] = useState(false)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [feeForm, setFeeForm] = useState({
    class: "",
    tuition: 0,
    development: 0,
    exam: 0,
    sports: 0,
    library: 0,
  })

  const [payments, setPayments] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [feeStructure, setFeeStructure] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFinancialData()

    // const unsubscribePayments = dbManager.subscribe("payments", (data) => {
    //   setPayments(data)
    // })

    // const unsubscribeReceipts = dbManager.subscribe("receipts", (data) => {
    //   setReceipts(data)
    // })

    // const unsubscribeFees = dbManager.subscribe("feeStructure", (data) => {
    //   setFeeStructure(data)
    // })

    // return () => {
    //   unsubscribePayments()
    //   unsubscribeReceipts()
    //   unsubscribeFees()
    // }
  }, [])

  const loadFinancialData = async () => {
    try {
      setLoading(true)
      // const [paymentsData, receiptsData, feesData] = await Promise.all([
      //   dbManager.getPayments(),
      //   dbManager.getReceipts(),
      //   dbManager.getFeeStructure(),
      // ])

      const mockPayments = [
        {
          id: "1",
          studentName: "John Doe",
          class: "JSS 1A",
          amount: 50000,
          type: "Tuition",
          status: "paid",
          method: "online",
          date: "2025-01-08",
          reference: "PAY001",
        },
        {
          id: "2",
          studentName: "Jane Smith",
          class: "JSS 2B",
          amount: 45000,
          type: "Tuition",
          status: "pending",
          method: "offline",
          date: "2025-01-07",
          reference: "PAY002",
        },
        {
          id: "3",
          studentName: "Mike Johnson",
          class: "SS 1A",
          amount: 55000,
          type: "Tuition",
          status: "paid",
          method: "online",
          date: "2025-01-06",
          reference: "PAY003",
        },
      ]

      const mockReceipts = [
        {
          id: "1",
          receiptNo: "REC001",
          studentName: "John Doe",
          amount: 50000,
          date: "2025-01-08",
          reference: "PAY001",
        },
        {
          id: "2",
          receiptNo: "REC003",
          studentName: "Mike Johnson",
          amount: 55000,
          date: "2025-01-06",
          reference: "PAY003",
        },
      ]

      const mockFeeStructure = [
        { class: "JSS 1", tuition: 40000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 50000 },
        { class: "JSS 2", tuition: 42000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 52000 },
        { class: "JSS 3", tuition: 44000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 54000 },
        { class: "SS 1", tuition: 46000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 59000 },
        { class: "SS 2", tuition: 48000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 61000 },
        { class: "SS 3", tuition: 50000, development: 6000, exam: 4000, sports: 1500, library: 1500, total: 63000 },
      ]

      setPayments(mockPayments)
      setReceipts(mockReceipts)
      setFeeStructure(mockFeeStructure)
    } catch (error) {
      console.error("Error loading financial data:", error)
    } finally {
      setLoading(false)
    }
  }

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0)
  const pendingPayments = payments.filter((p) => p.status === "pending").length

  const handleUpdateFeeStructure = async () => {
    try {
      const total = feeForm.tuition + feeForm.development + feeForm.exam + feeForm.sports + feeForm.library
      const newFee = { ...feeForm, total }

      setFeeStructure((prev) => {
        const existingIndex = prev.findIndex((fee) => fee.class === newFee.class)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = newFee
          return updated
        } else {
          return [...prev, newFee]
        }
      })

      // await dbManager.saveFeeStructure(newFee)

      setShowFeeDialog(false)
      setFeeForm({ class: "", tuition: 0, development: 0, exam: 0, sports: 0, library: 0 })
    } catch (error) {
      console.error("Error updating fee structure:", error)
    }
  }

  const handlePrintReceipt = (payment: any) => {
    setSelectedPayment(payment)
    setShowReceiptDialog(true)
  }

  const handleDownloadReceipt = async (payment: any) => {
    try {
      console.log("Generating receipt for:", payment)
      // await dbManager.generateReceipt(payment)
    } catch (error) {
      console.error("Error generating receipt:", error)
    }
  }

  const handleGenerateReport = async (reportType: string) => {
    try {
      console.log("Generated report:", reportType, payments)
      // const reportData = await dbManager.generateFinancialReport(reportType, payments)
    } catch (error) {
      console.error("Error generating report:", error)
    }
  }

  const handleRecordPayment = async (paymentData: any) => {
    try {
      const newPayment = { ...paymentData, id: Date.now().toString() }
      setPayments((prev) => [...prev, newPayment])
      // await dbManager.savePayment(paymentData)
    } catch (error) {
      console.error("Error recording payment:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading financial data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold">Welcome, {accountant.name}</h1>
        <p className="text-green-100">Financial Management - VEA 2025</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">₦{totalRevenue.toLocaleString()}</p>
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
                    ? Math.round((payments.filter((p) => p.status === "paid").length / payments.length) * 100)
                    : 0}
                  %
                </p>
                <p className="text-sm text-gray-600">Collection Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="fees">Fee Structure</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.slice(0, 3).map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{payment.studentName}</p>
                        <p className="text-xs text-gray-600">
                          ₦{payment.amount.toLocaleString()} - {payment.type}
                        </p>
                      </div>
                      <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{payment.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Online Payments</span>
                    <span className="text-sm font-bold text-[#2d682d]">
                      {payments.filter((p) => p.method === "online").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Offline Payments</span>
                    <span className="text-sm font-bold text-[#b29032]">
                      {payments.filter((p) => p.method === "offline").length}
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
                    <Plus className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                </div>

                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{payment.studentName}</h3>
                        <p className="text-sm text-gray-600">
                          {payment.class} - {payment.type}
                        </p>
                        <p className="text-xs text-gray-500">
                          Date: {payment.date} | Ref: {payment.reference}
                        </p>
                      </div>
                      <div className="text-center mr-4">
                        <p className="text-lg font-bold text-[#2d682d]">₦{payment.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{payment.method}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{payment.status}</Badge>
                        {payment.status === "paid" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(payment)}>
                              <Download className="w-4 h-4 mr-1" />
                              Download PDF
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                              onClick={() => handlePrintReceipt(payment)}
                            >
                              <Printer className="w-4 h-4 mr-1" />
                              Print
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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
                  <div key={receipt.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">Receipt #{receipt.receiptNo}</h3>
                      <p className="text-sm text-gray-600">{receipt.studentName}</p>
                      <p className="text-xs text-gray-500">
                        Date: {receipt.date} | Ref: {receipt.reference}
                      </p>
                    </div>
                    <div className="text-center mr-4">
                      <p className="text-lg font-bold text-[#2d682d]">₦{receipt.amount.toLocaleString()}</p>
                    </div>
                    <div className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(receipt)}>
                        <Download className="w-4 h-4 mr-1" />
                        Download PDF
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                        onClick={() => handlePrintReceipt(receipt)}
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-[#2d682d]">Fee Structure Management</CardTitle>
                  <CardDescription>Update and manage school fee structure by class</CardDescription>
                </div>
                <Button onClick={() => setShowFeeDialog(true)} className="bg-[#b29032] hover:bg-[#b29032]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Update Fee Structure
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-[#2d682d] text-white">
                        <th className="border border-gray-300 p-2 text-left">Class</th>
                        <th className="border border-gray-300 p-2 text-right">Tuition</th>
                        <th className="border border-gray-300 p-2 text-right">Development</th>
                        <th className="border border-gray-300 p-2 text-right">Exam</th>
                        <th className="border border-gray-300 p-2 text-right">Sports</th>
                        <th className="border border-gray-300 p-2 text-right">Library</th>
                        <th className="border border-gray-300 p-2 text-right">Total</th>
                        <th className="border border-gray-300 p-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeStructure.map((fee, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 p-2 font-medium">{fee.class}</td>
                          <td className="border border-gray-300 p-2 text-right">₦{fee.tuition.toLocaleString()}</td>
                          <td className="border border-gray-300 p-2 text-right">₦{fee.development.toLocaleString()}</td>
                          <td className="border border-gray-300 p-2 text-right">₦{fee.exam.toLocaleString()}</td>
                          <td className="border border-gray-300 p-2 text-right">₦{fee.sports.toLocaleString()}</td>
                          <td className="border border-gray-300 p-2 text-right">₦{fee.library.toLocaleString()}</td>
                          <td className="border border-gray-300 p-2 text-right font-bold text-[#2d682d]">
                            ₦{fee.total.toLocaleString()}
                          </td>
                          <td className="border border-gray-300 p-2 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setFeeForm(fee)
                                setShowFeeDialog(true)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Financial Reports & Analytics</CardTitle>
              <CardDescription>Generate comprehensive financial reports and analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("monthly-revenue")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Monthly Revenue Report
                </Button>
                <Button
                  className="bg-[#b29032] hover:bg-[#b29032]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("outstanding-payments")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Outstanding Payments
                </Button>
                <Button
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("class-wise-collection")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Class-wise Collection
                </Button>
                <Button
                  className="bg-[#b29032] hover:bg-[#b29032]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("payment-method-analysis")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Payment Method Analysis
                </Button>
                <Button
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("fee-defaulters")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Fee Defaulters Report
                </Button>
                <Button
                  className="bg-[#b29032] hover:bg-[#b29032]/90 h-20 flex-col"
                  onClick={() => handleGenerateReport("annual-financial-summary")}
                >
                  <Download className="w-6 h-6 mb-2" />
                  Annual Financial Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Fee Structure</DialogTitle>
            <DialogDescription>Set fee amounts for each category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="class">Class</Label>
              <Select
                value={feeForm.class}
                onValueChange={(value) => setFeeForm((prev) => ({ ...prev, class: value }))}
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
                  onChange={(e) => setFeeForm((prev) => ({ ...prev, tuition: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="development">Development (₦)</Label>
                <Input
                  id="development"
                  type="number"
                  value={feeForm.development}
                  onChange={(e) => setFeeForm((prev) => ({ ...prev, development: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="exam">Exam (₦)</Label>
                <Input
                  id="exam"
                  type="number"
                  value={feeForm.exam}
                  onChange={(e) => setFeeForm((prev) => ({ ...prev, exam: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="sports">Sports (₦)</Label>
                <Input
                  id="sports"
                  type="number"
                  value={feeForm.sports}
                  onChange={(e) => setFeeForm((prev) => ({ ...prev, sports: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="library">Library (₦)</Label>
                <Input
                  id="library"
                  type="number"
                  value={feeForm.library}
                  onChange={(e) => setFeeForm((prev) => ({ ...prev, library: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Total</Label>
                <div className="p-2 bg-gray-100 rounded font-bold text-[#2d682d]">
                  ₦
                  {(
                    feeForm.tuition +
                    feeForm.development +
                    feeForm.exam +
                    feeForm.sports +
                    feeForm.library
                  ).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFeeStructure} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Update Fee Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print Receipt</DialogTitle>
            <DialogDescription>Receipt for {selectedPayment?.studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-bold text-[#2d682d]">VICTORY EDUCATIONAL ACADEMY</h3>
              <p className="text-sm">Official Payment Receipt</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-medium">{selectedPayment?.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-medium">₦{selectedPayment?.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Reference:</span>
                <span className="font-medium">{selectedPayment?.reference}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium">{selectedPayment?.date}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log("Printing receipt for:", selectedPayment)
                setShowReceiptDialog(false)
              }}
              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
