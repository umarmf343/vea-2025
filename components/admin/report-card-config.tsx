"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, GripVertical, Settings, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface ReportCardColumn {
  id: string
  name: string
  type: "test" | "exam" | "assignment" | "project" | "custom"
  maxScore: number
  weight: number
  isRequired: boolean
  order: number
}

const defaultColumns: ReportCardColumn[] = [
  { id: "1", name: "1st Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 1 },
  { id: "2", name: "2nd Test", type: "test", maxScore: 20, weight: 20, isRequired: true, order: 2 },
  { id: "3", name: "Exam", type: "exam", maxScore: 60, weight: 60, isRequired: true, order: 3 },
]

export function ReportCardConfig() {
  const [columns, setColumns] = useState<ReportCardColumn[]>(defaultColumns)
  const [newColumn, setNewColumn] = useState({
    name: "",
    type: "test" as ReportCardColumn["type"],
    maxScore: 20,
    weight: 20,
  })
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const addColumn = () => {
    if (!newColumn.name.trim()) return

    const newCol: ReportCardColumn = {
      id: Date.now().toString(),
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
    setColumns(columns.filter((col) => col.id !== id))
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

    // Update order numbers
    newColumns.forEach((col, idx) => {
      col.order = idx + 1
    })

    setColumns(newColumns)
  }

  const getTotalWeight = () => {
    return columns.reduce((sum, col) => sum + col.weight, 0)
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#2d682d]">Report Card Configuration</h3>
          <p className="text-gray-600">Configure assessment columns for student report cards</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d] hover:text-white"
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? "Edit Mode" : "Preview"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
                <Plus className="h-4 w-4 mr-2" />
                Add Column
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
                    onChange={(e) => setNewColumn((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Mid-term Test, Project Work"
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
                      value={newColumn.maxScore}
                      onChange={(e) =>
                        setNewColumn((prev) => ({ ...prev, maxScore: Number.parseInt(e.target.value) || 0 }))
                      }
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight (%)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={newColumn.weight}
                      onChange={(e) =>
                        setNewColumn((prev) => ({ ...prev, weight: Number.parseInt(e.target.value) || 0 }))
                      }
                      min="1"
                      max="100"
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

      {/* Weight Summary */}
      <Card className="border-[#b29032]/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Weight</p>
              <p className={`text-2xl font-bold ${getTotalWeight() === 100 ? "text-green-600" : "text-red-600"}`}>
                {getTotalWeight()}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Assessment Columns</p>
              <p className="text-2xl font-bold text-[#2d682d]">{columns.length}</p>
            </div>
          </div>
          {getTotalWeight() !== 100 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">⚠️ Total weight should equal 100% for accurate grade calculation</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Configuration */}
      {previewMode ? (
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle className="text-[#2d682d]">Report Card Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#2d682d]">
                    <th className="text-left py-2 font-semibold text-[#2d682d]">Subject</th>
                    {columns.map((column) => (
                      <th key={column.id} className="text-center py-2 font-semibold text-[#2d682d]">
                        {column.name} ({column.maxScore})
                      </th>
                    ))}
                    <th className="text-center py-2 font-semibold text-[#2d682d]">Total (100)</th>
                    <th className="text-center py-2 font-semibold text-[#2d682d]">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 font-medium">Mathematics</td>
                    {columns.map((column) => (
                      <td key={column.id} className="text-center py-3">
                        --
                      </td>
                    ))}
                    <td className="text-center py-3 font-semibold">--</td>
                    <td className="text-center py-3">
                      <Badge className="bg-gray-100 text-gray-600">--</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 font-medium">English Language</td>
                    {columns.map((column) => (
                      <td key={column.id} className="text-center py-3">
                        --
                      </td>
                    ))}
                    <td className="text-center py-3 font-semibold">--</td>
                    <td className="text-center py-3">
                      <Badge className="bg-gray-100 text-gray-600">--</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {columns.map((column, index) => (
            <Card key={column.id} className="border-[#2d682d]/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveColumn(column.id, "up")}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                    >
                      <GripVertical className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveColumn(column.id, "down")}
                      disabled={index === columns.length - 1}
                      className="h-6 w-6 p-0"
                    >
                      <GripVertical className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div>
                      <Label className="text-xs text-gray-500">Column Name</Label>
                      <Input
                        value={column.name}
                        onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Type</Label>
                      <div className="mt-1">
                        <Badge className={getColumnTypeColor(column.type)}>{column.type}</Badge>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Max Score</Label>
                      <Input
                        type="number"
                        value={column.maxScore}
                        onChange={(e) => updateColumn(column.id, { maxScore: Number.parseInt(e.target.value) || 0 })}
                        className="mt-1"
                        min="1"
                        max="100"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Weight (%)</Label>
                      <Input
                        type="number"
                        value={column.weight}
                        onChange={(e) => updateColumn(column.id, { weight: Number.parseInt(e.target.value) || 0 })}
                        className="mt-1"
                        min="1"
                        max="100"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {column.isRequired && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(column.id)}
                        disabled={column.isRequired}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save Configuration */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Reset to Default</Button>
        <Button className="bg-[#2d682d] hover:bg-[#1a4a1a]">
          <Settings className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
