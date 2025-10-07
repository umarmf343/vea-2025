"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Clock,
  Droplets,
  Flame,
  PartyPopper,
  Pause,
  Play,
  Sprout,
  Sunrise,
  Sunset,
  Undo2,
} from "lucide-react"

interface GardenPlant {
  id: string
  name: string
  subject: string
  description: string
  growth: number
  hydration: number
  streak: number
  focusHistory: Record<string, number>
  reflections: string[]
}

const INITIAL_PLANTS: GardenPlant[] = [
  {
    id: "math",
    name: "Math Magnolia",
    subject: "Problem solving",
    description: "Short equation bursts and mental math warmups.",
    growth: 52,
    hydration: 74,
    streak: 2,
    focusHistory: { Morning: 3, Afternoon: 1, Evening: 0 },
    reflections: ["Felt confident multiplying fractions."],
  },
  {
    id: "reading",
    name: "Literacy Lavender",
    subject: "Reading + annotation",
    description: "Preview, annotate, and summarize key chapters.",
    growth: 67,
    hydration: 68,
    streak: 4,
    focusHistory: { Morning: 1, Afternoon: 4, Evening: 1 },
    reflections: ["Need to slow down on context clues."],
  },
  {
    id: "science",
    name: "Science Succulent",
    subject: "Lab review",
    description: "Cycle through diagrams and lab vocabulary.",
    growth: 41,
    hydration: 59,
    streak: 1,
    focusHistory: { Morning: 0, Afternoon: 2, Evening: 1 },
    reflections: ["Flashcards helped with ecosystem terms."],
  },
]

const SESSION_LENGTHS = [
  { id: "short", label: "Quick water • 2 min", seconds: 120 },
  { id: "steady", label: "Deep focus • 4 min", seconds: 240 },
  { id: "power", label: "Power sprint • 6 min", seconds: 360 },
]

const TIMES_OF_DAY = [
  { id: "Morning", label: "Morning boost", icon: Sunrise },
  { id: "Afternoon", label: "Afternoon groove", icon: Flame },
  { id: "Evening", label: "Evening wind-down", icon: Sunset },
]

interface SessionLogEntry {
  id: string
  plantId: string
  duration: number
  timeOfDay: string
  reflection?: string
  timestamp: Date
}

