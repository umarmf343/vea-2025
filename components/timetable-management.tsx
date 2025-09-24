"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Clock, Coffee, Edit, Loader2, Plus, Send, Trash2 } from "lucide-react"

import { logger } from "@/lib/logger"
import {
  CLASS_TIMETABLE_PERIODS,
  DEFAULT_TIMETABLE_PERIODS,
  DAY_ORDER,
  formatTimetablePeriodRange,
  normalizeTimetableCollection,
  normaliseTimeRangeLabel,
  type TimetableSlotViewModel,
} from "@/lib/timetable"

interface ClassOption {
  value: string
  label: string
  subjects: string[]
}

type TimetableSlot = TimetableSlotViewModel

const FALLBACK_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Physics",
  "Chemistry",
  "Biology",
  "Basic Science",
  "Computer Studies",
  "Economics",
  "Civic Education",
  "Geography",
]

const PERIOD_SELECT_OPTIONS = CLASS_TIMETABLE_PERIODS.map((period) => {
  const range = formatTimetablePeriodRange(period)
  return { id: period.id, value: range, label: `${period.label} • ${range}` }
})

export default function TimetableManagement() {
  const { toast } = useToast()

  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [classSubjects, setClassSubjects] = useState<Map<string, string[]>>(new Map())
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedDay, setSelectedDay] = useState<string>(DAY_ORDER[0])
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const [dialogState, setDialogState] = useState<
    { mode: "create" | "edit"; slot?: TimetableSlot; defaultTime?: string } | null
  >(null)
  const [slotForm, setSlotForm] = useState({
    day: DAY_ORDER[0],
    time: PERIOD_SELECT_OPTIONS[0]?.value ?? normaliseTimeRangeLabel(""),
    subject: FALLBACK_SUBJECTS[0],
    teacher: "",
    location: "",
  })

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Failed to load classes (${response.status})`)
      }

      const payload: unknown = await response.json()
      const rawClasses = Array.isArray((payload as Record<string, unknown>)?.classes)
        ? ((payload as Record<string, unknown>).classes as unknown[])
        : []

      const normalized = rawClasses
        .map((item) => {
          if (typeof item === "string") {
            return { value: item, label: item, subjects: [] }
          }

          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>
            const rawValue = record.id ?? record.name
            const value =
              typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : null
            if (!value) {
              return null
            }

            const label =
              typeof record.name === "string" && record.name.trim().length > 0
                ? record.name.trim()
                : value

            const rawSubjects = Array.isArray(record.subjects) ? record.subjects : []
            const subjects = rawSubjects
              .map((subject) => {
                if (typeof subject === "string") {
                  return subject.trim()
                }
                if (subject && typeof subject === "object") {
                  const subjectRecord = subject as Record<string, unknown>
                  const candidate = [
                    subjectRecord.name,
                    subjectRecord.title,
                    subjectRecord.subject,
                    subjectRecord.label,
                  ].find((value) => typeof value === "string" && value.trim().length > 0)
                  return typeof candidate === "string" ? candidate.trim() : null
                }
                return null
              })
              .filter((subject): subject is string => Boolean(subject && subject.trim().length > 0))

            const deduped = Array.from(new Set(subjects))

            return { value, label, subjects: deduped }
          }

          return null
        })
        .filter((option): option is ClassOption => option !== null)

      setClassOptions(normalized)
      setClassSubjects(new Map(normalized.map((option) => [option.value, option.subjects])))

      if (normalized.length > 0) {
        setSelectedClass((previous) => previous || normalized[0].value)
      }
    } catch (error) {
      logger.error("Unable to load classes", { error })
      setClassOptions([])
      setClassSubjects(new Map())
    }
  }, [])

  const loadTimetable = useCallback(
    async (className: string) => {
      if (!className) {
        setTimetableSlots([])
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch(`/api/timetable?className=${encodeURIComponent(className)}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch timetable (${response.status})`)
        }

        const data: unknown = await response.json()
        const slots = normalizeTimetableCollection((data as Record<string, unknown>)?.timetable)
        setTimetableSlots(slots)
      } catch (error) {
        logger.error("Failed to load timetable", { error })
        toast({
          title: "Unable to load timetable",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (!selectedClass) {
      return
    }
    void loadTimetable(selectedClass)
  }, [selectedClass, loadTimetable])

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Map<string, TimetableSlot>>()

    DAY_ORDER.forEach((day) => {
      map.set(day, new Map())
    })

    timetableSlots.forEach((slot) => {
      const normalizedDay =
        DAY_ORDER.find((day) => day.toLowerCase() === slot.day.toLowerCase()) ?? slot.day
      const dayMap = map.get(normalizedDay) ?? new Map<string, TimetableSlot>()
      dayMap.set(normaliseTimeRangeLabel(slot.time), slot)
      map.set(normalizedDay, dayMap)
    })

    return map
  }, [timetableSlots])

  const selectedDayMap = slotsByDay.get(selectedDay) ?? new Map<string, TimetableSlot>()

  const scheduledCount = useMemo(() => {
    const dayMap = slotsByDay.get(selectedDay)
    if (!dayMap) {
      return 0
    }

    return CLASS_TIMETABLE_PERIODS.reduce((count, period) => {
      const range = formatTimetablePeriodRange(period)
      return dayMap.has(range) ? count + 1 : count
    }, 0)
  }, [selectedDay, slotsByDay])

  const nextAvailablePeriod = useMemo(() => {
    const dayMap = slotsByDay.get(selectedDay)
    return CLASS_TIMETABLE_PERIODS.find((period) => {
      const range = formatTimetablePeriodRange(period)
      return !(dayMap?.has(range) ?? false)
    })
  }, [selectedDay, slotsByDay])

  const nextAvailableTime = nextAvailablePeriod
    ? formatTimetablePeriodRange(nextAvailablePeriod)
    : PERIOD_SELECT_OPTIONS[0]?.value ?? normaliseTimeRangeLabel("")

  const subjectOptions = useMemo(() => {
    const base = classSubjects.get(selectedClass) ?? []
    const usable = base.length > 0 ? base : FALLBACK_SUBJECTS
    const unique = new Set(usable)

    if (dialogState?.slot?.subject) {
      unique.add(dialogState.slot.subject)
    }

    return Array.from(unique)
  }, [classSubjects, dialogState?.slot?.subject, selectedClass])

  const periodOptions = useMemo(() => {
    const base = [...PERIOD_SELECT_OPTIONS]
    const existing = new Set(base.map((option) => option.value))

    if (dialogState?.slot?.time) {
      const normalized = normaliseTimeRangeLabel(dialogState.slot.time)
      if (!existing.has(normalized)) {
        base.push({ id: `custom-${normalized}`, value: normalized, label: normalized })
        existing.add(normalized)
      }
    }

    if (dialogState?.defaultTime) {
      const normalized = normaliseTimeRangeLabel(dialogState.defaultTime)
      if (!existing.has(normalized)) {
        base.push({ id: `default-${normalized}`, value: normalized, label: normalized })
      }
    }

    return base
  }, [dialogState])

  useEffect(() => {
    const defaultSubject = subjectOptions[0] ?? FALLBACK_SUBJECTS[0]

    if (dialogState?.mode === "edit" && dialogState.slot) {
      setSlotForm({
        day: dialogState.slot.day,
        time: normaliseTimeRangeLabel(dialogState.slot.time),
        subject: dialogState.slot.subject || defaultSubject,
        teacher: dialogState.slot.teacher,
        location: dialogState.slot.location ?? "",
      })
    } else {
      const defaultTimeLabel = dialogState?.defaultTime
        ? normaliseTimeRangeLabel(dialogState.defaultTime)
        : normaliseTimeRangeLabel(nextAvailableTime)

      setSlotForm({
        day: selectedDay,
        time: defaultTimeLabel,
        subject: defaultSubject,
        teacher: "",
        location: "",
      })
    }
  }, [dialogState, nextAvailableTime, selectedDay, subjectOptions])

  const classSubjectChips = classSubjects.get(selectedClass) ?? []
  const totalPeriods = CLASS_TIMETABLE_PERIODS.length

  const handleSlotSubmit = async () => {
    if (!selectedClass) {
      toast({
        title: "Select a class",
        description: "Choose a class before updating the timetable.",
        variant: "destructive",
      })
      return
    }

    const normalizedTime = normaliseTimeRangeLabel(slotForm.time)
    const subject = slotForm.subject.trim()
    const teacher = slotForm.teacher.trim()
    const location = slotForm.location.trim()

    if (!subject || !teacher) {
      toast({
        title: "Missing details",
        description: "Subject and teacher are required for each period.",
        variant: "destructive",
      })
      return
    }

    const duplicate = timetableSlots.some((slot) => {
      if (dialogState?.slot && slot.id === dialogState.slot.id) {
        return false
      }

      return slot.day === slotForm.day && normaliseTimeRangeLabel(slot.time) === normalizedTime
    })

    if (duplicate) {
      toast({
        title: "Period already scheduled",
        description: "Choose a different time slot for this day.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      if (dialogState?.mode === "edit" && dialogState.slot) {
        const response = await fetch("/api/timetable", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: dialogState.slot.id,
            updates: {
              day: slotForm.day,
              time: normalizedTime,
              subject,
              teacher,
              location: location ? location : null,
            },
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
          const message =
            typeof payload.error === "string" ? payload.error : `Failed to update timetable (${response.status})`
          throw new Error(message)
        }

        await response.json().catch(() => undefined)
        toast({ title: "Timetable entry updated" })
      } else {
        const response = await fetch("/api/timetable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            className: selectedClass,
            slot: {
              day: slotForm.day,
              time: normalizedTime,
              subject,
              teacher,
              location: location ? location : null,
            },
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
          const message =
            typeof payload.error === "string" ? payload.error : `Failed to create timetable slot (${response.status})`
          throw new Error(message)
        }

        await response.json().catch(() => undefined)
        toast({ title: "Period added to timetable" })
      }

      await loadTimetable(selectedClass)
      setSelectedDay(slotForm.day)
      setDialogState(null)
    } catch (error) {
      logger.error("Failed to save timetable slot", { error })
      toast({
        title: "Unable to save timetable",
        description: "Please review the details and try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSlot = async (slot: TimetableSlot) => {
    if (!selectedClass) {
      return
    }

    const confirmation = window.confirm(
      `Remove ${slot.subject || "this period"} (${normaliseTimeRangeLabel(slot.time)}) from ${selectedClass}?`,
    )

    if (!confirmation) {
      return
    }

    try {
      const response = await fetch(`/api/timetable?slotId=${encodeURIComponent(slot.id)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        const message =
          typeof payload.error === "string" ? payload.error : `Failed to delete timetable slot (${response.status})`
        throw new Error(message)
      }

      await loadTimetable(selectedClass)
      toast({ title: "Timetable entry removed" })
    } catch (error) {
      logger.error("Failed to delete timetable entry", { error })
      toast({
        title: "Unable to delete timetable entry",
        description: "Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handleSendTimetable = async () => {
    if (!selectedClass) {
      toast({
        title: "Select a class",
        description: "Choose a class timetable before sending updates.",
        variant: "destructive",
      })
      return
    }

    const hasScheduledPeriods = timetableSlots.some((slot) => slot.subject.trim().length > 0)
    if (!hasScheduledPeriods) {
      toast({
        title: "No scheduled periods",
        description: "Add at least one class period before sending the timetable.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)

    try {
      const response = await fetch("/api/timetable/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: selectedClass }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
        const message =
          typeof payload.error === "string" ? payload.error : `Failed to send timetable (${response.status})`
        throw new Error(message)
      }

      toast({
        title: "Timetable shared",
        description: `Students, teachers and parents for ${selectedClass} will now see the updated schedule.`,
      })
    } catch (error) {
      logger.error("Failed to send timetable update", { error })
      toast({
        title: "Unable to send timetable",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-emerald-900">Timetable Management</h2>
          <p className="text-sm text-emerald-700/80">
            Orchestrate 40-minute lessons, coordinated breaks and after-break sessions for every class.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100"
            onClick={handleSendTimetable}
            disabled={isSending || !selectedClass}
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send to dashboards
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setDialogState({ mode: "create", defaultTime: nextAvailableTime })}
            disabled={!selectedClass}
          >
            <Plus className="mr-2 h-4 w-4" /> Quick add period
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-emerald-200/70 bg-white/90 shadow-lg backdrop-blur">
        <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-emerald-500/10 via-white to-emerald-500/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-emerald-900">Class Timetable Planner</CardTitle>
              <CardDescription>Allocate subjects into 40-minute learning blocks with a structured break.</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700/80">
              <Clock className="h-4 w-4" />
              {totalPeriods} periods • 10-minute break
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="rounded-2xl border-emerald-200 bg-white/80">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Day</Label>
              <Tabs value={selectedDay} onValueChange={setSelectedDay}>
                <TabsList className="grid grid-cols-5 rounded-full bg-emerald-500/10 p-1">
                  {DAY_ORDER.map((day) => (
                    <TabsTrigger
                      key={day}
                      value={day}
                      className="rounded-full px-3 py-1 text-sm font-medium text-emerald-700 transition data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-emerald-900"
                    >
                      {day.slice(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Summary</Label>
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">{selectedClass || "Select a class"}</p>
                <p className="text-xs text-emerald-700/70">{selectedDay}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20">
                    {scheduledCount} of {totalPeriods} periods scheduled
                  </Badge>
                  <Badge variant="outline" className="border-amber-200 text-amber-700">
                    10-minute break
                  </Badge>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="rounded-3xl border border-emerald-100 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80">
                  Subjects for this class
                </p>
                {classSubjectChips.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {classSubjectChips.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700/70">
                    Assign subjects to this class to streamline scheduling.
                  </p>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[60vh] pr-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-emerald-700/70">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading timetable…
              </div>
            ) : (
              <div className="grid gap-4">
                {DEFAULT_TIMETABLE_PERIODS.map((period) => {
                  const range = formatTimetablePeriodRange(period)

                  if (period.kind === "break") {
                    return (
                      <div
                        key={period.id}
                        className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-amber-100 p-5 shadow-sm"
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-amber-300/70" />
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                              {period.label}
                            </span>
                            <h3 className="text-lg font-semibold text-amber-900">10-minute Break</h3>
                            <p className="text-sm text-amber-700/80">
                              Encourage students to hydrate, stretch and reset for the next sessions.
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-3 text-right">
                            <Coffee className="h-5 w-5 text-amber-600" />
                            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700 shadow-inner">
                              {range}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const slot = selectedDayMap.get(range)
                  const hasSlot = Boolean(slot && slot.subject.trim().length > 0)

                  return (
                    <div
                      key={period.id}
                      className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400/70" />
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            {period.label}
                          </span>
                          <h3 className="text-xl font-semibold text-emerald-900">
                            {hasSlot ? slot?.subject || "Subject not set" : "Free period"}
                          </h3>
                          <p className="text-sm text-emerald-700/80">
                            {hasSlot
                              ? [
                                  slot?.teacher ? `Teacher: ${slot.teacher}` : "Teacher pending",
                                  slot?.location ? `Location: ${slot.location}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")
                              : "Assign a subject and teacher to keep the learning momentum."}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-3 text-right">
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-inner">
                            {range}
                          </span>
                          {hasSlot && slot ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                                onClick={() => setDialogState({ mode: "edit", slot })}
                              >
                                <Edit className="mr-1 h-4 w-4" /> Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteSlot(slot)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" /> Delete
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => setDialogState({ mode: "create", defaultTime: range })}
                              disabled={!selectedClass}
                            >
                              <Plus className="mr-1 h-4 w-4" /> Schedule class
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!dialogState} onOpenChange={(open) => (!open ? setDialogState(null) : undefined)}>
        <DialogContent className="max-w-2xl border-emerald-200/70 bg-white/95 backdrop-blur">
          <DialogHeader>
            <DialogTitle className="text-emerald-900">
              {dialogState?.mode === "edit" ? "Update period" : "Schedule new period"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Day</Label>
              <Select value={slotForm.day} onValueChange={(value) => setSlotForm((prev) => ({ ...prev, day: value }))}>
                <SelectTrigger className="rounded-2xl border-emerald-200 bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_ORDER.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Period</Label>
              <Select value={slotForm.time} onValueChange={(value) => setSlotForm((prev) => ({ ...prev, time: value }))}>
                <SelectTrigger className="rounded-2xl border-emerald-200 bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((period) => (
                    <SelectItem key={period.id} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Subject</Label>
              <Select value={slotForm.subject} onValueChange={(value) => setSlotForm((prev) => ({ ...prev, subject: value }))}>
                <SelectTrigger className="rounded-2xl border-emerald-200 bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-emerald-900">Teacher</Label>
              <Input
                value={slotForm.teacher}
                onChange={(event) => setSlotForm((prev) => ({ ...prev, teacher: event.target.value }))}
                placeholder="Enter teacher's name"
                className="rounded-2xl border-emerald-200 bg-white/80"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-emerald-900">Location</Label>
              <Input
                value={slotForm.location}
                onChange={(event) => setSlotForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Laboratory, room number or hall"
                className="rounded-2xl border-emerald-200 bg-white/80"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState(null)} className="border-emerald-200 text-emerald-700">
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleSlotSubmit}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
