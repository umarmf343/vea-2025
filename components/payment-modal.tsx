"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { CreditCard, Loader2 } from "lucide-react"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: () => void
  studentName: string
  studentId: string
  parentName: string
  parentEmail?: string
  mode?: "school" | "event"
  eventPaymentLabel?: string
}

interface FeeConfiguration {
  className: string
  term: string
  session: string | null
  schoolFee: {
    id: string
    amount: number
    term: string
    className: string
    version: number
    notes: string | null
    effectiveDate: string
  } | null
  eventFees: Array<{
    id: string
    name: string
    description: string | null
    amount: number
    dueDate: string | null
    applicableClasses: string[]
  }>
  eventPaymentTitle?: string | null
}

export function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  studentName,
  studentId,
  parentName,
  parentEmail,
  mode = "school",
  eventPaymentLabel,
}: PaymentModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    email: parentEmail ?? "",
    phone: "",
    term: "first",
    session: "2024/2025",
  })
  const [configuration, setConfiguration] = useState<FeeConfiguration | null>(null)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    setPaymentForm((previous) => ({
      ...previous,
      email: parentEmail ?? previous.email,
    }))
  }, [parentEmail])

  useEffect(() => {
    if (!isOpen || !studentId) {
      return
    }

    let cancelled = false

    const fetchConfiguration = async () => {
      setIsLoadingConfig(true)
      setConfigError(null)

      try {
        const params = new URLSearchParams({
          studentId,
          term: paymentForm.term,
          session: paymentForm.session,
        })

        if (mode === "event") {
          params.set("scope", "event")
        }

        const response = await fetch(`/api/payments/fees?${params.toString()}`, { cache: "no-store" })

        if (!response.ok) {
          let message = `Unable to load fee configuration (status ${response.status})`
          try {
            const payload = await response.json()
            if (typeof payload?.error === "string") {
              message = payload.error
            }
          } catch {
            // ignore parsing error
          }

          if (!cancelled) {
            setConfiguration(null)
            setSelectedEventIds([])
            setConfigError(message)
          }
          return
        }

        const payload = (await response.json()) as FeeConfiguration

        if (!cancelled) {
          setConfiguration(payload)
          const defaultSelection =
            mode === "event" && Array.isArray(payload.eventFees)
              ? payload.eventFees.map((event) => event.id)
              : []
          setSelectedEventIds(defaultSelection)
          setConfigError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setConfiguration(null)
          setSelectedEventIds([])
          setConfigError(
            error instanceof Error ? error.message : "Unable to load fee configuration. Please try again.",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false)
        }
      }
    }

    void fetchConfiguration()

    return () => {
      cancelled = true
    }
  }, [isOpen, studentId, paymentForm.term, paymentForm.session, mode])

  useEffect(() => {
    if (!isOpen) {
      setConfiguration(null)
      setSelectedEventIds([])
      setConfigError(null)
      setIsLoadingConfig(false)
    }
  }, [isOpen, mode])

  const schoolFeeAmount = mode === "school" ? configuration?.schoolFee?.amount ?? 0 : 0
  const selectedEventTotal = useMemo(() => {
    if (!configuration) {
      return 0
    }

    return configuration.eventFees
      .filter((event) => selectedEventIds.includes(event.id))
      .reduce((sum, event) => Number((sum + Number(event.amount)).toFixed(2)), 0)
  }, [configuration, selectedEventIds])

  const totalDue = useMemo(() => {
    if (mode === "event") {
      return Number(selectedEventTotal.toFixed(2))
    }

    return Number((schoolFeeAmount + selectedEventTotal).toFixed(2))
  }, [mode, schoolFeeAmount, selectedEventTotal])

  const formatCurrency = (value: number) => `₦${Number(value || 0).toLocaleString()}`

  const toggleEventSelection = (id: string) => {
    setSelectedEventIds((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      if (!configuration) {
        throw new Error("Fee configuration not available. Please try again.")
      }

      if (mode === "event" && selectedEventIds.length === 0) {
        throw new Error("Select at least one event fee to proceed with payment.")
      }

      const amountToCharge = totalDue
      if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
        throw new Error("Unable to determine payable amount. Please contact the school administrator.")
      }

      const paymentType = mode === "event" ? "event_fee" : "school_fees"

      const requestBody = {
        email: paymentForm.email,
        amount: Math.round(amountToCharge * 100),
        studentId,
        paymentType,
        term: paymentForm.term,
        session: paymentForm.session,
        schoolFeeId: configuration.schoolFee?.id,
        eventFeeIds: selectedEventIds,
        metadata: {
          student_name: studentName,
          studentId,
          student_id: studentId,
          payment_type: paymentType,
          term: configuration.term,
          session: paymentForm.session,
          phone: paymentForm.phone,
          parent_name: parentName,
          parentName,
          parent_email: paymentForm.email,
          parentEmail: paymentForm.email,
          payer_role: "parent",
          class_name: configuration.className,
          className: configuration.className,
          ...(configuration.schoolFee
            ? { school_fee_configuration_id: configuration.schoolFee.id }
            : {}),
          selected_event_fee_ids: selectedEventIds,
          event_fee_ids: selectedEventIds,
        },
      }

      // Initialize Paystack payment
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.status) {
        onPaymentSuccess()
        const browserScope =
          typeof globalThis !== "undefined" && globalThis
            ? (globalThis as { location?: Location; top?: unknown })
            : null

        if (browserScope?.location && data.data?.authorization_url) {
          browserScope.location.href = data.data.authorization_url
        } else {
          logger.warn("Paystack returned without a browser window context", {
            authorizationUrl: data.data?.authorization_url,
          })
        }
      } else {
        throw new Error(data.message || "Payment initialization failed")
      }
    } catch (error) {
      logger.error("Payment initialization failed", { error })
      const description =
        error instanceof Error && error.message
          ? error.message
          : "Payment initialization failed. Please try again."
      toast({
        title: "Unable to start payment",
        description,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#2d682d]">
            <CreditCard className="h-5 w-5" />
            {mode === "event"
              ? eventPaymentLabel || configuration?.eventPaymentTitle || "Pay Event Fees"
              : "Pay School Fees"}
          </DialogTitle>
          <DialogDescription>
            {configuration
              ? `Complete payment for ${studentName} - ${formatCurrency(totalDue)}`
              : `Complete payment for ${studentName}`}
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

          {isLoadingConfig ? (
            <div className="flex items-center gap-2 rounded-md border border-[#2d682d]/20 bg-white/60 p-3 text-sm text-[#2d682d]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading fee configuration...
            </div>
          ) : configError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {configError}
            </div>
          ) : configuration ? (
            <>
              {configuration.eventFees.length > 0 ? (
                <div className="space-y-2">
                  <Label>{mode === "event" ? "Available Event Fees" : "Optional Event Fees"}</Label>
                  <div className="space-y-2">
                    {configuration.eventFees.map((event) => {
                      const isSelected = selectedEventIds.includes(event.id)
                      return (
                        <label
                          key={event.id}
                          className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                            isSelected
                              ? "border-[#2d682d] bg-[#2d682d]/10"
                              : "border-[#2d682d]/20"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleEventSelection(event.id)}
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <p className="font-medium text-[#2d682d]">{event.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(event.amount)}
                              {event.dueDate
                                ? ` • Due ${new Date(event.dueDate).toLocaleDateString()}`
                                : ""}
                            </p>
                            {event.description ? (
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            ) : null}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-[#2d682d]/20 bg-white/60 p-3 text-sm text-[#2d682d]">
                  {mode === "event"
                    ? "No event fees are available for payment right now."
                    : "No optional event fees are available for this class."}
                </div>
              )}

              <div className="bg-[#2d682d]/5 p-4 rounded-lg space-y-2">
                {mode === "school" && configuration.schoolFee ? (
                  <div className="flex justify-between items-center text-sm">
                    <span>School Fees ({configuration.schoolFee.term})</span>
                    <span className="font-semibold">{formatCurrency(schoolFeeAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center text-sm">
                  <span>{mode === "event" ? "Event Fees" : "Selected Event Fees"}</span>
                  <span>{formatCurrency(selectedEventTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Processing Fee</span>
                  <span>{formatCurrency(0)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between items-center font-semibold text-[#2d682d]">
                  <span>Total Due</span>
                  <span>{formatCurrency(totalDue)}</span>
                </div>
              </div>
            </>
          ) : null}

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
            <Button
              type="submit"
              className="flex-1 bg-[#b29032] hover:bg-[#8a6b25]"
              disabled={
                isProcessing ||
                isLoadingConfig ||
                !configuration ||
                Boolean(configError) ||
                (mode === "event" && selectedEventIds.length === 0)
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${formatCurrency(totalDue)}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
