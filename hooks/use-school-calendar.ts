"use client"

import { useEffect, useState } from "react"

import { getSchoolCalendar, subscribeToSchoolCalendar, type SchoolCalendarRecord } from "@/lib/school-calendar"

export function useSchoolCalendar() {
  const [calendar, setCalendar] = useState<SchoolCalendarRecord>(() => getSchoolCalendar())

  useEffect(() => {
    setCalendar(getSchoolCalendar())
    const unsubscribe = subscribeToSchoolCalendar((data) => {
      setCalendar(data)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return calendar
}

