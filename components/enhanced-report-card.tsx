"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, PrinterIcon as Print } from "lucide-react"
import { useEffect, useState } from "react"
import { safeStorage } from "@/lib/safe-storage"

interface ReportCardData {
  student: {
    id: string
    name: string
    admissionNumber: string
    class: string
    term: string
    session: string
    numberInClass?: number
    status?: string
  }
  subjects: Array<{
    name: string
    ca1: number
    ca2: number
    assignment: number
    exam: number
    total: number
    grade: string
    remarks: string
  }>
  affectiveDomain: {
    neatness: string
    honesty: string
    punctuality: string
  }
  psychomotorDomain: {
    sport: string
    handwriting: string
  }
  classTeacherRemarks: string
  totalObtainable: number
  totalObtained: number
  average: number
  position: string
  vacationDate?: string
  resumptionDate?: string
}

export function EnhancedReportCard({ data }: { data?: ReportCardData }) {
  const [schoolLogo, setSchoolLogo] = useState<string>("")
  const [headmasterSignature, setHeadmasterSignature] = useState<string>("")
  const [studentPhoto, setStudentPhoto] = useState<string>("")
  const [headmasterName, setHeadmasterName] = useState<string>("Dr. Emmanuel Adebayo")
  const [reportCardData, setReportCardData] = useState<ReportCardData | null>(data || null)

  useEffect(() => {
    const loadReportCardData = async () => {
      if (data?.student?.id) {
        try {
          const [marksRes, behavioralRes, attendanceRes, remarksRes] = await Promise.all([
            fetch(
              `/api/student-marks?studentId=${data.student.id}&term=${data.student.term}&session=${data.student.session}`,
            ),
            fetch(
              `/api/behavioral-assessments?studentId=${data.student.id}&term=${data.student.term}&session=${data.student.session}`,
            ),
            fetch(
              `/api/attendance-records?studentId=${data.student.id}&term=${data.student.term}&session=${data.student.session}`,
            ),
            fetch(
              `/api/class-teacher-remarks?studentId=${data.student.id}&term=${data.student.term}&session=${data.student.session}`,
            ),
          ])

          const marks = marksRes.ok ? await marksRes.json() : []
          const behavioral = behavioralRes.ok ? await behavioralRes.json() : []
          const attendance = attendanceRes.ok ? await attendanceRes.json() : []
          const remarks = remarksRes.ok ? await remarksRes.json() : []

          if (marks.length > 0) {
            const subjects = marks.map((mark: any) => ({
              name: mark.subject,
              ca1: mark.ca1,
              ca2: mark.ca2,
              assignment: mark.assignment,
              exam: mark.exam,
              total: mark.grandTotal,
              grade: mark.grade,
              remarks: mark.remarks,
            }))

            const totalObtained = subjects.reduce((sum: number, subject: any) => sum + subject.total, 0)
            const totalObtainable = subjects.length * 100
            const average = totalObtainable > 0 ? (totalObtained / totalObtainable) * 100 : 0

            const enhancedData: ReportCardData = {
              ...data,
              subjects,
              totalObtained,
              totalObtainable,
              average,
              affectiveDomain: behavioral[0]?.affectiveDomain || data.affectiveDomain,
              psychomotorDomain: behavioral[0]?.psychomotorDomain || data.psychomotorDomain,
              classTeacherRemarks: remarks[0]?.remarks || data.classTeacherRemarks,
              position: attendance[0]?.position
                ? `${attendance[0].position}${getOrdinalSuffix(attendance[0].position)}`
                : data.position,
            }

            setReportCardData(enhancedData)
          }
        } catch (error) {
          console.error("Error loading report card data:", error)
          setReportCardData(data)
        }
      }
    }

    loadReportCardData()

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key &&
        ["studentMarks", "behavioralAssessments", "attendancePositions", "classTeacherRemarks"].includes(e.key)
      ) {
        loadReportCardData()
      }
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [data])

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10
    const k = num % 100
    if (j === 1 && k !== 11) return "st"
    if (j === 2 && k !== 12) return "nd"
    if (j === 3 && k !== 13) return "rd"
    return "th"
  }

  useEffect(() => {
    const brandingData = safeStorage.getItem("schoolBranding")
    if (brandingData) {
      const branding = JSON.parse(brandingData)
      setSchoolLogo(branding.logoUrl || "")
      setHeadmasterSignature(branding.signatureUrl || "")
      setHeadmasterName(branding.headmasterName || "Dr. Emmanuel Adebayo")
    }

    if (reportCardData?.student?.id) {
      const studentPhotos = safeStorage.getItem("studentPhotos")
      if (studentPhotos) {
        const photos = JSON.parse(studentPhotos)
        setStudentPhoto(photos[reportCardData.student.id] || "")
      }
    }
  }, [reportCardData?.student?.id])

  if (!reportCardData || !reportCardData.student) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8">
        <Card className="border-2 border-gray-300">
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <h3 className="text-lg font-semibold mb-2">No Report Card Data Available</h3>
              <p>Please select a student to view their report card.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getRatingCheckbox = (currentRating: string, targetRating: string) => {
    return currentRating === targetRating ? "●" : "○"
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    alert("Report card downloaded as PDF")
  }

  return (
    <div className="max-w-4xl mx-auto bg-white">
      {/* Print Controls */}
      <div className="flex gap-2 mb-4 print:hidden">
        <Button onClick={handlePrint} className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
          <Print className="h-4 w-4 mr-2" />
          Print Report Card
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d] hover:text-white bg-transparent"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div className="border-8 border-[#2d682d] print:border-black bg-white print:shadow-none">
        <div className="bg-white p-6">
          <div className="flex items-start justify-between mb-6">
            {/* Left: School Logo */}
            <div className="w-20 h-20 border-2 border-[#2d682d] print:border-black flex items-center justify-center bg-white">
              {schoolLogo ? (
                <img
                  src={schoolLogo || "/placeholder.svg"}
                  alt="School Crest"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <div className="text-xs text-[#2d682d] print:text-gray-600 text-center font-bold">
                  SCHOOL
                  <br />
                  CREST
                </div>
              )}
            </div>

            {/* Center: School Information */}
            <div className="flex-1 text-center mx-8">
              <h1 className="text-3xl font-bold text-[#2d682d] print:text-black mb-2 uppercase tracking-wide font-serif">
                VICTORY EDUCATIONAL ACADEMY
              </h1>
              <p className="text-sm text-[#2d682d]/80 print:text-black mb-4 font-medium">
                No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja
              </p>
            </div>

            {/* Right: Student Photo placeholder */}
            <div className="w-20 h-24 border-2 border-[#2d682d] print:border-black flex items-center justify-center bg-white">
              {studentPhoto ? (
                <img
                  src={studentPhoto || "/placeholder.svg"}
                  alt="Student Photo"
                  className="w-full h-full object-cover p-1"
                />
              ) : (
                <div className="text-xs text-[#2d682d] print:text-gray-600 text-center font-bold">
                  STUDENT
                  <br />
                  PHOTO
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="bg-[#b29032] print:bg-gray-200 py-3 px-6 border-2 border-[#2d682d] print:border-black">
              <h2 className="text-xl font-bold text-white print:text-black uppercase tracking-wider font-serif">
                TERMINAL REPORT SHEET
              </h2>
            </div>
          </div>

          <div className="mb-6">
            <table className="w-full border-2 border-[#2d682d] print:border-black">
              <tbody>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    NAME OF STUDENT
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.name}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    TERM
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.term}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    ADMISSION NUMBER
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.admissionNumber}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    SESSION
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.session}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    CLASS
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.class}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    STATUS
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.status || "ACTIVE"}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    NUMBER IN CLASS
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-semibold">
                    {reportCardData.student.numberInClass || "N/A"}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    POSITION
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold text-[#b29032] print:text-black bg-[#b29032]/10 print:bg-gray-50">
                    {reportCardData.position}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    TOTAL MARKS OBTAINABLE
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold">
                    {reportCardData.totalObtainable}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    TOTAL MARKS OBTAINED
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold text-[#b29032] print:text-black bg-[#b29032]/10 print:bg-gray-50">
                    {reportCardData.totalObtained}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold uppercase text-sm bg-[#2d682d]/10 text-[#2d682d] print:bg-gray-100 print:text-black">
                    AVERAGE
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2 font-bold text-[#b29032] print:text-black bg-[#b29032]/10 print:bg-gray-50">
                    {reportCardData.average.toFixed(1)}%
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-2"></td>
                  <td className="border border-[#2d682d] print:border-black p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t-4 border-[#2d682d] print:border-black mb-6"></div>
        </div>

        <div className="bg-white px-6">
          <table className="w-full border-2 border-[#2d682d] print:border-black mb-6">
            <thead>
              <tr className="bg-[#2d682d] print:bg-gray-300 text-white print:text-black">
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">SUBJECT</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">1ST C.A.</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">2ND C.A.</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">NOTE/ASSIGNMENT</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">TOTAL C.A.</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">EXAM</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">TOTAL</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">GRADE</th>
                <th className="border border-[#2d682d] print:border-black p-3 font-bold text-sm">TEACHER'S REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {reportCardData.subjects.map((subject, index) => (
                <tr key={index} className="hover:bg-[#2d682d]/5 print:hover:bg-transparent">
                  <td className="border border-[#2d682d] print:border-black p-3 font-semibold text-left">
                    {subject.name}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center">{subject.ca1}</td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center">{subject.ca2}</td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center">{subject.assignment}</td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                    {subject.ca1 + subject.ca2 + subject.assignment}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center">{subject.exam}</td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                    {subject.total}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold text-lg text-[#b29032] print:text-black">
                    {subject.grade}
                  </td>
                  <td className="border border-[#2d682d] print:border-black p-3 text-right text-sm">
                    {subject.remarks}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#2d682d]/10 print:bg-gray-100">
                <td className="border border-[#2d682d] print:border-black p-3 font-bold text-center text-[#2d682d] print:text-black">
                  TOTALS
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                  {reportCardData.subjects.reduce((sum, subject) => sum + subject.ca1, 0)}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                  {reportCardData.subjects.reduce((sum, subject) => sum + subject.ca2, 0)}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                  {reportCardData.subjects.reduce((sum, subject) => sum + subject.assignment, 0)}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                  {reportCardData.subjects.reduce(
                    (sum, subject) => sum + subject.ca1 + subject.ca2 + subject.assignment,
                    0,
                  )}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">
                  {reportCardData.subjects.reduce((sum, subject) => sum + subject.exam, 0)}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold text-lg text-[#b29032] print:text-black">
                  {reportCardData.totalObtained}
                </td>
                <td className="border border-[#2d682d] print:border-black p-3 text-center font-bold">-</td>
                <td className="border border-[#2d682d] print:border-black p-3"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6">
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              {/* Class Teacher Remarks */}
              <div className="mb-6">
                <h4 className="font-bold text-[#2d682d] print:text-black mb-2 uppercase font-serif">
                  CLASS TEACHER REMARKS
                </h4>
                <div className="border-2 border-[#2d682d] print:border-black p-4 min-h-[120px] bg-white">
                  <p className="text-sm">{reportCardData.classTeacherRemarks}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="font-bold uppercase text-sm text-[#2d682d] print:text-black">VACATION DATE:</span>
                  <div className="border-b-2 border-[#2d682d] print:border-black flex-1 pb-1">
                    {reportCardData.vacationDate || ""}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold uppercase text-sm text-[#2d682d] print:text-black">RESUMPTION DATE:</span>
                  <div className="border-b-2 border-[#2d682d] print:border-black flex-1 pb-1">
                    {reportCardData.resumptionDate || ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Affective Domain Table */}
              <div>
                <h4 className="font-bold text-[#2d682d] print:text-black mb-2 uppercase text-center font-serif">
                  AFFECTIVE DOMAIN
                </h4>
                <table className="w-full border-2 border-[#2d682d] print:border-black text-xs">
                  <thead>
                    <tr className="bg-[#2d682d]/10 print:bg-gray-100">
                      <th className="border border-[#2d682d] print:border-black p-2 font-bold text-[#2d682d] print:text-black">
                        TRAITS
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        EXCELLENT
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        V.GOOD
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        GOOD
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        POOR
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        V.POOR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-[#2d682d] print:border-black p-2 font-semibold">Neatness</td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.neatness, "excel")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.neatness, "vgood")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.neatness, "good")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.neatness, "poor")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.neatness, "vpoor")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#2d682d] print:border-black p-2 font-semibold">Honesty</td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.honesty, "excel")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.honesty, "vgood")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.honesty, "good")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.honesty, "poor")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.honesty, "vpoor")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#2d682d] print:border-black p-2 font-semibold">Punctuality</td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.punctuality, "excel")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.punctuality, "vgood")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.punctuality, "good")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.punctuality, "poor")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.affectiveDomain.punctuality, "vpoor")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Psychomotor Domain Table */}
              <div>
                <h4 className="font-bold text-[#2d682d] print:text-black mb-2 uppercase text-center font-serif">
                  PSYCHOMOTOR DOMAIN
                </h4>
                <table className="w-full border-2 border-[#2d682d] print:border-black text-xs">
                  <thead>
                    <tr className="bg-[#2d682d]/10 print:bg-gray-100">
                      <th className="border border-[#2d682d] print:border-black p-2 font-bold text-[#2d682d] print:text-black">
                        SKILLS
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        EXCELLENT
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        V.GOOD
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        GOOD
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        POOR
                      </th>
                      <th className="border border-[#2d682d] print:border-black p-1 font-bold text-[#2d682d] print:text-black">
                        V.POOR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-[#2d682d] print:border-black p-2 font-semibold">Sport</td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.sport, "excel")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.sport, "vgood")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.sport, "good")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.sport, "poor")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.sport, "vpoor")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#2d682d] print:border-black p-2 font-semibold">Handwriting</td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.handwriting, "excel")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.handwriting, "vgood")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.handwriting, "good")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.handwriting, "poor")}
                      </td>
                      <td className="border border-[#2d682d] print:border-black p-1 text-center text-[#b29032] print:text-black">
                        {getRatingCheckbox(reportCardData.psychomotorDomain.handwriting, "vpoor")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-bold text-[#2d682d] print:text-black mb-3 uppercase text-center font-serif">
              GRADING SCALE
            </h4>
            <div className="border-2 border-[#2d682d] print:border-black p-4 bg-[#2d682d]/5 print:bg-gray-50">
              <div className="grid grid-cols-6 gap-2 text-xs text-center">
                <div className="font-bold text-[#2d682d] print:text-black">A: 75-100</div>
                <div className="font-bold text-[#2d682d] print:text-black">B: 60-74</div>
                <div className="font-bold text-[#2d682d] print:text-black">C: 50-59</div>
                <div className="font-bold text-[#2d682d] print:text-black">D: 40-49</div>
                <div className="font-bold text-[#2d682d] print:text-black">E: 30-39</div>
                <div className="font-bold text-[#2d682d] print:text-black">F: 0-29</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mb-6">
            <div className="text-center">
              <div className="border-b-2 border-[#2d682d] print:border-black w-48 h-16 mb-2"></div>
              <p className="text-sm font-bold text-[#2d682d] print:text-black">CLASS TEACHER</p>
            </div>
            <div className="text-center">
              {headmasterSignature ? (
                <div className="mb-2">
                  <img
                    src={headmasterSignature || "/placeholder.svg"}
                    alt="Headmaster Signature"
                    className="h-16 w-48 object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="border-b-2 border-[#2d682d] print:border-black w-48 h-16 mb-2"></div>
              )}
              <p className="text-sm font-bold text-[#2d682d] print:text-black">{headmasterName.toUpperCase()}</p>
              <p className="text-sm font-bold text-[#2d682d] print:text-black">HEADMASTER</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-[#2d682d] print:text-gray-600 font-medium">
              © Victory Educational Academy. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
