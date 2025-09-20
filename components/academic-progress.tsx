"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BookOpen, TrendingUp } from "lucide-react"

interface Subject {
  name: string
  score: number
  grade: string
  position: number
  totalStudents: number
}

interface AcademicProgressProps {
  subjects: Subject[]
  overallAverage: number
  overallGrade: string
  classPosition: number
  totalStudents: number
  hasAccess: boolean
}

export function AcademicProgress({
  subjects,
  overallAverage,
  overallGrade,
  classPosition,
  totalStudents,
  hasAccess,
}: AcademicProgressProps) {
  if (!hasAccess) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <BookOpen className="h-5 w-5" />
            Academic Progress
          </CardTitle>
          <CardDescription className="text-red-600">Payment required to view academic progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Access Restricted</p>
            <p className="text-red-500 text-sm">Please complete payment to view grades and progress</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[#2d682d]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2d682d]">
          <BookOpen className="h-5 w-5" />
          Academic Progress
        </CardTitle>
        <CardDescription>Current term performance and grades</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Performance */}
        <div className="bg-[#2d682d]/5 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-[#2d682d]">Overall Performance</h4>
            <Badge className="bg-[#b29032] hover:bg-[#8a6b25]">{overallGrade}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Average Score</p>
              <p className="text-2xl font-bold text-[#2d682d]">{overallAverage}%</p>
            </div>
            <div>
              <p className="text-gray-600">Class Position</p>
              <p className="text-2xl font-bold text-[#b29032]">
                {classPosition}/{totalStudents}
              </p>
            </div>
          </div>
          <Progress value={overallAverage} className="mt-3" />
        </div>

        {/* Subject Performance */}
        <div className="space-y-3">
          <h4 className="font-semibold text-[#2d682d] flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Subject Performance
          </h4>
          {subjects.map((subject, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{subject.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{subject.grade}</Badge>
                  <span className="text-sm text-gray-600">
                    {subject.position}/{subject.totalStudents}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={subject.score} className="flex-1" />
                <span className="text-sm font-medium text-[#2d682d]">{subject.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
