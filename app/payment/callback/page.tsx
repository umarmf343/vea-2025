import type { Viewport } from "next"

import PaymentCallbackClient from "@/components/payment/payment-callback-client"

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function PaymentCallbackPage() {
  return <PaymentCallbackClient />
}
