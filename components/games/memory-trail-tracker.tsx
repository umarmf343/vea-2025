"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  ArrowRightCircle,
  Brain,
  History,
  PartyPopper,
  RefreshCcw,
  Sparkles,
  Undo2,
} from "lucide-react"

interface StoryFrame {
  id: string
  text: string
  detail: string
  theme: string
}

interface StoryTrail {
  id: string
  title: string
  prompt: string
  frames: StoryFrame[]
}

interface TrailResult {
  id: string
  title: string
  accuracy: number
  streakEarned: boolean
  timestamp: Date
}

const BASE_TRAILS: StoryTrail[] = [
  {
    id: "library-mystery",
    title: "Library Mystery",
    prompt: "Rebuild yesterday&apos;s reading adventure in the correct order.",
    frames: [
      { id: "lm-1", text: "Found a glowing bookmark", detail: "Bookmark pulsed softly between pages", theme: "Observation" },
      { id: "lm-2", text: "Followed clues along the shelves", detail: "Dusty arrows pointed toward history", theme: "Inference" },
      { id: "lm-3", text: "Discovered a secret reading nook", detail: "Cushions and lanterns hidden behind biographies", theme: "Discovery" },
      { id: "lm-4", text: "Shared the story map with friends", detail: "Classmates planned the next reading quest", theme: "Collaboration" },
    ],
  },
  {
    id: "science-fair",
    title: "Science Fair Sparks",
    prompt: "Remember the experiment steps before presenting again.",
    frames: [
      { id: "sf-1", text: "Sketched the invention idea", detail: "Notebook page filled with labelled diagrams", theme: "Planning" },
      { id: "sf-2", text: "Tested the prototype", detail: "Tiny LED blinked during the water filtration test", theme: "Testing" },
      { id: "sf-3", text: "Logged results in the lab book", detail: "Measured clarity and taste after filtering", theme: "Analysis" },
      { id: "sf-4", text: "Presented to the judges", detail: "Explained improvements for the next trial", theme: "Presentation" },
    ],
  },
  {
    id: "field-journey",
    title: "Field Trip Trail",
    prompt: "Retrace the day from bus ride to reflection circle.",
    frames: [
      { id: "fj-1", text: "Boarded the humming bus", detail: "Seats filled with excited chatter", theme: "Beginning" },
      { id: "fj-2", text: "Met the park ranger guide", detail: "Learned about native plants and animals", theme: "Learning" },
      { id: "fj-3", text: "Mapped the forest trail", detail: "Group marked sightings with stickers", theme: "Exploration" },
      { id: "fj-4", text: "Shared highlights back at school", detail: "Circle time reflections with classmates", theme: "Reflection" },
    ],
  },
]

