import type { Viewport } from "next"

import PaymentCallbackClient from "@/components/payment/payment-callback-client"

export const dynamic =
  process.env.NEXT_BUILD_TARGET === "export" ? "force-static" : "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function PaymentCallbackPage() {
  return <PaymentCallbackClient />
}
