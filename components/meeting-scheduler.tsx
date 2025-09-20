"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock, Users, Plus, Bell, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface Meeting {
  id: string
  title: string
  teacherId: string
  teacherName: string
  parentId: string
  parentName: string
  studentName: string
  date: Date
  time: string
  duration: number
  status: "pending" | "confirmed" | "completed" | "cancelled"
  notes?: string
  meetingType: "in-person" | "virtual"
  location?: string
  meetingLink?: string
}

interface MeetingSchedulerProps {
  currentUser: {
    id: string
    name: string
    role: string
  }
}

export function MeetingScheduler({ currentUser }: MeetingSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false)
  const [newMeetingForm, setNewMeetingForm] = useState({
    title: "",
    teacherId: "",
    parentId: "",
    studentName: "",
    date: new Date(),
    time: "",
    duration: 30,
    meetingType: "in-person" as "in-person" | "virtual",
    location: "",
    notes: "",
  })

  // Mock data
  const teachers = [
    { id: "1", name: "Mr. Johnson", subject: "Mathematics" },
    { id: "2", name: "Mrs. Smith", subject: "English" },
    { id: "3", name: "Dr. Brown", subject: "Physics" },
    { id: "4", name: "Ms. Davis", subject: "Chemistry" },
  ]

  const parents = [
    { id: "1", name: "John Doe", email: "john.doe@parent.vea.edu.ng", phone: "+234 801 234 5678" },
    { id: "2", name: "Jane Smith", email: "jane.smith@parent.vea.edu.ng", phone: "+234 802 345 6789" },
    { id: "3", name: "Mike Brown", email: "mike.brown@parent.vea.edu.ng", phone: "+234 803 456 7890" },
  ]

  const [meetings, setMeetings] = useState<Meeting[]>([
    {
      id: "1",
      title: "Discuss Mathematics Performance",
      teacherId: "1",
      teacherName: "Mr. Johnson",
      parentId: "1",
      parentName: "John Doe",
      studentName: "Sarah Doe",
      date: new Date(2024, 2, 20),
      time: "10:00",
      duration: 30,
      status: "confirmed",
      meetingType: "in-person",
      location: "Teacher's Office",
      notes: "Discuss recent test performance and improvement strategies",
    },
    {
      id: "2",
      title: "Parent-Teacher Conference",
      teacherId: "2",
      teacherName: "Mrs. Smith",
      parentId: "2",
      parentName: "Jane Smith",
      studentName: "Michael Smith",
      date: new Date(2024, 2, 22),
      time: "14:00",
      duration: 45,
      status: "pending",
      meetingType: "virtual",
      meetingLink: "https://meet.google.com/abc-def-ghi",
      notes: "General academic progress discussion",
    },
    {
      id: "3",
      title: "Behavioral Concerns Discussion",
      teacherId: "3",
      teacherName: "Dr. Brown",
      parentId: "3",
      parentName: "Mike Brown",
      studentName: "Emily Brown",
      date: new Date(2024, 2, 25),
      time: "11:30",
      duration: 60,
      status: "completed",
      meetingType: "in-person",
      location: "Principal's Office",
      notes: "Address recent behavioral issues and create action plan",
    },
  ])

  const handleScheduleMeeting = () => {
    if (!newMeetingForm.title || !newMeetingForm.teacherId || !newMeetingForm.parentId || !newMeetingForm.time) {
      return
    }

    const teacher = teachers.find((t) => t.id === newMeetingForm.teacherId)
    const parent = parents.find((p) => p.id === newMeetingForm.parentId)

    if (!teacher || !parent) return

    const meeting: Meeting = {
      id: Date.now().toString(),
      title: newMeetingForm.title,
      teacherId: teacher.id,
      teacherName: teacher.name,
      parentId: parent.id,
      parentName: parent.name,
      studentName: newMeetingForm.studentName,
      date: newMeetingForm.date,
      time: newMeetingForm.time,
      duration: newMeetingForm.duration,
      status: "pending",
      meetingType: newMeetingForm.meetingType,
      location: newMeetingForm.location,
      notes: newMeetingForm.notes,
    }

    setMeetings((prev) => [...prev, meeting])

    // Show notification popup for Super Admin about school fees payment
    if (currentUser.role === "super_admin") {
      alert("🔔 New Meeting Scheduled! School fees payment notification sent to admin.")
    }

    setNewMeetingForm({
      title: "",
      teacherId: "",
      parentId: "",
      studentName: "",
      date: new Date(),
      time: "",
      duration: 30,
      meetingType: "in-person",
      location: "",
      notes: "",
    })
    setShowNewMeetingDialog(false)
  }

  const updateMeetingStatus = (meetingId: string, status: Meeting["status"]) => {
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, status } : m)))

    // Show notification popup
    const meeting = meetings.find((m) => m.id === meetingId)
    if (meeting) {
      alert(`🔔 Meeting "${meeting.title}" status updated to ${status}`)
    }
  }

  const getStatusColor = (status: Meeting["status"]) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: Meeting["status"]) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const todaysMeetings = meetings.filter((m) => m.date.toDateString() === new Date().toDateString())

  const upcomingMeetings = meetings.filter((m) => m.date > new Date() && m.status !== "cancelled").slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d] flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Parent-Teacher Meeting Scheduler
          </h2>
          <p className="text-gray-600">Appointment booking system with notifications</p>
        </div>
        <Dialog open={showNewMeetingDialog} onOpenChange={setShowNewMeetingDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
              <DialogDescription>Book a parent-teacher meeting appointment</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Meeting Title</Label>
                  <Input
                    id="title"
                    value={newMeetingForm.title}
                    onChange={(e) => setNewMeetingForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Discuss Academic Progress"
                  />
                </div>
                <div>
                  <Label htmlFor="teacher">Teacher</Label>
                  <Select
                    value={newMeetingForm.teacherId}
                    onValueChange={(value) => setNewMeetingForm((prev) => ({ ...prev, teacherId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} - {teacher.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="parent">Parent</Label>
                  <Select
                    value={newMeetingForm.parentId}
                    onValueChange={(value) => setNewMeetingForm((prev) => ({ ...prev, parentId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="student">Student Name</Label>
                  <Input
                    id="student"
                    value={newMeetingForm.studentName}
                    onChange={(e) => setNewMeetingForm((prev) => ({ ...prev, studentName: e.target.value }))}
                    placeholder="Enter student name"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Meeting Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newMeetingForm.date ? format(newMeetingForm.date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newMeetingForm.date}
                        onSelect={(date) => date && setNewMeetingForm((prev) => ({ ...prev, date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newMeetingForm.time}
                    onChange={(e) => setNewMeetingForm((prev) => ({ ...prev, time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select
                    value={newMeetingForm.duration.toString()}
                    onValueChange={(value) =>
                      setNewMeetingForm((prev) => ({ ...prev, duration: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="meetingType">Meeting Type</Label>
                  <Select
                    value={newMeetingForm.meetingType}
                    onValueChange={(value: "in-person" | "virtual") =>
                      setNewMeetingForm((prev) => ({ ...prev, meetingType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">In-Person</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                  <Label htmlFor="location">Location/Meeting Link</Label>
                  <Input
                    id="location"
                    value={newMeetingForm.location}
                    onChange={(e) => setNewMeetingForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder={newMeetingForm.meetingType === "virtual" ? "Meeting link" : "Room/Office location"}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={newMeetingForm.notes}
                    onChange={(e) => setNewMeetingForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes or agenda items"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewMeetingDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleScheduleMeeting} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                Schedule Meeting
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{todaysMeetings.length}</p>
                <p className="text-sm text-gray-600">Today's Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">
                  {meetings.filter((m) => m.status === "pending").length}
                </p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {meetings.filter((m) => m.status === "confirmed").length}
                </p>
                <p className="text-sm text-gray-600">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-600">{meetings.length}</p>
                <p className="text-sm text-gray-600">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All Meetings</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Upcoming Meetings</CardTitle>
              <CardDescription>Scheduled meetings for the coming days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="p-4 border rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(meeting.status)}
                          <h3 className="font-medium">{meeting.title}</h3>
                          <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <p>
                            <strong>Teacher:</strong> {meeting.teacherName}
                          </p>
                          <p>
                            <strong>Parent:</strong> {meeting.parentName}
                          </p>
                          <p>
                            <strong>Student:</strong> {meeting.studentName}
                          </p>
                          <p>
                            <strong>Date:</strong> {format(meeting.date, "PPP")}
                          </p>
                          <p>
                            <strong>Time:</strong> {meeting.time} ({meeting.duration} min)
                          </p>
                          <p>
                            <strong>Type:</strong> {meeting.meetingType}
                          </p>
                        </div>
                        {meeting.notes && <p className="text-sm text-gray-700 mt-2 italic">"{meeting.notes}"</p>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {meeting.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateMeetingStatus(meeting.id, "confirmed")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMeetingStatus(meeting.id, "cancelled")}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {meeting.status === "confirmed" && (
                          <Button
                            size="sm"
                            onClick={() => updateMeetingStatus(meeting.id, "completed")}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d] flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Today's Meetings
              </CardTitle>
              <CardDescription>Meetings scheduled for today</CardDescription>
            </CardHeader>
            <CardContent>
              {todaysMeetings.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No meetings scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todaysMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-4 bg-[#2d682d]/5 border border-[#2d682d]/20 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-[#2d682d]" />
                            <h3 className="font-medium text-[#2d682d]">{meeting.title}</h3>
                            <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              <strong>Time:</strong> {meeting.time} ({meeting.duration} minutes)
                            </p>
                            <p>
                              <strong>Participants:</strong> {meeting.teacherName} & {meeting.parentName}
                            </p>
                            <p>
                              <strong>Student:</strong> {meeting.studentName}
                            </p>
                            <p>
                              <strong>Location:</strong> {meeting.location || meeting.meetingLink || "TBD"}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                          <Bell className="h-4 w-4 mr-1" />
                          Remind
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">All Meetings</CardTitle>
              <CardDescription>Complete meeting history and upcoming appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(meeting.status)}
                          <h3 className="font-medium">{meeting.title}</h3>
                          <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                          <p>
                            <strong>Date:</strong> {format(meeting.date, "PPP")}
                          </p>
                          <p>
                            <strong>Time:</strong> {meeting.time}
                          </p>
                          <p>
                            <strong>Duration:</strong> {meeting.duration} min
                          </p>
                          <p>
                            <strong>Teacher:</strong> {meeting.teacherName}
                          </p>
                          <p>
                            <strong>Parent:</strong> {meeting.parentName}
                          </p>
                          <p>
                            <strong>Student:</strong> {meeting.studentName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
