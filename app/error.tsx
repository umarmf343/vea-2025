"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Something went wrong</h1>
        <p className="text-gray-600">
          An unexpected error occurred while rendering this page. You can try again or return to the dashboard.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-xs text-gray-400">Error reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  )
}
