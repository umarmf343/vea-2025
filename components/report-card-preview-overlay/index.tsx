"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ReportCardPreviewOverlayProps {
  isOpen: boolean
  title: string
  description?: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function ReportCardPreviewOverlay({
  isOpen,
  title,
  description,
  onClose,
  actions,
  children,
  footer,
}: ReportCardPreviewOverlayProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col bg-white shadow-2xl">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          </div>
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            {actions}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Close
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-slate-200 bg-white px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}
