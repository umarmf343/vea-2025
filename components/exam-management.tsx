"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Calendar, Clock, Edit, Trash2, FileText } from "lucide-react"

export default function ExamManagement() {
  const [activeTab, setActiveTab] = useState("upcoming")

  const upcomingExams = [
    { id: 1, subject: "Mathematics", class: "Grade 10A", date: "2025-01-15", time: "9:00 AM", duration: "2 hours" },
    { id: 2, subject: "Physics", class: "Grade 11B", date: "2025-01-16", time: "10:00 AM", duration: "1.5 hours" },
    { id: 3, subject: "Chemistry", class: "Grade 12A", date: "2025-01-17", time: "2:00 PM", duration: "2 hours" },
  ]

  const completedExams = [
    { id: 4, subject: "English", class: "Grade 10A", date: "2025-01-10", avgScore: 78, totalStudents: 32 },
    { id: 5, subject: "Biology", class: "Grade 11A", date: "2025-01-08", avgScore: 82, totalStudents: 28 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#2d682d]">Exam Management</h2>
        <Button className="bg-[#b29032] hover:bg-[#9a7c2a] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Schedule Exam
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming Exams</TabsTrigger>
          <TabsTrigger value="completed">Completed Exams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingExams.map((exam) => (
            <Card key={exam.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[#2d682d]">{exam.subject}</h3>
                    <p className="text-sm text-gray-600">{exam.class}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1 text-[#b29032]" />
                        {exam.date}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-[#b29032]" />
                        {exam.time}
                      </span>
                      <span>{exam.duration}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedExams.map((exam) => (
            <Card key={exam.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[#2d682d]">{exam.subject}</h3>
                    <p className="text-sm text-gray-600">{exam.class}</p>
                    <p className="text-sm">Date: {exam.date}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-lg font-bold text-[#b29032]">{exam.avgScore}%</div>
                    <div className="text-sm text-gray-600">Avg Score</div>
                    <div className="text-sm">{exam.totalStudents} students</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an exam to view detailed results</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
