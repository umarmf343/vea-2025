"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react"

interface TermPayment {
  termId: string
  termName: string
  session: string
  amount: number
  dueDate: string
  status: "paid" | "pending" | "overdue"
  paidDate?: string
  receiptNumber?: string
}

interface PerTermPaymentSystemProps {
  studentId: string
  parentId: string
  onPaymentStatusChange?: (termId: string, status: string) => void
}

export function PerTermPaymentSystem({ studentId, parentId, onPaymentStatusChange }: PerTermPaymentSystemProps) {
  const [termPayments, setTermPayments] = useState<TermPayment[]>([
    {
      termId: "2024-term1",
      termName: "First Term",
      session: "2024/2025",
      amount: 45000,
      dueDate: "2024-10-15",
      status: "paid",
      paidDate: "2024-09-20",
      receiptNumber: "VEA/2024/001234",
    },
    {
      termId: "2024-term2",
      termName: "Second Term",
      session: "2024/2025",
      amount: 45000,
      dueDate: "2025-01-15",
      status: "pending",
    },
    {
      termId: "2024-term3",
      termName: "Third Term",
      session: "2024/2025",
      amount: 45000,
      dueDate: "2025-04-15",
      status: "pending",
    },
  ])

  const [currentTerm, setCurrentTerm] = useState("2024-term2")

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "overdue":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const canAccessReportCard = (termId: string) => {
    const payment = termPayments.find((p) => p.termId === termId)
    return payment?.status === "paid"
  }

  const handlePayment = (termId: string) => {
    setTermPayments((prev) =>
      prev.map((payment) =>
        payment.termId === termId
          ? {
              ...payment,
              status: "paid" as const,
              paidDate: new Date().toISOString().split("T")[0],
              receiptNumber: `VEA/2024/${Math.random().toString().substr(2, 6)}`,
            }
          : payment,
      ),
    )
    onPaymentStatusChange?.(termId, "paid")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <CreditCard className="h-5 w-5" />
            Per-Term Payment Status
          </CardTitle>
          <p className="text-sm text-gray-600">Report card access is restricted per term based on payment status</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {termPayments.map((payment) => (
              <div key={payment.termId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <h4 className="font-medium">{payment.termName}</h4>
                    <p className="text-sm text-gray-600">{payment.session}</p>
                    <p className="text-xs text-gray-500">Due: {payment.dueDate}</p>
                    {payment.paidDate && <p className="text-xs text-green-600">Paid: {payment.paidDate}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">₦{payment.amount.toLocaleString()}</p>
                    <Badge className={getStatusColor(payment.status)}>{payment.status.toUpperCase()}</Badge>
                  </div>

                  {payment.status === "pending" && (
                    <Button
                      size="sm"
                      className="bg-[#2d682d] hover:bg-[#1a4a1a]"
                      onClick={() => handlePayment(payment.termId)}
                    >
                      Pay Now
                    </Button>
                  )}

                  {payment.status === "paid" && (
                    <Button size="sm" variant="outline">
                      View Receipt
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Report Card Access Policy</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Report cards are available only for terms with completed payments</li>
              <li>• Each term requires separate payment for report card access</li>
              <li>• Admin can grant temporary access for offline payments</li>
              <li>• Cumulative reports require all term payments to be completed</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
