"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface WordState {
  id: number
  text: string
  progress: number
  x: number
  y: number
  speed: number
  selected: boolean
  destroyed?: boolean
  explosionTime?: number
}

interface ProjectileState {
  id: number
  x1: number
  y1: number
  targetX: number
  targetY: number
  progress: number
}

const WORD_BANK = [
  "orbit",
  "galaxy",
  "comet",
  "neon",
  "syntax",
  "rocket",
  "asteroid",
  "vector",
  "photon",
  "impact",
  "launch",
  "binary",
  "nebula",
  "fusion",
  "quantum",
  "lunar",
  "stellar",
  "signal",
  "spectrum",
  "matrix",
  "velocity",
  "gravity",
  "meteor",
  "ion",
  "aster",
  "glyph",
  "cosmic",
  "ignite",
  "thruster",
  "horizon",
  "script",
  "syntax",
  "planet",
  "energy",
  "cypher",
  "aurora",
  "signal",
  "tunnel",
  "flash",
  "orbit",
  "plasma",
  "zenith",
  "vector",
]

const getRandomWord = (() => {
  let cache = [...WORD_BANK]
  return () => {
    if (cache.length === 0) {
      cache = [...WORD_BANK]
    }
    const index = Math.floor(Math.random() * cache.length)
    const [word] = cache.splice(index, 1)
    return word
  }
})()

const BASE_POSITION = { x: 50, y: 88 }

