"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RefreshCw } from "lucide-react"

import {
  type EventFeeConfigurationRecord,
  type SchoolFeeConfigurationRecord,
} from "@/lib/database"
import { safeStorage } from "@/lib/safe-storage"
import { useToast } from "@/hooks/use-toast"

interface FeeConfigurationPanelProps {
  accountantName: string
}

const TERM_OPTIONS = [
  { value: "First Term", label: "First Term" },
  { value: "Second Term", label: "Second Term" },
  { value: "Third Term", label: "Third Term" },
]

interface ClassOption {
  id: string
  name: string
}

interface SchoolFeeFormState {
  classId: string
  className: string
  term: string
  amount: string
  effectiveDate: string
  activate: boolean
  notes: string
}

interface EventFeeFormState {
  name: string
  description: string
  amount: string
  dueDate: string
  classes: string
  activate: boolean
}

const formatCurrency = (value: number): string => `₦${Number(value).toLocaleString()}`

const buildRequestInit = (init: RequestInit = {}): RequestInit => {
  const token = safeStorage.getItem("vea_auth_token")
  const headers = new Headers(init.headers ?? {})
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return { ...init, headers, cache: "no-store" }
}

export function FeeConfigurationPanel({ accountantName }: FeeConfigurationPanelProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolFees, setSchoolFees] = useState<SchoolFeeConfigurationRecord[]>([])
  const [eventFees, setEventFees] = useState<EventFeeConfigurationRecord[]>([])
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)
  const [classError, setClassError] = useState<string | null>(null)
  const [schoolForm, setSchoolForm] = useState<SchoolFeeFormState>({
    classId: "",
    className: "",
    term: TERM_OPTIONS[0]?.value ?? "First Term",
    amount: "",
    effectiveDate: "",
    activate: true,
    notes: "",
  })
  const [eventForm, setEventForm] = useState<EventFeeFormState>({
    name: "",
    description: "",
    amount: "",
    dueDate: "",
    classes: "",
    activate: true,
  })

  const sortedSchoolFees = useMemo(() => {
    return [...schoolFees].sort((a, b) => {
      if (a.className === b.className) {
        if (a.term === b.term) {
          return b.version - a.version
        }
        return a.term.localeCompare(b.term)
      }
      return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" })
    })
  }, [schoolFees])

  const sortedEventFees = useMemo(() => {
    return [...eventFees].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [eventFees])

  const resetSchoolForm = () => {
    setSchoolForm((previous) => ({
      classId: previous.classId,
      className: previous.className,
      term: TERM_OPTIONS[0]?.value ?? "First Term",
      amount: "",
      effectiveDate: "",
      activate: true,
      notes: "",
    }))
  }

  const resetEventForm = () => {
    setEventForm({ name: "", description: "", amount: "", dueDate: "", classes: "", activate: true })
  }

  const loadConfigurations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [schoolResponse, eventResponse] = await Promise.all([
        fetch("/api/fees/school", buildRequestInit()),
        fetch("/api/fees/events", buildRequestInit()),
      ])

      if (!schoolResponse.ok) {
        throw new Error(`Failed to load school fees (status ${schoolResponse.status})`)
      }

      if (!eventResponse.ok) {
        throw new Error(`Failed to load event fees (status ${eventResponse.status})`)
      }

      const schoolPayload = (await schoolResponse.json()) as { fees: SchoolFeeConfigurationRecord[] }
      const eventPayload = (await eventResponse.json()) as { events: EventFeeConfigurationRecord[] }

      setSchoolFees(schoolPayload.fees ?? [])
      setEventFees(eventPayload.events ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fee configurations")
    } finally {
      setIsLoading(false)
    }
  }

  const loadClasses = async () => {
    setIsLoadingClasses(true)
    setClassError(null)

    try {
      const response = await fetch("/api/classes", buildRequestInit())
      if (!response.ok) {
        throw new Error(`Failed to load classes (status ${response.status})`)
      }

      const payload = (await response.json()) as { classes?: Array<{ id: string; name: string }> }
      const options = Array.isArray(payload.classes)
        ? payload.classes
            .filter((entry): entry is { id: string; name: string } =>
              Boolean(entry?.id) && Boolean(entry?.name),
            )
            .map((entry) => ({ id: String(entry.id), name: String(entry.name) }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
        : []

      setClassOptions(options)

      setSchoolForm((previous) => {
        if (!previous.classId || options.some((option) => option.id === previous.classId)) {
          return previous
        }

        return {
          ...previous,
          classId: "",
          className: "",
        }
      })
    } catch (loadError) {
      setClassOptions([])
      setClassError(
        loadError instanceof Error ? loadError.message : "Unable to load classes. Please try again later.",
      )
    } finally {
      setIsLoadingClasses(false)
    }
  }

  useEffect(() => {
    void loadConfigurations()
    void loadClasses()
  }, [])

  const handleCreateSchoolFee = async (event: React.FormEvent) => {
    event.preventDefault()

    if (classOptions.length > 0 && !schoolForm.classId) {
      toast({
        title: "Class is required",
        description: "Please select a class before saving the school fee configuration.",
        variant: "destructive",
      })
      return
    }

    const resolvedClassName =
      classOptions.find((option) => option.id === schoolForm.classId)?.name || schoolForm.className

    if (!resolvedClassName.trim() || !schoolForm.term.trim() || !schoolForm.amount.trim()) {
      toast({
        title: "Incomplete details",
        description: "Class, term, and amount are required to create a school fee configuration.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        className: resolvedClassName,
        term: schoolForm.term,
        amount: Number(schoolForm.amount),
        effectiveDate: schoolForm.effectiveDate || null,
        notes: schoolForm.notes || null,
        activate: schoolForm.activate,
        classId: schoolForm.classId || null,
      }

      const response = await fetch("/api/fees/school", buildRequestInit({
        method: "POST",
        body: JSON.stringify(payload),
      }))

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error ?? `Failed to create school fee configuration (status ${response.status})`
        throw new Error(message)
      }

      toast({
        title: "School fee saved",
        description: `${resolvedClassName} • ${schoolForm.term} has been configured successfully.`,
      })
      resetSchoolForm()
      await loadConfigurations()
    } catch (submitError) {
      toast({
        title: "Unable to save school fee",
        description: submitError instanceof Error ? submitError.message : "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateEventFee = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!eventForm.name.trim() || !eventForm.amount.trim()) {
      toast({
        title: "Incomplete details",
        description: "Event name and amount are required to create an event fee.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: eventForm.name,
        description: eventForm.description || null,
        amount: Number(eventForm.amount),
        dueDate: eventForm.dueDate || null,
        applicableClasses: eventForm.classes
          ? eventForm.classes
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
          : [],
        activate: eventForm.activate,
      }

      const response = await fetch("/api/fees/events", buildRequestInit({
        method: "POST",
        body: JSON.stringify(payload),
      }))

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error ?? `Failed to create event fee (status ${response.status})`
        throw new Error(message)
      }

      toast({ title: "Event fee saved", description: `${eventForm.name} has been created.` })
      resetEventForm()
      await loadConfigurations()
    } catch (submitError) {
      toast({
        title: "Unable to save event fee",
        description: submitError instanceof Error ? submitError.message : "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSchoolFeeStatus = async (fee: SchoolFeeConfigurationRecord) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/fees/school/${fee.id}`, buildRequestInit({
        method: "PATCH",
        body: JSON.stringify({ isActive: !fee.isActive }),
      }))

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error ?? `Failed to update fee status (status ${response.status})`
        throw new Error(message)
      }

      toast({
        title: !fee.isActive ? "Fee activated" : "Fee deactivated",
        description: `${fee.className} • ${fee.term} has been ${!fee.isActive ? "activated" : "deactivated"}.`,
      })
      await loadConfigurations()
    } catch (toggleError) {
      toast({
        title: "Unable to update fee",
        description: toggleError instanceof Error ? toggleError.message : "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleEventFeeStatus = async (fee: EventFeeConfigurationRecord) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/fees/events/${fee.id}`, buildRequestInit({
        method: "PATCH",
        body: JSON.stringify({ isActive: !fee.isActive }),
      }))

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error ?? `Failed to update event status (status ${response.status})`
        throw new Error(message)
      }

      toast({
        title: !fee.isActive ? "Event activated" : "Event deactivated",
        description: `${fee.name} has been ${!fee.isActive ? "activated" : "deactivated"}.`,
      })
      await loadConfigurations()
    } catch (toggleError) {
      toast({
        title: "Unable to update event fee",
        description: toggleError instanceof Error ? toggleError.message : "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#2d682d]">Fee Configuration</h2>
          <p className="text-sm text-muted-foreground">
            {accountantName
              ? `Hi ${accountantName.split(" ")[0]}, define mandatory school fees and optional event charges. Parents must settle the configured school fee before accessing report cards.`
              : "Define mandatory school fees and optional event charges. Parents must settle the configured school fee before accessing report cards."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void Promise.all([loadConfigurations(), loadClasses()])}
          disabled={isLoading || isSubmitting || isLoadingClasses}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Standard School Fees</CardTitle>
          <CardDescription>
            Configure the mandatory school fees for each class and term. Only one active configuration per class-term
            is allowed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateSchoolFee} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="className">Class</Label>
              <Select
                value={schoolForm.classId || undefined}
                onValueChange={(value) => {
                  const selected = classOptions.find((option) => option.id === value)
                  setSchoolForm((prev) => ({
                    ...prev,
                    classId: selected?.id ?? "",
                    className: selected?.name ?? "",
                  }))
                }}
                disabled={isLoadingClasses || classOptions.length === 0}
              >
                <SelectTrigger id="className">
                  <SelectValue
                    placeholder={
                      isLoadingClasses
                        ? "Loading classes..."
                        : classOptions.length === 0
                          ? "No classes available"
                          : "Select class"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classError ? (
                <p className="text-xs text-red-600">{classError}</p>
              ) : classOptions.length === 0 && !isLoadingClasses ? (
                <p className="text-xs text-muted-foreground">Create a class before configuring fees.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="termSelect">Term</Label>
              <Select
                value={schoolForm.term}
                onValueChange={(value) => setSchoolForm((prev) => ({ ...prev, term: value }))}
              >
                <SelectTrigger id="termSelect">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (NGN)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="50000"
                value={schoolForm.amount}
                onChange={(event) => setSchoolForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={schoolForm.effectiveDate}
                onChange={(event) => setSchoolForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Provide internal notes or context"
                value={schoolForm.notes}
                onChange={(event) => setSchoolForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                id="activateSchoolFee"
                checked={schoolForm.activate}
                onCheckedChange={(checked) => setSchoolForm((prev) => ({ ...prev, activate: Boolean(checked) }))}
              />
              <Label htmlFor="activateSchoolFee" className="text-sm text-muted-foreground">
                Activate immediately
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save School Fee"
                )}
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Class</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Term</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Version</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedSchoolFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading school fees..." : "No school fee configurations yet."}
                    </td>
                  </tr>
                ) : (
                  sortedSchoolFees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{fee.className}</td>
                      <td className="px-3 py-2 text-gray-600">{fee.term}</td>
                      <td className="px-3 py-2 font-semibold">{formatCurrency(fee.amount)}</td>
                      <td className="px-3 py-2 text-gray-600">v{fee.version}</td>
                      <td className="px-3 py-2">
                        <Badge variant={fee.isActive ? "default" : "outline"}>
                          {fee.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleSchoolFeeStatus(fee)}
                          disabled={isSubmitting}
                        >
                          {fee.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event-Based Fees</CardTitle>
          <CardDescription>
            Configure optional, event-specific charges such as excursions or sports days. Parents can opt-in during
            payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateEventFee} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                placeholder="e.g. Excursion 2024"
                value={eventForm.name}
                onChange={(evt) => setEventForm((prev) => ({ ...prev, name: evt.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventAmount">Amount (NGN)</Label>
              <Input
                id="eventAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="15000"
                value={eventForm.amount}
                onChange={(evt) => setEventForm((prev) => ({ ...prev, amount: evt.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="eventDescription">Description</Label>
              <Textarea
                id="eventDescription"
                placeholder="Provide a brief description for parents"
                value={eventForm.description}
                onChange={(evt) => setEventForm((prev) => ({ ...prev, description: evt.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDueDate">Due Date</Label>
              <Input
                id="eventDueDate"
                type="date"
                value={eventForm.dueDate}
                onChange={(evt) => setEventForm((prev) => ({ ...prev, dueDate: evt.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventClasses">Applicable Classes</Label>
              <Input
                id="eventClasses"
                placeholder="Separate multiple classes with commas"
                value={eventForm.classes}
                onChange={(evt) => setEventForm((prev) => ({ ...prev, classes: evt.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to make the event available to all classes.
              </p>
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                id="activateEvent"
                checked={eventForm.activate}
                onCheckedChange={(checked) => setEventForm((prev) => ({ ...prev, activate: Boolean(checked) }))}
              />
              <Label htmlFor="activateEvent" className="text-sm text-muted-foreground">
                Activate immediately
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Event Fee"
                )}
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Event</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Classes</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEventFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading event fees..." : "No event fee configurations yet."}
                    </td>
                  </tr>
                ) : (
                  sortedEventFees.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">
                        <div>{event.name}</div>
                        {event.description ? (
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatCurrency(event.amount)}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {event.dueDate ? new Date(event.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {event.applicableClasses.length > 0 ? event.applicableClasses.join(", ") : "All classes"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={event.isActive ? "default" : "outline"}>
                          {event.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleEventFeeStatus(event)}
                          disabled={isSubmitting}
                        >
                          {event.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
