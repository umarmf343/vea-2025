"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { EnhancedReportCard } from "@/components/enhanced-report-card"
import { getStudentReportCardData } from "@/lib/report-card-data"

interface ReportCardViewerProps {
  studentId: string
  studentName: string
  userRole: string
  hasAccess: boolean
}

export function ReportCardViewer({ studentId, studentName, userRole, hasAccess }: ReportCardViewerProps) {
  const [selectedTerm, setSelectedTerm] = useState("First Term")
  const [selectedSession, setSelectedSession] = useState("2024/2025")
  const [reportCardData, setReportCardData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadReportCard = async () => {
    if (!hasAccess) {
      alert("Access denied. Please complete payment or contact admin.")
      return
    }

    setLoading(true)
    try {
      const data = getStudentReportCardData(studentId, selectedTerm, selectedSession)

      if (data) {
        setReportCardData(data)
      } else {
        alert("No report card data found for the selected term and session.")
      }
    } catch (error) {
      console.error("Error loading report card:", error)
      alert("Error loading report card. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess) {
      loadReportCard()
    }
  }, [selectedTerm, selectedSession, hasAccess])

  if (!hasAccess) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600 mb-4">Please complete school fee payment to access report cards.</p>
        <Button className="bg-[#b29032] hover:bg-[#b29032]/90">Pay School Fees</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="flex gap-4 items-end">
        <div>
          <Label>Term</Label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="First Term">First Term</SelectItem>
              <SelectItem value="Second Term">Second Term</SelectItem>
              <SelectItem value="Third Term">Third Term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Session</Label>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024/2025">2024/2025</SelectItem>
              <SelectItem value="2023/2024">2023/2024</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={loadReportCard} disabled={loading}>
          {loading ? "Loading..." : "Load Report Card"}
        </Button>
      </div>

      {/* Report Card Display */}
      {reportCardData && <EnhancedReportCard data={reportCardData} />}
    </div>
  )
}
