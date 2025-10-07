"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EnhancedReportCard } from "@/components/enhanced-report-card"
import type { RawReportCardData } from "@/lib/report-card-types"

interface ReportCardProps {
  data: RawReportCardData
  isOpen: boolean
  onClose: () => void
}

const mockReportCardData: RawReportCardData = {
  student: {
    id: "student_demo",
    name: "Emmanuel Divine Favour",
    admissionNumber: "000_",
    class: "J.S.S 2",
    term: "Second Term",
    session: "2025/2026",
  },
  subjects: [
    {
      name: "YORUBA",
      ca1: 9,
      ca2: 10,
      assignment: 20,
      caTotal: 39,
      exam: 55,
      total: 94,
      grade: "A",
      remarks: "Excellent",
      position: "A",
    },
    {
      name: "ENGLISH",
      ca1: 5,
      ca2: 4,
      assignment: 16.5,
      caTotal: 25.5,
      exam: 33,
      total: 58.5,
      grade: "C",
      remarks: "GOOD",
      position: "C",
    },
    {
      name: "MATHEMATICS",
      ca1: 6,
      ca2: 7,
      assignment: 10,
      caTotal: 23,
      exam: 20,
      total: 43,
      grade: "D",
      remarks: "FAIR",
      position: "D",
    },
    {
      name: "AGRIC SCIENCE",
      ca1: 5.5,
      ca2: 6.5,
      assignment: 15,
      caTotal: 27,
      exam: 39,
      total: 66,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "BASIC SCIENCE",
      ca1: 8,
      ca2: 10,
      assignment: 20,
      caTotal: 38,
      exam: 37,
      total: 75,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "BASIC TECHNOLOGY",
      ca1: 8,
      ca2: 10,
      assignment: 17,
      caTotal: 35,
      exam: 38,
      total: 73,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "BUSINESS STUDIES",
      ca1: 8,
      ca2: 10,
      assignment: 20,
      caTotal: 38,
      exam: 37,
      total: 75,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "CIVIC EDUCATION",
      ca1: 5,
      ca2: 9,
      assignment: 20,
      caTotal: 34,
      exam: 57,
      total: 91,
      grade: "A",
      remarks: "Excellent",
      position: "A",
    },
    {
      name: "CULTURAL AND CREATIVE ART",
      ca1: 6,
      ca2: 7,
      assignment: 20,
      caTotal: 33,
      exam: 37.5,
      total: 70.5,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "FRENCH LANGUAGE",
      ca1: 6,
      ca2: 10,
      assignment: 15,
      caTotal: 31,
      exam: 53,
      total: 84,
      grade: "A",
      remarks: "Excellent",
      position: "A",
    },
    {
      name: "HOME ECONOMICS",
      ca1: 6.5,
      ca2: 7,
      assignment: 18,
      caTotal: 31.5,
      exam: 40,
      total: 71.5,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "PHONICS",
      ca1: 8,
      ca2: 6,
      assignment: 18,
      caTotal: 32,
      exam: 41,
      total: 73,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "P.H.E",
      ca1: 8,
      ca2: 8,
      assignment: 20,
      caTotal: 36,
      exam: 30,
      total: 66,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "SOCIAL STUDIES",
      ca1: 8,
      ca2: 9,
      assignment: 18,
      caTotal: 35,
      exam: 35.5,
      total: 70.5,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "C.R.K",
      ca1: 5,
      ca2: 10,
      assignment: 20,
      caTotal: 35,
      exam: 51,
      total: 86,
      grade: "A",
      remarks: "Excellent",
      position: "A",
    },
    {
      name: "COMPUTER SCIENCE",
      ca1: 10,
      ca2: 10,
      assignment: 19,
      caTotal: 39,
      exam: 33,
      total: 72,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
    {
      name: "SECURITY STUDIES",
      ca1: 6,
      ca2: 7,
      assignment: 17,
      caTotal: 32,
      exam: 42,
      total: 74,
      grade: "B",
      remarks: "V. GOOD",
      position: "B",
    },
  ],
  summary: {
    totalMarksObtainable: 1700,
    totalMarksObtained: 1243,
    averageScore: 73.1,
    grade: "B",
    position: "2nd",
  },
  termInfo: {
    numberInClass: 25,
    vacationEnds: "2025-03-28",
    nextTermBegins: "2025-04-22",
  },
  remarks: {
    classTeacher: "You can always do better",
    headTeacher: "She is very dedicated to her studies.",
  },
  affectiveDomain: {
    neatness: true,
    honesty: true,
    punctuality: true,
  },
  psychomotorDomain: {
    sport: true,
    handwriting: true,
  },
  attendance: {
    present: 42,
    absent: 3,
    total: 45,
  },
  branding: {
    schoolName: "Victory Educational Academy",
    address: "No 19, Abdulazez street, zone 3 Duste, Baumpa Bwari Area council, Abuja.",
    educationZone: "",
    councilArea: "",
    contactPhone: "",
    contactEmail: "",
    logo: null,
    signature: null,
    headmasterName: "",
    defaultRemark: "She is very dedicated to her studies.",
  },
}

export function ReportCard({ data, isOpen, onClose }: ReportCardProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="flex h-screen w-screen max-w-[100vw] flex-col overflow-hidden p-0 sm:rounded-none">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-slate-800">Academic Report Card</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <EnhancedReportCard data={data} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ReportCardTrigger({ children, hasAccess }: { children: ReactNode; hasAccess: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!hasAccess) {
    return <>{children}</>
  }

  return (
    <>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>
        {children}
      </DialogTrigger>
      <ReportCard data={mockReportCardData} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
