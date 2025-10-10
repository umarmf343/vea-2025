import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "VEA 2025 - School Management Portal",
  description: "Victory Educational Academy - Excellence in Education Since 2020",
  generator: "v0.app",
  keywords: ["school management", "education", "student portal", "parent portal", "academic records"],
  authors: [{ name: "Victory Educational Academy" }],
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="antialiased font-sans bg-gray-50 text-gray-900">
        <ErrorBoundary>
          <div className="min-h-screen">{children}</div>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  )
}