const PREVIEW_SECONDS = 12
const ROUND_SECONDS = 75

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function MemoryTrailTracker() {
  const [trail, setTrail] = useState<StoryTrail | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [trailTimer, setTrailTimer] = useState(PREVIEW_SECONDS)
  const [challengeTimer, setChallengeTimer] = useState(ROUND_SECONDS)
  const [shuffledFrames, setShuffledFrames] = useState<StoryFrame[]>([])
  const [selection, setSelection] = useState<StoryFrame[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [memoryVault, setMemoryVault] = useState<StoryFrame[]>([])
  const [results, setResults] = useState<TrailResult[]>([])
  const [celebrating, setCelebrating] = useState(false)

  const startNewTrail = useCallback(() => {
    const availableTrails = shuffle(BASE_TRAILS)
    const baseTrail = availableTrails[0]
    const memoryBonus = memoryVault.length > 0 ? shuffle(memoryVault).slice(0, 1) : []
    const combinedFrames = memoryBonus.length > 0 ? shuffle([...baseTrail.frames, ...memoryBonus]) : baseTrail.frames
    const trimmedFrames = combinedFrames.slice(0, 4)
    setTrail({ ...baseTrail, frames: trimmedFrames })
    setPreviewing(true)
    setTrailTimer(PREVIEW_SECONDS)
    setChallengeTimer(ROUND_SECONDS)
    setSelection([])
    setMistakes(0)
    setCelebrating(false)
    setShuffledFrames(shuffle(trimmedFrames))
  }, [memoryVault])

  const correctOrderIds = useMemo(() => trail?.frames.map((frame) => frame.id) ?? [], [trail?.frames])

  const handleRoundEnd = useCallback(
    (success: boolean, finalSelection: StoryFrame[]) => {
      if (!trail) {
        return
      }

      setCelebrating(success)
      if (success) {
        setStreak((previous) => {
          const next = previous + 1
          setBestStreak((best) => Math.max(best, next))
          return next
        })
        setMemoryVault((previous) => {
          const newFrames = trail.frames.slice(0, 2)
          const existingIds = new Set(previous.map((frame) => frame.id))
          const merged = [...previous]
          newFrames.forEach((frame) => {
            if (!existingIds.has(frame.id)) {
              merged.push(frame)
            }
          })
          return merged
        })
      } else {
        setStreak(0)
      }

      const accuracy = Math.max(
        0,
        Math.round(
          (finalSelection.filter((item, index) => item.id === correctOrderIds[index]).length / correctOrderIds.length) * 100,
        ),
      )
      const result: TrailResult = {
        id: `${Date.now()}`,
        title: trail.title,
        accuracy,
        streakEarned: success,
        timestamp: new Date(),
      }
      setResults((previous) => [result, ...previous].slice(0, 6))

      setTimeout(() => {
        setCelebrating(false)
        startNewTrail()
      }, 2400)
    },
    [correctOrderIds, startNewTrail, trail],
  )

  useEffect(() => {
    if (!previewing) {
      return
    }

    const interval = setInterval(() => {
      setTrailTimer((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          setPreviewing(false)
          setChallengeTimer(ROUND_SECONDS)
          return PREVIEW_SECONDS
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [previewing])

  useEffect(() => {
    if (previewing || selection.length === (trail?.frames.length ?? 0) || trail === null) {
      return
    }

    const interval = setInterval(() => {
      setChallengeTimer((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          handleRoundEnd(false, selection)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [handleRoundEnd, previewing, selection, trail])

  useEffect(() => {
    startNewTrail()
  }, [startNewTrail])

  const handleSelectFrame = (frame: StoryFrame) => {
    if (!trail || previewing) {
      return
    }
    if (selection.find((item) => item.id === frame.id)) {
      return
    }

    const nextSelection = [...selection, frame]
    setSelection(nextSelection)

    const nextIndex = nextSelection.length - 1
    if (frame.id !== correctOrderIds[nextIndex]) {
      setMistakes((previous) => previous + 1)
      return
    }

    if (nextSelection.length === correctOrderIds.length) {
      handleRoundEnd(true, nextSelection)
    }
  }

  const handleUndo = () => {
    if (selection.length === 0) {
      return
    }
    setSelection((previous) => previous.slice(0, -1))
  }

  const previewProgress = useMemo(() => ((PREVIEW_SECONDS - trailTimer) / PREVIEW_SECONDS) * 100, [trailTimer])
  const challengeProgress = useMemo(() => ((ROUND_SECONDS - challengeTimer) / ROUND_SECONDS) * 100, [challengeTimer])

  return (
    <Card className="border-amber-200 bg-amber-50/60 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl text-amber-800">
            <Sparkles className="h-6 w-6" /> Memory Trail Tracker
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm text-slate-700">
            Preview the story path, then rebuild it from memory. Streak up by finishing before the lantern fades.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-sm text-amber-800 shadow-sm">
          <Brain className="h-4 w-4" /> Current streak <span className="font-semibold">{streak}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
          <Card className="border-amber-200/60 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <History className="h-5 w-5" /> Story preview window
              </CardTitle>
              <CardDescription>
                Watch closely. When the countdown ends, the cards will shuffle and only memory can guide you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-amber-700">
                  {trail?.title ?? "Loading trail"}
                  <span>{previewing ? "Preview mode" : "Recall mode"}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {trail?.frames.map((frame, index) => (
                    <div
                      key={frame.id}
                      className={`rounded-lg border border-amber-100 bg-white/80 p-3 text-sm text-slate-700 transition-opacity ${
                        previewing || selection.find((item) => item.id === frame.id)
                          ? "opacity-100"
                          : "opacity-40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Step {index + 1}
                        <Badge variant="outline" className="border-amber-200 text-amber-700">
                          {frame.theme}
                        </Badge>
                      </div>
                      <p className="mt-1 font-medium text-slate-800">{frame.text}</p>
                      <p className="text-xs text-slate-500">{frame.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2 text-amber-700">
                  <ArrowRightCircle className="h-4 w-4" /> {trail?.prompt}
                </div>
                <div className="rounded-xl border border-amber-100 bg-white/70 p-3">
                  {previewing ? (
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-amber-800">Preview closes in {trailTimer}s</p>
                      <Progress value={previewProgress} className="h-2" />
                    </div>
                  ) : (
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-amber-800">Lantern dims in {challengeTimer}s</p>
                      <Progress value={challengeProgress} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <Sparkles className="h-5 w-5" /> Rebuild the trail
              </CardTitle>
              <CardDescription>
                Tap the cards in story order. Undo to fix mistakes before time runs out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {shuffledFrames.map((frame) => {
                  const isSelected = selection.find((item) => item.id === frame.id)
                  const currentIndex = selection.findIndex((item) => item.id === frame.id)
                  const expectedIndex = correctOrderIds.indexOf(frame.id)
                  const isCorrectSpot = currentIndex > -1 && currentIndex === expectedIndex

                  return (
                    <Button
                      key={frame.id}
                      variant="outline"
                      className={`justify-between border-amber-200 text-left text-sm font-medium text-slate-700 ${
                        isSelected
                          ? isCorrectSpot
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-700"
                          : "bg-white/80"
                      }`}
                      onClick={() => handleSelectFrame(frame)}
                      disabled={previewing || selection.length === correctOrderIds.length}
                    >
                      <span>{frame.text}</span>
                      {isSelected ? <Badge variant="secondary">Step {currentIndex + 1}</Badge> : null}
                    </Button>
                  )
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleUndo} variant="outline" className="border-amber-200 text-amber-800" disabled={selection.length === 0}>
                  <Undo2 className="mr-2 h-4 w-4" /> Undo last step
                </Button>
                <Button
                  onClick={() => startNewTrail()}
                  variant="ghost"
                  className="text-amber-800"
                  disabled={previewing}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Shuffle new story
                </Button>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-sm text-slate-600">
                <div>Selections made: {selection.length}</div>
                <div>Mistakes: {mistakes}</div>
                <div>Best streak: {bestStreak}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-amber-200" />

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card className="border-amber-200/60 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-amber-800">Trail journal</CardTitle>
              <CardDescription>Review your streak history and celebrate high-accuracy rounds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.length === 0 ? (
                <p className="text-sm text-slate-600">Complete a trail to begin filling your journal.</p>
              ) : (
                <div className="space-y-2">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex flex-col gap-1 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-200 text-amber-800">
                          {result.title}
                        </Badge>
                        <span>{result.accuracy}% accurate</span>
                        {result.streakEarned ? (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Sparkles className="h-4 w-4" /> streak boosted
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {result.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-amber-800">Memory vault</CardTitle>
              <CardDescription>Flashback cards return to future rounds for spaced retrieval.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {memoryVault.length === 0 ? (
                <p className="text-sm text-slate-600">Win a trail to capture your first flashback card.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-600">
                  {memoryVault.map((frame) => (
                    <li key={frame.id} className="rounded-lg border border-amber-100 bg-amber-50/70 p-2">
                      <span className="font-semibold text-amber-800">{frame.theme}:</span> {frame.text}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {celebrating ? (
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-amber-800 shadow-sm transition-opacity">
              <PartyPopper className="h-4 w-4" />
              <span className="text-sm font-semibold">Trail complete! Memory path unlocked.</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default MemoryTrailTracker
