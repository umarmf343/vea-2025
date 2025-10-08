"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type RaceLevel = 1 | 2 | 3 | 4 | 5

type Operation = "×" | "+" | "−" | "÷"

interface MathQuestion {
  prompt: string
  answer: number
  level: RaceLevel
  operation: Operation
}

interface RaceLogEntry {
  id: string
  message: string
}

const MAX_LEVEL: RaceLevel = 5

const levelStyles: Record<RaceLevel, string> = {
  1: "border-emerald-200 bg-emerald-50 text-emerald-700",
  2: "border-amber-200 bg-amber-50 text-amber-700",
  3: "border-sky-200 bg-sky-50 text-sky-700",
  4: "border-indigo-200 bg-indigo-50 text-indigo-700",
  5: "border-purple-200 bg-purple-50 text-purple-700",
}

const levelLabels: Record<RaceLevel, string> = {
  1: "Rolling start",
  2: "Turbo turns",
  3: "Lightning loop",
  4: "Hyper sprint",
  5: "Galaxy circuit",
}

const levelSettings: Record<
  RaceLevel,
  {
    range: [number, number]
    operations: Operation[]
    rivalSpeed: number
    description: string
  }
> = {
  1: { range: [1, 9], operations: ["+", "−"], rivalSpeed: 4.2, description: "Single-digit addition and subtraction." },
  2: {
    range: [2, 12],
    operations: ["+", "−", "×"],
    rivalSpeed: 4.8,
    description: "Add small multiplication to keep you on your toes.",
  },
  3: {
    range: [3, 15],
    operations: ["+", "−", "×", "÷"],
    rivalSpeed: 5.4,
    description: "Mixed operations with mid-sized numbers.",
  },
  4: {
    range: [4, 20],
    operations: ["+", "−", "×", "÷"],
    rivalSpeed: 6,
    description: "Bigger values and quicker rivals.",
  },
  5: {
    range: [6, 25],
    operations: ["+", "−", "×", "÷"],
    rivalSpeed: 6.7,
    description: "Final circuit with demanding division laps.",
  },
}

const defaultQuestion: MathQuestion = {
  prompt: "0 + 0",
  answer: 0,
  level: 1,
  operation: "+",
}

