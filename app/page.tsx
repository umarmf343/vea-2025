import type { Viewport } from "next"

import HomePageClient from "@/components/home-page-client"

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function HomePage() {
  return <HomePageClient />
}