export default function TypingGalaxy() {
  const [gameState, setGameState] = useState<"idle" | "playing" | "paused" | "ended">("idle")
  const [score, setScore] = useState(0)
  const [combo, _setCombo] = useState(0)
  const comboRef = useRef(0)
  const setCombo = useCallback(
    (value: number | ((prev: number) => number)) => {
      _setCombo(prev => {
        const nextValue = typeof value === "function" ? value(prev) : value
        comboRef.current = nextValue
        return nextValue
      })
    },
    [_setCombo],
  )
  const [level, setLevel] = useState(1)
  const [lives, _setLives] = useState(3)
  const livesRef = useRef(3)
  const setLives = useCallback(
    (value: number | ((prev: number) => number)) => {
      _setLives(prev => {
        const nextValue = typeof value === "function" ? value(prev) : value
        livesRef.current = nextValue
        return nextValue
      })
    },
    [_setLives],
  )
  const [words, _setWords] = useState<WordState[]>([])
  const wordsRef = useRef<WordState[]>([])
  const setWordsState = useCallback(
    (value: WordState[] | ((prev: WordState[]) => WordState[])) => {
      _setWords(prev => {
        const nextValue = typeof value === "function" ? value(prev) : value
        wordsRef.current = nextValue
        return nextValue
      })
    },
    [_setWords],
  )
  const [projectiles, _setProjectiles] = useState<ProjectileState[]>([])
  const projectilesRef = useRef<ProjectileState[]>([])
  const setProjectilesState = useCallback(
    (value: ProjectileState[] | ((prev: ProjectileState[]) => ProjectileState[])) => {
      _setProjectiles(prev => {
        const nextValue = typeof value === "function" ? value(prev) : value
        projectilesRef.current = nextValue
        return nextValue
      })
    },
    [_setProjectiles],
  )
  const animationRef = useRef<number>()
  const projectileIdRef = useRef(0)
  const wordIdRef = useRef(0)

  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    projectilesRef.current = projectiles
  }, [projectiles])

  const resetGame = useCallback(() => {
    setScore(0)
    setCombo(0)
    setLevel(1)
    setLives(3)
    setWordsState([])
    setProjectilesState([])
    wordIdRef.current = 0
    projectileIdRef.current = 0
  }, [setCombo, setLives, setProjectilesState, setWordsState])

  const spawnWord = useCallback(() => {
    const text = getRandomWord()
    const speed = 0.035 + Math.random() * 0.03 + level * 0.005
    const x = 12 + Math.random() * 76
    const newWord: WordState = {
      id: wordIdRef.current++,
      text,
      progress: 0,
      x,
      y: -5,
      speed,
      selected: false,
    }
    setWordsState(prev => [...prev, newWord])
  }, [level, setWordsState])

  const advanceProjectiles = useCallback(
    (delta: number) => {
      setProjectilesState(prev =>
        prev
          .map(projectile => ({ ...projectile, progress: projectile.progress + delta / 320 }))
          .filter(projectile => projectile.progress < 1.1),
      )
    },
    [setProjectilesState],
  )

  const advanceWords = useCallback(
    (delta: number) => {
      let lostLives = 0
      const nextWords: WordState[] = []
      const speedBoost = 1 + level * 0.08

      for (const word of wordsRef.current) {
        if (word.destroyed) {
          const explosionTime = (word.explosionTime ?? 0) + delta
          if (explosionTime < 420) {
            nextWords.push({ ...word, explosionTime })
          }
          continue
        }

        const newY = word.y + (delta * word.speed * speedBoost) / 16
        if (newY >= 92) {
          lostLives += 1
        } else {
          nextWords.push({ ...word, y: newY })
        }
      }

      if (lostLives > 0) {
        setLives(prev => Math.max(0, prev - lostLives))
        setCombo(0)
      }

      setWordsState(nextWords)
    },
    [level, setCombo, setLives, setWordsState],
  )

  useEffect(() => {
    if (gameState !== "playing") {
      return
    }

    let lastTime = performance.now()
    let spawnTimer = 0

    const frame = (time: number) => {
      const delta = time - lastTime
      lastTime = time
      spawnTimer += delta

      advanceWords(delta)
      advanceProjectiles(delta)

      const spawnDelay = Math.max(600, 2200 - level * 120)
      if (spawnTimer >= spawnDelay) {
        spawnTimer = 0
        spawnWord()
      }

      if (livesRef.current <= 0) {
        setGameState("ended")
        return
      }

      animationRef.current = requestAnimationFrame(frame)
    }

    animationRef.current = requestAnimationFrame(frame)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [advanceProjectiles, advanceWords, gameState, level, spawnWord])

  useEffect(() => {
    setLevel(Math.min(10, 1 + Math.floor(score / 250)))
  }, [score])

  useEffect(() => {
    if (gameState !== "playing") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      if (!/^[a-z]$/.test(key)) {
        return
      }

      event.preventDefault()

      let letterMatched = false
      let destroyedWord = false
      let hitCoordinates: { x: number; y: number } | null = null
      let miss = false

      setWordsState(prev => {
        const next = prev.map(word => ({ ...word }))
        const activeWords = next.filter(word => !word.destroyed)
        if (activeWords.length === 0) {
          miss = true
          return next
        }

        let targetIndex = next.findIndex(word => word.selected && !word.destroyed)

        const assignTarget = (index: number) => {
          targetIndex = index
        }

        if (targetIndex === -1) {
          const candidates = activeWords
            .map(word => ({ word, index: next.findIndex(item => item.id === word.id) }))
            .filter(candidate => candidate.word.text[candidate.word.progress].toLowerCase() === key)
            .sort((a, b) => b.word.y - a.word.y)
          if (candidates.length > 0) {
            assignTarget(candidates[0].index)
          } else {
            miss = true
            return next
          }
        }

        const target = next[targetIndex]
        const expected = target.text[target.progress].toLowerCase()

        if (expected === key) {
          target.progress += 1
          target.selected = target.progress < target.text.length
          letterMatched = true
          hitCoordinates = { x: target.x, y: target.y }
          if (target.progress >= target.text.length) {
            target.destroyed = true
            target.selected = false
            target.explosionTime = 0
            destroyedWord = true
          }
        } else {
          target.selected = false
          target.progress = 0
          miss = true
        }

        return next
      })

      if (letterMatched && hitCoordinates) {
        const projectile: ProjectileState = {
          id: projectileIdRef.current++,
          x1: BASE_POSITION.x,
          y1: BASE_POSITION.y,
          targetX: hitCoordinates.x,
          targetY: hitCoordinates.y,
          progress: 0,
        }
        setProjectilesState(prev => [...prev, projectile])
        const comboBefore = comboRef.current
        setScore(prev => prev + 12 + comboBefore * 2)
        setCombo(comboBefore + 1)
        if (destroyedWord) {
          setScore(prev => prev + 45 + comboBefore * 3)
        }
      }

      if (miss) {
        setCombo(0)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [gameState, setCombo, setProjectilesState, setScore, setWordsState])

  useEffect(() => {
    if (gameState === "ended") {
      setProjectilesState([])
      setWordsState(prev => prev.map(word => ({ ...word, selected: false })))
    }
  }, [gameState, setProjectilesState, setWordsState])

  const startGame = useCallback(() => {
    resetGame()
    setGameState("playing")
    spawnWord()
  }, [resetGame, spawnWord])

  const pauseGame = useCallback(() => {
    setGameState(state => (state === "playing" ? "paused" : state))
  }, [])

  const resumeGame = useCallback(() => {
    if (gameState === "paused") {
      setGameState("playing")
    }
  }, [gameState])

  const stats = useMemo(
    () => [
      { label: "Score", value: score.toString() },
      { label: "Combo", value: `x${combo}` },
      { label: "Level", value: level.toString() },
      { label: "Lives", value: "❤️".repeat(lives).padEnd(3, "○") },
    ],
    [combo, level, lives, score],
  )

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <CardHeader className="space-y-3">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-emerald-200">Typing Galaxy: Meteor Defense</CardTitle>
            <CardDescription className="text-slate-300">
              Hold the line by typing each incoming code comet before it reaches your command ship. Every perfect streak
              powers up your laser volley!
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {gameState !== "playing" && (
              <Button onClick={startGame} className="bg-emerald-400 text-slate-900 hover:bg-emerald-300">
                {gameState === "ended" ? "Restart Mission" : "Launch Mission"}
              </Button>
            )}
            {gameState === "playing" && (
              <Button onClick={pauseGame} variant="outline" className="border-emerald-300 text-emerald-200">
                Pause
              </Button>
            )}
            {gameState === "paused" && (
              <Button onClick={resumeGame} className="bg-emerald-400 text-slate-900 hover:bg-emerald-300">
                Resume
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm md:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
              <p className="text-emerald-300/80">{stat.label}</p>
              <p className="text-lg font-semibold tracking-wide text-emerald-100">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_55%),radial-gradient(circle_at_top,_rgba(94,234,212,0.08),_transparent_60%)] p-6 shadow-inner">
          <div className="relative h-[440px] overflow-hidden rounded-3xl border border-slate-700/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_65%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%27240%27 height=%27240%27 viewBox=%270 0 120 120%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27none%27 fill-opacity=%270.1%27 stroke=%27%2344d7b6%27 stroke-width=%270.5%27%3E%3Cpath d=%27M0 60h120M60 0v120%27/%3E%3C/g%3E%3C/svg%3E')] opacity-20" />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-10">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="absolute inset-4 rounded-full border border-emerald-400/40" />
                <div className="absolute inset-2 rounded-full border border-emerald-500/60" />
                <div className="absolute inset-6 rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_0_25px_rgba(16,185,129,0.65)]" />
              </div>
            </div>

            {words.map(word => {
              const top = `calc(${word.y}% - 18px)`
              const left = `calc(${word.x}% - 40px)`
              const wordText = word.text.split("")
              return (
                <div key={word.id} className="absolute flex flex-col items-center gap-2" style={{ top, left }}>
                  {!word.destroyed && (
                    <div className="h-16 w-[2px] bg-gradient-to-b from-emerald-400/60 to-transparent" />
                  )}
                  <div
                    className={`relative rounded-full border px-4 py-2 text-base font-semibold uppercase tracking-[0.3em] shadow-lg transition-transform duration-150 ${
                      word.destroyed
                        ? "border-emerald-200/10 bg-emerald-200/10 text-emerald-200"
                        : word.selected
                          ? "border-emerald-300 bg-emerald-500/20 text-emerald-100"
                          : "border-slate-600 bg-slate-800/80 text-slate-200"
                    }`}
                  >
                    <span className="flex gap-[0.1em]">
                      {wordText.map((letter, index) => (
                        <span
                          key={index}
                          className={`${index < word.progress ? "text-emerald-200" : "opacity-80"}`}
                        >
                          {letter}
                        </span>
                      ))}
                    </span>
                    {word.selected && !word.destroyed && (
                      <span className="absolute -bottom-5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                    )}
                  </div>
                  {word.destroyed && (
                    <div className="absolute -inset-4 animate-ping rounded-full bg-emerald-400/40" />
                  )}
                </div>
              )
            })}

            {projectiles.map(projectile => {
              const x = projectile.x1 + (projectile.targetX - projectile.x1) * projectile.progress
              const y = projectile.y1 + (projectile.targetY - projectile.y1) * projectile.progress
              return (
                <div
                  key={projectile.id}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              )
            })}

            {gameState !== "playing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/70 text-center backdrop-blur-sm">
                <h3 className="text-3xl font-bold text-emerald-200">
                  {gameState === "idle" && "Click Launch to Start"}
                  {gameState === "paused" && "Mission Paused"}
                  {gameState === "ended" && "Command Ship Overrun"}
                </h3>
                <p className="max-w-md text-sm text-slate-300">
                  Type the highlighted letters to fire. Completing a word detonates the meteor instantly and boosts your
                  combo. Missed letters reset your streak, and letting a comet through will cost a life.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
                    <span className="font-semibold text-emerald-100">Tip:</span> Click anywhere and start typing to lock onto a
                    comet.
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
                    Chain hits to amplify your laser score multiplier.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
