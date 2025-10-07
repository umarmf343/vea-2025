"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface MathQuestion {
  prompt: string
  answer: number
  difficulty: "warm-up" | "speedster" | "pilot"
  operation: "×" | "+" | "−" | "÷"
}

interface RaceLogEntry {
  id: string
  message: string
}

const difficultyStyles: Record<MathQuestion["difficulty"], string> = {
  "warm-up": "border-emerald-200 bg-emerald-50 text-emerald-700",
  speedster: "border-amber-200 bg-amber-50 text-amber-700",
  pilot: "border-purple-200 bg-purple-50 text-purple-700",
}

const difficultyLabels: Record<MathQuestion["difficulty"], string> = {
  "warm-up": "Warm-up lap",
  speedster: "Speedster sprint",
  pilot: "Pilot mode",
}

const createQuestion = (): MathQuestion => {
  const difficultyPool: MathQuestion["difficulty"][] = ["warm-up", "speedster", "pilot"]
  const difficulty = difficultyPool[Math.floor(Math.random() * difficultyPool.length)]

  const ranges: Record<MathQuestion["difficulty"], [number, number]> = {
    "warm-up": [2, 9],
    speedster: [6, 12],
    pilot: [8, 18],
  }

  const [min, max] = ranges[difficulty]
  const operations: Array<MathQuestion["operation"]> = ["×", "+", "−", "÷"]
  const operation = operations[Math.floor(Math.random() * operations.length)]

  let left = Math.floor(Math.random() * (max - min + 1)) + min
  let right = Math.floor(Math.random() * (max - min + 1)) + min

  if (operation === "÷") {
    right = Math.max(2, right)
    left = right * Math.floor(Math.random() * (max - min + 1) + min)
  }

  if (operation === "−" && right > left) {
    ;[left, right] = [right, left]
  }

  const answer =
    operation === "×"
      ? left * right
      : operation === "+"
        ? left + right
        : operation === "−"
          ? left - right
          : left / right

  return {
    prompt: `${left} ${operation} ${right}`,
    answer,
    difficulty,
    operation,
  }
}

const clampProgress = (value: number) => Math.min(100, Math.max(0, value))

const formatSpeedMessage = (seconds: number) => {
  if (seconds <= 3) {
    return "🚀 Nitro boost!"
  }
  if (seconds <= 6) {
    return "⚡ Turbo time!"
  }
  return "⛽ Smooth cruise"
}

const trackPosition = (value: number) => `${Math.min(92, Math.max(6, value))}%`

