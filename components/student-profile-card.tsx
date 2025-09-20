"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Calendar, MapPin, Phone, Mail } from "lucide-react"

interface StudentProfileProps {
  student: {
    id: string
    name: string
    class: string
    section: string
    admissionNumber: string
    dateOfBirth: string
    address: string
    phone: string
    email: string
    avatar?: string
    status: "active" | "inactive"
  }
}

export function StudentProfileCard({ student }: StudentProfileProps) {
  return (
    <Card className="border-[#2d682d]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2d682d]">
          <User className="h-5 w-5" />
          Student Profile
        </CardTitle>
        <CardDescription>Your child's information and current status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={student.avatar || "/placeholder.svg"} alt={student.name} />
            <AvatarFallback className="bg-[#2d682d] text-white text-lg">
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#2d682d]">{student.name}</h3>
            <p className="text-sm text-gray-600">
              Class {student.class} - Section {student.section}
            </p>
            <Badge variant={student.status === "active" ? "default" : "secondary"} className="mt-1">
              {student.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#b29032]" />
              <span className="font-medium">DOB:</span>
              <span>{student.dateOfBirth}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#b29032]" />
              <span className="font-medium">Address:</span>
              <span className="text-xs">{student.address}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#b29032]" />
              <span className="font-medium">Phone:</span>
              <span>{student.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#b29032]" />
              <span className="font-medium">Email:</span>
              <span className="text-xs">{student.email}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Admission Number:</span> {student.admissionNumber}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