const createQuestion = (level: RaceLevel): MathQuestion => {
  const { range, operations } = levelSettings[level]
  const [min, max] = range
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
    level,
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
  const [question, setQuestion] = useState<MathQuestion>(defaultQuestion)
  const [answer, setAnswer] = useState("")
  const [raceLog, setRaceLog] = useState<RaceLogEntry[]>([])
  const [roundsCompleted, setRoundsCompleted] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestBoost, setBestBoost] = useState<number | null>(null)
  const [penalties, setPenalties] = useState(0)
  const [raceOutcome, setRaceOutcome] = useState<"win" | "loss" | null>(null)
  const [outcomeMessage, setOutcomeMessage] = useState("")
  const [level, setLevel] = useState<RaceLevel>(1)
  const [wins, setWins] = useState(0)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [bestLevel, setBestLevel] = useState<RaceLevel>(1)

  const rivalIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const questionStartRef = useRef<number | null>(null)
  const lastOutcomeSessionRef = useRef<number | null>(null)

  const raceDistance = useMemo(
    () => Math.round((playerProgress / 100) * (400 + (level - 1) * 60)),
    [playerProgress, level],
  )

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
    setRaceOutcome(null)
    setOutcomeMessage("")
    const initialQuestion = createQuestion(level)
    setQuestion(initialQuestion)
    setAnswer("")
    questionStartRef.current = Date.now()
    lastOutcomeSessionRef.current = null
  }, [level])

  const stopRace = useCallback(
    (message: string, outcome: "win" | "loss" | null = null) => {
      setRaceActive(false)
      setRaceLog((previous) => [{ id: `${Date.now()}`, message }, ...previous].slice(0, 6))
      setRaceOutcome(outcome)
      setOutcomeMessage(message)
      if (rivalIntervalRef.current) {
        clearInterval(rivalIntervalRef.current)
        rivalIntervalRef.current = null
      }
      questionStartRef.current = null
    },
    [],
  )

  const handleStopRace = useCallback(() => {
    if (raceActive) {
      stopRace("⛔ Race halted. Ready when you are!")
    }
  }, [raceActive, stopRace])

  useEffect(() => {
    setQuestion(createQuestion(level))
  }, [level])

  useEffect(() => {
    if (!raceActive) {
      return
    }

    questionStartRef.current = Date.now()
    const interval = setInterval(() => {
      setRivalProgress((previous) => {
        const baseIncrement = (3 + Math.random() * 4) / 10
        const speedMultiplier = levelSettings[level].rivalSpeed
        const updated = clampProgress(previous + baseIncrement * speedMultiplier)
        if (updated >= 100) {
          stopRace("🏁 Rival championed the race. Try again!", "loss")
        }
        return updated
      })
    }, 1200)

    rivalIntervalRef.current = interval

    return () => {
      clearInterval(interval)
      rivalIntervalRef.current = null
    }
  }, [level, raceActive, sessionId, stopRace])

  useEffect(() => {
    if (!raceActive) {
      return
    }
    if (playerProgress >= 100) {
      const nextLevel = level >= MAX_LEVEL ? MAX_LEVEL : ((level + 1) as RaceLevel)
      const victoryMessage =
        level >= MAX_LEVEL
          ? "🏆 Final lap mastered! You've conquered the entire circuit."
          : `🏆 Level ${level} cleared! Gear up for Level ${nextLevel}.`
      stopRace(victoryMessage, "win")
    } else if (rivalProgress >= 100) {
      const setbackMessage =
        level > 1
          ? "🏁 Rival caught you! Sliding back to Level 1 to rebuild momentum."
          : "🏁 Rival championed the race. Try again!"
      stopRace(setbackMessage, "loss")
    }
  }, [level, playerProgress, raceActive, rivalProgress, stopRace])

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
      const baseBoost = seconds <= 3 ? 26 : seconds <= 6 ? 18 : 12
      const boost = Math.max(8, baseBoost - (level - 1) * 2)
      const questionPoints = Math.max(20, Math.round(40 - seconds * 4)) * level
      const totalBoost = boost + streak * 4
      const adjustedBoost = Math.max(0, Math.round(totalBoost * 0.97 * 10) / 10)
      const formattedBoost = Number.isInteger(adjustedBoost)
        ? `${adjustedBoost}`
        : adjustedBoost.toFixed(1)
      setPlayerProgress((previous) => clampProgress(previous + adjustedBoost))
      setRaceLog((previous) =>
        [
          {
            id: `${Date.now()}`,
            message: `${speedMessage} +${formattedBoost} progress (+${questionPoints} pts) for solving ${question.prompt}`,
          },
          ...previous,
        ].slice(0, 6),
      )
      setRoundsCompleted((previous) => previous + 1)
      setStreak((previous) => previous + 1)
      setBestBoost((previous) => (previous === null ? adjustedBoost : Math.max(previous, adjustedBoost)))
      setScore((previous) => {
        const updated = previous + questionPoints
        setHighScore((prevHigh) => Math.max(prevHigh, updated))
        return updated
      })
      setQuestion(createQuestion(level))
      setAnswer("")
    } else {
      const penalty = 10 + (level - 1) * 2
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
      setQuestion(createQuestion(level))
      setAnswer("")
    }
  }

  useEffect(() => {
    if (!raceActive) {
      questionStartRef.current = null
    }
  }, [raceActive])

  useEffect(() => {
    if (!raceOutcome) {
      return
    }
    if (lastOutcomeSessionRef.current === sessionId) {
      return
    }
    lastOutcomeSessionRef.current = sessionId

    if (raceOutcome === "win") {
      const levelBonus = 150 + level * 25
      setWins((previous) => previous + 1)
      setScore((previous) => {
        const updated = previous + levelBonus
        setHighScore((prevHigh) => Math.max(prevHigh, updated))
        return updated
      })
      setBestLevel((previous) => {
        if (level >= MAX_LEVEL) {
          return MAX_LEVEL
        }
        const upcoming = ((level + 1) as RaceLevel)
        return upcoming > previous ? upcoming : previous
      })
      setLevel((previous) => (previous >= MAX_LEVEL ? previous : ((previous + 1) as RaceLevel)))
    } else if (raceOutcome === "loss") {
      setWins(0)
      setScore(0)
      setLevel(1)
    }
  }, [level, raceOutcome, sessionId])

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold text-slate-900">Math Racing</CardTitle>
            <Badge variant="outline" className={statusBadge.variant}>
              {statusBadge.label}
            </Badge>
          </div>
          <CardDescription className="text-slate-600">
            Solve equations to rocket your car down the neon track. Each correct answer pushes your racer forward, while
            mistakes slow you down. Keep your streak alive to unlock turbo boosts and cross the finish line first!
          </CardDescription>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <Badge variant="outline" className={cn("text-xs", levelStyles[level])}>
              Level {level}: {levelLabels[level]}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Score: {score}
            </Badge>
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              High score: {highScore}
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Wins: {wins}
            </Badge>
            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
              Best level: {bestLevel}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">{levelSettings[level].description}</p>
        </div>
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
                the next answer! Clear Level {level} to unlock Level {level < MAX_LEVEL ? level + 1 : "5"} bonus points.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">Solve to accelerate</h3>
                <p className="text-sm text-slate-500">Solve as many as you can before the rival crosses the finish line.</p>
              </div>
              <Badge variant="outline" className={cn("text-xs", levelStyles[question.level])}>
                Level {question.level}: {levelLabels[question.level]}
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
                <Button type="button" variant="destructive" onClick={handleStopRace} disabled={!raceActive}>
                  Stop race
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
              <span>Level progress</span>
              <span>
                Lv. {level} / {MAX_LEVEL}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Wins this run</span>
              <span>{wins}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Score</span>
              <span>{score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>High score</span>
              <span>{highScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Best level reached</span>
              <span>{bestLevel}</span>
            </div>
            <Separator />
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
              <span>{raceActive ? `Racing Level ${level}` : "Pit stop"}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <Dialog
        open={raceOutcome !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRaceOutcome(null)
          }
        }}
      >
        <DialogContent
          className={cn(
            "text-center",
            raceOutcome === "win" ? "border-emerald-200" : raceOutcome === "loss" ? "border-rose-200" : "border-slate-200",
          )}
        >
          <DialogHeader className="space-y-3 text-center">
            <DialogTitle className="text-3xl font-bold">
              {raceOutcome === "win"
                ? "🏆 Grand Prix Champion!"
                : raceOutcome === "loss"
                  ? "💀 Catastrophic Crash!"
                  : ""}
            </DialogTitle>
          <DialogDescription className="text-base">
            {raceOutcome === "win"
              ? "You blitzed past the finish line like a legend. Bask in the confetti and queue up the next victory lap!"
              : raceOutcome === "loss"
                ? "That was a face-plant into the guardrail. Shake off the slime, wipe off the tears, and fire those engines again!"
                : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-600">{outcomeMessage}</p>
        <p className="text-xs text-slate-500">
          Score: {score} • High score: {highScore} • Best level: {bestLevel}
        </p>
        <DialogFooter className="mt-4 flex justify-center gap-3 sm:justify-center">
          <Button
            onClick={() => {
              setRaceOutcome(null)
              startRace()
            }}
          >
            {raceOutcome === "win"
              ? `Start Level ${level}`
              : raceOutcome === "loss"
                ? "Redeem yourself"
                : "Start a new race"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