export default function MathRacing() {
  const [raceActive, setRaceActive] = useState(false)
  const [sessionId, setSessionId] = useState(0)
  const [playerProgress, setPlayerProgress] = useState(0)
  const [rivalProgress, setRivalProgress] = useState(0)
  const [question, setQuestion] = useState<MathQuestion>(() => createQuestion())
  const [answer, setAnswer] = useState("")
  const [raceLog, setRaceLog] = useState<RaceLogEntry[]>([])
  const [roundsCompleted, setRoundsCompleted] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestBoost, setBestBoost] = useState<number | null>(null)
  const [penalties, setPenalties] = useState(0)

  const rivalIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const questionStartRef = useRef<number | null>(null)

  const raceDistance = useMemo(() => Math.round((playerProgress / 100) * 400), [playerProgress])

  const startRace = useCallback(() => {
    if (rivalIntervalRef.current) {
      clearInterval(rivalIntervalRef.current)
      rivalIntervalRef.current = null
    }
    setRaceActive(true)
    setSessionId((previous) => previous + 1)
    setPlayerProgress(0)
    setRivalProgress(0)
    setRaceLog([])
    setRoundsCompleted(0)
    setStreak(0)
    setPenalties(0)
    setBestBoost(null)
    const initialQuestion = createQuestion()
    setQuestion(initialQuestion)
    setAnswer("")
    questionStartRef.current = Date.now()
  }, [])

  const stopRace = useCallback(
    (message: string) => {
      setRaceActive(false)
      setRaceLog((previous) => [{ id: `${Date.now()}`, message }, ...previous].slice(0, 6))
      if (rivalIntervalRef.current) {
        clearInterval(rivalIntervalRef.current)
        rivalIntervalRef.current = null
      }
      questionStartRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (!raceActive) {
      return
    }

    questionStartRef.current = Date.now()
    const interval = setInterval(() => {
      setRivalProgress((previous) => {
        const updated = clampProgress(previous + 3 + Math.random() * 4)
        if (updated >= 100) {
          stopRace("🏁 Rival championed the race. Try again!")
        }
        return updated
      })
    }, 1200)

    rivalIntervalRef.current = interval

    return () => {
      clearInterval(interval)
      rivalIntervalRef.current = null
    }
  }, [raceActive, sessionId, stopRace])

  useEffect(() => {
    if (!raceActive) {
      return
    }
    if (playerProgress >= 100) {
      stopRace("🏆 You won the math grand prix!")
    } else if (rivalProgress >= 100) {
      stopRace("🏁 Rival championed the race. Try again!")
    }
  }, [playerProgress, raceActive, rivalProgress, stopRace])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!raceActive) {
      return
    }

    const parsed = Number(answer.trim())
    if (Number.isNaN(parsed)) {
      setRaceLog((previous) => [{ id: `${Date.now()}`, message: "Enter a number to boost your vehicle!" }, ...previous].slice(0, 6))
      return
    }

    const now = Date.now()
    const seconds = questionStartRef.current ? (now - questionStartRef.current) / 1000 : 8
    questionStartRef.current = now

    if (parsed === question.answer) {
      const speedMessage = formatSpeedMessage(seconds)
      const boost = seconds <= 3 ? 26 : seconds <= 6 ? 18 : 12
      setPlayerProgress((previous) => clampProgress(previous + boost + streak * 4))
      setRaceLog((previous) =>
        [
          {
            id: `${Date.now()}`,
            message: `${speedMessage} +${boost} progress for solving ${question.prompt}`,
          },
          ...previous,
        ].slice(0, 6),
      )
      setRoundsCompleted((previous) => previous + 1)
      setStreak((previous) => previous + 1)
      setBestBoost((previous) => (previous === null ? boost : Math.max(previous, boost)))
      setQuestion(createQuestion())
      setAnswer("")
    } else {
      const penalty = 10
      setPlayerProgress((previous) => clampProgress(previous - penalty))
      setPenalties((previous) => previous + 1)
      setRaceLog((previous) =>
        [
          {
            id: `${Date.now()}`,
            message: `🪫 Penalty lap! ${question.prompt} = ${question.answer}. -${penalty} progress.`,
          },
          ...previous,
        ].slice(0, 6),
      )
      setStreak(0)
      setQuestion(createQuestion())
      setAnswer("")
    }
  }

  useEffect(() => {
    if (!raceActive) {
      questionStartRef.current = null
    }
  }, [raceActive])

  const statusBadge = useMemo(() => {
    if (!raceActive) {
      return { label: "Tap start to race", variant: "border-slate-200 bg-slate-100 text-slate-700" }
    }
    if (streak >= 3) {
      return { label: "Combo streak!", variant: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    }
    if (penalties > 0) {
      return { label: "Shake off penalties", variant: "border-amber-200 bg-amber-50 text-amber-700" }
    }
    return { label: "Keep solving!", variant: "border-indigo-200 bg-indigo-50 text-indigo-700" }
  }, [penalties, raceActive, streak])

  const carBaseClass = "absolute flex -translate-x-1/2 items-center gap-3 transition-all duration-500 ease-out"

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl font-semibold text-slate-900">Math Racing</CardTitle>
          <Badge variant="outline" className={statusBadge.variant}>
            {statusBadge.label}
          </Badge>
        </div>
        <CardDescription className="text-slate-600">
          Solve equations to rocket your car down the neon track. Each correct answer pushes your racer forward, while
          mistakes slow you down. Keep your streak alive to unlock turbo boosts and cross the finish line first!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-3xl border-4 border-slate-900 bg-slate-950 p-4 text-slate-100 shadow-2xl">
              <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                <div className="absolute inset-0 flex flex-col justify-between py-6">
                  <div className="h-0.5 w-full bg-white/10" />
                  <div className="h-0.5 w-full bg-white/10" />
                </div>
                <div
                  className="absolute inset-y-3 right-3 w-8 rounded-2xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255,255,255,0.85) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.85) 75%, transparent 75%, transparent)",
                    backgroundSize: "16px 16px",
                  }}
                />
                <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <span>Start</span>
                  <span>Finish</span>
                </div>
                <div
                  className={cn(carBaseClass, "top-[34%]")}
                  style={{ left: trackPosition(playerProgress) }}
                >
                  <div className="relative h-12 w-20 rounded-[18px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-[0_16px_30px_-18px_rgba(16,185,129,0.95)]">
                    <div className="absolute -left-9 top-1/2 h-2 w-9 -translate-y-1/2 rounded-full bg-emerald-300/40 blur-sm" />
                    <div className="absolute left-3 top-2 h-3 w-6 rounded-md bg-emerald-100/90" />
                    <div className="absolute right-3 top-2 h-3 w-6 rounded-md bg-emerald-50/80" />
                    <div className="absolute left-3 bottom-1 h-3 w-3 rounded-full bg-slate-900" />
                    <div className="absolute right-3 bottom-1 h-3 w-3 rounded-full bg-slate-900" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-100">You</span>
                </div>
                <div
                  className={cn(carBaseClass, "top-[72%]")}
                  style={{ left: trackPosition(rivalProgress) }}
                >
                  <div className="relative h-12 w-20 rounded-[18px] bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 shadow-[0_16px_30px_-18px_rgba(244,63,94,0.95)]">
                    <div className="absolute -left-9 top-1/2 h-2 w-9 -translate-y-1/2 rounded-full bg-rose-300/40 blur-sm" />
                    <div className="absolute left-3 top-2 h-3 w-6 rounded-md bg-rose-100/90" />
                    <div className="absolute right-3 top-2 h-3 w-6 rounded-md bg-rose-50/80" />
                    <div className="absolute left-3 bottom-1 h-3 w-3 rounded-full bg-slate-900" />
                    <div className="absolute right-3 bottom-1 h-3 w-3 rounded-full bg-slate-900" />
                  </div>
                  <span className="text-xs font-semibold text-rose-100">Rival</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/80 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Lap streak</p>
                  <p className="text-lg font-semibold text-emerald-200">{streak}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Boost record</p>
                  <p className="text-lg font-semibold text-amber-200">{bestBoost ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Penalty laps</p>
                  <p className="text-lg font-semibold text-rose-200">{penalties}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Your vehicle</span>
                <span className="text-slate-500">{Math.round(playerProgress)}% race complete</span>
              </div>
              <Progress value={playerProgress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Distance: {raceDistance}m</span>
                <span>Streak: {streak}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Rival racer</span>
                <span className="text-slate-500">{Math.round(rivalProgress)}%</span>
              </div>
              <Progress value={rivalProgress} className="h-2 bg-slate-200" />
              <p className="text-xs text-slate-500">Keep your lead by staying accurate and speedy.</p>
            </div>

            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-700">
              <p>
                Tip: Answer in under 3 seconds to earn the biggest boost. Each correct streak adds +4 extra progress to
                the next answer!
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">Solve to accelerate</h3>
                <p className="text-sm text-slate-500">Solve as many as you can before the rival crosses the finish line.</p>
              </div>
              <Badge variant="outline" className={cn("text-xs", difficultyStyles[question.difficulty])}>
                {difficultyLabels[question.difficulty]}
              </Badge>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-900/90 p-4 text-white shadow-inner">
                <span className="text-sm uppercase tracking-wide text-slate-300">Current problem</span>
                <span className="text-3xl font-bold">{question.prompt}</span>
              </div>
              <Input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer"
                inputMode="numeric"
                disabled={!raceActive}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!raceActive}>
                  Boost forward
                </Button>
                <Button type="button" variant="outline" onClick={() => startRace()}>
                  {raceActive ? "Restart race" : "Start engines"}
                </Button>
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                  Penalties: {penalties}
                </Badge>
                {bestBoost !== null && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Best boost: +{bestBoost}
                  </Badge>
                )}
              </div>
            </form>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Race events</h4>
            {raceLog.length === 0 ? (
              <p className="text-sm text-slate-500">Your race log is empty. Start the engines to generate highlights!</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600">
                {raceLog.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm text-sm text-slate-600">
            <h4 className="text-sm font-semibold text-slate-700">Race stats</h4>
            <div className="flex items-center justify-between">
              <span>Correct boosts</span>
              <span>{roundsCompleted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Current streak</span>
              <span>{streak}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Penalty laps</span>
              <span>{penalties}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Race status</span>
              <span>{raceActive ? "Racing" : "Pit stop"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
