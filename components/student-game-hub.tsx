"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Calculator,
  Brain,
  Timer,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Trophy,
  Volume2,
  PlayCircle,
  PauseCircle,
  Play,
  StopCircle,
  RefreshCcw,
  PartyPopper,
  Frown,
  RotateCcw,
  Undo2,
} from "lucide-react"

interface MathProblem {
  prompt: string
  answer: number
  options: number[]
  difficulty: "easy" | "medium" | "hard"
}

interface SpellingWord {
  word: string
  definition: string
  example: string
}

interface SentenceRound {
  id: string
  sentence: string
  hint: string
  difficulty: "easy" | "medium" | "hard"
}

const MATH_ROUND_SIZE = 8
const MATH_TIME_PER_QUESTION = 45
const SPELLING_ROUND_SIZE = 10
const SENTENCE_ROUND_SIZE = 6

const mathDifficultyStyles: Record<MathProblem["difficulty"], string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  hard: "border-purple-200 bg-purple-50 text-purple-700",
}

const mathDifficultyLabels: Record<MathProblem["difficulty"], string> = {
  easy: "Warm-up",
  medium: "Brain boost",
  hard: "Genius mode",
}

const SPELLING_WORD_BANK: SpellingWord[] = [
  {
    word: "adventure",
    definition: "An exciting or unusual experience that often involves exploring.",
    example: "The class planned an adventure to the science museum.",
  },
  {
    word: "curiosity",
    definition: "A desire to learn or know more about something.",
    example: "Her curiosity about space inspired her to read astronomy books.",
  },
  {
    word: "harmony",
    definition: "A pleasing combination or arrangement of different things.",
    example: "The choir sang in harmony during assembly.",
  },
  {
    word: "gratitude",
    definition: "A feeling of thankfulness and appreciation.",
    example: "We showed gratitude by writing thank-you notes.",
  },
  {
    word: "innovate",
    definition: "To introduce new ideas, methods, or products.",
    example: "Students innovate when they solve real-world problems.",
  },
  {
    word: "champion",
    definition: "Someone who wins or strongly supports a cause.",
    example: "Be a champion for kindness in our classroom.",
  },
  {
    word: "persevere",
    definition: "To keep trying even when something is difficult.",
    example: "We persevere through tough math problems to learn more.",
  },
  {
    word: "collaborate",
    definition: "To work together with others to reach a goal.",
    example: "The artists collaborate to paint the school mural.",
  },
  {
    word: "spectacular",
    definition: "Very impressive or dramatic.",
    example: "The science fair projects were truly spectacular.",
  },
  {
    word: "mindfulness",
    definition: "The practice of paying attention to the present moment.",
    example: "Morning mindfulness helped the class start the day calmly.",
  },
  {
    word: "resourceful",
    definition: "Able to find quick and clever ways to solve problems.",
    example: "She was resourceful when the group needed supplies for the project.",
  },
]

const SENTENCE_ROUNDS: SentenceRound[] = [
  {
    id: "easy-1",
    sentence: "Books open new worlds",
    hint: "Imagine what happens when you start reading.",
    difficulty: "easy",
  },
  {
    id: "easy-2",
    sentence: "Science experiments are fun",
    hint: "Think about a cheerful lab day.",
    difficulty: "easy",
  },
  {
    id: "medium-1",
    sentence: "Curious minds solve puzzles with teamwork",
    hint: "Friends joining forces to crack a mystery.",
    difficulty: "medium",
  },
  {
    id: "medium-2",
    sentence: "Rainy days inspire creative indoor games",
    hint: "What do you play when it rains outside?",
    difficulty: "medium",
  },
  {
    id: "hard-1",
    sentence: "Innovative students design robots to help their community",
    hint: "Robotics club planning a helpful invention.",
    difficulty: "hard",
  },
  {
    id: "hard-2",
    sentence: "Exploring the galaxy requires courage curiosity and focus",
    hint: "Picture astronauts preparing for launch.",
    difficulty: "hard",
  },
]

