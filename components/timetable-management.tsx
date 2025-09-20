"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Plus, Clock, Edit } from "lucide-react"

export default function TimetableManagement() {
  const [selectedClass, setSelectedClass] = useState("Grade 10A")
  const [selectedDay, setSelectedDay] = useState("Monday")

  const classes = ["Grade 10A", "Grade 10B", "Grade 11A", "Grade 11B", "Grade 12A", "Grade 12B"]
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const timeSlots = [
    "8:00 - 8:45",
    "8:45 - 9:30",
    "9:30 - 10:15",
    "10:15 - 11:00",
    "11:15 - 12:00",
    "12:00 - 12:45",
    "1:30 - 2:15",
    "2:15 - 3:00",
  ]

  const subjects = ["Mathematics", "English", "Physics", "Chemistry", "Biology", "History", "Geography"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#2d682d]">Timetable Management</h2>
        <Button className="bg-[#b29032] hover:bg-[#9a7c2a] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Period
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="class-select">Select Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="day-select">Select Day</Label>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((day) => (
                <SelectItem key={day} value={day}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#2d682d]">
            {selectedClass} - {selectedDay}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeSlots.map((time, index) => (
              <div key={time} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Clock className="w-4 h-4 text-[#b29032]" />
                  <span className="font-medium">{time}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{subjects[index % subjects.length]}</span>
                  <Button variant="outline" size="sm">
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
