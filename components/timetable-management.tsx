"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { dbManager } from "@/lib/database-manager"
import { Clock, Edit, Loader2, Plus, Trash2 } from "lucide-react"

interface TimetableSlot {
  id: string
  day: string
  time: string
  subject: string
  teacher: string
  location?: string | null
}

interface ClassOption {
  value: string
  label: string
}

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

const PERIOD_OPTIONS = [
  "8:00 AM - 8:45 AM",
  "8:45 AM - 9:30 AM",
  "9:30 AM - 10:15 AM",
  "10:15 AM - 11:00 AM",
  "11:15 AM - 12:00 PM",
  "12:00 PM - 12:45 PM",
  "1:30 PM - 2:15 PM",
  "2:15 PM - 3:00 PM",
]

const SUBJECT_OPTIONS = [
  "Mathematics",
  "English Language",
  "Physics",
  "Chemistry",
  "Biology",
  "Basic Science",
  "Computer Studies",
  "Economics",
  "Civic Education",
  "Geography",
]

export default function TimetableManagement() {
  const { toast } = useToast()
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedDay, setSelectedDay] = useState<string>(DAY_OPTIONS[0])
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [dialogState, setDialogState] = useState<{ mode: "create" | "edit"; slot?: TimetableSlot } | null>(null)
  const [slotForm, setSlotForm] = useState({
    day: DAY_OPTIONS[0],
    time: PERIOD_OPTIONS[0],
    subject: SUBJECT_OPTIONS[0],
    teacher: "",
    location: "",
  })
  const [isSaving, setIsSaving] = useState(false)

  const loadClasses = useCallback(async () => {
    const classes = await dbManager.getClasses()
    const normalized = (Array.isArray(classes) ? classes : [])
      .map((item: any) => {
        if (typeof item === "string") {
          return { value: item, label: item }
        }
        return {
          value: String(item.name ?? item.id ?? ""),
          label: String(item.name ?? item.id ?? "Unknown Class"),
        }
      })
      .filter((option) => option.value)

    setClassOptions(normalized)
    if (normalized.length > 0) {
      setSelectedClass((prev) => prev || normalized[0].value)
    }
  }, [])

  const loadTimetable = useCallback(
    async (className: string) => {
      if (!className) {
        setTimetableSlots([])
        return
      }

      try {
        setIsLoading(true)
        const slots = await dbManager.getTimetable(className)
        setTimetableSlots(slots)
      } catch (error) {
        console.error("Failed to load timetable", error)
        toast({
          title: "Unable to load timetable",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (!selectedClass) {
      return
    }
    loadTimetable(selectedClass)

    const handleTimetableUpdate = (payload: { className: string; slots: TimetableSlot[] }) => {
      if (payload?.className === selectedClass) {
        setTimetableSlots(payload.slots)
      }
    }

    dbManager.on("timetableUpdated", handleTimetableUpdate)
    return () => {
      dbManager.off("timetableUpdated", handleTimetableUpdate)
    }
  }, [selectedClass, loadTimetable])

  useEffect(() => {
    if (dialogState?.mode === "edit" && dialogState.slot) {
      const slot = dialogState.slot
      setSlotForm({
        day: slot.day,
        time: slot.time,
        subject: slot.subject,
        teacher: slot.teacher,
        location: slot.location ?? "",
      })
    } else {
      setSlotForm({
        day: selectedDay,
        time: PERIOD_OPTIONS[0],
        subject: SUBJECT_OPTIONS[0],
        teacher: "",
        location: "",
      })
    }
  }, [dialogState, selectedDay])

  const filteredSlots = useMemo(
    () =>
      timetableSlots
        .filter((slot) => slot.day === selectedDay)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [timetableSlots, selectedDay],
  )

  const handleSlotSubmit = async () => {
    if (!selectedClass) {
      toast({
        title: "Select a class",
        description: "Choose a class before updating the timetable.",
        variant: "destructive",
      })
      return
    }

    if (!slotForm.teacher || !slotForm.time || !slotForm.subject) {
      toast({
        title: "Missing details",
        description: "Subject, period and teacher are required.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      if (dialogState?.mode === "edit" && dialogState.slot) {
        await dbManager.updateTimetableSlot(selectedClass, dialogState.slot.id, {
          day: slotForm.day,
          time: slotForm.time,
          subject: slotForm.subject,
          teacher: slotForm.teacher,
          location: slotForm.location || undefined,
        })
        toast({ title: "Timetable entry updated" })
      } else {
        await dbManager.addTimetableSlot(selectedClass, {
          day: slotForm.day,
          time: slotForm.time,
          subject: slotForm.subject,
          teacher: slotForm.teacher,
          location: slotForm.location || undefined,
        })
        toast({ title: "Period added to timetable" })
      }

      setDialogState(null)
    } catch (error) {
      console.error("Failed to save timetable slot", error)
      toast({
        title: "Unable to save timetable",
        description: "Please review the details and try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSlot = async (slot: TimetableSlot) => {
    if (!selectedClass) {
      return
    }

    const confirmation = window.confirm(`Remove ${slot.subject} (${slot.time}) from ${selectedClass}?`)
    if (!confirmation) {
      return
    }

    try {
      await dbManager.deleteTimetableSlot(selectedClass, slot.id)
      toast({ title: "Timetable entry removed" })
    } catch (error) {
      console.error("Failed to delete timetable entry", error)
      toast({
        title: "Unable to delete timetable entry",
        description: "Please try again later.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2d682d]">Timetable Management</h2>
          <p className="text-sm text-gray-600">
            Coordinate class schedules across the school and keep teachers in sync with lesson delivery.
          </p>
        </div>
        <Button className="bg-[#b29032] hover:bg-[#9a7c2a] text-white" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="w-4 h-4 mr-2" /> Add Period
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#2d682d]">Manage Class Timetable</CardTitle>
          <CardDescription>Update daily schedules and lesson allocations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Day</Label>
              <Tabs value={selectedDay} onValueChange={setSelectedDay}>
                <TabsList className="grid grid-cols-5">
                  {DAY_OPTIONS.map((day) => (
                    <TabsTrigger key={day} value={day}>
                      {day.slice(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Summary</Label>
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-gray-600">{selectedClass || "Select a class"}</p>
                <p className="text-xs text-gray-500">{filteredSlots.length} periods scheduled</p>
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[50vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading timetable...
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
                <Clock className="w-6 h-6 text-[#b29032]" />
                No periods scheduled for {selectedDay}. Use “Add Period” to schedule a class.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">{slot.time}</TableCell>
                      <TableCell>{slot.subject}</TableCell>
                      <TableCell>{slot.teacher}</TableCell>
                      <TableCell>{slot.location || "-"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setDialogState({ mode: "edit", slot })}>
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteSlot(slot)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!dialogState} onOpenChange={(open) => (!open ? setDialogState(null) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2d682d]">
              {dialogState?.mode === "edit" ? "Update Period" : "Add Timetable Period"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Day</Label>
              <Select
                value={slotForm.day}
                onValueChange={(value) => setSlotForm((prev) => ({ ...prev, day: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Period</Label>
              <Select
                value={slotForm.time}
                onValueChange={(value) => setSlotForm((prev) => ({ ...prev, time: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Subject</Label>
              <Select
                value={slotForm.subject}
                onValueChange={(value) => setSlotForm((prev) => ({ ...prev, subject: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700">Teacher</Label>
              <Input
                value={slotForm.teacher}
                onChange={(event) => setSlotForm((prev) => ({ ...prev, teacher: event.target.value }))}
                placeholder="Enter teacher's name"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">Location</Label>
              <Input
                value={slotForm.location}
                onChange={(event) => setSlotForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Laboratory, Room number or hall"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState(null)}>
              Cancel
            </Button>
            <Button className="bg-[#2d682d] hover:bg-[#245224] text-white" onClick={handleSlotSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
