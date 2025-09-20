import { safeStorage } from "@/lib/safe-storage"
import { getBrandingFromStorage } from "./branding"

const fallbackBrandingInfo = getBrandingFromStorage()

export const completeReportCardData = {
  // Complete report card data for John Doe - JSS 1A Mathematics
  "JSS 1A-Mathematics-first-2024/2025": {
    student: {
      id: 1,
      name: "John Doe",
      admissionNumber: "VEA/2024/001",
      class: "JSS 1A",
      term: "First Term",
      session: "2024/2025",
      dateOfBirth: "2010-05-15",
      gender: "Male",
      photo: "/diverse-students.png",
    },
    subjects: [
      {
        name: "Mathematics",
        firstCA: 18,
        secondCA: 16,
        noteAssignment: 9,
        caTotal: 43,
        exam: 52,
        total: 95,
        grade: "A",
        teacherRemark: "Excellent performance in all areas. Shows strong analytical skills and consistent improvement.",
      },
      {
        name: "English Language",
        firstCA: 16,
        secondCA: 14,
        noteAssignment: 8,
        caTotal: 38,
        exam: 48,
        total: 86,
        grade: "A",
        teacherRemark: "Very good grasp of language concepts. Excellent written and oral communication skills.",
      },
      {
        name: "Basic Science",
        firstCA: 15,
        secondCA: 13,
        noteAssignment: 7,
        caTotal: 35,
        exam: 45,
        total: 80,
        grade: "B",
        teacherRemark: "Good understanding of scientific principles. Participates actively in practical sessions.",
      },
      {
        name: "Social Studies",
        firstCA: 17,
        secondCA: 15,
        noteAssignment: 8,
        caTotal: 40,
        exam: 47,
        total: 87,
        grade: "A",
        teacherRemark: "Shows excellent knowledge of social concepts and current affairs.",
      },
      {
        name: "French",
        firstCA: 14,
        secondCA: 12,
        noteAssignment: 6,
        caTotal: 32,
        exam: 40,
        total: 72,
        grade: "B",
        teacherRemark: "Good progress in language acquisition. Needs more practice in pronunciation.",
      },
    ],
    summary: {
      totalMarksObtainable: 500,
      totalMarksObtained: 420,
      averageScore: 84,
      position: 1,
      positionSuffix: "st",
      numberOfStudents: 25,
      classAverage: 72.5,
      grade: "A",
    },
    affectiveDomain: {
      neatness: "Excellent",
      honesty: "Very Good",
      punctuality: "Excellent",
      leadership: "Very Good",
      relationship: "Excellent",
    },
    psychomotorDomain: {
      sport: "Very Good",
      handwriting: "Excellent",
      drawing: "Good",
      craft: "Very Good",
    },
    attendance: {
      present: 58,
      absent: 2,
      total: 60,
      percentage: 97,
    },
    remarks: {
      classTeacher:
        "John is an exceptional student who demonstrates outstanding academic performance and excellent character. He is a natural leader and shows great potential. Keep up the excellent work!",
      headTeacher: "A brilliant student with exemplary conduct. Recommended for academic excellence award.",
    },
    nextTermBegins: "2025-01-15",
    vacationEnds: "2025-01-14",
    branding: {
      schoolName: fallbackBrandingInfo.schoolName,
      address: fallbackBrandingInfo.schoolAddress,
      logo: fallbackBrandingInfo.logoUrl ?? "/generic-school-logo.png",
      headmasterSignature: fallbackBrandingInfo.signatureUrl ?? "",
      headmasterName: fallbackBrandingInfo.headmasterName,
    },
  },
}

// Function to get complete report card data
export const getCompleteReportCard = (
  studentId: number,
  className: string,
  subject: string,
  term: string,
  session: string,
) => {
  const key = `${className}-${subject}-${term}-${session}`
  return completeReportCardData[key] || null
}

// Function to save complete report card data
export const saveCompleteReportCard = (key: string, data: any) => {
  completeReportCardData[key] = data
  safeStorage.setItem("completeReportCardData", JSON.stringify(completeReportCardData))
}

// Load saved data on initialization
if (typeof window !== "undefined") {
  const savedData = safeStorage.getItem("completeReportCardData")
  if (savedData) {
    Object.assign(completeReportCardData, JSON.parse(savedData))
  }
}
