"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreditCard, Search, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react"
import { dbManager } from "@/lib/database-manager"
import { cn } from "@/lib/utils" // Import cn function

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
}

export function PaymentManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPayments = async () => {
      try {
        setLoading(true)
        const paymentData = await dbManager.getPayments()
        setPayments(paymentData)
        setError(null)
      } catch (err) {
        setError("Failed to load payment data")
        console.error("Error loading payments:", err)
      } finally {
        setLoading(false)
      }
    }

    loadPayments()

    const handlePaymentUpdate = (updatedPayments: PaymentRecord[]) => {
      setPayments(updatedPayments)
    }

    dbManager.on("paymentsUpdated", handlePaymentUpdate)

    return () => {
      dbManager.off("paymentsUpdated", handlePaymentUpdate)
    }
  }, [])

  const filteredPayments = payments.filter(
    (payment) =>
      payment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.parentName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const grantAccess = async (paymentId: string) => {
    try {
      await dbManager.updatePaymentAccess(paymentId, true)
      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === paymentId ? { ...payment, hasAccess: true, status: "paid" as const } : payment,
        ),
      )
    } catch (err) {
      setError("Failed to grant access")
      console.error("Error granting access:", err)
    }
  }

  const revokeAccess = async (paymentId: string) => {
    try {
      await dbManager.updatePaymentAccess(paymentId, false)
      setPayments((prev) =>
        prev.map((payment) => (payment.id === paymentId ? { ...payment, hasAccess: false } : payment)),
      )
    } catch (err) {
      setError("Failed to revoke access")
      console.error("Error revoking access:", err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
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

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0)
  const pendingPayments = payments.filter((p) => p.status === "pending").length
  const failedPayments = payments.filter((p) => p.status === "failed").length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading payment data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#2d682d]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#2d682d]" />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold text-[#2d682d]">₦{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-xl font-bold text-green-600">{payments.filter((p) => p.status === "paid").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{pendingPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-xl font-bold text-red-600">{failedPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Records */}
      <Card className="border-[#b29032]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#b29032]">
                <CreditCard className="h-5 w-5" />
                Payment Management
              </CardTitle>
              <CardDescription>Manage school fee payments and access control</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-[#2d682d]/20 focus:border-[#b29032]"
            />
          </div>

          {/* Payments Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student/Parent</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#2d682d] text-white text-xs">
                            {payment.studentName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{payment.studentName}</p>
                          <p className="text-xs text-gray-500">{payment.parentName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₦{payment.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {payment.method}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell>
                      <Badge variant={payment.hasAccess ? "default" : "secondary"}>
                        {payment.hasAccess ? "Granted" : "Restricted"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!payment.hasAccess ? (
                          <Button
                            size="sm"
                            onClick={() => grantAccess(payment.id)}
                            className={cn(
                              "bg-[#2d682d] hover:bg-[#1a4a1a] text-white",
                              "text-xs font-medium transition-all duration-200",
                            )}
                          >
                            Grant Access
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revokeAccess(payment.id)}
                            className="text-xs font-medium transition-all duration-200"
                          >
                            Revoke Access
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
