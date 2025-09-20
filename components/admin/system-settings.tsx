"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Save, RotateCcw } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"

export function SystemSettings() {
  const [registrationEnabled, setRegistrationEnabled] = useState(() => {
    const saved = safeStorage.getItem("registrationEnabled")
    return saved !== null ? JSON.parse(saved) : true
  })

  const [schoolName, setSchoolName] = useState("Victory Educational Academy")
  const [schoolAddress, setSchoolAddress] = useState(
    "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba Bwari Area Council, Abuja",
  )
  const [currentSession, setCurrentSession] = useState("2024/2025")
  const [currentTerm, setCurrentTerm] = useState("Third Term")

  const handleSaveSettings = () => {
    safeStorage.setItem("registrationEnabled", JSON.stringify(registrationEnabled))
    // In a real app, these would be saved to a backend
    alert("Settings saved successfully!")
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  const handleResetPassword = (userEmail: string) => {
    // Mock password reset functionality
    const newPassword = Math.random().toString(36).slice(-8)
    alert(`Password reset for ${userEmail}. New password: ${newPassword}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-[#2d682d]" />
        <h3 className="text-xl font-semibold text-[#2d682d]">System Settings</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Control */}
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Registration Control</CardTitle>
            <CardDescription>Control user registration access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="registration-toggle" className="text-sm font-medium">
                Enable User Registration
              </Label>
              <Switch id="registration-toggle" checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
            </div>
            <p className="text-sm text-gray-600">
              {registrationEnabled
                ? "Users can register new accounts through the login page"
                : "Only login is available - registration is disabled"}
            </p>
          </CardContent>
        </Card>

        {/* School Information */}
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">School Information</CardTitle>
            <CardDescription>Basic school details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input
                id="school-name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-address">School Address</Label>
              <Textarea
                id="school-address"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Academic Session */}
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Academic Session</CardTitle>
            <CardDescription>Current academic session and term</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-session">Current Session</Label>
              <Input
                id="current-session"
                value={currentSession}
                onChange={(e) => setCurrentSession(e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-term">Current Term</Label>
              <Input
                id="current-term"
                value={currentTerm}
                onChange={(e) => setCurrentTerm(e.target.value)}
                className="border-[#2d682d]/20 focus:border-[#b29032]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Password Reset */}
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Password Management</CardTitle>
            <CardDescription>Reset user passwords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                onClick={() => handleResetPassword("teacher@vea.edu.ng")}
                variant="outline"
                className="w-full justify-start"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Teacher Password
              </Button>
              <Button
                onClick={() => handleResetPassword("parent@vea.edu.ng")}
                variant="outline"
                className="w-full justify-start"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Parent Password
              </Button>
              <Button
                onClick={() => handleResetPassword("student@vea.edu.ng")}
                variant="outline"
                className="w-full justify-start"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Student Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Settings */}
      <Card className="border-[#2d682d]/20">
        <CardContent className="pt-6">
          <Button onClick={handleSaveSettings} className="w-full bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
            <Save className="h-4 w-4 mr-2" />
            Save All Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
