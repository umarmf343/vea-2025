"use client"

import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Eye, Loader2, Plus, Settings, Trash2 } from "lucide-react"

interface ReportCardColumn {
  id: string
  name: string
  type: "test" | "exam" | "assignment" | "project" | "custom"
  maxScore: number
  weight: number
  isRequired: boolean
  order: number
}

const FALLBACK_COLUMNS: ReportCardColumn[] = [
  { id: "column_ca1", name: "1st Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 1 },
  { id: "column_ca2", name: "2nd Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 2 },
  { id: "column_exam", name: "Exam", type: "exam", maxScore: 60, weight: 60, isRequired: true, order: 3 },
]

export function ReportCardConfig() {
  const [columns, setColumns] = useState<ReportCardColumn[]>([])
  const [newColumn, setNewColumn] = useState({
    name: "",
    type: "test" as ReportCardColumn["type"],
    maxScore: 20,
    weight: 20,
  })
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const loadConfiguration = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/report-cards/config")
      if (!response.ok) {
        throw new Error("Unable to load report card configuration")
      }

      const data = (await response.json()) as { columns: ReportCardColumn[] }
      setColumns(data.columns.length > 0 ? data.columns : FALLBACK_COLUMNS)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load configuration")
      setColumns(FALLBACK_COLUMNS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfiguration()
  }, [loadConfiguration])

  const addColumn = () => {
    if (!newColumn.name.trim()) return

    const newCol: ReportCardColumn = {
      id: `column_${Date.now().toString(36)}`,
      name: newColumn.name,
      type: newColumn.type,
      maxScore: newColumn.maxScore,
      weight: newColumn.weight,
      isRequired: false,
      order: columns.length + 1,
    }

    setColumns([...columns, newCol])
    setNewColumn({ name: "", type: "test", maxScore: 20, weight: 20 })
    setShowAddDialog(false)
  }

  const removeColumn = (id: string) => {
    const filtered = columns.filter((col) => col.id !== id).map((col, index) => ({ ...col, order: index + 1 }))
    setColumns(filtered)
  }

  const updateColumn = (id: string, updates: Partial<ReportCardColumn>) => {
    setColumns(columns.map((col) => (col.id === id ? { ...col, ...updates } : col)))
  }

  const moveColumn = (id: string, direction: "up" | "down") => {
    const index = columns.findIndex((col) => col.id === id)
    if (index === -1) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= columns.length) return

    const newColumns = [...columns]
    const [movedColumn] = newColumns.splice(index, 1)
    newColumns.splice(newIndex, 0, movedColumn)

    setColumns(newColumns.map((col, idx) => ({ ...col, order: idx + 1 })))
  }

  const getTotalWeight = () => columns.reduce((sum, col) => sum + col.weight, 0)

  const getColumnTypeColor = (type: ReportCardColumn["type"]) => {
    switch (type) {
      case "test":
        return "bg-blue-100 text-blue-800"
      case "exam":
        return "bg-red-100 text-red-800"
      case "assignment":
        return "bg-green-100 text-green-800"
      case "project":
        return "bg-purple-100 text-purple-800"
      case "custom":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleSaveConfiguration = async () => {
    setSaving(true)
    setError(null)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/report-cards/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columns.map((column, index) => ({ ...column, order: index + 1 })) }),
      })

      if (!response.ok) {
        throw new Error("Failed to save configuration")
      }

      const data = (await response.json()) as { columns: ReportCardColumn[] }
      setColumns(data.columns)
      setStatusMessage("Report card configuration saved successfully")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to save configuration")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-[#2d682d]">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading report card configuration…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#2d682d]" />
          <div>
            <h3 className="text-xl font-semibold text-[#2d682d]">Report Card Configuration</h3>
            <p className="text-gray-600">Configure assessment columns for student report cards</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d] hover:text-white"
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewMode ? "Edit Mode" : "Preview"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                <Plus className="mr-2 h-4 w-4" /> Add Column
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Assessment Column</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="column-name">Column Name</Label>
                  <Input
                    id="column-name"
                    value={newColumn.name}
                    onChange={(event) => setNewColumn((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="column-type">Assessment Type</Label>
                  <Select
                    value={newColumn.type}
                    onValueChange={(value: ReportCardColumn["type"]) =>
                      setNewColumn((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max-score">Max Score</Label>
                    <Input
                      id="max-score"
                      type="number"
                      min={1}
                      max={100}
                      value={newColumn.maxScore}
                      onChange={(event) =>
                        setNewColumn((prev) => ({ ...prev, maxScore: Number.parseInt(event.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight (%)</Label>
                    <Input
                      id="weight"
                      type="number"
                      min={1}
                      max={100}
                      value={newColumn.weight}
                      onChange={(event) =>
                        setNewColumn((prev) => ({ ...prev, weight: Number.parseInt(event.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addColumn} className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                    Add Column
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void loadConfiguration()} className="ml-auto">
            Reload
          </Button>
        </div>
      )}

      {statusMessage && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Assessment Columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {columns.map((column) => (
              <div key={column.id} className="rounded-lg border border-[#2d682d]/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-[#2d682d]">{column.name}</h4>
                      <Badge className={getColumnTypeColor(column.type)}>{column.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Weight: {column.weight}% • Max Score: {column.maxScore}</p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={column.isRequired}
                          onChange={(event) => updateColumn(column.id, { isRequired: event.target.checked })}
                        />
                        Required for grading
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => moveColumn(column.id, "up")}>↑</Button>
                    <Button variant="ghost" size="sm" onClick={() => moveColumn(column.id, "down")}>↓</Button>
                    <Button variant="destructive" size="icon" onClick={() => removeColumn(column.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs uppercase text-gray-500">Column Name</Label>
                    <Input
                      value={column.name}
                      onChange={(event) => updateColumn(column.id, { name: event.target.value })}
                      disabled={previewMode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-gray-500">Assessment Type</Label>
                    <Select
                      value={column.type}
                      onValueChange={(value: ReportCardColumn["type"]) => updateColumn(column.id, { type: value })}
                      disabled={previewMode}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">Test</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-gray-500">Max Score</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={column.maxScore}
                      onChange={(event) => updateColumn(column.id, { maxScore: Number.parseInt(event.target.value) || 0 })}
                      disabled={previewMode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-gray-500">Weight (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={column.weight}
                      onChange={(event) => updateColumn(column.id, { weight: Number.parseInt(event.target.value) || 0 })}
                      disabled={previewMode}
                    />
                  </div>
                </div>
              </div>
            ))}
            {columns.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#2d682d]/30 p-6 text-center text-sm text-gray-500">
                No columns configured yet. Add an assessment column to get started.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#b29032]/20">
          <CardHeader>
            <CardTitle className="text-[#b29032]">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[#b29032]/20 p-4">
              <p className="text-sm text-gray-600">Total Columns</p>
              <p className="text-2xl font-bold text-[#b29032]">{columns.length}</p>
            </div>
            <div className="rounded-lg border border-[#b29032]/20 p-4">
              <p className="text-sm text-gray-600">Total Weight</p>
              <p className="text-2xl font-bold text-[#b29032]">{getTotalWeight()}%</p>
              {getTotalWeight() !== 100 && (
                <p className="text-xs text-red-600">Ensure the total weight equals 100% for accurate grading.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2d682d]/20">
        <CardContent className="flex justify-end gap-3 py-4">
          <Button variant="outline" onClick={() => void loadConfiguration()} disabled={saving}>
            Reload Defaults
          </Button>
          <Button
            onClick={() => void handleSaveConfiguration()}
            className="bg-[#2d682d] hover:bg-[#1a4a1a] text-white"
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
