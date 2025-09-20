"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"
import type { Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function PaymentCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [verificationStatus, setVerificationStatus] = useState<"loading" | "success" | "failed">("loading")
  const [paymentData, setPaymentData] = useState<any>(null)

  useEffect(() => {
    const reference = searchParams.get("reference")

    if (reference) {
      verifyPayment(reference)
    } else {
      setVerificationStatus("failed")
    }
  }, [searchParams])

  const verifyPayment = async (reference: string) => {
    try {
      const response = await fetch(`/api/payments/verify?reference=${reference}`)
      const data = await response.json()

      if (data.status) {
        setVerificationStatus("success")
        setPaymentData(data.data)

        // Store payment success in safeStorage for SSR compatibility
        // In a real app, this would be handled server-side
        safeStorage.setItem("paymentSuccess", "true")
        safeStorage.setItem("paymentData", JSON.stringify(data.data))

        const studentId = data.data.metadata?.student_id || "1" // Default to student 1 if not provided
        const grantedAccess = JSON.parse(safeStorage.getItem("grantedAccess") || "{}")
        grantedAccess[studentId] = true
        safeStorage.setItem("grantedAccess", JSON.stringify(grantedAccess))
      } else {
        setVerificationStatus("failed")
      }
    } catch (error) {
      console.error("Payment verification error:", error)
      setVerificationStatus("failed")
    }
  }

  const handleContinue = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2d682d] to-[#1a4a1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#b29032]/20 bg-white/95 backdrop-blur">
        <CardHeader className="text-center">
          {verificationStatus === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-[#b29032] mx-auto mb-4" />
              <CardTitle className="text-[#2d682d]">Verifying Payment</CardTitle>
              <CardDescription>Please wait while we confirm your payment...</CardDescription>
            </>
          )}

          {verificationStatus === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-green-600">Payment Successful!</CardTitle>
              <CardDescription>Your school fees payment has been confirmed.</CardDescription>
            </>
          )}

          {verificationStatus === "failed" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-red-600">Payment Failed</CardTitle>
              <CardDescription>There was an issue with your payment. Please try again.</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {verificationStatus === "success" && paymentData && (
            <div className="bg-green-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Amount Paid:</span>
                <span className="font-semibold">₦{paymentData.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Reference:</span>
                <span className="font-mono text-xs">{paymentData.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Student:</span>
                <span>{paymentData.metadata?.student_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Term:</span>
                <span className="capitalize">{paymentData.metadata?.term} Term</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleContinue}
            className="w-full bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
            disabled={verificationStatus === "loading"}
          >
            {verificationStatus === "success" ? "Continue to Dashboard" : "Back to Home"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
