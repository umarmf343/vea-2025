"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { DEFAULT_TIMETABLE_PERIODS, DAY_ORDER, formatTimetablePeriodRange, normaliseTimeRangeLabel, type TimetableSlotViewModel } from "@/lib/timetable"

export type TimetableWeeklyViewSlot = Pick<
  TimetableSlotViewModel,
  "id" | "day" | "time" | "subject" | "teacher" | "location"
>

interface TimetableWeeklyViewProps {
  slots: TimetableWeeklyViewSlot[]
  renderDetails?: (slot: TimetableWeeklyViewSlot) => ReactNode
  emptyMessage?: string
  initialDay?: string
}

const defaultRenderDetails = (slot: TimetableWeeklyViewSlot) => {
  const details: string[] = []
  if (slot.teacher && slot.teacher.trim().length > 0) {
    details.push(`Teacher: ${slot.teacher}`)
  }
  if (slot.location && slot.location.trim().length > 0) {
    details.push(`Location: ${slot.location}`)
  }

  if (details.length === 0) {
    return <p className="text-sm text-emerald-700/70">Teacher and venue will be shared soon.</p>
  }

  return <p className="text-sm text-emerald-700/80">{details.join(" • ")}</p>
}

export function TimetableWeeklyView({ slots, renderDetails = defaultRenderDetails, emptyMessage, initialDay }: TimetableWeeklyViewProps) {
  const dayMaps = useMemo(() => {
    const map = new Map<string, Map<string, TimetableWeeklyViewSlot>>()
    DAY_ORDER.forEach((day) => {
      map.set(day, new Map())
    })

    slots.forEach((slot) => {
      const normalizedDay =
        DAY_ORDER.find((day) => day.toLowerCase() === slot.day.toLowerCase()) ?? slot.day
      const dayMap = map.get(normalizedDay) ?? new Map<string, TimetableWeeklyViewSlot>()
      dayMap.set(normaliseTimeRangeLabel(slot.time), slot)
      map.set(normalizedDay, dayMap)
    })

    return map
  }, [slots])

  const resolveInitialDay = () => {
    if (initialDay) {
      const normalized = DAY_ORDER.find((day) => day.toLowerCase() === initialDay.toLowerCase())
      if (normalized) {
        return normalized
      }
    }

    const firstDayWithSlots = DAY_ORDER.find((day) => (dayMaps.get(day)?.size ?? 0) > 0)
    return firstDayWithSlots ?? DAY_ORDER[0]
  }

  const [activeDay, setActiveDay] = useState<string>(() => resolveInitialDay())

  useEffect(() => {
    if (!DAY_ORDER.includes(activeDay)) {
      setActiveDay(DAY_ORDER[0])
      return
    }

    const currentDaySlots = dayMaps.get(activeDay)
    if ((currentDaySlots?.size ?? 0) > 0) {
      return
    }

    const firstDayWithSlots = DAY_ORDER.find((day) => (dayMaps.get(day)?.size ?? 0) > 0)
    if (firstDayWithSlots) {
      setActiveDay(firstDayWithSlots)
    }
  }, [activeDay, dayMaps])

  const activeDayMap = dayMaps.get(activeDay) ?? new Map<string, TimetableWeeklyViewSlot>()
  const hasAnySlot = slots.length > 0
  const hasScheduledPeriods = DEFAULT_TIMETABLE_PERIODS.some((period) => {
    if (period.kind === "break") {
      return false
    }

    const range = formatTimetablePeriodRange(period)
    const slot = activeDayMap.get(range)
    return Boolean(slot && slot.subject.trim().length > 0)
  })

  if (!hasAnySlot && emptyMessage) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-white/80 p-6 text-center shadow-sm">
        <p className="text-sm text-emerald-700/80">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-100 bg-white/85 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-500/10 via-white to-emerald-500/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/70">Selected day</p>
            <h3 className="text-xl font-semibold text-emerald-900">{activeDay}</h3>
            {!hasScheduledPeriods ? (
              <p className="text-xs text-emerald-700/70">All periods are currently free for this day.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_ORDER.map((day) => {
              const isActive = day === activeDay
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
                    isActive
                      ? "bg-white text-emerald-900 shadow"
                      : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="space-y-3 p-5">
          {DEFAULT_TIMETABLE_PERIODS.map((period) => {
            const range = formatTimetablePeriodRange(period)

            if (period.kind === "break") {
              return (
                <div
                  key={period.id}
                  className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-amber-100 p-5"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-amber-300/70" />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {period.label}
                      </span>
                      <h4 className="text-lg font-semibold text-amber-900">10-minute Break</h4>
                      <p className="text-sm text-amber-700/80">Time to refresh and prepare for the next lessons.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700 shadow-inner">
                        {range}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }

            const slot = activeDayMap.get(range)
            const hasSlot = Boolean(slot && slot.subject.trim().length > 0)

            return (
              <div
                key={period.id}
                className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400/70" />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      {period.label}
                    </span>
                    <h4 className="text-lg font-semibold text-emerald-900">
                      {hasSlot ? slot?.subject || "Subject not set" : "Free period"}
                    </h4>
                    {hasSlot && slot ? (
                      renderDetails(slot)
                    ) : (
                      <p className="text-sm text-emerald-700/70">No class scheduled yet. Enjoy a study moment or prepare ahead.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-inner">
                      {range}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