const sentenceDifficultyLabels: Record<SentenceRound["difficulty"], string> = {
  easy: "Warm-up",
  medium: "Brain boost",
  hard: "Galaxy guru",
}

const sentenceDifficultyStyles: Record<SentenceRound["difficulty"], string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  hard: "border-purple-200 bg-purple-50 text-purple-700",
}

const shuffleArray = <T,>(items: T[]): T[] => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

const generateMathProblem = (): MathProblem => {
  const operations: Array<MathProblem["difficulty"]> = ["easy", "medium", "hard"]
  const difficulty = operations[Math.floor(Math.random() * operations.length)]
  const [min, max] =
    difficulty === "easy" ? [1, 20] : difficulty === "medium" ? [10, 60] : [25, 99]

  const operationPool: Array<"+" | "-" | "×"> = ["+", "-", "×"]
  const operation = operationPool[Math.floor(Math.random() * operationPool.length)]

  let a = Math.floor(Math.random() * (max - min + 1)) + min
  let b = Math.floor(Math.random() * (max - min + 1)) + min

  if (operation === "-" && b > a) {
    ;[a, b] = [b, a]
  }

  if (operation === "×") {
    a = Math.min(a, 12)
    b = Math.min(b, 12)
  }

  let answer = a + b
  if (operation === "-") {
    answer = a - b
  } else if (operation === "×") {
    answer = a * b
  }

  const prompt = `${a} ${operation} ${b}`
  const options = new Set<number>([answer])
  while (options.size < 4) {
    const candidate = answer + Math.floor(Math.random() * 15) - 7
    if (candidate >= 0) {
      options.add(candidate)
    }
  }

  return {
    prompt,
    answer,
    options: shuffleArray([...options]),
    difficulty,
  }
}

const selectSpellingWords = (): SpellingWord[] => shuffleArray(SPELLING_WORD_BANK).slice(0, SPELLING_ROUND_SIZE)

const selectSentenceRounds = (): SentenceRound[] => shuffleArray(SENTENCE_ROUNDS).slice(0, SENTENCE_ROUND_SIZE)

