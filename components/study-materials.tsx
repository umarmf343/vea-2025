"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { dbManager } from "@/lib/database-manager"
import { cn } from "@/lib/utils"
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react"

type BrowserRuntime = typeof globalThis & Partial<Window>

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null
  }

  return globalThis as BrowserRuntime
}

interface StudyMaterialRecord {
  id: string
  title: string
  description: string
  subject: string
  className: string
  classId?: string | null
  teacherId?: string | null
  teacherName: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl?: string | null
  uploadDate: string
  downloadCount: number
}

interface StudyMaterialsProps {
  userRole: "teacher" | "student"
  teacherName?: string
  teacherId?: string
  availableSubjects?: string[]
  availableClasses?: string[]
  studentClass?: string
}

const DEFAULT_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
]

const DEFAULT_CLASSES = ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"]

const formatFileSize = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) {
    return "--"
  }

  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Unable to read file"))
    reader.readAsDataURL(file)
  })

export function StudyMaterials({
  userRole,
  teacherName,
  teacherId,
  availableSubjects,
  availableClasses,
  studentClass,
}: StudyMaterialsProps) {
  const { toast } = useToast()
  const [materials, setMaterials] = useState<StudyMaterialRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    subject: "",
    className: "",
    file: null as File | null,
  })

  const subjectOptions = useMemo(() => {
    if (userRole === "teacher" && availableSubjects && availableSubjects.length > 0) {
      return availableSubjects
    }
    return DEFAULT_SUBJECTS
  }, [availableSubjects, userRole])

  const classOptions = useMemo(() => {
    if (userRole === "teacher" && availableClasses && availableClasses.length > 0) {
      return availableClasses
    }
    return DEFAULT_CLASSES
  }, [availableClasses, userRole])

  const canUpload = userRole === "teacher"

  const canManageMaterial = (material: StudyMaterialRecord) => {
    if (!canUpload) {
      return false
    }

    if (teacherId) {
      return material.teacherId === teacherId
    }

    if (teacherName) {
      return material.teacherName.toLowerCase() === teacherName.toLowerCase()
    }

    return true
  }

  const loadMaterials = async () => {
    try {
      setLoading(true)
      const filters: { className?: string; teacherId?: string } = {}

      if (userRole === "student" && studentClass) {
        filters.className = studentClass
      }

      if (userRole === "teacher" && teacherId) {
        filters.teacherId = teacherId
      }

      const records = await dbManager.getStudyMaterials(filters)

      const filtered =
        userRole === "student" && studentClass
          ? records.filter((material) => material.className.toLowerCase() === studentClass.toLowerCase())
          : records

      setMaterials(filtered)
    } catch (error) {
      console.error("Error loading study materials:", error)
      toast({
        variant: "destructive",
        title: "Unable to load study materials",
        description: "Please try again later.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMaterials()

    const handleMaterialsUpdate = () => {
      void loadMaterials()
    }

    dbManager.on("studyMaterialsUpdated", handleMaterialsUpdate)

    return () => {
      dbManager.off("studyMaterialsUpdated", handleMaterialsUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, teacherId, studentClass])

  const handleUpload: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    if (!uploadForm.file) {
      toast({
        variant: "destructive",
        title: "File is required",
        description: "Please attach a file before uploading.",
      })
      return
    }

    if (!uploadForm.subject || !uploadForm.className) {
      toast({
        variant: "destructive",
        title: "Incomplete details",
        description: "Select both the subject and the class for the material.",
      })
      return
    }

    try {
      setIsUploading(true)
      const dataUrl = await readFileAsDataUrl(uploadForm.file)

      await dbManager.saveStudyMaterial({
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim(),
        subject: uploadForm.subject,
        className: uploadForm.className,
        teacherId: teacherId ?? undefined,
        teacherName: teacherName ?? "Unknown Teacher",
        fileName: uploadForm.file.name,
        fileSize: uploadForm.file.size,
        fileType: uploadForm.file.type || "application/octet-stream",
        fileUrl: dataUrl,
      })

      toast({
        title: "Material uploaded",
        description: "The study material is now available to students.",
      })

      setUploadForm({ title: "", description: "", subject: "", className: "", file: null })
      setShowUploadForm(false)
    } catch (error) {
      console.error("Error uploading study material:", error)
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "We could not upload the material. Please try again.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (material: StudyMaterialRecord) => {
    if (!canManageMaterial(material)) {
      toast({
        variant: "destructive",
        title: "Action not allowed",
        description: "You can only remove materials you uploaded.",
      })
      return
    }

    const runtime = getBrowserRuntime()
    const confirmed = runtime?.confirm
      ? runtime.confirm(`Delete “${material.title}”? This action cannot be undone.`)
      : true
    if (!confirmed) {
      return
    }

    try {
      await dbManager.deleteStudyMaterial(material.id)
      toast({
        title: "Material removed",
        description: "The study material has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting study material:", error)
      toast({
        variant: "destructive",
        title: "Unable to delete material",
        description: "Please try again or contact the administrator.",
      })
    }
  }

  const handleDownload = async (material: StudyMaterialRecord) => {
    try {
      if (!material.fileUrl) {
        toast({
          variant: "destructive",
          title: "File unavailable",
          description: "This material does not have an attachment to download.",
        })
        return
      }

      const runtime = getBrowserRuntime()
      if (!runtime?.document) {
        toast({
          variant: "destructive",
          title: "Download unavailable",
          description: "Attachments can only be downloaded in a browser environment.",
        })
        return
      }

      const link = runtime.document.createElement("a")
      link.href = material.fileUrl
      link.download = material.fileName || `${material.title}.file`
      runtime.document.body?.appendChild(link)
      link.click()
      runtime.document.body?.removeChild(link)

      await dbManager.incrementDownloadCount(material.id)
    } catch (error) {
      console.error("Error downloading study material:", error)
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "We could not start the download. Please try again.",
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[#2d682d]"></div>
            <p className="text-gray-600">Loading study materials...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#2d682d]">Study Materials</h3>
          <p className="text-gray-600">
            {userRole === "teacher"
              ? "Upload and manage study materials"
              : "Access study materials for your class"}
          </p>
        </div>
        {canUpload && (
          <Button
            onClick={() => setShowUploadForm((prev) => !prev)}
            className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            {showUploadForm ? "Hide Form" : "Upload Material"}
          </Button>
        )}
      </div>

      {showUploadForm && canUpload && (
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#b29032]">Upload Study Material</CardTitle>
            <CardDescription>Add new study material for students</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Enter material title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select
                    value={uploadForm.subject}
                    onValueChange={(value) => setUploadForm((prev) => ({ ...prev, subject: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select
                  value={uploadForm.className}
                  onValueChange={(value) => setUploadForm((prev) => ({ ...prev, className: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((classOption) => (
                      <SelectItem key={classOption} value={classOption}>
                        {classOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={uploadForm.description}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Enter material description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))
                  }
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  required
                />
                <p className="text-xs text-gray-500">
                  Supported formats: PDF, Word, PowerPoint, Excel. Maximum size 10MB.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isUploading}
                  className={cn("bg-[#2d682d] text-white", isUploading && "opacity-80")}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload Material"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUploadForm(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((material) => {
          const uploadedOn = new Date(material.uploadDate)
          const formattedDate = Number.isNaN(uploadedOn.getTime())
            ? material.uploadDate
            : uploadedOn.toLocaleDateString()
          const allowManagement = canManageMaterial(material)

          return (
            <Card
              key={material.id}
              className="border-[#2d682d]/20 transition-colors hover:border-[#2d682d]/40"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2 text-sm font-medium text-[#2d682d]">
                      {material.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {material.subject} • {material.className}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {material.fileType.split("/").pop()?.toUpperCase() || "FILE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm text-gray-600">
                <p className="line-clamp-3">{material.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>By {material.teacherName}</span>
                  <span>Uploaded {formattedDate}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{formatFileSize(material.fileSize)}</span>
                  <span>{material.downloadCount} downloads</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-[#2d682d] text-white hover:bg-[#1a4a1a]"
                    onClick={() => void handleDownload(material)}
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Download
                  </Button>
                  {allowManagement && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(material)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {materials.length === 0 && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No study materials</h3>
            <p className="text-gray-500">
              {userRole === "teacher"
                ? "Upload your first study material to get started"
                : "No study materials available for your class yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
