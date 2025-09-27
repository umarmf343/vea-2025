"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Shield } from "lucide-react"

import {
  REPORT_CARD_ACCESS_EVENT,
  grantReportCardAccess,
  normalizeTermLabel,
  revokeReportCardAccess,
  syncReportCardAccess,
  type ReportCardAccessRecord,
} from "@/lib/report-card-access"
import { useToast } from "@/hooks/use-toast"

interface ParentRecord {
  id: string
  name: string
  email: string
  studentIds: string[]
}

interface StudentRecord {
  id: string
  name: string
  className?: string | null
}

interface ParentAccessManagerProps {
  title?: string
  description?: string
}

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export function ParentAccessManager({
  title = "Manual Report Card Access",
  description = "Grant or revoke report card access for parents who completed offline payments.",
}: ParentAccessManagerProps) {
  const { toast } = useToast()
  const [parents, setParents] = useState<ParentRecord[]>([])
  const [students, setStudents] = useState<Map<string, StudentRecord>>(new Map())
  const [accessRecords, setAccessRecords] = useState<ReportCardAccessRecord[]>([])
  const [term, setTerm] = useState("First Term")
  const [session, setSession] = useState("2024/2025")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [parentsPayload, studentsPayload, settingsPayload] = await Promise.all([
        fetchJson<{ users?: Array<Record<string, any>> }>("/api/users?role=parent"),
        fetchJson<{ users?: Array<Record<string, any>> }>("/api/users?role=student"),
        fetchJson<{ settings?: { currentTerm?: string; academicYear?: string } }>("/api/system/settings"),
      ])

      const parentRecords: ParentRecord[] = Array.isArray(parentsPayload.users)
        ? parentsPayload.users.map((user) => ({
            id: String(user.id ?? ""),
            name: typeof user.name === "string" && user.name.trim().length ? user.name : String(user.email ?? "Parent"),
            email: typeof user.email === "string" ? user.email : "—",
            studentIds: Array.isArray(user.studentIds)
              ? user.studentIds.map((studentId: unknown) => String(studentId))
              : [],
          }))
        : []

      const studentMap = new Map<string, StudentRecord>()
      if (Array.isArray(studentsPayload.users)) {
        studentsPayload.users.forEach((user) => {
          const metadata = (user.metadata ?? {}) as Record<string, unknown>
          studentMap.set(String(user.id ?? ""), {
            id: String(user.id ?? ""),
            name: typeof user.name === "string" && user.name.trim().length ? user.name : String(user.email ?? "Student"),
            className:
              typeof metadata.assignedClassName === "string"
                ? metadata.assignedClassName
                : typeof user.className === "string"
                  ? user.className
                  : null,
          })
        })
      }

      const normalizedTerm = normalizeTermLabel(settingsPayload.settings?.currentTerm ?? "First Term")
      const academicSession = settingsPayload.settings?.academicYear ?? "2024/2025"

      setParents(parentRecords)
      setStudents(studentMap)
      setTerm(normalizedTerm)
      setSession(academicSession)
      setAccessRecords(syncReportCardAccess(normalizedTerm, academicSession))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load parent access records")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ records?: ReportCardAccessRecord[] }>).detail
      if (Array.isArray(detail?.records)) {
        setAccessRecords(detail.records)
      }
    }

    window.addEventListener(REPORT_CARD_ACCESS_EVENT, handleUpdate as EventListener)
    return () => {
      window.removeEventListener(REPORT_CARD_ACCESS_EVENT, handleUpdate as EventListener)
    }
  }, [])

  const rows = useMemo(() => {
    return parents
      .map((parent) => {
        if (!parent.studentIds.length) {
          return [
            {
              key: `${parent.id}::none`,
              parent,
              student: null,
              hasAccess: false,
              grantedBy: null as ReportCardAccessRecord["grantedBy"] | null,
              disabled: true,
            },
          ]
        }

        return parent.studentIds.map((studentId) => {
          const student = students.get(studentId) ?? null
          const record = accessRecords.find(
            (entry) =>
              entry.parentId === parent.id &&
              entry.studentId === studentId &&
              entry.term === term &&
              entry.session === session,
          )

          return {
            key: `${parent.id}::${studentId}`,
            parent,
            student,
            hasAccess: Boolean(record),
            grantedBy: record?.grantedBy ?? null,
            disabled: false,
          }
        })
      })
      .flat()
      .sort((a, b) => a.parent.name.localeCompare(b.parent.name))
  }, [accessRecords, parents, session, students, term])

  const handleToggle = useCallback(
    (parentId: string, studentId: string | null, enable: boolean) => {
      if (!studentId) {
        toast({
          variant: "destructive",
          title: "Link a student",
          description: "Assign a student to this parent before managing access.",
        })
        return
      }

      try {
        const updated = enable
          ? grantReportCardAccess({
              parentId,
              studentId,
              term,
              session,
              grantedBy: "manual",
            })
          : revokeReportCardAccess({ parentId, studentId, term, session })
        setAccessRecords(updated)
        toast({
          title: enable ? "Access granted" : "Access revoked",
          description: enable
            ? "Parent can now view report cards for this term."
            : "Parent access has been revoked for this term.",
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Unable to update access",
          description: error instanceof Error ? error.message : "Please try again.",
        })
      }
    },
    [session, term, toast],
  )

  if (isLoading) {
    return (
      <Card className="border-dashed border-[#2d682d]/40">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-[#2d682d]">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading manual access records…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-red-700">{error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[#2d682d]/20">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-[#2d682d]">
            <Shield className="h-5 w-5" /> {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="text-xs text-gray-500">
          Current period: {term} • {session}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            No parent records available. Add parents to manage manual access.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Manual Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="font-medium text-[#2d682d]">{row.parent.name}</div>
                      <div className="text-xs text-gray-500">{row.parent.email}</div>
                    </TableCell>
                    <TableCell>
                      {row.student ? (
                        <div>
                          <div className="font-medium">{row.student.name}</div>
                          <div className="text-xs text-gray-500">{row.student.className ?? "Class not set"}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-red-600">No linked student</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.grantedBy ? (
                        <Badge variant="outline" className="capitalize">
                          {row.grantedBy === "manual" ? "Manual" : "Payment"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Not granted</Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex justify-end">
                      <Switch
                        checked={row.hasAccess}
                        disabled={row.disabled}
                        onCheckedChange={(checked) => handleToggle(row.parent.id, row.student?.id ?? null, checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

