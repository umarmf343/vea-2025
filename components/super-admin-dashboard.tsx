"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Settings, Shield, Users, GraduationCap, FileText, Upload, Download, Edit, Printer, Plus, Trash2, TrendingUp, Calendar, DollarSign, Key, AlertTriangle, Save } from 'lucide-react'

import { EnhancedReportCard } from "./enhanced-report-card"
import { createRoot } from "react-dom/client"
import { InternalMessaging } from "@/components/internal-messaging"
import { FinancialReports } from "@/components/financial-reports"
import { AcademicAnalytics } from "@/components/academic-analytics"
import { AdminApprovalDashboard } from "@/components/admin-approval-dashboard"

import { getCompleteReportCard } from "@/lib/sample-report-data"
import { dbManager } from "@/lib/database-manager"
import { safeStorage } from "@/lib/safe-storage"

export default function SuperAdminDashboard() {
  const [activeSection, setActiveSection] = useState("overview")
  const [showBrandingDialog, setShowBrandingDialog] = useState(false)
  const [showReportCardEditor, setShowReportCardEditor] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [signaturePreview, setSignaturePreview] = useState<string>("")

  const [brandingForm, setBrandingForm] = useState({
    schoolLogo: null as File | null,
    headmasterSignature: null as File | null,
    headmasterName: "Dr. Emmanuel Adebayo",
    defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
  })

  const [reportCardData, setReportCardData] = useState({
    subjects: [],
    classTeacherRemark: "",
    headmasterRemark: brandingForm.defaultRemark,
  })

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "",
    phone: "",
    address: "",
    class: "",
    subjects: [] as string[],
    status: "active", // Added status field
    password: "", // Added password field
  })

  const systemStats = {
    totalUsers: 1247,
    totalStudents: 856,
    totalTeachers: 45,
    totalParents: 623,
    activePayments: 234,
    pendingPayments: 89,
    systemUptime: "99.9%",
    storageUsed: "2.4 GB",
    monthlyRevenue: 12500000,
    averageGrade: 78.5,
    attendanceRate: 94.2,
  }

  // <CHANGE> Replace database manager calls with mock data to prevent crashes
  const [users, setUsers] = useState([
    { id: 1, name: "John Doe", email: "john@example.com", role: "teacher", status: "active", lastLogin: "2024-03-10" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "student", status: "active", lastLogin: "2024-03-10" },
    { id: 3, name: "Admin User", email: "admin@example.com", role: "admin", status: "active", lastLogin: "2024-03-09" }
  ])

  const mockStudents = [
    {
      id: 1,
      name: "John Doe",
      class: "JSS 1A",
      admissionNo: "VEA2025001",
      totalScore: 340,
      average: 85.0,
      position: 1,
    },
    {
      id: 2,
      name: "Jane Smith",
      class: "JSS 2B",
      admissionNo: "VEA2025002",
      totalScore: 320,
      average: 80.0,
      position: 2,
    },
    {
      id: 3,
      name: "Mike Johnson",
      class: "JSS 1B",
      admissionNo: "VEA2025003",
      totalScore: 300,
      average: 75.0,
      position: 3,
    },
  ]

  const mockPayments = [
    { id: 1, studentName: "John Doe", amount: 50000, reference: "PAY001", date: "2024-03-10", status: "paid" },
    { id: 2, studentName: "Jane Smith", amount: 45000, reference: "PAY002", date: "2024-03-09", status: "paid" },
    { id: 3, studentName: "Mike Johnson", amount: 50000, reference: "PAY003", date: "2024-03-08", status: "paid" },
  ]

  const recentActivities = [
    { id: 1, action: "New student registered", user: "John Doe", time: "2 minutes ago" },
    { id: 2, action: "Payment completed", user: "Jane Smith", time: "5 minutes ago" },
    { id: 3, action: "Grade updated", user: "Mr. Johnson", time: "10 minutes ago" },
    { id: 4, action: "Report card generated", user: "System", time: "15 minutes ago" },
  ]

  const [showGrantAccessDialog, setShowGrantAccessDialog] = useState(false)
  const [selectedStudentForAccess, setSelectedStudentForAccess] = useState<any>(null)
  const [grantedAccess, setGrantedAccess] = useState<{ [key: string]: boolean }>({})

  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null)
  const [studentsInClass, setStudentsInClass] = useState<any[]>([])

  const [mockClasses, setMockClasses] = useState([
    "JSS 1A",
    "JSS 1B",
    "JSS 1C",
    "JSS 2A",
    "JSS 2B",
    "JSS 2C",
    "JSS 3A",
    "JSS 3B",
    "JSS 3C",
    "SS 1A",
    "SS 1B",
    "SS 1C",
    "SS 2A",
    "SS 2B",
    "SS 2C",
    "SS 3A",
    "SS 3B",
    "SS 3C",
  ])

  const handleClassSelection = (className: string) => {
    setSelectedClass(className)
    setSelectedStudentForReport(null)

    // Filter students by class
    const filteredStudents = mockStudents.filter((student) => student.class === className)
    setStudentsInClass(filteredStudents)
  }

  const handleGrantAccess = (student: any) => {
    setSelectedStudentForAccess(student)
    setShowGrantAccessDialog(true)
  }

  useEffect(() => {
    const savedGrantedAccess = safeStorage.getItem("grantedAccess")
    if (savedGrantedAccess) {
      setGrantedAccess(JSON.parse(savedGrantedAccess))
    }
  }, [])

  useEffect(() => {
    safeStorage.setItem("grantedAccess", JSON.stringify(grantedAccess))
  }, [grantedAccess])

  const confirmGrantAccess = () => {
    if (selectedStudentForAccess) {
      const newGrantedAccess = {
        ...grantedAccess,
        [selectedStudentForAccess.id]: true,
      }
      setGrantedAccess(newGrantedAccess)
      safeStorage.setItem("grantedAccess", JSON.stringify(newGrantedAccess))
      setShowGrantAccessDialog(false)
      setSelectedStudentForAccess(null)
    }
  }

  const handleRevokeAccess = (studentId: number) => {
    const newGrantedAccess = {
      ...grantedAccess,
      [studentId]: false,
    }
    setGrantedAccess(newGrantedAccess)
    safeStorage.setItem("grantedAccess", JSON.stringify(newGrantedAccess))
  }

  const revokeAccess = (studentId: number) => {
    setGrantedAccess((prev) => ({
      ...prev,
      [studentId]: false,
    }))
  }

  const handleFileUpload = (file: File, type: "logo" | "signature") => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (type === "logo") {
        setLogoPreview(result)
        setBrandingForm((prev) => ({ ...prev, schoolLogo: file }))
      } else {
        setSignaturePreview(result)
        setBrandingForm((prev) => ({ ...prev, headmasterSignature: file }))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleBrandingUpload = async () => {
    try {
      const brandingData = {
        ...brandingForm,
        logoUrl: logoPreview,
        signatureUrl: signaturePreview,
        updatedAt: new Date().toISOString(),
      }

      // Save to database instead of just localStorage
      await dbManager.saveBranding(brandingData)

      safeStorage.setItem("schoolBranding", JSON.stringify(brandingData))

      setShowBrandingDialog(false)

      // Trigger real-time updates for all panels
      dbManager.triggerEvent("brandingUpdated", brandingData)

      // Update report card default remark
      setReportCardData((prev) => ({
        ...prev,
        headmasterRemark: brandingForm.defaultRemark,
      }))

      alert("Branding updated successfully!")
    } catch (error) {
      console.error("Error updating branding:", error)
      alert("Failed to update branding. Please try again.")
    }
  }

  const loadStudentReportData = async (studentId: string) => {
    try {
      const completeData = getCompleteReportCard(
        Number.parseInt(studentId),
        "JSS 1A",
        "Mathematics",
        "first",
        "2024/2025",
      )

      if (completeData) {
        // Use complete teacher-entered data
        setReportCardData({
          subjects: completeData.subjects.map((subject: any) => ({
            name: subject.name,
            ca1: subject.firstCA,
            ca2: subject.secondCA,
            assignment: subject.noteAssignment,
            exam: subject.exam,
            total: subject.total,
            grade: subject.grade,
            remark: subject.teacherRemark,
          })),
          classTeacherRemark: completeData.remarks.classTeacher,
          headmasterRemark: completeData.remarks.headTeacher,
        })
        return
      }

      // Get actual marks entered by teachers
      const response = await fetch(`/api/marks?studentId=${studentId}`)
      const marksData = await response.json()

      if (marksData.success && marksData.marks) {
        const subjects = marksData.marks.map((mark: any) => ({
          name: mark.subject,
          ca1: mark.ca1 || 0,
          ca2: mark.ca2 || 0,
          assignment: mark.assignment || 0,
          exam: mark.exam || 0,
          total: (mark.ca1 || 0) + (mark.ca2 || 0) + (mark.assignment || 0) + (mark.exam || 0),
          grade: calculateGrade((mark.ca1 || 0) + (mark.ca2 || 0) + (mark.assignment || 0) + (mark.exam || 0)),
          remark: mark.teacherRemark || "Good",
        }))

        setReportCardData({
          subjects,
          classTeacherRemark: marksData.classTeacherRemark || "Excellent performance. Keep it up!",
          headmasterRemark: marksData.headmasterRemark || brandingForm.defaultRemark,
        })
      } else {
        // Fallback to default subjects if no data found
        setReportCardData({
          subjects: [
            {
              name: "Mathematics",
              ca1: 0,
              ca2: 0,
              assignment: 0,
              exam: 0,
              total: 0,
              grade: "F",
              remark: "No data entered",
            },
            {
              name: "English Language",
              ca1: 0,
              ca2: 0,
              assignment: 0,
              exam: 0,
              total: 0,
              grade: "F",
              remark: "No data entered",
            },
            {
              name: "Physics",
              ca1: 0,
              ca2: 0,
              assignment: 0,
              exam: 0,
              total: 0,
              grade: "F",
              remark: "No data entered",
            },
          ],
          classTeacherRemark: "Awaiting teacher input",
          headmasterRemark: brandingForm.defaultRemark,
        })
      }
    } catch (error) {
      console.error("Error loading student report data:", error)
    }
  }

  const calculateGrade = (total: number) => {
    if (total >= 75) return "A"
    if (total >= 60) return "B"
    if (total >= 50) return "C"
    if (total >= 40) return "D"
    if (total >= 30) return "E"
    return "F"
  }

  const handleEditReportCard = async (student: any) => {
    setSelectedStudent(student)
    await loadStudentReportData(student.id)
    setShowReportCardEditor(true)
  }

  const handleSaveReportCard = async () => {
    try {
      const reportData = {
        studentId: selectedStudent?.id,
        marks: reportCardData.subjects,
        classTeacherRemark: reportCardData.classTeacherRemark,
        headmasterRemark: reportCardData.headmasterRemark,
        updatedAt: new Date().toISOString(),
        updatedBy: "Super Admin",
      }

      // Save to database with real-time updates
      await dbManager.saveReportCard(reportData)

      // Trigger real-time updates for teacher and parent panels
      dbManager.triggerEvent("reportCardUpdated", reportData)

      setShowReportCardEditor(false)
      alert("Report card saved successfully!")
    } catch (error) {
      console.error("Error saving report card:", error)
      alert("Failed to save report card. Please try again.")
    }
  }

  const handlePrintReportCard = async (student: any) => {
    const completeData = getCompleteReportCard(student.id, "JSS 1A", "Mathematics", "first", "2024/2025")

    if (completeData) {
      // Use complete teacher-entered data for printing
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Report Card - ${completeData.student.name}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .report-card { max-width: 800px; margin: 0 auto; }
              </style>
            </head>
            <body>
              <div class="report-card">
                <div id="enhanced-report-card"></div>
              </div>
              <script>
                // Render the enhanced report card component
                const reportData = ${JSON.stringify(completeData)};
                // This would render the EnhancedReportCard component with real data
              </script>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    } else {
      // Fallback to existing print functionality
      await loadStudentReportData(student.id)

      const enhancedReportCardData = {
        student: {
          name: student.name,
          class: student.class,
          admissionNumber: student.admissionNo,
          term: "First Term",
          session: "2024/2025",
          position: student.position || "N/A",
          totalStudents: 45,
          photo: "/diverse-students.png",
        },
        subjects: reportCardData.subjects.map((subject) => ({
          name: subject.name,
          ca1: subject.ca1,
          ca2: subject.ca2,
          assignment: subject.assignment,
          caTotal: subject.ca1 + subject.ca2 + subject.assignment,
          exam: subject.exam,
          total: subject.total,
          grade: calculateGrade(subject.total),
          remark: subject.remark || "Good",
        })),
        summary: {
          totalObtainable: reportCardData.subjects.length * 100,
          totalObtained: reportCardData.subjects.reduce((sum, subject) => sum + subject.total, 0),
          average:
            reportCardData.subjects.length > 0
              ? Math.round(
                  reportCardData.subjects.reduce((sum, subject) => sum + subject.total, 0) /
                    reportCardData.subjects.length,
                )
              : 0,
        },
        affectiveDomain: {
          neatness: "V.Good",
          honesty: "Excel.",
          punctuality: "Good",
        },
        psychomotorDomain: {
          sport: "Good",
          handwriting: "V.Good",
        },
        remarks: {
          classTeacher: reportCardData.classTeacherRemark || "Excellent performance. Keep it up!",
          headmaster: reportCardData.headmasterRemark || brandingForm.defaultRemark,
        },
        branding: {
          logo: logoPreview,
          signature: signaturePreview,
          headmasterName: brandingForm.headmasterName || "Dr. Victory Adebayo",
        },
      }

      const printContainer = document.createElement("div")
      printContainer.style.position = "absolute"
      printContainer.style.left = "-9999px"
      document.body.appendChild(printContainer)

      const root = createRoot(printContainer)
      root.render(<EnhancedReportCard {...enhancedReportCardData} />)

      setTimeout(() => {
        const reportCardHTML = printContainer.innerHTML

        const enhancedReportCardHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Victory Educational Academy - Report Card - ${student.name}</title>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: 'Arial', sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: white;
                line-height: 1.4;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none !important; }
                @page { margin: 0.5in; }
              }
              .text-green-800 { color: #166534; }
              .text-yellow-800 { color: #92400e; }
              .bg-yellow-100 { background-color: #fef3c7; }
              .bg-yellow-400 { background-color: #fbbf24; }
              .border { border: 1px solid #d1d5db; }
              .border-2 { border-width: 2px; }
              .border-black { border-color: #000000; }
              .p-2 { padding: 0.5rem; }
              .p-4 { padding: 1rem; }
              .text-center { text-align: center; }
              .text-left { text-align: left; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .text-lg { font-size: 1.125rem; }
              .text-xl { font-size: 1.25rem; }
              .text-2xl { font-size: 1.5rem; }
              .text-sm { font-size: 0.875rem; }
              .text-xs { font-size: 0.75rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .mb-4 { margin-bottom: 1rem; }
              .mt-4 { margin-top: 1rem; }
              .grid { display: grid; }
              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .gap-2 { gap: 0.5rem; }
              .gap-4 { gap: 1rem; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .w-full { width: 100%; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 12px; }
              th { background-color: #2d682d; color: white; font-weight: bold; }
              .grade-A { background-color: #dcfce7; color: #166534; }
              .grade-B { background-color: #dbeafe; color: #1d4ed8; }
              .grade-C { background-color: #fef3c7; color: #92400e; }
              .grade-D { background-color: #fed7aa; color: #ea580c; }
              .grade-F { background-color: #fecaca; color: #dc2626; }
            </style>
          </head>
          <body>
            ${reportCardHTML}
          </body>
          </html>
        `

        document.body.removeChild(printContainer)

        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write(enhancedReportCardHTML)
          printWindow.document.close()
          printWindow.print()
        }
      }, 100)
    }
  }

  const handlePrintReceipt = (payment: any) => {
    const receiptContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${logoPreview ? `<img src="${logoPreview}" style="height: 60px; margin-bottom: 10px;">` : ""}
          <h2 style="color: #2d682d; margin: 0;">VICTORY EDUCATIONAL ACADEMY</h2>
          <p style="margin: 5px 0;">PAYMENT RECEIPT</p>
        </div>
        
        <div style="border-top: 2px solid #2d682d; border-bottom: 2px solid #2d682d; padding: 15px; margin: 20px 0;">
          <p><strong>Receipt No:</strong> ${payment.reference}</p>
          <p><strong>Student:</strong> ${payment.studentName}</p>
          <p><strong>Amount:</strong> ₦${payment.amount.toLocaleString()}</p>
          <p><strong>Date:</strong> ${payment.date}</p>
          <p><strong>Status:</strong> ${payment.status.toUpperCase()}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 12px;">Thank you for your payment</p>
          <p style="font-size: 10px;">This is a computer-generated receipt</p>
        </div>
      </div>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(receiptContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleDownloadReceipt = (payment: any) => {
    // Create downloadable receipt content
    const receiptData = {
      receiptNo: payment.reference,
      studentName: payment.studentName,
      amount: payment.amount,
      date: payment.date,
      status: payment.status,
    }

    const dataStr = JSON.stringify(receiptData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `receipt_${payment.reference}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCreateUser = () => {
    setSelectedUser(null)
    setUserForm({
      name: "",
      email: "",
      role: "",
      phone: "",
      address: "",
      class: "",
      subjects: [],
      status: "active", // Reset status
      password: "", // Reset password
    })
    setShowUserDialog(true)
  }

  const handleEditUser = (user: any) => {
    setSelectedUser(user)
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      address: user.address || "",
      class: user.class || "",
      subjects: user.subjects || [],
      status: user.status || "active", // Set status
      password: "", // Clear password on edit
    })
    setShowUserDialog(true)
  }

  // <CHANGE> Replace database operations with local state management
  const handleSaveUser = async () => {
    try {
      const userData = {
        id: selectedUser?.id || Date.now(),
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        status: userForm.status || "active",
        // Add other fields if necessary, e.g., phone, address, class, subjects
        phone: userForm.phone,
        address: userForm.address,
        class: userForm.class,
        subjects: userForm.subjects,
        lastLogin: selectedUser?.lastLogin || new Date().toISOString(), // Preserve lastLogin if editing
      }

      if (selectedUser) {
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? userData : u))
      } else {
        setUsers(prev => [...prev, userData])
      }

      setShowUserDialog(false)
      setUserForm({ name: "", email: "", role: "", status: "active", password: "", phone: "", address: "", class: "", subjects: [] }) // Reset form including new fields
      setSelectedUser(null)
      alert(`User ${selectedUser ? "updated" : "created"} successfully!`)
    } catch (error) {
      console.error("Error saving user:", error)
      alert("Failed to save user. Please try again.")
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        setUsers(prev => prev.filter(u => u.id !== userId))
        alert("User deleted successfully!")
      } catch (error) {
        console.error("Error deleting user:", error)
        alert("Failed to delete user. Please try again.")
      }
    }
  }

  const [classes, setClasses] = useState<string[]>([])
  const [systemSettings, setSystemSettings] = useState({
    academicYear: "2024/2025",
    currentTerm: "First Term",
    reportCardDeadline: "",
    schoolName: "Victory Educational Academy",
    schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
  })

  // <CHANGE> Simplify useEffect to prevent database connection errors
  useEffect(() => {
    // Initialize with mock data - no database calls
    console.log("Super Admin Dashboard initialized with mock data")

    // Load branding from safeStorage if available
    const savedBranding = safeStorage.getItem("schoolBranding")
    if (savedBranding) {
      const brandingData = JSON.parse(savedBranding)
      setBrandingForm(brandingData)
      if (brandingData.logoUrl) setLogoPreview(brandingData.logoUrl)
      if (brandingData.signatureUrl) setSignaturePreview(brandingData.signatureUrl)
    }

    // Load system settings from localStorage if available
    const savedSettings = localStorage.getItem('systemSettings')
    if (savedSettings) {
      setSystemSettings(JSON.parse(savedSettings))
    }

    // Load classes from mockClasses for now
    setClasses(mockClasses)

  }, [])

  const handleSaveSystemSettings = async () => {
    try {
      // Save to localStorage instead of database
      localStorage.setItem('systemSettings', JSON.stringify(systemSettings))
      alert("System settings saved successfully!")
    } catch (error) {
      console.error("Error saving system settings:", error)
      alert("Failed to save system settings. Please try again.")
    }
  }

  const handleAddClass = async (className: string) => {
    if (className && !classes.includes(className)) {
      setClasses((prev) => [...prev, className])
      // In a real app, you'd call dbManager.addClass(className) here
      alert(`Class "${className}" added successfully!`)
    } else if (classes.includes(className)) {
      alert(`Class "${className}" already exists.`)
    }
  }

  const handleDeleteClass = async (className: string) => {
    if (confirm(`Are you sure you want to delete the class "${className}"?`)) {
      setClasses((prev) => prev.filter((c) => c !== className))
      // In a real app, you'd call dbManager.deleteClass(className) here
      alert(`Class "${className}" deleted successfully!`)
    }
  }

  const [newClassName, setNewClassName] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#2d682d]">Super Admin Dashboard</h1>
          <p className="text-gray-600">Complete system oversight and management</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            System Settings
          </Button>
          <Button className="bg-[#b29032] hover:bg-[#9a7c2a] text-white">
            <Shield className="w-4 h-4 mr-2" />
            Security Panel
          </Button>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="reportcards">Report Cards</TabsTrigger>
          <TabsTrigger value="approval">Report Approval</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-[#2d682d]">{systemStats.totalUsers}</p>
                  </div>
                  <Users className="w-8 h-8 text-[#b29032]" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-[#2d682d]">
                      ₦{(systemStats.monthlyRevenue / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-[#b29032]" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Average Grade</p>
                    <p className="text-2xl font-bold text-green-600">{systemStats.averageGrade}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Attendance Rate</p>
                    <p className="text-2xl font-bold text-[#2d682d]">{systemStats.attendanceRate}%</p>
                  </div>
                  <Calendar className="w-8 h-8 text-[#b29032]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ... existing recent activities and payment overview ... */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Recent System Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.user}</p>
                      </div>
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Payment Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Active Payments</span>
                    <span className="font-bold text-green-600">{systemStats.activePayments}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pending Payments</span>
                    <span className="font-bold text-yellow-600">{systemStats.pendingPayments}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#b29032] h-2 rounded-full"
                      style={{
                        width: `${(systemStats.activePayments / (systemStats.activePayments + systemStats.pendingPayments)) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {Math.round(
                      (systemStats.activePayments / (systemStats.activePayments + systemStats.pendingPayments)) * 100,
                    )}
                    % completion rate
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-[#2d682d]">School Branding Management</CardTitle>
                  <p className="text-gray-600">
                    Upload school logo, headmaster signature, and set default remarks for report cards
                  </p>
                </div>
                <Button onClick={() => setShowBrandingDialog(true)} className="bg-[#b29032] hover:bg-[#9a7c2a]">
                  <Upload className="w-4 h-4 mr-2" />
                  Update Branding
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  {logoPreview ? (
                    <img
                      src={logoPreview || "/placeholder.svg"}
                      alt="School Logo"
                      className="w-20 h-20 mx-auto mb-4 object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#2d682d] rounded-full mx-auto mb-4 flex items-center justify-center">
                      <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                  )}
                  <h3 className="font-medium">School Logo</h3>
                  <p className="text-sm text-gray-600">Current logo displayed on all report cards and website</p>
                </div>
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  {signaturePreview ? (
                    <img
                      src={signaturePreview || "/placeholder.svg"}
                      alt="Headmaster Signature"
                      className="w-20 h-20 mx-auto mb-4 object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#b29032] rounded mx-auto mb-4 flex items-center justify-center">
                      <Edit className="w-10 h-10 text-white" />
                    </div>
                  )}
                  <h3 className="font-medium">Headmaster Signature</h3>
                  <p className="text-sm text-gray-600">Digital signature for report cards</p>
                </div>
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="w-20 h-20 bg-gray-500 rounded mx-auto mb-4 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-medium">Default Remark</h3>
                  <p className="text-sm text-gray-600">Standard headmaster remark for all report cards</p>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    "{brandingForm.defaultRemark.substring(0, 50)}..."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <InternalMessaging currentUser={{ id: "super-admin", name: "Super Admin", role: "super_admin" }} />
        </TabsContent>

        <TabsContent value="reportcards" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Student Report Cards Management</CardTitle>
              <p className="text-gray-600">View, edit, and print all student report cards</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="class-select">Select Class</Label>
                    {/* Replace mockClasses with real classes data */}
                    <Select value={selectedClass} onValueChange={handleClassSelection}>
                      <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedClass && studentsInClass.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="student-select">Select Student</Label>
                      <Select
                        value={selectedStudentForReport?.id?.toString() || ""}
                        onValueChange={(value) => {
                          const student = studentsInClass.find((s) => s.id.toString() === value)
                          setSelectedStudentForReport(student)
                        }}
                      >
                        <SelectTrigger className="border-[#2d682d]/20 focus:border-[#b29032]">
                          <SelectValue placeholder="Choose a student" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentsInClass.map((student) => (
                            <SelectItem key={student.id} value={student.id.toString()}>
                              {student.name} - {student.admissionNo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {selectedStudentForReport && (
                  <Card className="border-[#b29032]/20">
                    <CardHeader>
                      <CardTitle className="text-[#b29032]">Report Card for {selectedStudentForReport.name}</CardTitle>
                      <CardDescription>
                        Class: {selectedStudentForReport.class} | Admission No: {selectedStudentForReport.admissionNo}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium">{selectedStudentForReport.name}</h3>
                          <p className="text-sm text-gray-600">
                            {selectedStudentForReport.class} - {selectedStudentForReport.admissionNo}
                          </p>
                          <p className="text-xs text-gray-500">
                            Average: {selectedStudentForReport.average}% | Position: {selectedStudentForReport.position}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditReportCard(selectedStudentForReport)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit Report Card
                          </Button>
                          <Button
                            size="sm"
                            className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                            onClick={() => handlePrintReportCard(selectedStudentForReport)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            Print
                          </Button>
                          <Button
                            size="sm"
                            variant={grantedAccess[selectedStudentForReport.id] ? "destructive" : "secondary"}
                            onClick={() =>
                              grantedAccess[selectedStudentForReport.id]
                                ? revokeAccess(selectedStudentForReport.id)
                                : handleGrantAccess(selectedStudentForReport)
                            }
                          >
                            <Key className="w-4 h-4 mr-1" />
                            {grantedAccess[selectedStudentForReport.id] ? "Revoke Access" : "Grant Access"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedClass && studentsInClass.length === 0 && (
                  <Card className="border-gray-200">
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-500">No students found in {selectedClass}</p>
                    </CardContent>
                  </Card>
                )}

                {!selectedClass && (
                  <Card className="border-gray-200">
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-500">Please select a class to view students and manage report cards</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="space-y-6">
          <AdminApprovalDashboard />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Receipt Management</CardTitle>
              <p className="text-gray-600">Print and download payment receipts</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{payment.studentName}</h3>
                      <p className="text-sm text-gray-600">
                        ₦{payment.amount.toLocaleString()} - {payment.reference}
                      </p>
                      <p className="text-xs text-gray-500">Date: {payment.date}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(payment)}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                        onClick={() => handlePrintReceipt(payment)}
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-[#2d682d]">Advanced User Management</CardTitle>
                  <p className="text-gray-600">Create, edit, and manage all system users</p>
                </div>
                <Button onClick={handleCreateUser} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell>{user.lastLogin}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">System Health Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">Healthy</div>
                  <div className="text-sm text-gray-600">Database Status</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">Online</div>
                  <div className="text-sm text-gray-600">Payment Gateway</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">Active</div>
                  <div className="text-sm text-gray-600">Email Service</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Server Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>CPU Usage</span>
                      <span>45%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: "45%" }}></div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Memory Usage</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>RAM Usage</span>
                      <span>62%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: "62%" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <FinancialReports />
          <AcademicAnalytics />
        </TabsContent>
      </Tabs>

      {/* Add System Settings tab with comprehensive configuration */}
      {activeSection === "system" && (
        <div className="space-y-6">
          <Card className="border-[#2d682d]/20">
            <CardHeader>
              <CardTitle className="text-[#2d682d]">System Configuration</CardTitle>
              <CardDescription>Manage system-wide settings and configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    value={systemSettings.academicYear}
                    onChange={(e) => setSystemSettings((prev) => ({ ...prev, academicYear: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="currentTerm">Current Term</Label>
                  <Select
                    value={systemSettings.currentTerm}
                    onValueChange={(value) => setSystemSettings((prev) => ({ ...prev, currentTerm: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Term">First Term</SelectItem>
                      <SelectItem value="Second Term">Second Term</SelectItem>
                      <SelectItem value="Third Term">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reportDeadline">Report Card Submission Deadline</Label>
                  <Input
                    id="reportDeadline"
                    type="datetime-local"
                    value={systemSettings.reportCardDeadline}
                    onChange={(e) => setSystemSettings((prev) => ({ ...prev, reportCardDeadline: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="schoolName">School Name</Label>
                  <Input
                    id="schoolName"
                    value={systemSettings.schoolName}
                    onChange={(e) => setSystemSettings((prev) => ({ ...prev, schoolName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="schoolAddress">School Address</Label>
                <Textarea
                  id="schoolAddress"
                  value={systemSettings.schoolAddress}
                  onChange={(e) => setSystemSettings((prev) => ({ ...prev, schoolAddress: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button onClick={handleSaveSystemSettings} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                <Save className="w-4 h-4 mr-2" />
                Save System Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#2d682d]/20">
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Class Management</CardTitle>
              <CardDescription>Add, edit, or remove classes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter new class name (e.g., JSS 1C)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
                <Button onClick={() => handleAddClass(newClassName)} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Class
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {classes.map((className) => (
                  <div key={className} className="flex items-center justify-between p-2 border rounded">
                    <span>{className}</span>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteClass(className)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showBrandingDialog} onOpenChange={setShowBrandingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update School Branding</DialogTitle>
            <DialogDescription>Upload school logo, headmaster signature, and set default remarks</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="logo">School Logo</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, "logo")
                }}
              />
              {logoPreview && (
                <img
                  src={logoPreview || "/placeholder.svg"}
                  alt="Logo Preview"
                  className="mt-2 h-16 w-16 object-contain border rounded"
                />
              )}
            </div>
            <div>
              <Label htmlFor="signature">Headmaster Signature</Label>
              <Input
                id="signature"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, "signature")
                }}
              />
              {signaturePreview && (
                <img
                  src={signaturePreview || "/placeholder.svg"}
                  alt="Signature Preview"
                  className="mt-2 h-16 w-32 object-contain border rounded"
                />
              )}
            </div>
            <div>
              <Label htmlFor="headmaster">Headmaster Name</Label>
              <Input
                id="headmaster"
                value={brandingForm.headmasterName}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, headmasterName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="remark">Default Headmaster Remark</Label>
              <Textarea
                id="remark"
                value={brandingForm.defaultRemark}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, defaultRemark: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBrandingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBrandingUpload} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Update Branding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportCardEditor} onOpenChange={setShowReportCardEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Report Card - {selectedStudent?.name}</DialogTitle>
            <DialogDescription>Edit student grades and remarks</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Student Name</Label>
                <Input value={selectedStudent?.name || ""} disabled />
              </div>
              <div>
                <Label>Class</Label>
                <Input value={selectedStudent?.class || ""} disabled />
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Subject Grades</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>1st C.A.</TableHead>
                    <TableHead>2nd C.A.</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportCardData.subjects.map((subject, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={subject.ca1}
                          onChange={(e) => {
                            const newSubjects = [...reportCardData.subjects]
                            newSubjects[index].ca1 = Number.parseInt(e.target.value) || 0
                            newSubjects[index].total =
                              newSubjects[index].ca1 +
                              newSubjects[index].ca2 +
                              newSubjects[index].assignment +
                              newSubjects[index].exam
                            setReportCardData((prev) => ({ ...prev, subjects: newSubjects }))
                          }}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={subject.ca2}
                          onChange={(e) => {
                            const newSubjects = [...reportCardData.subjects]
                            newSubjects[index].ca2 = Number.parseInt(e.target.value) || 0
                            newSubjects[index].total =
                              newSubjects[index].ca1 +
                              newSubjects[index].ca2 +
                              newSubjects[index].assignment +
                              newSubjects[index].exam
                            setReportCardData((prev) => ({ ...prev, subjects: newSubjects }))
                          }}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={subject.assignment}
                          onChange={(e) => {
                            const newSubjects = [...reportCardData.subjects]
                            newSubjects[index].assignment = Number.parseInt(e.target.value) || 0
                            newSubjects[index].total =
                              newSubjects[index].ca1 +
                              newSubjects[index].ca2 +
                              newSubjects[index].assignment +
                              newSubjects[index].exam
                            setReportCardData((prev) => ({ ...prev, subjects: newSubjects }))
                          }}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={subject.exam}
                          onChange={(e) => {
                            const newSubjects = [...reportCardData.subjects]
                            newSubjects[index].exam = Number.parseInt(e.target.value) || 0
                            newSubjects[index].total =
                              newSubjects[index].ca1 +
                              newSubjects[index].ca2 +
                              newSubjects[index].assignment +
                              newSubjects[index].exam
                            setReportCardData((prev) => ({ ...prev, subjects: newSubjects }))
                          }}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{subject.total}</TableCell>
                      <TableCell className="font-medium">
                        {subject.total >= 75
                          ? "A"
                          : subject.total >= 60
                            ? "B"
                            : subject.total >= 50
                              ? "C"
                              : subject.total >= 40
                                ? "D"
                                : "F"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="classTeacherRemark">Class Teacher's Remark</Label>
                <Textarea
                  id="classTeacherRemark"
                  value={reportCardData.classTeacherRemark}
                  onChange={(e) => setReportCardData((prev) => ({ ...prev, classTeacherRemark: e.target.value }))}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="headmasterRemark">Headmaster's Remark</Label>
                <Textarea
                  id="headmasterRemark"
                  value={reportCardData.headmasterRemark}
                  onChange={(e) => setReportCardData((prev) => ({ ...prev, headmasterRemark: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportCardEditor(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReportCard} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Edit User" : "Create New User"}</DialogTitle>
            <DialogDescription>
              {selectedUser ? "Update user information and settings" : "Add a new user to the system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="userName">Full Name</Label>
              <Input
                id="userName"
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="userEmail">Email Address</Label>
              <Input
                id="userEmail"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="userRole">Role</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Student">Student</SelectItem>
                  <SelectItem value="Teacher">Teacher</SelectItem>
                  <SelectItem value="Parent">Parent</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Librarian">Librarian</SelectItem>
                  <SelectItem value="Accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="userPhone">Phone Number</Label>
              <Input
                id="userPhone"
                value={userForm.phone}
                onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="userAddress">Address</Label>
              <Textarea
                id="userAddress"
                value={userForm.address}
                onChange={(e) => setUserForm((prev) => ({ ...prev, address: e.target.value }))}
                rows={2}
              />
            </div>
            {/* Conditionally render class selection based on role */}
            {(userForm.role === "Student" || userForm.role === "Parent") && (
              <div>
                <Label htmlFor="userClass">Class</Label>
                <Select value={userForm.class} onValueChange={(value) => setUserForm((prev) => ({ ...prev, class: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Add password field for new user creation */}
            {!selectedUser && (
              <div>
                <Label htmlFor="userPassword">Password</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              {selectedUser ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGrantAccessDialog} onOpenChange={setShowGrantAccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2d682d]">Grant Report Card Access</DialogTitle>
            <DialogDescription>
              Grant access to report card download and print for {selectedStudentForAccess?.name}? This will allow the
              parent to access the report card even without payment.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Override Payment Requirement</p>
                <p className="text-xs text-yellow-700 mt-1">
                  This will bypass the payment verification for this student's report card access.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowGrantAccessDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmGrantAccess} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Grant Access
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
