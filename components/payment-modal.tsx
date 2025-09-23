"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, Loader2 } from "lucide-react"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: () => void
  studentName: string
  studentId: string
  amount: number
  parentName: string
  parentEmail?: string
}

export function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  studentName,
  studentId,
  amount,
  parentName,
  parentEmail,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    email: parentEmail ?? "",
    phone: "",
    term: "first",
    session: "2024/2025",
  })

  useEffect(() => {
    setPaymentForm((previous) => ({
      ...previous,
      email: parentEmail ?? previous.email,
    }))
  }, [parentEmail])

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      // Initialize Paystack payment
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: paymentForm.email,
          amount: amount * 100, // Convert to kobo for Paystack
          studentId,
          paymentType: "school_fees",
          metadata: {
            student_name: studentName,
            studentId,
            student_id: studentId,
            payment_type: "school_fees",
            term: paymentForm.term,
            session: paymentForm.session,
            phone: paymentForm.phone,
            parent_name: parentName,
            parentName,
            parent_email: paymentForm.email,
            parentEmail: paymentForm.email,
            payer_role: "parent",
          },
        }),
      })

      const data = await response.json()

      if (data.status) {
        // Redirect to Paystack payment page
        window.location.href = data.data.authorization_url
      } else {
        throw new Error(data.message || "Payment initialization failed")
      }
    } catch (error) {
      console.error("Payment error:", error)
      alert("Payment initialization failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#2d682d]">
            <CreditCard className="h-5 w-5" />
            Pay School Fees
          </DialogTitle>
          <DialogDescription>
            Complete payment for {studentName} - ₦{amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePayment} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={paymentForm.email}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, email: e.target.value }))}
              className="border-[#2d682d]/20 focus:border-[#b29032]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={paymentForm.phone}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="border-[#2d682d]/20 focus:border-[#b29032]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select
                value={paymentForm.term}
                onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, term: value }))}
              >
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Term</SelectItem>
                  <SelectItem value="second">Second Term</SelectItem>
                  <SelectItem value="third">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session">Session</Label>
              <Select
                value={paymentForm.session}
                onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, session: value }))}
              >
                <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024/2025">2024/2025</SelectItem>
                  <SelectItem value="2025/2026">2025/2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-[#2d682d]/5 p-4 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span>School Fees ({paymentForm.term} term)</span>
              <span className="font-semibold">₦{amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span>Processing Fee</span>
              <span>₦0</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between items-center font-semibold text-[#2d682d]">
              <span>Total</span>
              <span>₦{amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-transparent"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#b29032] hover:bg-[#8a6b25]" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Pay Now"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