export function StudentGameHub() {
  // Math Sprint state
  const [mathProblems, setMathProblems] = useState<MathProblem[]>(() =>
    Array.from({ length: MATH_ROUND_SIZE }, generateMathProblem),
  )
  const [mathActive, setMathActive] = useState(false)
  const [mathAnswered, setMathAnswered] = useState(false)
  const [mathIndex, setMathIndex] = useState(0)
  const [mathSelected, setMathSelected] = useState<number | null>(null)
  const [mathScore, setMathScore] = useState(0)
  const [mathTimeLeft, setMathTimeLeft] = useState(MATH_TIME_PER_QUESTION)
  const [mathCelebration, setMathCelebration] = useState(false)

  // Spelling Bee state
  const [spellingWords, setSpellingWords] = useState<SpellingWord[]>(selectSpellingWords)
  const [spellingActive, setSpellingActive] = useState(false)
  const [spellingPaused, setSpellingPaused] = useState(false)
  const [spellingIndex, setSpellingIndex] = useState(0)
  const [spellingAnswer, setSpellingAnswer] = useState("")
  const [spellingFeedback, setSpellingFeedback] = useState<"correct" | "incorrect" | "info" | null>(null)
  const [spellingAttempts, setSpellingAttempts] = useState<{ word: string; outcome: "correct" | "incorrect" }[]>([])
  const [spellingTimeLeft, setSpellingTimeLeft] = useState(25)
  const [spellingCelebration, setSpellingCelebration] = useState(false)
  const spellingInputRef = useRef<HTMLInputElement | null>(null)

  // Sentence scramble state
  const [sentenceRounds, setSentenceRounds] = useState<SentenceRound[]>(selectSentenceRounds)
  const [sentenceActive, setSentenceActive] = useState(false)
  const [sentencePaused, setSentencePaused] = useState(false)
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [sentenceSelectedWords, setSentenceSelectedWords] = useState<string[]>([])
  const [sentencePool, setSentencePool] = useState<string[]>([])
  const [sentenceAttempts, setSentenceAttempts] = useState<{ id: string; correct: boolean }[]>([])
  const [sentenceTimeLeft, setSentenceTimeLeft] = useState(60)
  const [sentenceCelebration, setSentenceCelebration] = useState(false)

  const currentMath = mathProblems[mathIndex] ?? null
  const currentWord = spellingWords[spellingIndex] ?? null
  const currentSentence = sentenceRounds[sentenceIndex] ?? null

  const mathProgress = useMemo(
    () => ((mathIndex + (mathAnswered ? 1 : 0)) / mathProblems.length) * 100,
    [mathIndex, mathAnswered, mathProblems.length],
  )

  const spellingProgress = useMemo(
    () => ((spellingIndex + (spellingFeedback === "correct" ? 1 : 0)) / spellingWords.length) * 100,
    [spellingIndex, spellingFeedback, spellingWords.length],
  )

  const sentenceProgress = useMemo(
    () => (sentenceAttempts.length / sentenceRounds.length) * 100,
    [sentenceAttempts.length, sentenceRounds.length],
  )

  // Math Sprint logic
  useEffect(() => {
    if (!mathActive || mathAnswered) {
      return
    }

    const interval = setInterval(() => {
      setMathTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          setMathAnswered(true)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [mathActive, mathAnswered])

  useEffect(() => {
    if (!mathActive || !mathAnswered) {
      return
    }

    const timeout = setTimeout(() => {
      if (mathIndex + 1 < mathProblems.length) {
        setMathIndex((prev) => prev + 1)
        setMathAnswered(false)
        setMathSelected(null)
        setMathTimeLeft(MATH_TIME_PER_QUESTION)
      } else {
        setMathCelebration(true)
        setMathActive(false)
      }
    }, 1400)

    return () => clearTimeout(timeout)
  }, [mathActive, mathAnswered, mathIndex, mathProblems.length])

  const handleStartMath = useCallback(() => {
    setMathProblems(Array.from({ length: MATH_ROUND_SIZE }, generateMathProblem))
    setMathActive(true)
    setMathIndex(0)
    setMathSelected(null)
    setMathAnswered(false)
    setMathScore(0)
    setMathTimeLeft(MATH_TIME_PER_QUESTION)
    setMathCelebration(false)
  }, [])

  const handleSelectMath = useCallback(
    (option: number) => {
      if (!mathActive || mathAnswered || !currentMath) {
        return
      }

      setMathSelected(option)
      setMathAnswered(true)
      if (option === currentMath.answer) {
        setMathScore((previous) => previous + 1)
      }
    },
    [currentMath, mathActive, mathAnswered],
  )

  const handleStopMath = useCallback(() => {
    setMathActive(false)
    setMathCelebration(false)
    setMathTimeLeft(MATH_TIME_PER_QUESTION)
    setMathIndex(0)
    setMathAnswered(false)
    setMathSelected(null)
  }, [])

  // Spelling Bee logic
  useEffect(() => {
    if (!spellingActive || spellingPaused || !currentWord) {
      return
    }

    const interval = setInterval(() => {
      setSpellingTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          handleSubmitSpelling(new Event("submit") as unknown as FormEvent<HTMLFormElement>)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentWord, spellingActive, spellingPaused])

  const speakWord = useCallback(() => {
    if (!currentWord || typeof window === "undefined") {
      return
    }

    const synth = window.speechSynthesis
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(currentWord.word)
    utterance.rate = 0.9
    synth.speak(utterance)
  }, [currentWord])

  useEffect(() => {
    if (spellingActive && !spellingPaused) {
      speakWord()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          spellingInputRef.current?.focus()
        })
      }
    }
  }, [speakWord, spellingActive, spellingPaused])

  const handleStartSpelling = useCallback(() => {
    setSpellingWords(selectSpellingWords())
    setSpellingActive(true)
    setSpellingPaused(false)
    setSpellingIndex(0)
    setSpellingAnswer("")
    setSpellingAttempts([])
    setSpellingFeedback(null)
    setSpellingTimeLeft(25)
    setSpellingCelebration(false)
  }, [])

  const handlePauseSpelling = useCallback(() => {
    setSpellingPaused((previous) => !previous)
  }, [])

  const handleStopSpelling = useCallback(() => {
    setSpellingActive(false)
    setSpellingPaused(false)
    setSpellingIndex(0)
    setSpellingAnswer("")
    setSpellingAttempts([])
    setSpellingFeedback(null)
    setSpellingTimeLeft(25)
    setSpellingCelebration(false)
  }, [])

  const handleSubmitSpelling = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!spellingActive || !currentWord) {
        return
      }

      const normalizedAnswer = spellingAnswer.trim().toLowerCase()
      const isCorrect = normalizedAnswer === currentWord.word.toLowerCase()

      setSpellingAttempts((previous) => [...previous, { word: currentWord.word, outcome: isCorrect ? "correct" : "incorrect" }])
      setSpellingFeedback(isCorrect ? "correct" : "incorrect")
      setSpellingAnswer("")

      const hasNext = spellingIndex + 1 < spellingWords.length
      if (hasNext) {
        setTimeout(() => {
          setSpellingIndex((prev) => prev + 1)
          setSpellingFeedback(null)
          setSpellingTimeLeft(25)
        }, 900)
      } else {
        setTimeout(() => {
          setSpellingCelebration(true)
          setSpellingActive(false)
        }, 900)
      }
    },
    [currentWord, spellingActive, spellingAnswer, spellingIndex, spellingWords.length],
  )

  const correctSpellingCount = spellingAttempts.filter((attempt) => attempt.outcome === "correct").length

  // Sentence scramble logic
  const resetSentenceRound = useCallback(
    (round: SentenceRound | null) => {
      if (!round) {
        setSentencePool([])
        setSentenceSelectedWords([])
        setSentenceTimeLeft(60)
        return
      }

      const words = round.sentence.split(" ")
      setSentencePool(shuffleArray(words))
      setSentenceSelectedWords([])
      setSentenceTimeLeft(round.difficulty === "easy" ? 60 : round.difficulty === "medium" ? 75 : 90)
    },
    [],
  )

  useEffect(() => {
    if (!sentenceActive || sentencePaused) {
      return
    }

    const interval = setInterval(() => {
      setSentenceTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(interval)
          handleSubmitSentence()
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [sentenceActive, sentencePaused, sentenceIndex])

  useEffect(() => {
    if (sentenceActive) {
      resetSentenceRound(currentSentence ?? null)
    }
  }, [currentSentence, resetSentenceRound, sentenceActive])

  const handleStartSentence = useCallback(() => {
    const rounds = selectSentenceRounds()
    setSentenceRounds(rounds)
    setSentenceIndex(0)
    setSentenceAttempts([])
    setSentenceActive(true)
    setSentencePaused(false)
    setSentenceCelebration(false)
    resetSentenceRound(rounds[0] ?? null)
  }, [resetSentenceRound])

  const handleTogglePauseSentence = useCallback(() => {
    setSentencePaused((previous) => !previous)
  }, [])

  const handleStopSentence = useCallback(() => {
    setSentenceActive(false)
    setSentencePaused(false)
    setSentenceIndex(0)
    setSentenceAttempts([])
    setSentenceCelebration(false)
    setSentenceSelectedWords([])
    setSentencePool([])
  }, [])

  const handleSelectWord = useCallback(
    (word: string, index: number) => {
      if (!sentenceActive || sentencePaused) {
        return
      }

      setSentenceSelectedWords((previous) => [...previous, word])
      setSentencePool((previous) => previous.filter((_, idx) => idx !== index))
    },
    [sentenceActive, sentencePaused],
  )

  const handleUndoWord = useCallback(() => {
    setSentenceSelectedWords((previous) => {
      const copy = [...previous]
      const last = copy.pop()
      if (last) {
        setSentencePool((pool) => [last, ...pool])
      }
      return copy
    })
  }, [])

  const handleShuffleWords = useCallback(() => {
    setSentencePool((previous) => shuffleArray(previous))
  }, [])

  const handleSubmitSentence = useCallback(() => {
    if (!sentenceActive || !currentSentence) {
      return
    }

    const userSentence = sentenceSelectedWords.join(" ")
    const normalizedUser = userSentence.trim().toLowerCase()
    const normalizedCorrect = currentSentence.sentence.toLowerCase()
    const isCorrect = normalizedUser === normalizedCorrect

    setSentenceAttempts((previous) => [...previous, { id: currentSentence.id, correct: isCorrect }])

    if (sentenceIndex + 1 < sentenceRounds.length) {
      setTimeout(() => {
        setSentenceIndex((prev) => prev + 1)
        resetSentenceRound(sentenceRounds[sentenceIndex + 1] ?? null)
      }, 900)
    } else {
      setTimeout(() => {
        setSentenceCelebration(true)
        setSentenceActive(false)
      }, 900)
    }
  }, [currentSentence, resetSentenceRound, sentenceActive, sentenceIndex, sentenceRounds, sentenceSelectedWords])

  const correctSentenceCount = sentenceAttempts.filter((attempt) => attempt.correct).length

  return (
    <div className="space-y-10">
      <section className="space-y-6" id="math-sprint">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#2d682d]">Math Sprint</h2>
            <p className="text-sm text-slate-600">
              Solve quick-fire arithmetic puzzles to strengthen your number sense.
            </p>
          </div>
          <Badge variant="outline" className="border-[#2d682d] text-[#2d682d]">
            {mathIndex + 1} / {mathProblems.length}
          </Badge>
        </div>

        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#2d682d]">
              <Calculator className="h-5 w-5" /> Lightning Math Sprint
            </CardTitle>
            <CardDescription>
              {mathActive
                ? `Question ${mathIndex + 1} of ${mathProblems.length}`
                : "Press start to begin your challenge."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-[#2d682d]">
                <Timer className="h-4 w-4" />
                {mathActive ? `${mathTimeLeft}s remaining` : "Timer ready"}
              </span>
              <span className="flex items-center gap-2 text-[#b29032]">
                <Sparkles className="h-4 w-4" /> Score: {mathScore}
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 text-center">
              {mathActive && currentMath ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-emerald-600">Solve</p>
                    <p className="text-4xl font-bold text-[#2d682d]">{currentMath.prompt}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentMath.options.map((option) => {
                      const isSelected = mathSelected === option
                      const isCorrect = option === currentMath.answer
                      return (
                        <Button
                          key={option}
                          type="button"
                          variant="outline"
                          className={`h-14 justify-start border-2 text-left text-lg font-semibold transition-all ${
                            mathAnswered
                              ? isCorrect
                                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                : isSelected
                                  ? "border-red-400 bg-red-50 text-red-900"
                                  : "border-slate-200 bg-white text-slate-700"
                              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/80"
                          }`}
                          disabled={!mathActive || mathAnswered}
                          onClick={() => handleSelectMath(option)}
                        >
                          {option}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-[#2d682d]">Ready for a mental math workout?</p>
                  <p className="text-sm text-slate-600">
                    Press start to tackle {mathProblems.length} curated arithmetic challenges. Each puzzle gives you {" "}
                    {MATH_TIME_PER_QUESTION} seconds to respond.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button className="bg-[#2d682d] text-white hover:bg-[#2d682d]/90" onClick={handleStartMath}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {mathActive ? "Restart challenge" : "Start Math Sprint"}
              </Button>
              <Button variant="outline" onClick={handleStopMath} disabled={!mathActive}>
                <StopCircle className="mr-2 h-4 w-4" /> End round
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Challenge progress</span>
                <span className="font-semibold text-[#2d682d]">{mathIndex + (mathAnswered ? 1 : 0)} / {mathProblems.length}</span>
              </div>
              <Progress value={mathProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6" id="spelling-bee">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#2d682d]">Spelling Bee</h2>
            <p className="text-sm text-slate-600">Listen closely and type what you hear before the timer ends.</p>
          </div>
          <Badge variant="outline" className="border-[#b29032] text-[#b29032]">
            {spellingIndex + 1} / {spellingWords.length}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                <Volume2 className="h-5 w-5" /> Classroom Challenge
              </CardTitle>
              <CardDescription>
                Tap start, listen to each word, and type your answer before the clock runs out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-[#2d682d]">
                  <Timer className="h-4 w-4" /> {spellingActive ? `${spellingTimeLeft}s remaining` : "Timer ready"}
                </span>
                <span className="flex items-center gap-2 text-[#b29032]">
                  <Sparkles className="h-4 w-4" /> Correct words: {correctSpellingCount}
                </span>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white p-6">
                {spellingActive && currentWord ? (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm text-slate-600">
                      <p className="font-semibold text-[#2d682d]">Definition:</p>
                      <p>{currentWord.definition}</p>
                      <p className="font-semibold text-[#2d682d]">Example:</p>
                      <p className="italic">{currentWord.example}</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmitSpelling}>
                      <div className="space-y-2">
                        <Label htmlFor="spelling-answer">Type what you hear</Label>
                        <Input
                          id="spelling-answer"
                          ref={spellingInputRef}
                          value={spellingAnswer}
                          onChange={(event) => setSpellingAnswer(event.target.value)}
                          placeholder="Enter the word..."
                          disabled={!spellingActive || spellingPaused}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" disabled={!spellingActive || spellingAnswer.trim().length === 0}>
                          Submit spelling
                        </Button>
                        <Button type="button" variant="outline" onClick={speakWord} disabled={!spellingActive || spellingPaused}>
                          <PlayCircle className="mr-2 h-4 w-4" /> Hear word again
                        </Button>
                        <Button type="button" variant="outline" onClick={handlePauseSpelling} disabled={!spellingActive}>
                          {spellingPaused ? <Play className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                          {spellingPaused ? "Resume" : "Pause"}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleStopSpelling} disabled={!spellingActive}>
                          <StopCircle className="mr-2 h-4 w-4" /> Stop
                        </Button>
                      </div>
                    </form>

                    {spellingFeedback ? (
                      <div
                        className={`rounded-xl border p-4 text-sm font-medium ${
                          spellingFeedback === "correct"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : spellingFeedback === "incorrect"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {spellingFeedback === "correct"
                          ? "Wonderful spelling!"
                          : spellingFeedback === "incorrect"
                            ? `Almost! The answer was "${currentWord.word}".`
                            : "Listen carefully and type what you hear."}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-lg font-semibold text-[#2d682d]">Ready to spell like a champion?</p>
                    <p className="text-sm text-slate-600">
                      Press start to begin a set of {spellingWords.length} carefully curated words.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button className="bg-[#2d682d] text-white hover:bg-[#2d682d]/90" onClick={handleStartSpelling}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> {spellingActive ? "Restart challenge" : "Start Spelling Bee"}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Bee progress</span>
                  <span className="font-semibold text-[#b29032]">{spellingIndex + 1} / {spellingWords.length}</span>
                </div>
                <Progress value={spellingProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                <Trophy className="h-5 w-5" /> Progress Tracker
              </CardTitle>
              <CardDescription>Review each attempt and celebrate improvements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {spellingAttempts.length === 0 ? (
                <p className="text-sm text-slate-600">Your results will appear here after each submission.</p>
              ) : (
                <div className="space-y-3">
                  {spellingAttempts.map((attempt, index) => (
                    <div key={`${attempt.word}-${index}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#2d682d]">Word {index + 1}</span>
                        <Badge
                          className={
                            attempt.outcome === "correct"
                              ? "border-transparent bg-[#2d682d] text-white"
                              : "border-transparent bg-red-100 text-red-700"
                          }
                        >
                          {attempt.outcome === "correct" ? "Correct" : "Try again"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-slate-600">{attempt.word}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6" id="sentence-scramble">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#2d682d]">Sentence Scramble</h2>
            <p className="text-sm text-slate-600">Reorder the glowing word tiles to form smart sentences.</p>
          </div>
          <Badge variant="outline" className="border-[#2d682d] text-[#2d682d]">
            {sentenceAttempts.length} / {sentenceRounds.length} complete
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-emerald-200">
            <CardHeader className="bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                    <Sparkles className="h-5 w-5" /> Sentence Scramble Quest
                  </CardTitle>
                  <CardDescription>
                    Complete the quest by arranging each glowing tile to reveal a powerful sentence.
                  </CardDescription>
                </div>
                <Badge className={`flex items-center gap-1 ${currentSentence ? sentenceDifficultyStyles[currentSentence.difficulty] : "bg-slate-100 text-slate-600"}`}>
                  {currentSentence ? sentenceDifficultyLabels[currentSentence.difficulty] : "Warm-up"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
                  <p className="font-semibold">Round</p>
                  <p className="text-xl font-bold">{sentenceIndex + 1}/{sentenceRounds.length}</p>
                  <p className="text-xs text-emerald-700/70">Stay sharp! Sentences grow tougher as you succeed.</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-700">
                  <p className="font-semibold">Timer</p>
                  <p className="text-xl font-bold">{sentenceActive ? (sentencePaused ? "Paused" : `${sentenceTimeLeft}s`) : "--"}</p>
                  <p className="text-xs text-amber-700/70">Beat the countdown before the sparkle fades.</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3 text-sm text-purple-700">
                  <p className="font-semibold">Victories</p>
                  <p className="text-xl font-bold">{correctSentenceCount}</p>
                  <p className="text-xs text-purple-700/80">Stack perfect solves to unlock mastery.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>
                    {sentenceActive
                      ? sentencePaused
                        ? "Quest paused. Tap continue when you're ready."
                        : `Stay sharp! ${sentenceTimeLeft}s remaining.`
                      : "Press start to begin the scramble journey."}
                  </span>
                  <span>Progress: {sentenceAttempts.length}/{sentenceRounds.length}</span>
                </div>
                <Progress value={sentenceProgress} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#2d682d]">Your sentence</h3>
                  {currentSentence ? <span className="text-xs text-slate-500">Hint: {currentSentence.hint}</span> : null}
                </div>
                <div className={`min-h-[64px] rounded-xl border border-dashed border-emerald-200 bg-white/80 p-3 ${
                  sentenceSelectedWords.length === 0 ? "animate-pulse" : ""
                }`}>
                  {sentenceSelectedWords.length === 0 ? (
                    <p className="text-xs text-emerald-700/80">Tap the glowing tiles below to build your sentence.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sentenceSelectedWords.map((word, index) => (
                        <span key={`${word}-${index}`} className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700">
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Word bank</span>
                  <span>{sentencePool.length} tiles remaining</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {sentencePool.map((word, index) => (
                    <Button
                      key={`${word}-${index}`}
                      type="button"
                      variant="outline"
                      className="group h-12 justify-center rounded-xl border-emerald-200 bg-white text-sm font-semibold text-emerald-700 transition hover:-translate-y-1 hover:bg-emerald-500/10"
                      onClick={() => handleSelectWord(word, index)}
                      disabled={!sentenceActive || sentencePaused}
                    >
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-500 transition group-hover:rotate-12" />
                        {word}
                      </span>
                    </Button>
                  ))}
                  {sentencePool.length === 0 && sentenceActive ? (
                    <p className="col-span-full text-center text-xs text-slate-400">All tiles used — submit your sentence!</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button className="bg-[#2d682d] text-white hover:bg-[#2d682d]/90" onClick={handleStartSentence}>
                  <PlayCircle className="mr-2 h-4 w-4" /> {sentenceActive ? "Restart Quest" : "Start Quest"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSubmitSentence}
                  disabled={!sentenceActive || sentencePool.length > 0}
                  className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                >
                  <CheckCircle className="mr-2 h-4 w-4" /> Submit sentence
                </Button>
                <Button variant="outline" onClick={handleTogglePauseSentence} disabled={!sentenceActive}>
                  {sentencePaused ? <Play className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                  {sentencePaused ? "Continue" : "Pause"}
                </Button>
                <Button variant="destructive" onClick={handleStopSentence} disabled={!sentenceActive}>
                  <StopCircle className="mr-2 h-4 w-4" /> Stop
                </Button>
                <Button variant="outline" onClick={handleUndoWord} disabled={!sentenceActive || sentenceSelectedWords.length === 0}>
                  <Undo2 className="mr-2 h-4 w-4" /> Undo
                </Button>
                <Button variant="outline" onClick={handleShuffleWords} disabled={!sentenceActive}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Shuffle tiles
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Achievement Tracker</CardTitle>
              <CardDescription>Watch your accuracy climb as sentences stretch from easy breezes to galaxy guru challenges.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                <p className="text-xs uppercase text-emerald-600">Accuracy</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {sentenceAttempts.length === 0
                    ? 0
                    : Math.round((correctSentenceCount / sentenceAttempts.length) * 100)}%
                </p>
                <Progress
                  value={sentenceAttempts.length === 0 ? 0 : (correctSentenceCount / sentenceAttempts.length) * 100}
                  className="mt-2 h-2"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase text-slate-500">Completed</p>
                  <p className="text-lg font-semibold text-slate-800">{sentenceAttempts.length}</p>
                  <p className="text-xs text-slate-500">Sentences played</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3">
                  <p className="text-xs uppercase text-purple-600">Perfect solves</p>
                  <p className="text-lg font-semibold text-purple-700">{correctSentenceCount}</p>
                  <p className="text-xs text-purple-600/80">Keep climbing to unlock mastery</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={mathCelebration} onOpenChange={setMathCelebration}>
        <DialogContent className="sm:max-w-md border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white">
          <DialogHeader className="items-center text-center">
            <PartyPopper className="h-10 w-10 text-[#2d682d]" />
            <DialogTitle className="mt-4 text-2xl font-bold text-[#2d682d]">Math Sprint complete!</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              You solved {mathScore} out of {mathProblems.length} challenges. Ready to beat your score?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full" onClick={() => setMathCelebration(false)}>
              Close
            </Button>
            <Button type="button" className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90" onClick={handleStartMath}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Play again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={spellingCelebration} onOpenChange={setSpellingCelebration}>
        <DialogContent className="sm:max-w-md border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white">
          <DialogHeader className="items-center text-center">
            <PartyPopper className="h-10 w-10 text-[#b29032]" />
            <DialogTitle className="mt-4 text-2xl font-bold text-[#2d682d]">Spelling Bee champion!</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              You completed every word. Keep practicing to build an unbeatable vocabulary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full" onClick={() => setSpellingCelebration(false)}>
              Close
            </Button>
            <Button type="button" className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90" onClick={handleStartSpelling}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Play again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sentenceCelebration} onOpenChange={setSentenceCelebration}>
        <DialogContent className="sm:max-w-lg border-purple-200 bg-gradient-to-b from-purple-50 via-white to-white">
          <DialogHeader className="items-center text-center">
            <PartyPopper className="h-10 w-10 text-purple-500" />
            <DialogTitle className="mt-4 text-2xl font-bold text-[#2d682d]">Sentence quest complete!</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              You finished every scramble with {correctSentenceCount} perfect solves. Amazing focus!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full" onClick={() => setSentenceCelebration(false)}>
              Close
            </Button>
            <Button type="button" className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90" onClick={handleStartSentence}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Play again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

