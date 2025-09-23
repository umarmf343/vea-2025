"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Loader2, RotateCcw, Save, Settings } from "lucide-react"
import { safeStorage } from "@/lib/safe-storage"

interface BrandingPayload {
  schoolName: string
  schoolAddress: string
  educationZone?: string
  councilArea?: string
  contactPhone?: string
  contactEmail?: string
  headmasterName?: string
  defaultRemark?: string
}

interface SystemSettingsPayload {
  registrationEnabled: boolean
  academicYear: string
  currentTerm: string
  reportCardDeadline: string
}

interface UserSummary {
  id: string
  email: string
  name: string
}

export function SystemSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [schoolName, setSchoolName] = useState("")
  const [schoolAddress, setSchoolAddress] = useState("")
  const [educationZone, setEducationZone] = useState("")
  const [councilArea, setCouncilArea] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [headmasterName, setHeadmasterName] = useState("")
  const [defaultRemark, setDefaultRemark] = useState("")
  const [currentSession, setCurrentSession] = useState("")
  const [currentTerm, setCurrentTerm] = useState("")
  const [reportCardDeadline, setReportCardDeadline] = useState("")

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatusMessage(null)

    try {
      const [settingsResponse, brandingResponse] = await Promise.all([
        fetch("/api/system/settings"),
        fetch("/api/system/branding"),
      ])

      if (!settingsResponse.ok) {
        throw new Error("Unable to load system settings")
      }

      if (!brandingResponse.ok) {
        throw new Error("Unable to load branding settings")
      }

      const settingsData = (await settingsResponse.json()) as { settings: Partial<SystemSettingsPayload> }
      const brandingData = (await brandingResponse.json()) as { branding: Partial<BrandingPayload> }

      const registrationState = Boolean(settingsData.settings?.registrationEnabled ?? true)
      setRegistrationEnabled(registrationState)
      safeStorage.setItem("registrationEnabled", JSON.stringify(registrationState))
      setCurrentSession(settingsData.settings?.academicYear ?? "2024/2025")
      setCurrentTerm(settingsData.settings?.currentTerm ?? "First Term")
      setReportCardDeadline(settingsData.settings?.reportCardDeadline ?? "")

      setSchoolName(brandingData.branding?.schoolName ?? "Victory Educational Academy")
      setSchoolAddress(
        brandingData.branding?.schoolAddress ??
          "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba Bwari Area Council, Abuja",
      )
      setEducationZone(brandingData.branding?.educationZone ?? "Municipal Education Zone")
      setCouncilArea(brandingData.branding?.councilArea ?? "Bwari Area Council")
      setContactPhone(brandingData.branding?.contactPhone ?? "+234 (0) 700-832-2025")
      setContactEmail(brandingData.branding?.contactEmail ?? "info@victoryacademy.edu.ng")
      setHeadmasterName(brandingData.branding?.headmasterName ?? "")
      setDefaultRemark(
        brandingData.branding?.defaultRemark ??
          "Keep up the excellent work and continue to strive for academic excellence.",
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load system settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const canSave = useMemo(() => {
    return Boolean(
      schoolName &&
      schoolAddress &&
      educationZone &&
      councilArea &&
      contactPhone &&
      contactEmail &&
      currentSession &&
      currentTerm,
    )
  }, [
    contactEmail,
    contactPhone,
    councilArea,
    currentSession,
    currentTerm,
    educationZone,
    schoolAddress,
    schoolName,
  ])

  const handleSaveSettings = useCallback(async () => {
    if (!canSave) {
      setError("Please complete the required fields before saving.")
      return
    }

    setSaving(true)
    setError(null)
    setStatusMessage(null)

    try {
      const [settingsResponse, brandingResponse] = await Promise.all([
        fetch("/api/system/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationEnabled,
            academicYear: currentSession,
            currentTerm,
            reportCardDeadline,
          }),
        }),
        fetch("/api/system/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolName,
            schoolAddress,
            educationZone,
            councilArea,
            contactPhone,
            contactEmail,
            headmasterName,
            defaultRemark,
          }),
        }),
      ])

      if (!settingsResponse.ok) {
        throw new Error("Failed to update system settings")
      }

      if (!brandingResponse.ok) {
        throw new Error("Failed to update branding settings")
      }

      safeStorage.setItem("registrationEnabled", JSON.stringify(registrationEnabled))
      setStatusMessage("Settings saved successfully")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to save settings")
    } finally {
      setSaving(false)
    }
  }, [
    canSave,
    currentSession,
    currentTerm,
    defaultRemark,
    educationZone,
    headmasterName,
    registrationEnabled,
    reportCardDeadline,
    schoolAddress,
    schoolName,
    contactPhone,
    contactEmail,
    councilArea,
  ])

  const handleResetPassword = useCallback(async (userEmail: string) => {
    setError(null)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/users")

      if (!response.ok) {
        throw new Error("Unable to fetch users for password reset")
      }

      const data = (await response.json()) as { users: UserSummary[] }
      const match = data.users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase())

      if (!match) {
        throw new Error("User not found for password reset")
      }

      const newPassword = Math.random().toString(36).slice(-10)
      const updateResponse = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: match.id, password: newPassword }),
      })

      if (!updateResponse.ok) {
        throw new Error("Failed to reset user password")
      }

      setStatusMessage(`Password reset for ${userEmail}. Temporary password: ${newPassword}`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to reset password at this time")
    }
  }, [])

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#2d682d]" />
          <span className="ml-3 text-sm text-[#2d682d]">Loading system settings…</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-[#2d682d]" />
        <h3 className="text-xl font-semibold text-[#2d682d]">System Settings</h3>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void loadSettings()} className="ml-auto">
            Reload
          </Button>
        </div>
      )}

      {statusMessage && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Registration Control</CardTitle>
            <CardDescription>Enable or disable portal registration for new users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="registration-toggle" className="text-sm font-medium">
                Enable User Registration
              </Label>
              <Switch
                id="registration-toggle"
                checked={registrationEnabled}
                onCheckedChange={setRegistrationEnabled}
                disabled={saving}
              />
            </div>
            <p className="text-sm text-gray-600">
              {registrationEnabled
                ? "Users can create new accounts through the portal"
                : "Registration is disabled. Existing users can still log in."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">School Information</CardTitle>
            <CardDescription>Branding details displayed across the portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input
                id="school-name"
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-address">School Address</Label>
              <Textarea
                id="school-address"
                value={schoolAddress}
                onChange={(event) => setSchoolAddress(event.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="education-zone">Education Zone</Label>
                <Input
                  id="education-zone"
                  value={educationZone}
                  onChange={(event) => setEducationZone(event.target.value)}
                  placeholder="e.g. Municipal Education Zone"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="council-area">Local Council Area</Label>
                <Input
                  id="council-area"
                  value={councilArea}
                  onChange={(event) => setCouncilArea(event.target.value)}
                  placeholder="e.g. Bwari Area Council"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Contact Phone</Label>
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="e.g. +234 (0) 700-832-2025"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="e.g. info@victoryacademy.edu.ng"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headmaster-name">Headmaster/Principal</Label>
              <Input
                id="headmaster-name"
                value={headmasterName}
                onChange={(event) => setHeadmasterName(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-remark">Default Report Card Remark</Label>
              <Textarea
                id="default-remark"
                value={defaultRemark}
                onChange={(event) => setDefaultRemark(event.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Academic Session</CardTitle>
            <CardDescription>Configure the current academic session and term</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="academic-session">Academic Session</Label>
              <Input
                id="academic-session"
                value={currentSession}
                onChange={(event) => setCurrentSession(event.target.value)}
                placeholder="2024/2025"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic-term">Current Term</Label>
              <Input
                id="academic-term"
                value={currentTerm}
                onChange={(event) => setCurrentTerm(event.target.value)}
                placeholder="First Term"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-deadline">Report Card Deadline</Label>
              <Input
                id="report-deadline"
                type="date"
                value={reportCardDeadline}
                onChange={(event) => setReportCardDeadline(event.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-gray-500">
                Optional deadline reminder for teachers to submit report cards
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Password Management</CardTitle>
            <CardDescription>Issue temporary passwords for staff and parents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => void handleResetPassword("teacher@vea.edu.ng")}
              variant="outline"
              className="w-full justify-start"
              disabled={saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Teacher Password
            </Button>
            <Button
              onClick={() => void handleResetPassword("parent@vea.edu.ng")}
              variant="outline"
              className="w-full justify-start"
              disabled={saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Parent Password
            </Button>
            <Button
              onClick={() => void handleResetPassword("student@vea.edu.ng")}
              variant="outline"
              className="w-full justify-start"
              disabled={saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Student Password
            </Button>
            <p className="text-xs text-gray-500">
              Temporary passwords should be shared securely and changed after first login.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2d682d]/20">
        <CardContent className="pt-6">
          <Button
            onClick={() => void handleSaveSettings()}
            className="w-full bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
            disabled={saving || !canSave}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving settings…" : "Save All Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
