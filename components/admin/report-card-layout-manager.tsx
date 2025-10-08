"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  applyLayoutDefaults,
  type ReportCardBehavioralItemConfig,
  type ReportCardLayoutConfig,
  type ReportCardLayoutFieldConfig,
  type ReportCardLayoutSectionConfig,
} from "@/lib/report-card-layout-config"
import { safeStorage } from "@/lib/safe-storage"
import { logger } from "@/lib/logger"
import { Loader2, Plus, Save, Trash2, ChevronDown, ChevronUp } from "lucide-react"

const STORAGE_KEY = "reportCardLayoutConfig"

const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

export function ReportCardLayoutManager() {
  const { toast } = useToast()
  const [config, setConfig] = useState<ReportCardLayoutConfig | null>(() => {
    const stored = safeStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    try {
      const parsed = JSON.parse(stored) as Partial<ReportCardLayoutConfig>
      return applyLayoutDefaults(parsed)
    } catch (error) {
      logger.warn("Failed to parse stored report card layout config", { error })
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedSections = useMemo(() => config?.sections ?? [], [config?.sections])

  const persistToStorage = useCallback((nextConfig: ReportCardLayoutConfig) => {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
  }, [])

  const loadLayout = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/report-cards/layout")
      if (!response.ok) {
        throw new Error("Unable to load report card layout configuration")
      }

      const data = (await response.json()) as { layout: ReportCardLayoutConfig }
      const normalized = applyLayoutDefaults(data.layout)
      setConfig(normalized)
      persistToStorage(normalized)
    } catch (err) {
      logger.error("Failed to load report card layout configuration", { error: err })
      setError(err instanceof Error ? err.message : "Unable to load report card layout configuration")
    } finally {
      setLoading(false)
    }
  }, [persistToStorage])

  useEffect(() => {
    if (!config) {
      void loadLayout()
    }
  }, [config, loadLayout])

  const updateSection = useCallback(
    (sectionId: string, updates: Partial<ReportCardLayoutSectionConfig>) => {
      setConfig((previous) => {
        if (!previous) return previous
        const next = {
          ...previous,
          sections: previous.sections.map((section) =>
            section.id === sectionId ? { ...section, ...updates } : section,
          ),
        }
        persistToStorage(next)
        return next
      })
    },
    [persistToStorage],
  )

  const updateField = useCallback(
    (sectionId: string, fieldId: string, updates: Partial<ReportCardLayoutFieldConfig>) => {
      setConfig((previous) => {
        if (!previous) return previous
        const next = {
          ...previous,
          sections: previous.sections.map((section) => {
            if (section.id !== sectionId) return section
            return {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? { ...field, ...updates } : field,
              ),
            }
          }),
        }
        persistToStorage(next)
        return next
      })
    },
    [persistToStorage],
  )

  const addSection = () => {
    const newSection: ReportCardLayoutSectionConfig = {
      id: generateId("section"),
      title: "New Section",
      description: "",
      enabled: true,
      fields: [],
    }

    setConfig((previous) => {
      if (!previous) {
        const normalized = applyLayoutDefaults({ sections: [newSection] })
        persistToStorage(normalized)
        return normalized
      }

      const next = { ...previous, sections: [...previous.sections, newSection] }
      persistToStorage(next)
      return next
    })
  }

  const removeSection = (sectionId: string) => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = {
        ...previous,
        sections: previous.sections.filter((section) => section.id !== sectionId),
      }
      persistToStorage(next)
      return next
    })
  }

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    setConfig((previous) => {
      if (!previous) return previous
      const index = previous.sections.findIndex((section) => section.id === sectionId)
      if (index === -1) return previous

      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= previous.sections.length) return previous

      const sections = [...previous.sections]
      const [section] = sections.splice(index, 1)
      sections.splice(targetIndex, 0, section)
      const next = { ...previous, sections }
      persistToStorage(next)
      return next
    })
  }

  const addField = (sectionId: string) => {
    const newField: ReportCardLayoutFieldConfig = {
      id: generateId("field"),
      label: "New Field",
      enabled: true,
    }

    setConfig((previous) => {
      if (!previous) return previous
      const next = {
        ...previous,
        sections: previous.sections.map((section) =>
          section.id === sectionId
            ? { ...section, fields: [...section.fields, newField] }
            : section,
        ),
      }
      persistToStorage(next)
      return next
    })
  }

  const removeField = (sectionId: string, fieldId: string) => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = {
        ...previous,
        sections: previous.sections.map((section) =>
          section.id === sectionId
            ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) }
            : section,
        ),
      }
      persistToStorage(next)
      return next
    })
  }

  const moveField = (sectionId: string, fieldId: string, direction: "up" | "down") => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = {
        ...previous,
        sections: previous.sections.map((section) => {
          if (section.id !== sectionId) return section

          const index = section.fields.findIndex((field) => field.id === fieldId)
          if (index === -1) return section
          const targetIndex = direction === "up" ? index - 1 : index + 1
          if (targetIndex < 0 || targetIndex >= section.fields.length) return section

          const fields = [...section.fields]
          const [field] = fields.splice(index, 1)
          fields.splice(targetIndex, 0, field)
          return { ...section, fields }
        }),
      }
      persistToStorage(next)
      return next
    })
  }

  const updateBehavioral = (
    domain: "affectiveTraits" | "psychomotorSkills",
    items: ReportCardBehavioralItemConfig[],
  ) => {
    setConfig((previous) => {
      if (!previous) return previous
      const next = { ...previous, [domain]: items }
      persistToStorage(next as ReportCardLayoutConfig)
      return next as ReportCardLayoutConfig
    })
  }

  const addBehavioralItem = (domain: "affectiveTraits" | "psychomotorSkills") => {
    if (!config) return
    const newItem: ReportCardBehavioralItemConfig = {
      id: generateId(domain === "affectiveTraits" ? "affective" : "psychomotor"),
      label: "New Entry",
      enabled: true,
    }
    const items = [...config[domain], newItem]
    updateBehavioral(domain, items)
  }

  const updateBehavioralItem = (
    domain: "affectiveTraits" | "psychomotorSkills",
    itemId: string,
    updates: Partial<ReportCardBehavioralItemConfig>,
  ) => {
    if (!config) return
    const items = config[domain].map((item) =>
      item.id === itemId ? { ...item, ...updates } : item,
    )
    updateBehavioral(domain, items)
  }

  const removeBehavioralItem = (domain: "affectiveTraits" | "psychomotorSkills", itemId: string) => {
    if (!config) return
    const items = config[domain].filter((item) => item.id !== itemId)
    updateBehavioral(domain, items)
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError(null)

    try {
      const payload = applyLayoutDefaults(config)
      const response = await fetch("/api/report-cards/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: payload }),
      })

      if (!response.ok) {
        throw new Error("Failed to save report card layout configuration")
      }

      const data = (await response.json()) as { layout: ReportCardLayoutConfig; message?: string }
      const normalized = applyLayoutDefaults(data.layout)
      setConfig(normalized)
      persistToStorage(normalized)
      toast({ title: "Layout updated", description: data.message ?? "Report card layout saved." })
    } catch (err) {
      logger.error("Failed to save report card layout configuration", { error: err })
      const message = err instanceof Error ? err.message : "Failed to save report card layout"
      setError(message)
      toast({ title: "Unable to save", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !config) {
    return (
      <Card className="border-[#2d682d]/20">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-[#2d682d]">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading report card layout…
        </CardContent>
      </Card>
    )
  }

  if (error && !config) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="flex flex-col gap-4 py-10 text-red-700">
          <p>{error}</p>
          <Button onClick={loadLayout} className="bg-[#2d682d] hover:bg-[#1a4a1a]">
            Retry Loading
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[#2d682d]">Report Card Layout</h3>
          <p className="text-sm text-gray-600">
            Control the sections, labels, and behavioral domains that appear on generated report cards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadLayout} disabled={loading || saving}>
            <Loader2 className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            className="bg-[#2d682d] hover:bg-[#1a4a1a]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Layout
          </Button>
        </div>
      </div>

      <Card className="border-[#2d682d]/15">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Layout Sections</span>
            <Button variant="outline" size="sm" onClick={addSection}>
              <Plus className="mr-2 h-4 w-4" /> Add Section
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedSections.length === 0 ? (
            <div className="rounded border border-dashed border-[#2d682d]/30 p-6 text-center text-sm text-gray-500">
              No sections defined yet. Click “Add Section” to create a new block for the report card layout.
            </div>
          ) : (
            sortedSections.map((section, index) => (
              <Card key={section.id} className="border border-[#2d682d]/20">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-[#2d682d]">{section.title}</h4>
                        <Badge variant="outline">{section.fields.length} fields</Badge>
                      </div>
                      {section.description ? (
                        <p className="text-sm text-gray-600">{section.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Switch
                          checked={section.enabled}
                          onCheckedChange={(checked) => updateSection(section.id, { enabled: checked })}
                        />
                        <span>Section enabled</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveSection(section.id, "up")}
                          disabled={index === 0}
                          aria-label="Move section up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveSection(section.id, "down")}
                          disabled={index === sortedSections.length - 1}
                          aria-label="Move section down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeSection(section.id)}
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Section Title</Label>
                      <Input
                        value={section.title}
                        onChange={(event) => updateSection(section.id, { title: event.target.value })}
                        placeholder="e.g. Student Overview"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Section Description</Label>
                      <Input
                        value={section.description ?? ""}
                        onChange={(event) => updateSection(section.id, { description: event.target.value })}
                        placeholder="Describe the purpose of this section"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {section.fields.map((field, fieldIndex) => (
                      <div
                        key={field.id}
                        className="rounded-lg border border-[#2d682d]/20 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <Label className="text-sm text-[#2d682d]">Field Label</Label>
                            <Input
                              value={field.label}
                              onChange={(event) =>
                                updateField(section.id, field.id, { label: event.target.value })
                              }
                              placeholder="Enter the label that should appear on the report"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Switch
                              checked={field.enabled}
                              onCheckedChange={(checked) =>
                                updateField(section.id, field.id, { enabled: checked })
                              }
                            />
                            <span>Visible</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => moveField(section.id, field.id, "up")}
                                disabled={fieldIndex === 0}
                                aria-label="Move field up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => moveField(section.id, field.id, "down")}
                                disabled={fieldIndex === section.fields.length - 1}
                                aria-label="Move field down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeField(section.id, field.id)}
                                aria-label="Remove field"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => addField(section.id)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Field
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle>Affective Domain Traits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.affectiveTraits.length === 0 ? (
              <div className="rounded border border-dashed border-[#2d682d]/30 p-4 text-center text-sm text-gray-500">
                No affective traits configured yet.
              </div>
            ) : (
              config.affectiveTraits.map((trait) => (
                <div key={trait.id} className="rounded border border-[#2d682d]/20 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Input
                      value={trait.label}
                      onChange={(event) =>
                        updateBehavioralItem("affectiveTraits", trait.id, {
                          label: event.target.value,
                        })
                      }
                      placeholder="Trait label"
                    />
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Switch
                        checked={trait.enabled}
                        onCheckedChange={(checked) =>
                          updateBehavioralItem("affectiveTraits", trait.id, { enabled: checked })
                        }
                      />
                      <span>Visible</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeBehavioralItem("affectiveTraits", trait.id)}
                        aria-label="Remove trait"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            <Button variant="secondary" size="sm" onClick={() => addBehavioralItem("affectiveTraits")}>
              <Plus className="mr-2 h-4 w-4" /> Add Trait
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#2d682d]/20">
          <CardHeader>
            <CardTitle>Psychomotor Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.psychomotorSkills.length === 0 ? (
              <div className="rounded border border-dashed border-[#2d682d]/30 p-4 text-center text-sm text-gray-500">
                No psychomotor skills configured yet.
              </div>
            ) : (
              config.psychomotorSkills.map((skill) => (
                <div key={skill.id} className="rounded border border-[#2d682d]/20 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Input
                      value={skill.label}
                      onChange={(event) =>
                        updateBehavioralItem("psychomotorSkills", skill.id, {
                          label: event.target.value,
                        })
                      }
                      placeholder="Skill label"
                    />
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(checked) =>
                          updateBehavioralItem("psychomotorSkills", skill.id, { enabled: checked })
                        }
                      />
                      <span>Visible</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeBehavioralItem("psychomotorSkills", skill.id)}
                        aria-label="Remove skill"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            <Button variant="secondary" size="sm" onClick={() => addBehavioralItem("psychomotorSkills")}>
              <Plus className="mr-2 h-4 w-4" /> Add Skill
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2d682d]/20">
        <CardHeader>
          <CardTitle>Default Remarks</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Class Teacher Default Remark</Label>
            <Textarea
              value={config.defaultRemarks.classTeacher}
              onChange={(event) =>
                setConfig((previous) => {
                  if (!previous) return previous
                  const next = {
                    ...previous,
                    defaultRemarks: {
                      ...previous.defaultRemarks,
                      classTeacher: event.target.value,
                    },
                  }
                  persistToStorage(next)
                  return next
                })
              }
              rows={3}
              placeholder="Provide the fallback remark for class teachers"
            />
          </div>
          <div className="space-y-2">
            <Label>Head Teacher Default Remark</Label>
            <Textarea
              value={config.defaultRemarks.headTeacher}
              onChange={(event) =>
                setConfig((previous) => {
                  if (!previous) return previous
                  const next = {
                    ...previous,
                    defaultRemarks: {
                      ...previous.defaultRemarks,
                      headTeacher: event.target.value,
                    },
                  }
                  persistToStorage(next)
                  return next
                })
              }
              rows={3}
              placeholder="Fallback remark for the head teacher"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
