"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Download, Eye, Trash2, Plus } from "lucide-react"
import { DatabaseManager } from "@/lib/database-manager"

interface StudyMaterial {
  id: string
  title: string
  description: string
  subject: string
  class: string
  fileType: string
  uploadDate: string
  downloadCount: number
  teacherName: string
}

interface StudyMaterialsProps {
  userRole: "teacher" | "student"
  teacherName?: string
  studentClass?: string
}

export function StudyMaterials({ userRole, teacherName, studentClass }: StudyMaterialsProps) {
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    subject: "",
    class: "",
    file: null as File | null,
  })

  const dbManager = DatabaseManager.getInstance()

  useEffect(() => {
    loadMaterials()

    // Real-time listener for materials updates
    const handleMaterialsUpdate = () => {
      loadMaterials()
    }

    dbManager.on("studyMaterialsUpdated", handleMaterialsUpdate)

    return () => {
      dbManager.off("studyMaterialsUpdated", handleMaterialsUpdate)
    }
  }, [])

  const loadMaterials = async () => {
    try {
      setLoading(true)
      const allMaterials = await dbManager.getStudyMaterials()

      // Filter materials based on user role
      const filteredMaterials =
        userRole === "student" ? allMaterials.filter((m) => m.class === studentClass) : allMaterials

      setMaterials(filteredMaterials)
    } catch (error) {
      console.error("Error loading study materials:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForm.file) return

    try {
      const newMaterial: StudyMaterial = {
        id: Date.now().toString(),
        title: uploadForm.title,
        description: uploadForm.description,
        subject: uploadForm.subject,
        class: uploadForm.class,
        fileType: uploadForm.file.name.split(".").pop()?.toUpperCase() || "FILE",
        uploadDate: new Date().toISOString().split("T")[0],
        downloadCount: 0,
        teacherName: teacherName || "Unknown Teacher",
      }

      await dbManager.saveStudyMaterial(newMaterial)
      setUploadForm({ title: "", description: "", subject: "", class: "", file: null })
      setShowUploadForm(false)

      // Trigger real-time update
      dbManager.emit("studyMaterialsUpdated")
    } catch (error) {
      console.error("Error uploading study material:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await dbManager.deleteStudyMaterial(id)
      dbManager.emit("studyMaterialsUpdated")
    } catch (error) {
      console.error("Error deleting study material:", error)
    }
  }

  const handleDownload = async (materialId: string) => {
    try {
      await dbManager.incrementDownloadCount(materialId)
      dbManager.emit("studyMaterialsUpdated")
    } catch (error) {
      console.error("Error updating download count:", error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d] mx-auto mb-4"></div>
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
            {userRole === "teacher" ? "Upload and manage study materials" : "Access study materials for your class"}
          </p>
        </div>
        {userRole === "teacher" && (
          <Button onClick={() => setShowUploadForm(true)} className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Upload Material
          </Button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && userRole === "teacher" && (
        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#b29032]">Upload Study Material</CardTitle>
            <CardDescription>Add new study material for students</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
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
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="English">English Language</SelectItem>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="Chemistry">Chemistry</SelectItem>
                      <SelectItem value="Biology">Biology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select
                  value={uploadForm.class}
                  onValueChange={(value) => setUploadForm((prev) => ({ ...prev, class: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JSS 1">JSS 1</SelectItem>
                    <SelectItem value="JSS 2">JSS 2</SelectItem>
                    <SelectItem value="JSS 3">JSS 3</SelectItem>
                    <SelectItem value="SS 1">SS 1</SelectItem>
                    <SelectItem value="SS 2">SS 2</SelectItem>
                    <SelectItem value="SS 3">SS 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter material description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Material
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowUploadForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((material) => (
          <Card key={material.id} className="border-[#2d682d]/20 hover:border-[#2d682d]/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-sm font-medium text-[#2d682d] line-clamp-2">{material.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {material.subject} • {material.class}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {material.fileType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{material.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>By {material.teacherName}</span>
                <span>{material.downloadCount} downloads</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
                  onClick={() => handleDownload(material.id)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button size="sm" variant="outline">
                  <Eye className="h-3 w-3" />
                </Button>
                {userRole === "teacher" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(material.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No study materials</h3>
            <p className="text-gray-500 text-center">
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