export function FocusGardenBuilder() {
  const [plants, setPlants] = useState<GardenPlant[]>(INITIAL_PLANTS)
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(INITIAL_PLANTS[0]?.id ?? null)
  const [sessionLength, setSessionLength] = useState(SESSION_LENGTHS[0])
  const [timeOfDay, setTimeOfDay] = useState<string>(TIMES_OF_DAY[0].id)
  const [timeLeft, setTimeLeft] = useState(sessionLength.seconds)
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [reflectionText, setReflectionText] = useState("")
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([])
  const [celebrating, setCelebrating] = useState(false)
  const [customPlantName, setCustomPlantName] = useState("")
  const [customPlantSubject, setCustomPlantSubject] = useState("")
  const [customPlantDescription, setCustomPlantDescription] = useState("")

  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId) ?? null

  const handleCompleteSession = useCallback(
    (reflectionOverride?: string) => {
      if (!selectedPlant) {
        return
      }

      setPlants((previous) =>
        previous.map((plant) => {
          if (plant.id === selectedPlant.id) {
            const newGrowth = Math.min(100, plant.growth + 12)
            const newHydration = Math.min(100, plant.hydration + 18)
            const newHistory = {
              ...plant.focusHistory,
              [timeOfDay]: (plant.focusHistory[timeOfDay] ?? 0) + 1,
            }

            const reflections = reflectionOverride
              ? [...plant.reflections, reflectionOverride]
              : reflectionText.trim()
                ? [...plant.reflections, reflectionText.trim()]
                : plant.reflections

            return {
              ...plant,
              growth: newGrowth,
              hydration: newHydration,
              streak: plant.streak + 1,
              focusHistory: newHistory,
              reflections,
            }
          }

          return {
            ...plant,
            hydration: Math.max(0, plant.hydration - 5),
            growth: Math.max(0, plant.growth - 3),
          }
        }),
      )

      const logEntry: SessionLogEntry = {
        id: `${Date.now()}`,
        plantId: selectedPlant.id,
        duration: sessionLength.seconds,
        timeOfDay,
        reflection: reflectionOverride ?? (reflectionText.trim() ? reflectionText.trim() : undefined),
        timestamp: new Date(),
      }

      setSessionLog((previous) => [logEntry, ...previous].slice(0, 8))
      setReflectionText("")
      setSessionActive(false)
      setSessionPaused(false)
      setTimeLeft(sessionLength.seconds)
      setCelebrating(true)
    },
    [reflectionText, selectedPlant, sessionLength.seconds, timeOfDay],
  )

  useEffect(() => {
    if (!sessionActive || sessionPaused) {
      return
    }

    const interval = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          handleCompleteSession()
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [handleCompleteSession, sessionActive, sessionPaused])

  useEffect(() => {
    if (!sessionActive) {
      setTimeLeft(sessionLength.seconds)
    }
  }, [sessionActive, sessionLength.seconds])

  useEffect(() => {
    if (!celebrating) {
      return
    }

    const timeout = setTimeout(() => setCelebrating(false), 2400)
    return () => clearTimeout(timeout)
  }, [celebrating])

  const sessionProgress = useMemo(() => {
    if (!sessionActive) {
      return 0
    }
    return ((sessionLength.seconds - timeLeft) / sessionLength.seconds) * 100
  }, [sessionActive, sessionLength.seconds, timeLeft])

  const gardenVitality = useMemo(() => {
    if (plants.length === 0) {
      return 0
    }
    const total = plants.reduce((sum, plant) => sum + (plant.growth + plant.hydration) / 2, 0)
    return Math.round(total / plants.length)
  }, [plants])

  const bestStreak = useMemo(() => Math.max(0, ...plants.map((plant) => plant.streak)), [plants])

  const handleStartSession = () => {
    if (!selectedPlant) {
      return
    }
    setSessionActive(true)
    setSessionPaused(false)
    setTimeLeft(sessionLength.seconds)
    setCelebrating(false)
  }

  const handlePauseToggle = () => {
    if (!sessionActive) {
      return
    }
    setSessionPaused((previous) => !previous)
  }

  const handleResetSession = () => {
    setSessionActive(false)
    setSessionPaused(false)
    setTimeLeft(sessionLength.seconds)
  }


  const handleAddCustomPlant = () => {
    if (!customPlantName.trim() || !customPlantSubject.trim()) {
      return
    }

    const newPlant: GardenPlant = {
      id: `${customPlantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: customPlantName.trim(),
      subject: customPlantSubject.trim(),
      description: customPlantDescription.trim() || "Create a ritual for this focus area.",
      growth: 35,
      hydration: 45,
      streak: 0,
      focusHistory: { Morning: 0, Afternoon: 0, Evening: 0 },
      reflections: [],
    }

    setPlants((previous) => [...previous, newPlant])
    setSelectedPlantId(newPlant.id)
    setCustomPlantDescription("")
    setCustomPlantName("")
    setCustomPlantSubject("")
  }

  const handleReviveGarden = () => {
    setPlants((previous) =>
      previous.map((plant) => ({
        ...plant,
        hydration: Math.min(100, plant.hydration + 10),
        growth: Math.min(100, plant.growth + 6),
        streak: plant.streak > 0 ? plant.streak - 1 : 0,
      })),
    )
  }

  const timeLabel = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [timeLeft])

  const mostLovedTimeOfDay = useMemo(() => {
    if (!selectedPlant) {
      return null
    }
    const entries = Object.entries(selectedPlant.focusHistory)
    if (entries.length === 0) {
      return null
    }
    return entries.reduce((best, current) => (current[1] > best[1] ? current : best))
  }, [selectedPlant])

  return (
    <Card className="border-emerald-200 bg-emerald-50/50 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl text-[#2d682d]">
            <Sprout className="h-6 w-6" /> Focus Garden Builder
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm text-slate-700">
            Turn focus sprints into a flourishing digital garden. Water a plant, log a reflection, and watch your
            streaks bloom.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm text-[#2d682d] shadow-sm">
          <Droplets className="h-4 w-4" /> Garden vitality <span className="font-semibold">{gardenVitality}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
          <div className="space-y-4">
            <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#2d682d]">Pick a plant to water</CardTitle>
                <CardDescription>Select a focus area to grow during your next study sprint.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs value={selectedPlantId ?? ""} onValueChange={setSelectedPlantId}>
                  <TabsList className="flex flex-wrap justify-start gap-2 bg-transparent p-0">
                    {plants.map((plant) => (
                      <TabsTrigger
                        key={plant.id}
                        value={plant.id}
                        className="rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm text-[#2d682d] data-[state=active]:bg-emerald-100"
                      >
                        {plant.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {plants.map((plant) => (
                    <TabsContent key={plant.id} value={plant.id} className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>{plant.subject}</span>
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Sprout className="h-4 w-4" /> streak {plant.streak}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{plant.description}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-emerald-700">
                            Growth
                            <span>{plant.growth}%</span>
                          </div>
                          <Progress value={plant.growth} className="h-2" />
                        </div>
                        <div className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/80 p-3">
                          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-amber-700">
                            Hydration
                            <span>{plant.hydration}%</span>
                          </div>
                          <Progress value={plant.hydration} className="h-2" />
                        </div>
                      </div>
                      {mostLovedTimeOfDay && plant.id === selectedPlant?.id ? (
                        <p className="text-xs text-emerald-700">
                          Thrives during <span className="font-semibold">{mostLovedTimeOfDay[0].toLowerCase()}</span> sessions.
                        </p>
                      ) : null}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#2d682d]">Grow your garden</CardTitle>
                <CardDescription>Log a new plant when you add a subject or habit to your routine.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Plant name"
                    value={customPlantName}
                    onChange={(event) => setCustomPlantName(event.target.value)}
                  />
                  <Input
                    placeholder="Subject or habit"
                    value={customPlantSubject}
                    onChange={(event) => setCustomPlantSubject(event.target.value)}
                  />
                </div>
                <Textarea
                  placeholder="Describe how you will care for this plant."
                  value={customPlantDescription}
                  onChange={(event) => setCustomPlantDescription(event.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAddCustomPlant} className="bg-emerald-600 text-white hover:bg-emerald-500">
                    Plant a new seed
                  </Button>
                  <Button onClick={handleReviveGarden} variant="outline" className="border-emerald-200 text-emerald-700">
                    Mist the whole garden
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#2d682d]">
                  <Clock className="h-5 w-5" /> Focus sprint controller
                </CardTitle>
                <CardDescription>
                  Choose a time block, match it with your energy, and stay with the plant until the timer blooms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {SESSION_LENGTHS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      onClick={() => setSessionLength(option)}
                      variant="outline"
                      className={`border-emerald-200 text-emerald-700 hover:!bg-emerald-50 ${
                        sessionLength.id === option.id
                          ? "!bg-emerald-600 !text-white hover:!bg-emerald-500"
                          : "!bg-white/80"
                      }`}
                      disabled={sessionActive}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {TIMES_OF_DAY.map((slot) => (
                    <Button
                      key={slot.id}
                      type="button"
                      onClick={() => setTimeOfDay(slot.id)}
                      variant="outline"
                      className={`border-emerald-200 text-emerald-700 hover:!bg-emerald-50 ${
                        timeOfDay === slot.id
                          ? "!bg-emerald-600 !text-white hover:!bg-emerald-500"
                          : "!bg-white/80"
                      }`}
                      disabled={sessionActive}
                    >
                      <slot.icon className="mr-2 h-4 w-4" /> {slot.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-center text-[#2d682d]">
                  <div className="text-sm font-medium uppercase tracking-wide">Current sprint</div>
                  <div className="text-3xl font-bold">{timeLabel}</div>
                  <Progress value={sessionProgress} className="h-2" />
                  <div className="text-xs text-emerald-700">
                    {sessionActive ? "Stay with your plant until the timer rewards you." : "Pick a plant and press start."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleStartSession}
                    disabled={sessionActive || !selectedPlant}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Begin watering
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePauseToggle}
                    disabled={!sessionActive}
                    variant="outline"
                    className="border-emerald-200 text-emerald-700"
                  >
                    {sessionPaused ? (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="mr-2 h-4 w-4" /> Pause
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetSession}
                    disabled={!sessionActive}
                    variant="ghost"
                    className="text-emerald-700"
                  >
                    <Undo2 className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleCompleteSession()}
                    disabled={!sessionActive}
                    variant="outline"
                    className="border-emerald-200 text-emerald-700"
                  >
                    Finish early
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#2d682d]">
                  <PartyPopper className="h-5 w-5" /> Reflection booster
                </CardTitle>
                <CardDescription>
                  Capture the key idea that stuck with you. It feeds tomorrow&apos;s prompts and builds streak confidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="What clicked? What still needs sunshine?"
                  value={reflectionText}
                  onChange={(event) => setReflectionText(event.target.value)}
                  rows={4}
                  disabled={sessionActive}
                />
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <Button
                    type="button"
                    onClick={() => handleCompleteSession()}
                    disabled={sessionActive}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Save reflection & reward plant
                  </Button>
                  <span>
                    Highest streak today: <span className="font-semibold text-emerald-700">{bestStreak}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="bg-emerald-200" />

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2d682d]">Recent watering sessions</CardTitle>
              <CardDescription>Keep an eye on your habit streaks and favourite time blocks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessionLog.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Start a session to see your log blossom with reflections and time-of-day insights.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessionLog.map((entry) => {
                    const plant = plants.find((candidate) => candidate.id === entry.plantId)
                    if (!plant) {
                      return null
                    }
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-1 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                            {plant.name}
                          </Badge>
                          <span>{Math.round(entry.duration / 60)} min focus</span>
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Flame className="h-4 w-4" /> {entry.timeOfDay}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {entry.reflection ? ` · ${entry.reflection}` : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-200/70 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2d682d]">Plant reflections</CardTitle>
              <CardDescription>Each entry becomes tomorrow&apos;s motivation prompt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedPlant && selectedPlant.reflections.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {selectedPlant.reflections
                    .slice()
                    .reverse()
                    .map((note, index) => (
                      <li key={`${note}-${index}`} className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2">
                        {note}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Your reflection garden is ready for its first story.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {celebrating ? (
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-[#2d682d] shadow-sm transition-opacity">
              <PartyPopper className="h-4 w-4" />
              <span className="text-sm font-semibold">Focus streak watered! Keep the garden glowing.</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default FocusGardenBuilder
