"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

import { Sparkles, Zap, Rocket, RotateCcw } from "lucide-react"

type Word = {
  id: string
  text: string
  x: number
  y: number
  progress: number
}

const WORD_BANK: string[][] = [
  ["sun", "tree", "code", "wave", "beam", "zen", "loop", "dash", "vim", "nova", "math", "arc"],
  ["planet", "orbit", "launch", "silver", "glitch", "bright", "vector", "buffer", "galaxy", "neon"],
  ["velocity", "asteroid", "quantum", "generate", "spectrum", "reactive", "synergy", "luminous", "momentum"],
  ["hyperdrive", "constellation", "telemetry", "microburst", "starfinder", "ionthrust", "laserfield", "datastream"],
]

const INITIAL_LIVES = 5

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)

const chooseWord = (level: number) => {
  const poolIndex = Math.min(WORD_BANK.length - 1, Math.floor(level / 2))
  const pool = WORD_BANK[poolIndex]
  return pool[Math.floor(Math.random() * pool.length)]
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getBrowserWindow = (): Window | undefined => {
  if (typeof globalThis === "undefined") {
    return undefined
  }

  const maybeWindow = globalThis as Window | undefined
  return typeof maybeWindow?.addEventListener === "function" ? maybeWindow : undefined
}

export default function TypingBlaster() {
  const [words, setWords] = useState<Word[]>([])
  const wordsRef = useRef<Word[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const isRunningRef = useRef(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [activeWordId, setActiveWordId] = useState<string | null>(null)
  const activeWordRef = useRef<string | null>(null)
  const [typedBuffer, setTypedBuffer] = useState("")
  const typedBufferRef = useRef("")

  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const [combo, setCombo] = useState(0)
  const comboRef = useRef(0)
  const [level, setLevel] = useState(1)
  const levelRef = useRef(1)
  const [lives, setLives] = useState(INITIAL_LIVES)
  const livesRef = useRef(INITIAL_LIVES)
  const [hits, setHits] = useState(0)
  const hitsRef = useRef(0)
  const [misses, setMisses] = useState(0)
  const missesRef = useRef(0)
  const [recentBurst, setRecentBurst] = useState<string | null>(null)

  const updateWordsRef = useCallback((value: Word[]) => {
    wordsRef.current = value
    setWords(value)
  }, [])

  const updateTypedBuffer = useCallback((value: string) => {
    typedBufferRef.current = value
    setTypedBuffer(value)
  }, [])

  const updateActiveWord = useCallback((value: string | null) => {
    activeWordRef.current = value
    setActiveWordId(value)
  }, [])

  const updateScore = useCallback((value: number) => {
    scoreRef.current = value
    setScore(value)
  }, [])

  const addScore = useCallback((delta: number) => {
    updateScore(scoreRef.current + delta)
  }, [updateScore])

  const updateCombo = useCallback((value: number) => {
    comboRef.current = value
    setCombo(value)
  }, [])

  const updateLevel = useCallback((value: number) => {
    const nextLevel = clamp(value, 1, 12)
    levelRef.current = nextLevel
    setLevel(nextLevel)
  }, [])

  const updateLives = useCallback((value: number) => {
    livesRef.current = value
    setLives(value)
  }, [])

  const addHit = useCallback(() => {
    const nextHits = hitsRef.current + 1
    hitsRef.current = nextHits
    setHits(nextHits)
  }, [])

  const addMiss = useCallback(() => {
    const nextMisses = missesRef.current + 1
    missesRef.current = nextMisses
    setMisses(nextMisses)
  }, [])

  const accuracy = useMemo(() => {
    const total = hits + misses
    if (total === 0) return 100
    return Math.round((hits / total) * 100)
  }, [hits, misses])

  const launchWord = useCallback(() => {
    const newWord: Word = {
      id: randomId(),
      text: chooseWord(levelRef.current),
      x: Math.random() * 72 + 8,
      y: 0,
      progress: 0,
    }
    updateWordsRef([...wordsRef.current, newWord])
  }, [updateWordsRef])

  const resetGame = useCallback(() => {
    updateWordsRef([])
    updateTypedBuffer("")
    updateActiveWord(null)
    updateScore(0)
    updateCombo(0)
    updateLevel(1)
    updateLives(INITIAL_LIVES)
    hitsRef.current = 0
    setHits(0)
    missesRef.current = 0
    setMisses(0)
    setRecentBurst(null)
    setIsGameOver(false)
  }, [updateActiveWord, updateCombo, updateLevel, updateLives, updateScore, updateTypedBuffer, updateWordsRef])

  const endGame = useCallback(() => {
    setIsRunning(false)
    isRunningRef.current = false
    setIsGameOver(true)
    updateActiveWord(null)
    updateTypedBuffer("")
  }, [updateActiveWord, updateTypedBuffer])

  const boostLevelIfNeeded = useCallback(() => {
    const calculatedLevel = 1 + Math.floor(scoreRef.current / 120)
    if (calculatedLevel !== levelRef.current) {
      updateLevel(calculatedLevel)
    }
  }, [updateLevel])

  const handleWordDestroyed = useCallback(
    (word: Word) => {
      addHit()
      const bonus = 12 + comboRef.current * 4 + word.text.length * 2
      addScore(bonus)
      updateCombo(comboRef.current + 1)
      setRecentBurst(`+${bonus}`)
      updateWordsRef(wordsRef.current.filter((existing) => existing.id !== word.id))
      updateTypedBuffer("")
      updateActiveWord(null)
      boostLevelIfNeeded()
    },
    [addHit, addScore, boostLevelIfNeeded, updateActiveWord, updateCombo, updateTypedBuffer, updateWordsRef]
  )

  const handleIncorrectShot = useCallback(() => {
    if (typedBufferRef.current.length === 0) return
    updateTypedBuffer("")
    updateActiveWord(null)
    updateWordsRef(
      wordsRef.current.map((word) => ({
        ...word,
        progress: 0,
      }))
    )
    updateCombo(0)
    addMiss()
    setRecentBurst("Miss!")
  }, [addMiss, updateActiveWord, updateCombo, updateTypedBuffer, updateWordsRef])

  const damagePlayer = useCallback(() => {
    const remaining = livesRef.current - 1
    updateLives(Math.max(remaining, 0))
    updateCombo(0)
    updateActiveWord(null)
    updateTypedBuffer("")
    if (remaining <= 0) {
      endGame()
    }
  }, [endGame, updateActiveWord, updateCombo, updateLives, updateTypedBuffer])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isRunningRef.current) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Backspace") {
        event.preventDefault()
        if (typedBufferRef.current.length === 0) return
        const nextBuffer = typedBufferRef.current.slice(0, -1)
        updateTypedBuffer(nextBuffer)
        updateWordsRef(
          wordsRef.current.map((word) => ({
            ...word,
            progress: word.id === activeWordRef.current ? Math.min(word.text.length, nextBuffer.length) : 0,
          }))
        )
        return
      }

      if (!/^[a-zA-Z]$/.test(event.key)) {
        return
      }

      const letter = event.key.toLowerCase()
      const buffer = typedBufferRef.current + letter
      const availableWords = wordsRef.current
      let activeWord = activeWordRef.current
        ? availableWords.find((word) => word.id === activeWordRef.current)
        : null

      const matchingWords = availableWords.filter((word) => word.text.startsWith(buffer))

      if (matchingWords.length === 0) {
        handleIncorrectShot()
        return
      }

      if (!activeWord || !activeWord.text.startsWith(buffer)) {
        activeWord = matchingWords.reduce((closest, candidate) => (candidate.y > closest.y ? candidate : closest), matchingWords[0])
        updateActiveWord(activeWord.id)
      }

      updateTypedBuffer(buffer)
      updateWordsRef(
        availableWords.map((word) => ({
          ...word,
          progress: word.id === activeWord!.id ? buffer.length : 0,
        }))
      )

      if (buffer === activeWord.text) {
        handleWordDestroyed(activeWord)
      }
    },
    [handleIncorrectShot, handleWordDestroyed, updateActiveWord, updateTypedBuffer, updateWordsRef]
  )

  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  useEffect(() => {
    const browserWindow = getBrowserWindow()
    if (!browserWindow) return
    const onKeyDown = (event: KeyboardEvent) => handleKeyDown(event)
    browserWindow.addEventListener("keydown", onKeyDown)
    return () => browserWindow.removeEventListener("keydown", onKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (!recentBurst) return
    const timeout = setTimeout(() => setRecentBurst(null), 900)
    return () => clearTimeout(timeout)
  }, [recentBurst])

  useEffect(() => {
    if (!isRunning) return
    const spawnRate = clamp(2400 - levelRef.current * 180 - comboRef.current * 40, 900, 2400)
    const spawnInterval = setInterval(() => {
      launchWord()
    }, spawnRate)

    return () => clearInterval(spawnInterval)
  }, [isRunning, launchWord, level, combo])

  useEffect(() => {
    if (!isRunning) return
    const tickInterval = setInterval(() => {
      const drift = 0.35 + levelRef.current * 0.12 + comboRef.current * 0.05
      const nextWords: Word[] = []
      let playerDamaged = false

      for (const word of wordsRef.current) {
        const nextY = word.y + drift
        if (nextY >= 100) {
          playerDamaged = true
        } else {
          nextWords.push({ ...word, y: nextY })
        }
      }

      if (playerDamaged) {
        damagePlayer()
      }

      updateWordsRef(nextWords)
    }, 140)

    return () => clearInterval(tickInterval)
  }, [damagePlayer, isRunning, updateWordsRef])

  useEffect(() => {
    if (!isRunning) return
    if (wordsRef.current.length === 0) {
      launchWord()
    }
  }, [isRunning, launchWord, words])

  const startGame = useCallback(() => {
    resetGame()
    setIsRunning(true)
    isRunningRef.current = true
    launchWord()
  }, [launchWord, resetGame])

  const resumeGame = useCallback(() => {
    setIsRunning(true)
    isRunningRef.current = true
  }, [])

  const pauseGame = useCallback(() => {
    setIsRunning(false)
    isRunningRef.current = false
  }, [])

  useEffect(() => {
    if (!isRunning) {
      updateWordsRef(
        wordsRef.current.map((word) => ({
          ...word,
          progress: 0,
        }))
      )
    }
  }, [isRunning, updateWordsRef])

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-slate-50 shadow-xl">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
            <Rocket className="h-6 w-6 text-emerald-300" />
            Typing Galaxy Patrol
          </CardTitle>
          <Badge variant="secondary" className="bg-emerald-400/20 text-emerald-200">
            <Sparkles className="mr-1 h-4 w-4" /> Aim, type, triumph
          </Badge>
        </div>
        <CardDescription className="text-sm text-slate-300">
          Blast incoming word comets by typing them before they hit your shield. Build streaks to raise your combo and push
          the wave speed just like the classic zType experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 shadow-inner sm:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Score</p>
            <p className="text-3xl font-semibold text-emerald-300">{score}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Combo</p>
            <p className="text-3xl font-semibold text-cyan-300">x{combo}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Accuracy</p>
            <div className="flex items-center gap-2">
              <Progress value={accuracy} className="h-2 w-full bg-slate-800" />
              <span className="text-lg font-medium text-indigo-200">{accuracy}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Shield Integrity</p>
            <div className="flex items-center gap-2">
              <Progress value={(lives / INITIAL_LIVES) * 100} className="h-2 w-full bg-slate-800" />
              <span className="text-lg font-medium text-rose-200">{lives}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 text-xs text-slate-300 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-300" />
            <span>Keep typing letters to focus on the closest matching word comet.</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <span>Clear words quickly to increase combo streaks and raise the challenge level.</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-sky-300" />
            <span>Missed shots reset your combo. Steady aim keeps your score soaring.</span>
          </div>
        </section>

        <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-950/60 p-6">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-indigo-500/20 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-rose-500/20 via-transparent to-transparent" />
          <div className="relative z-10 h-[360px]">
            {words.map((word) => {
              const isActive = word.id === activeWordId
              const matched = word.progress
              return (
                <div
                  key={word.id}
                  className={cn(
                    "absolute -translate-x-1/2 rounded-full border px-4 py-2 font-mono text-base tracking-wide shadow-lg transition-transform duration-300",
                    isActive
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700/60 bg-slate-900/70 text-slate-200"
                  )}
                  style={{ left: `${word.x}%`, top: `${word.y}%` }}
                >
                  <span className="text-emerald-200">{word.text.slice(0, matched)}</span>
                  <span className="text-slate-400">{word.text.slice(matched)}</span>
                </div>
              )
            })}

            {recentBurst && (
              <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-4 py-1 text-sm text-emerald-100 transition-all">
                {recentBurst}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3">
              <div className="rounded-full border border-slate-700/60 bg-slate-900/80 px-6 py-2 font-mono text-lg tracking-widest text-slate-200">
                {typedBuffer || "TYPE TO TARGET"}
              </div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Level {level}</div>
            </div>

            {!isRunning && !isGameOver && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/70">
                <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Paused</p>
                <Button onClick={resumeGame} className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
                  Resume Patrol
                </Button>
              </div>
            )}

            {isGameOver && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/80 text-center">
                <p className="text-xs uppercase tracking-[0.5em] text-rose-400">Shield Down</p>
                <p className="text-3xl font-semibold text-slate-100">Mission Over</p>
                <div className="text-sm text-slate-300">
                  <p>Score: {score}</p>
                  <p>Accuracy: {accuracy}%</p>
                  <p>Highest Combo: x{combo}</p>
                </div>
                <Button onClick={startGame} className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
                  Restart Mission
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Level {level}</div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={isRunning ? pauseGame : resumeGame}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700"
            >
              {isRunning ? "Pause" : "Resume"}
            </Button>
            <Button onClick={startGame} className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
              {isRunning || isGameOver ? "Restart" : "Begin Mission"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
