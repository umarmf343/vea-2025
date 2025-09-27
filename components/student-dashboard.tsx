"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BookOpen,
  Calendar,
  FileText,
  User,
  Clock,
  Trophy,
  Upload,
  CheckCircle,
  AlertCircle,
  Award,
  Download,
  Volume2,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  PartyPopper,
  Frown,
  RotateCcw,
  Undo2,
} from "lucide-react"
import { StudyMaterials } from "@/components/study-materials"
import { Noticeboard } from "@/components/noticeboard"
import { TutorialLink } from "@/components/tutorial-link"
import { ExamScheduleOverview } from "@/components/exam-schedule-overview"
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer"
import { TimetableWeeklyView, type TimetableWeeklyViewSlot } from "@/components/timetable-weekly-view"
import { dbManager } from "@/lib/database-manager"
import { logger } from "@/lib/logger"
import { normalizeTimetableCollection } from "@/lib/timetable"
import { CONTINUOUS_ASSESSMENT_MAXIMUMS } from "@/lib/grade-utils"
import { useBranding } from "@/hooks/use-branding"

type TimetableSlotSummary = TimetableWeeklyViewSlot

interface IdentifiedRecord {
  id: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toIdentifiedRecord(value: unknown, prefix: string): IdentifiedRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const record = value
  const idSource =
    record.id ?? record.ID ?? record._id ?? record.reference ?? record.slug ?? record.email ?? record.name ?? null

  let id: string
  if (typeof idSource === "string" && idSource.trim().length > 0) {
    id = idSource
  } else if (typeof idSource === "number") {
    id = String(idSource)
  } else {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${prefix}_${Math.random().toString(36).slice(2)}`
  }

  return { id, ...record }
}

function normalizeIdentifiedCollection(values: unknown, prefix: string): IdentifiedRecord[] {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((item) => toIdentifiedRecord(item, prefix))
    .filter((record): record is IdentifiedRecord => record !== null)
}

const normalizeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number") {
    return String(value)
  }

  return ""
}

const normalizeKey = (value: unknown): string => normalizeString(value).toLowerCase()

const extractRecordId = (record: Record<string, unknown>): string | null => {
  const candidates = [
    record.id,
    record.studentId,
    record.student_id,
    record.userId,
    record.user_id,
    record.reference,
    record.admissionNumber,
    record.admission_number,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized.length > 0) {
      return normalized
    }
  }

  return null
}

const findMatchingStudentRecord = (
  records: unknown,
  student: StudentDashboardProps["student"],
): Record<string, unknown> | null => {
  if (!Array.isArray(records)) {
    return null
  }

  const targetId = normalizeKey(student.id)
  const targetAdmission = normalizeKey(student.admissionNumber)
  const targetEmail = normalizeKey(student.email)
  const targetName = normalizeKey(student.name)

  for (const candidate of records) {
    if (!isRecord(candidate)) {
      continue
    }

    const candidateId = extractRecordId(candidate)
    if (candidateId && normalizeKey(candidateId) === targetId) {
      return candidate
    }

    const candidateAdmission = normalizeKey(candidate.admissionNumber ?? candidate.admission_number)
    if (targetAdmission && candidateAdmission === targetAdmission) {
      return candidate
    }

    const candidateEmail = normalizeKey(candidate.email)
    if (targetEmail && candidateEmail === targetEmail) {
      return candidate
    }

    const candidateName = normalizeKey(candidate.name)
    if (targetName && candidateName === targetName) {
      return candidate
    }
  }

  return null
}

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const normalizeSubjectName = (value: unknown): string => normalizeKey(value)

const resolveAssignmentMaximum = (assignment: IdentifiedRecord, fallback: number): number => {
  const candidates = [
    assignment.maximumScore,
    assignment.maximum_score,
    assignment.maxScore,
    assignment.max_score,
    assignment.totalMarks,
    assignment.total_marks,
  ]

  for (const candidate of candidates) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric)
    }
  }

  return fallback
}

const getRecordValue = (record: Record<string, unknown> | null | undefined, key: string): unknown => {
  if (!record) {
    return undefined
  }

  return record[key]
}

function shuffleArray<T>(source: T[]): T[] {
  const items = [...source]
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}

interface SpellingWord {
  word: string
  definition: string
  example: string
  syllables: string
}

interface SpellingAttempt {
  word: string
  userAnswer: string
  correct: boolean
  timeRemaining: number
  outcome: "correct" | "incorrect" | "skipped" | "timeout"
}

interface SentenceScrambleDefinition {
  id: string
  difficulty: "easy" | "medium" | "hard"
  sentence: string
  hint: string
}

interface SentenceScrambleRound extends SentenceScrambleDefinition {
  words: string[]
}

interface SentenceScrambleAttempt {
  id: string
  userSentence: string
  correct: boolean
  difficulty: SentenceScrambleRound["difficulty"]
  timeRemaining: number
}

type SentenceCelebrationState =
  | null
  | {
      mode: "win" | "lose"
      context: "round"
      round: SentenceScrambleRound | null
    }
  | {
      mode: "win" | "lose"
      context: "final"
      stats: { correct: number; total: number }
    }

type SpellingCelebrationState =
  | null
  | {
      mode: "win" | "lose"
      correct: number
      total: number
    }

const SPELLING_WORD_BANK: SpellingWord[] = [
  {
    word: "adventure",
    definition: "An exciting or unusual experience that often involves exploring.",
    example: "The class planned an adventure to the science museum.",
    syllables: "ad-ven-ture",
  },
  {
    word: "curiosity",
    definition: "A desire to learn or know more about something.",
    example: "Her curiosity about space inspired her to read astronomy books.",
    syllables: "cu-ri-os-i-ty",
  },
  {
    word: "celebrate",
    definition: "To honor or observe an event with special activities.",
    example: "We will celebrate the end of term with a class party.",
    syllables: "cel-e-brate",
  },
  {
    word: "imagination",
    definition: "The ability to form new ideas or images in your mind.",
    example: "Use your imagination to write a creative story.",
    syllables: "im-ag-i-na-tion",
  },
  {
    word: "resourceful",
    definition: "Able to find quick and clever ways to solve problems.",
    example: "He was resourceful when the group needed supplies for the project.",
    syllables: "re-source-ful",
  },
  {
    word: "friendship",
    definition: "A relationship between people who like and support each other.",
    example: "Their friendship grew stronger while working together.",
    syllables: "friend-ship",
  },
  {
    word: "discovery",
    definition: "The act of finding or learning something for the first time.",
    example: "The scientist made a discovery about ocean animals.",
    syllables: "dis-cov-er-y",
  },
  {
    word: "courageous",
    definition: "Brave when facing something difficult or dangerous.",
    example: "The courageous student presented in front of the entire school.",
    syllables: "cour-age-ous",
  },
  {
    word: "harmonious",
    definition: "Having parts that are arranged in a pleasant and balanced way.",
    example: "The choir performed a harmonious song at assembly.",
    syllables: "har-mo-ni-ous",
  },
  {
    word: "gratitude",
    definition: "A feeling of thankfulness and appreciation.",
    example: "She showed gratitude by writing thank-you notes to her teachers.",
    syllables: "grat-i-tude",
  },
  {
    word: "brilliant",
    definition: "Very bright or exceptionally clever.",
    example: "His brilliant solution impressed the robotics club.",
    syllables: "bril-liant",
  },
  {
    word: "persevere",
    definition: "To keep trying even when something is difficult.",
    example: "We persevere through tough math problems to learn more.",
    syllables: "per-se-vere",
  },
  {
    word: "collaborate",
    definition: "To work together with others to reach a goal.",
    example: "The artists collaborate to paint the school mural.",
    syllables: "col-lab-o-rate",
  },
  {
    word: "innovation",
    definition: "A new idea or method that improves something.",
    example: "Their innovation helped save water in the garden.",
    syllables: "in-no-va-tion",
  },
  {
    word: "mindfulness",
    definition: "The practice of paying attention to the present moment.",
    example: "Morning mindfulness helped the class start the day calmly.",
    syllables: "mind-ful-ness",
  },
  {
    word: "transform",
    definition: "To change something completely in appearance or character.",
    example: "Butterflies transform from caterpillars during metamorphosis.",
    syllables: "trans-form",
  },
  {
    word: "spectacular",
    definition: "Very impressive or dramatic.",
    example: "The science fair projects were truly spectacular.",
    syllables: "spec-tac-u-lar",
  },
  {
    word: "vocabulary",
    definition: "All the words known and used within a language.",
    example: "Reading every night grows your vocabulary.",
    syllables: "vo-cab-u-lar-y",
  },
  {
    word: "champion",
    definition: "Someone who wins or supports a cause strongly.",
    example: "Be a champion for kindness in our classroom.",
    syllables: "champ-i-on",
  },
  {
    word: "gratifying",
    definition: "Giving pleasure or satisfaction.",
    example: "Finishing a tough puzzle is deeply gratifying.",
    syllables: "grat-i-fy-ing",
  },
]

const SPELLING_CHALLENGE_SIZE = 12

const SENTENCE_SCRAMBLE_BANK: SentenceScrambleDefinition[] = [
  {
    id: "easy-1",
    difficulty: "easy",
    sentence: "Birds sing at dawn",
    hint: "Think about the sounds you hear in the morning.",
  },
  {
    id: "easy-2",
    difficulty: "easy",
    sentence: "Books open new worlds",
    hint: "Imagine what happens when you start reading.",
  },
  {
    id: "easy-3",
    difficulty: "easy",
    sentence: "Science experiments are fun",
    hint: "Consider a cheerful lab day.",
  },
  {
    id: "medium-1",
    difficulty: "medium",
    sentence: "Curious minds solve puzzles with teamwork",
    hint: "Friends joining forces to crack a mystery.",
  },
  {
    id: "medium-2",
    difficulty: "medium",
    sentence: "Rainy days inspire creative indoor games",
    hint: "What do you play when it rains outside?",
  },
  {
    id: "medium-3",
    difficulty: "medium",
    sentence: "The class built a tall marble tower",
    hint: "Remember a hands-on engineering challenge.",
  },
  {
    id: "hard-1",
    difficulty: "hard",
    sentence: "Exploring the galaxy requires courage curiosity and focus",
    hint: "Picture astronauts preparing for launch.",
  },
  {
    id: "hard-2",
    difficulty: "hard",
    sentence: "Innovative students design robots to help their community",
    hint: "Robotics club planning a helpful invention.",
  },
  {
    id: "hard-3",
    difficulty: "hard",
    sentence: "Vocabulary practice strengthens memory and communication every day",
    hint: "Daily reading boosts this skill.",
  },
]

const SPELLING_WIN_THRESHOLD = 0.7
const SENTENCE_WIN_THRESHOLD = 0.7

const difficultyDurations: Record<SentenceScrambleDefinition["difficulty"], number> = {
  easy: 55,
  medium: 70,
  hard: 85,
}

const prepareSpellingWords = () => shuffleArray(SPELLING_WORD_BANK).slice(0, SPELLING_CHALLENGE_SIZE)

const prepareSentenceRounds = (): SentenceScrambleRound[] => {
  const rounds = SENTENCE_SCRAMBLE_BANK.map<SentenceScrambleRound>((round) => ({
    ...round,
    words: round.sentence.split(" "),
  }))

  const easy = rounds.filter((round) => round.difficulty === "easy")
  const medium = rounds.filter((round) => round.difficulty === "medium")
  const hard = rounds.filter((round) => round.difficulty === "hard")

  return [...shuffleArray(easy), ...shuffleArray(medium), ...shuffleArray(hard)]
}

const normalizeSentence = (value: string) => value.replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim().toLowerCase()

interface StudentDashboardProps {
  student: {
    id: string
    name: string
    email: string
    class: string
    admissionNumber: string
  }
}

export function StudentDashboard({ student }: StudentDashboardProps) {
  const branding = useBranding()
  const resolvedSchoolName = branding.schoolName
  const [selectedTab, setSelectedTab] = useState("overview")
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<IdentifiedRecord | null>(null)
  const [submissionForm, setSubmissionForm] = useState({
    file: null as File | null,
    comment: "",
  })

  const [effectiveStudentId, setEffectiveStudentId] = useState(student.id)
  const [effectiveClassName, setEffectiveClassName] = useState(student.class)
  const [studentTeachers, setStudentTeachers] = useState<string[]>([])
  const [subjects, setSubjects] = useState<IdentifiedRecord[]>([])
  const [timetable, setTimetable] = useState<TimetableSlotSummary[]>([])
  const [assignments, setAssignments] = useState<IdentifiedRecord[]>([])
  const [libraryBooks, setLibraryBooks] = useState<IdentifiedRecord[]>([])
  const [attendance, setAttendance] = useState({ present: 0, total: 0, percentage: 0 })
  const [upcomingEvents, setUpcomingEvents] = useState<IdentifiedRecord[]>([])
  const [studentProfile, setStudentProfile] = useState(student)
  const [loading, setLoading] = useState(true)

  const defaultAssignmentMaximum = CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment ?? 20

  const spellingRoundDuration = 22
  const [spellingWords, setSpellingWords] = useState<SpellingWord[]>(() => prepareSpellingWords())

  const [spellingActive, setSpellingActive] = useState(false)
  const [currentSpellingIndex, setCurrentSpellingIndex] = useState(0)
  const [spellingInput, setSpellingInput] = useState("")
  const [spellingTimeLeft, setSpellingTimeLeft] = useState(spellingRoundDuration)
  const [spellingFeedback, setSpellingFeedback] = useState<
    { type: "success" | "error" | "info"; message: string } | null
  >(null)
  const [spellingAttempts, setSpellingAttempts] = useState<SpellingAttempt[]>([])
  const [spellingHintVisible, setSpellingHintVisible] = useState(false)
  const [spellingAnswered, setSpellingAnswered] = useState(false)
  const [spellingCelebration, setSpellingCelebration] = useState<SpellingCelebrationState>(null)
  const spellingInputRef = useRef<HTMLInputElement | null>(null)
  const advanceTimeoutRef = useRef<number | null>(null)

  const totalSpellingWords = spellingWords.length
  const currentSpellingWord = spellingWords[currentSpellingIndex] ?? null
  const totalCorrectSpellings = useMemo(
    () => spellingAttempts.filter((attempt) => attempt.correct).length,
    [spellingAttempts],
  )

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current !== null) {
      if (typeof window !== "undefined") {
        window.clearTimeout(advanceTimeoutRef.current)
      }
      advanceTimeoutRef.current = null
    }
  }, [])

  const advanceToNextWord = useCallback(() => {
    clearAdvanceTimeout()
    setSpellingInput("")
    setSpellingHintVisible(false)
    setSpellingAnswered(false)

    setCurrentSpellingIndex((prevIndex) => {
      const nextIndex = prevIndex + 1
      if (nextIndex < totalSpellingWords) {
        setSpellingTimeLeft(spellingRoundDuration)
        return nextIndex
      }

      setSpellingActive(false)
      setSpellingTimeLeft(0)
      return prevIndex
    })
  }, [clearAdvanceTimeout, spellingRoundDuration, totalSpellingWords])

  const queueAdvanceToNextWord = useCallback(() => {
    clearAdvanceTimeout()

    if (typeof window === "undefined") {
      advanceToNextWord()
      return
    }

    advanceTimeoutRef.current = window.setTimeout(() => {
      advanceTimeoutRef.current = null
      advanceToNextWord()
    }, 1500)
  }, [advanceToNextWord, clearAdvanceTimeout])

  const handleStartSpelling = useCallback(() => {
    clearAdvanceTimeout()
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel()
    }

    setSpellingWords(prepareSpellingWords())
    setSpellingActive(true)
    setCurrentSpellingIndex(0)
    setSpellingTimeLeft(spellingRoundDuration)
    setSpellingAttempts([])
    setSpellingFeedback({
      type: "info",
      message: "Listen carefully to the word and type what you hear before the timer ends.",
    })
    setSpellingInput("")
    setSpellingHintVisible(false)
    setSpellingAnswered(false)
    setSpellingCelebration(null)
  }, [clearAdvanceTimeout, prepareSpellingWords, spellingRoundDuration])

  const speakCurrentWord = useCallback(() => {
    if (!currentSpellingWord || typeof window === "undefined") {
      return
    }

    const synth = window.speechSynthesis
    synth.cancel()

    const wordUtterance = new SpeechSynthesisUtterance(currentSpellingWord.word)
    wordUtterance.lang = "en-US"
    wordUtterance.rate = 0.9
    synth.speak(wordUtterance)

    const sentenceUtterance = new SpeechSynthesisUtterance(`In a sentence: ${currentSpellingWord.example}`)
    sentenceUtterance.lang = "en-US"
    sentenceUtterance.rate = 0.95
    synth.speak(sentenceUtterance)
  }, [currentSpellingWord])

  const handleHearWordAgain = useCallback(() => {
    speakCurrentWord()
  }, [speakCurrentWord])

  const handleSkipWord = useCallback(() => {
    if (!spellingActive || spellingAnswered || !currentSpellingWord) {
      return
    }

    setSpellingAttempts((prev) => [
      ...prev,
      {
        word: currentSpellingWord.word,
        userAnswer: "(skipped)",
        correct: false,
        timeRemaining: spellingTimeLeft,
        outcome: "skipped",
      },
    ])
    setSpellingFeedback({
      type: "info",
      message: `Skipped. The correct spelling is "${currentSpellingWord.word}".`,
    })
    setSpellingAnswered(true)
    queueAdvanceToNextWord()
  }, [currentSpellingWord, queueAdvanceToNextWord, spellingActive, spellingAnswered, spellingTimeLeft])

  const handleRevealHint = useCallback(() => {
    if (!spellingActive || spellingAnswered || !currentSpellingWord) {
      return
    }

    setSpellingHintVisible(true)
    setSpellingFeedback({
      type: "info",
      message: `Hint: ${currentSpellingWord.definition}`,
    })
  }, [currentSpellingWord, spellingActive, spellingAnswered])

  const handleSubmitSpelling = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!spellingActive || spellingAnswered || !currentSpellingWord) {
        return
      }

      const trimmedInput = spellingInput.trim()
      if (trimmedInput.length === 0) {
        setSpellingFeedback({ type: "info", message: "Type your best spelling before submitting." })
        return
      }

      const isCorrect = trimmedInput.toLowerCase() === currentSpellingWord.word.toLowerCase()

      setSpellingAttempts((prev) => [
        ...prev,
        {
          word: currentSpellingWord.word,
          userAnswer: trimmedInput,
          correct: isCorrect,
          timeRemaining: spellingTimeLeft,
          outcome: isCorrect ? "correct" : "incorrect",
        },
      ])

      setSpellingFeedback(
        isCorrect
          ? { type: "success", message: `Nice work! "${currentSpellingWord.word}" is correct.` }
          : { type: "error", message: `Almost! The correct spelling is "${currentSpellingWord.word}".` },
      )

      setSpellingAnswered(true)
      queueAdvanceToNextWord()
    },
    [currentSpellingWord, queueAdvanceToNextWord, spellingActive, spellingAnswered, spellingInput, spellingTimeLeft],
  )

  const spellingProgress = totalSpellingWords
    ? Math.min((spellingAttempts.length / totalSpellingWords) * 100, 100)
    : 0

  const feedbackStyles: Record<"success" | "error" | "info", string> = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }

  const currentWordPosition = Math.min(currentSpellingIndex + 1, totalSpellingWords)
  const timerProgress = spellingActive ? (spellingTimeLeft / spellingRoundDuration) * 100 : 0
  const canSubmitSpelling = spellingActive && !spellingAnswered && spellingInput.trim().length > 0

  const [sentenceRounds, setSentenceRounds] = useState<SentenceScrambleRound[]>(() => prepareSentenceRounds())
  const [sentenceScrambleActive, setSentenceScrambleActive] = useState(false)
  const [sentencePaused, setSentencePaused] = useState(false)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [sentenceScrambledWords, setSentenceScrambledWords] = useState<string[]>([])
  const [sentenceSelectedWords, setSentenceSelectedWords] = useState<string[]>([])
  const [sentenceFeedback, setSentenceFeedback] = useState<
    { type: "success" | "error" | "info"; message: string } | null
  >(null)
  const [sentenceHintVisible, setSentenceHintVisible] = useState(false)
  const [sentenceAnswered, setSentenceAnswered] = useState(false)
  const [sentenceTimeLeft, setSentenceTimeLeft] = useState(0)
  const [sentenceAttempts, setSentenceAttempts] = useState<SentenceScrambleAttempt[]>([])
  const [sentenceCelebration, setSentenceCelebration] = useState<SentenceCelebrationState>(null)
  const [sentencePendingAdvance, setSentencePendingAdvance] = useState<"next" | "retry" | null>(null)

  const currentSentenceRound = useMemo(
    () => sentenceRounds[currentSentenceIndex] ?? null,
    [sentenceRounds, currentSentenceIndex],
  )
  const totalSentenceRounds = sentenceRounds.length
  const sentenceProgress = totalSentenceRounds
    ? Math.min((sentenceAttempts.length / totalSentenceRounds) * 100, 100)
    : 0

  const getSentenceRoundDuration = useCallback(
    (round: SentenceScrambleRound | null | undefined) => {
      if (!round) {
        return difficultyDurations.medium
      }
      return difficultyDurations[round.difficulty]
    },
    [],
  )

  const currentSentenceDuration = useMemo(
    () => getSentenceRoundDuration(currentSentenceRound),
    [currentSentenceRound, getSentenceRoundDuration],
  )
  const sentenceTimerProgress = sentenceScrambleActive
    ? Math.max(Math.min((sentenceTimeLeft / (currentSentenceDuration || 1)) * 100, 100), 0)
    : 0
  const sentenceDifficultyLabels: Record<SentenceScrambleRound["difficulty"], string> = {
    easy: "Easy Breeze",
    medium: "Brain Boost",
    hard: "Galaxy Guru",
  }
  const sentenceDifficultyBadges: Record<SentenceScrambleRound["difficulty"], string> = {
    easy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    hard: "bg-purple-100 text-purple-800 border-purple-200",
  }
  const totalSentenceCorrect = useMemo(
    () => sentenceAttempts.filter((attempt) => attempt.correct).length,
    [sentenceAttempts],
  )
  const sentenceCanSubmit =
    sentenceScrambleActive && !sentencePaused && !sentenceAnswered && sentenceSelectedWords.length > 0
  const sentenceCurrentPosition = Math.min(currentSentenceIndex + 1, totalSentenceRounds)
  const sentenceAccuracy = sentenceAttempts.length
    ? Math.round((totalSentenceCorrect / sentenceAttempts.length) * 100)
    : 0

  const prepareSentenceRound = useCallback(
    (round: SentenceScrambleRound | null) => {
      if (!round) {
        setSentenceScrambledWords([])
        setSentenceSelectedWords([])
        setSentenceTimeLeft(0)
        return
      }

      setSentenceScrambledWords(shuffleArray(round.words))
      setSentenceSelectedWords([])
      setSentenceHintVisible(false)
      setSentenceFeedback({
        type: "info",
        message: `Arrange the ${round.words.length}-word sentence (${round.difficulty} level).`,
      })
      setSentenceTimeLeft(getSentenceRoundDuration(round))
      setSentenceAnswered(false)
    },
    [getSentenceRoundDuration],
  )

  const finalizeSentenceAttempt = useCallback(
    (attempt: SentenceScrambleAttempt) => {
      setSentenceAttempts((prev) => {
        const updated = [...prev, attempt]
        const total = updated.length
        const correctCount = updated.filter((entry) => entry.correct).length
        const isFinalRound = currentSentenceIndex >= totalSentenceRounds - 1

        if (isFinalRound) {
          const accuracy = total > 0 ? correctCount / total : 0
          const mode: SentenceCelebrationState["mode"] =
            accuracy >= SENTENCE_WIN_THRESHOLD ? "win" : "lose"
          setSentenceCelebration({ mode, context: "final", stats: { correct: correctCount, total } })
          setSentenceScrambleActive(false)
          setSentencePendingAdvance(null)
        } else {
          setSentenceCelebration({ mode: attempt.correct ? "win" : "lose", context: "round", round: currentSentenceRound })
          setSentencePendingAdvance(attempt.correct ? "next" : "retry")
        }

        return updated
      })

      setSentencePaused(true)
      setSentenceAnswered(true)
      setSentenceHintVisible(false)
    },
    [currentSentenceIndex, currentSentenceRound, totalSentenceRounds],
  )

  const handleStartSentenceScramble = useCallback(() => {
    const rounds = prepareSentenceRounds()
    setSentenceRounds(rounds)
    setSentenceScrambleActive(true)
    setSentencePaused(false)
    setCurrentSentenceIndex(0)
    setSentenceAttempts([])
    setSentenceCelebration(null)
    setSentencePendingAdvance(null)
    setSentenceHintVisible(false)
    setSentenceSelectedWords([])
    setSentenceFeedback({
      type: "info",
      message: "Tap the words in the correct order before the timer sparkles out!",
    })
    const firstRound = rounds[0] ?? null
    prepareSentenceRound(firstRound)
  }, [prepareSentenceRound, prepareSentenceRounds])

  const handleSentenceSelectWord = useCallback(
    (word: string) => {
      if (!sentenceScrambleActive || sentencePaused || sentenceAnswered) {
        return
      }

      setSentenceScrambledWords((prev) => {
        const index = prev.indexOf(word)
        if (index === -1) {
          return prev
        }
        const next = [...prev]
        next.splice(index, 1)
        return next
      })
      setSentenceSelectedWords((prev) => [...prev, word])
    },
    [sentenceAnswered, sentencePaused, sentenceScrambleActive],
  )

  const handleSentenceUndo = useCallback(() => {
    if (!sentenceScrambleActive || sentencePaused || sentenceSelectedWords.length === 0) {
      return
    }

    setSentenceSelectedWords((prev) => {
      const next = [...prev]
      const word = next.pop()
      if (!word) {
        return prev
      }

      setSentenceScrambledWords((current) => {
        const insertionIndex = Math.floor(Math.random() * (current.length + 1))
        const copy = [...current]
        copy.splice(insertionIndex, 0, word)
        return copy
      })

      return next
    })
  }, [sentencePaused, sentenceScrambleActive, sentenceSelectedWords.length])

  const handleSentenceReset = useCallback(() => {
    if (!sentenceScrambleActive || sentencePaused) {
      return
    }

    prepareSentenceRound(currentSentenceRound)
    setSentenceFeedback({
      type: "info",
      message: "Fresh shuffle! Rebuild the sentence and beat the clock.",
    })
  }, [currentSentenceRound, prepareSentenceRound, sentencePaused, sentenceScrambleActive])

  const handleSentenceHint = useCallback(() => {
    if (!sentenceScrambleActive || sentencePaused || !currentSentenceRound) {
      return
    }

    setSentenceHintVisible(true)
    const firstWords = currentSentenceRound.words.slice(0, 2).join(" ")
    setSentenceFeedback({
      type: "info",
      message: `Hint: It begins "${firstWords}". ${currentSentenceRound.hint}`,
    })
  }, [currentSentenceRound, sentencePaused, sentenceScrambleActive])

  const handleSubmitSentence = useCallback(() => {
    if (!sentenceScrambleActive || sentencePaused || !currentSentenceRound || sentenceAnswered) {
      return
    }

    if (sentenceSelectedWords.length === 0) {
      setSentenceFeedback({
        type: "info",
        message: "Tap each word tile to build your sentence adventure.",
      })
      return
    }

    const proposed = sentenceSelectedWords.join(" ")
    const isCorrect = normalizeSentence(proposed) === normalizeSentence(currentSentenceRound.sentence)

    setSentenceFeedback({
      type: isCorrect ? "success" : "error",
      message: isCorrect
        ? "Brilliant! That sentence sparkles."
        : "Not quite yet—shuffle those tiles and try a new order.",
    })

    const attempt: SentenceScrambleAttempt = {
      id: currentSentenceRound.id,
      userSentence: proposed,
      correct: isCorrect,
      difficulty: currentSentenceRound.difficulty,
      timeRemaining: sentenceTimeLeft,
    }

    finalizeSentenceAttempt(attempt)
  }, [
    currentSentenceRound,
    finalizeSentenceAttempt,
    sentenceAnswered,
    sentencePaused,
    sentenceScrambleActive,
    sentenceSelectedWords,
    sentenceTimeLeft,
  ])

  const handleSentenceCelebrationClose = useCallback(() => {
    if (!sentenceCelebration) {
      return
    }

    if (sentenceCelebration.context === "round") {
      if (sentencePendingAdvance === "next") {
        setCurrentSentenceIndex((prev) => {
          const nextIndex = prev + 1
          if (nextIndex >= totalSentenceRounds) {
            return prev
          }
          return nextIndex
        })
        setSentencePaused(false)
      } else if (sentencePendingAdvance === "retry") {
        prepareSentenceRound(currentSentenceRound)
        setSentencePaused(false)
      }
    }

    setSentenceCelebration(null)
    setSentencePendingAdvance(null)
  }, [
    currentSentenceRound,
    prepareSentenceRound,
    sentenceCelebration,
    sentencePendingAdvance,
    totalSentenceRounds,
  ])

  const handleCloseSpellingCelebration = useCallback(() => {
    setSpellingCelebration(null)
  }, [])
  useEffect(() => {
    if (!spellingActive) {
      return
    }

    if (spellingTimeLeft <= 0) {
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const intervalId = window.setInterval(() => {
      setSpellingTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [spellingActive, spellingTimeLeft])

  useEffect(() => {
    if (!spellingActive || spellingAnswered || !currentSpellingWord) {
      return
    }

    if (spellingTimeLeft > 0) {
      return
    }

    setSpellingAttempts((prev) => [
      ...prev,
      {
        word: currentSpellingWord.word,
        userAnswer: "",
        correct: false,
        timeRemaining: 0,
        outcome: "timeout",
      },
    ])
    setSpellingFeedback({
      type: "error",
      message: `Time's up! The correct spelling was "${currentSpellingWord.word}".`,
    })
    setSpellingAnswered(true)
    queueAdvanceToNextWord()
  }, [
    currentSpellingWord,
    queueAdvanceToNextWord,
    spellingActive,
    spellingAnswered,
    spellingTimeLeft,
  ])

  useEffect(() => {
    if (!spellingActive || !currentSpellingWord) {
      return
    }

    setSpellingHintVisible(false)

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        spellingInputRef.current?.focus()
        spellingInputRef.current?.select()
      })
    }

    speakCurrentWord()
  }, [currentSpellingWord, speakCurrentWord, spellingActive])

  useEffect(() => {
    return () => {
      clearAdvanceTimeout()
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel()
      }
    }
  }, [clearAdvanceTimeout])

  useEffect(() => {
    if (spellingActive) {
      return
    }

    if (spellingAttempts.length === 0) {
      return
    }

    if (spellingAttempts.length !== totalSpellingWords) {
      return
    }

    if (spellingCelebration) {
      return
    }

    const correctCount = spellingAttempts.filter((attempt) => attempt.correct).length
    const accuracy = totalSpellingWords ? correctCount / totalSpellingWords : 0
    const mode: SpellingCelebrationState["mode"] = accuracy >= SPELLING_WIN_THRESHOLD ? "win" : "lose"

    setSpellingFeedback({
      type: mode === "win" ? "success" : "error",
      message:
        mode === "win"
          ? `Spectacular spelling! You nailed ${correctCount} of ${totalSpellingWords} words.`
          : `Challenge complete. You spelled ${correctCount} of ${totalSpellingWords} words — try again for a higher score!`,
    })
    setSpellingCelebration({ mode, correct: correctCount, total: totalSpellingWords })
  }, [
    spellingActive,
    spellingAttempts,
    spellingCelebration,
    totalSpellingWords,
  ])

  useEffect(() => {
    if (!sentenceScrambleActive) {
      return
    }

    prepareSentenceRound(currentSentenceRound)
  }, [sentenceScrambleActive, currentSentenceRound, prepareSentenceRound])

  useEffect(() => {
    if (!sentenceScrambleActive || sentencePaused) {
      return
    }

    if (!currentSentenceRound) {
      return
    }

    if (sentenceTimeLeft <= 0) {
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const intervalId = window.setInterval(() => {
      setSentenceTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [sentenceScrambleActive, sentencePaused, currentSentenceRound, sentenceTimeLeft])

  useEffect(() => {
    if (!sentenceScrambleActive || sentencePaused || !currentSentenceRound) {
      return
    }

    if (sentenceAnswered) {
      return
    }

    if (sentenceTimeLeft > 0) {
      return
    }

    setSentenceFeedback({
      type: "error",
      message: `Time's up! The sentence reads "${currentSentenceRound.sentence}."`,
    })

    const attempt: SentenceScrambleAttempt = {
      id: currentSentenceRound.id,
      userSentence: sentenceSelectedWords.join(" "),
      correct: false,
      difficulty: currentSentenceRound.difficulty,
      timeRemaining: 0,
    }

    finalizeSentenceAttempt(attempt)
  }, [
    currentSentenceRound,
    finalizeSentenceAttempt,
    sentenceAnswered,
    sentencePaused,
    sentenceScrambleActive,
    sentenceSelectedWords,
    sentenceTimeLeft,
  ])

  useEffect(() => {
    let isMounted = true

    const loadStudentData = async () => {
      try {
        setLoading(true)

        let resolvedStudentId = student.id
        let resolvedClassName = student.class
        let matchedStudent: Record<string, unknown> | null = null

        try {
          const studentsResponse = await fetch("/api/students")
          if (studentsResponse.ok) {
            const payload: unknown = await studentsResponse.json()
            const records = isRecord(payload) ? payload.students : undefined
            matchedStudent = findMatchingStudentRecord(records, student)

            if (matchedStudent) {
              const extractedId = extractRecordId(matchedStudent)
              if (extractedId) {
                resolvedStudentId = extractedId
              }

              const matchedClass = normalizeString(
                getRecordValue(matchedStudent, "class") ??
                  getRecordValue(matchedStudent, "className") ??
                  getRecordValue(matchedStudent, "class_name"),
              )
              if (matchedClass.length > 0) {
                resolvedClassName = matchedClass
              }
            }
          }
        } catch (error) {
          logger.error("Failed to resolve student record", { error })
        }

        let subjectRecords: IdentifiedRecord[] = []
        try {
          const subjectsResponse = await fetch("/api/subjects")
          if (subjectsResponse.ok) {
            const payload: unknown = await subjectsResponse.json()
            const records = isRecord(payload) ? payload.subjects : undefined
            const normalizedSubjects = normalizeIdentifiedCollection(records, "subject")
            if (normalizedSubjects.length > 0) {
              subjectRecords = normalizedSubjects.filter((record) => {
                if (typeof record.name !== "string" && typeof record.subject !== "string") {
                  return false
                }

                const classes = Array.isArray(record.classes) ? record.classes : []
                return classes.some((className) => normalizeKey(className) === normalizeKey(resolvedClassName))
              })
            }
          }
        } catch (error) {
          logger.error("Failed to load subject records", { error })
        }

        const subjectTeacherMap = new Map<string, string>()
        const teacherSet = new Set<string>()

        subjectRecords.forEach((record) => {
          const subjectName =
            typeof record.name === "string" ? record.name : typeof record.subject === "string" ? record.subject : ""
          const teachers = Array.isArray(record.teachers)
            ? record.teachers
            : typeof record.teacher === "string"
              ? [record.teacher]
              : []

          const primaryTeacher = teachers.find((teacher) => typeof teacher === "string" && teacher.trim().length > 0)

          if (subjectName && primaryTeacher) {
            subjectTeacherMap.set(normalizeSubjectName(subjectName), primaryTeacher)
            teacherSet.add(primaryTeacher)
          }
        })

        const normalizedTeacherSet = new Set(
          Array.from(teacherSet)
            .map((teacher) => teacher.trim().toLowerCase())
            .filter((teacher) => teacher.length > 0),
        )

        let resolvedSubjects = [] as IdentifiedRecord[]

        try {
          const gradesResponse = await fetch(`/api/grades?studentId=${encodeURIComponent(resolvedStudentId)}`)
          if (gradesResponse.ok) {
            const gradesData: unknown = await gradesResponse.json()
            const grades = isRecord(gradesData) ? gradesData.grades : undefined
            resolvedSubjects = normalizeIdentifiedCollection(grades, "grade")
          }
        } catch (error) {
          logger.error("Failed to load student grades", { error })
        }

        const matchedGrades = getRecordValue(matchedStudent, "grades")

        if (resolvedSubjects.length === 0 && Array.isArray(matchedGrades)) {
          const fallbackGrades = (matchedGrades as Array<Record<string, unknown>>).map((entry, index) => ({
            id: normalizeString(entry.id) || `grade_${index}_${normalizeSubjectName(entry.subject)}`,
            studentId: resolvedStudentId,
            subject: entry.subject,
            total: toNumber(entry.total),
            grade: entry.grade,
            firstCA: toNumber(entry.ca1 ?? entry.firstCA),
            secondCA: toNumber(entry.ca2 ?? entry.secondCA),
            assignment: toNumber(entry.assignment ?? entry.assessment),
            exam: toNumber(entry.exam),
          }))

          resolvedSubjects = normalizeIdentifiedCollection(fallbackGrades, "grade")
        }

        const processedSubjects = resolvedSubjects.map((subjectRecord) => {
          const subjectName = normalizeSubjectName(subjectRecord.subject)
          const teacherName =
            typeof subjectRecord.teacherName === "string" && subjectRecord.teacherName.trim().length > 0
              ? subjectRecord.teacherName
              : subjectTeacherMap.get(subjectName) ?? null

          return {
            ...subjectRecord,
            teacherName,
            total: toNumber(subjectRecord.total),
          }
        })

        const knownSubjectKeys = new Set(processedSubjects.map((subjectRecord) => normalizeSubjectName(subjectRecord.subject)))

        const additionalSubjects = subjectRecords
          .filter((record) => !knownSubjectKeys.has(normalizeSubjectName(record.name ?? record.subject)))
          .map((record) => {
            const subjectName =
              typeof record.name === "string" ? record.name : typeof record.subject === "string" ? record.subject : "Subject"
            const teacherName = subjectTeacherMap.get(normalizeSubjectName(subjectName)) ?? null

            return {
              id: normalizeString(record.id) || `subject_${normalizeSubjectName(subjectName)}`,
              subject: subjectName,
              teacherName,
              total: 0,
              grade: null,
            }
          })

        if (!isMounted) {
          return
        }

        setSubjects([...processedSubjects, ...additionalSubjects])

        const assignmentsData = await dbManager.getAssignments({ studentId: resolvedStudentId })
        if (!isMounted) {
          return
        }

        const normalizedAssignments = normalizeIdentifiedCollection(assignmentsData, "assignment")
        const filteredAssignments =
          normalizedTeacherSet.size > 0
            ? normalizedAssignments.filter((assignment) => {
                const teacherName = typeof assignment.teacher === "string" ? assignment.teacher.trim().toLowerCase() : ""
                if (!teacherName) {
                  return true
                }

                return normalizedTeacherSet.has(teacherName)
              })
            : normalizedAssignments
        setAssignments(filteredAssignments)

        const timetableResponse = await fetch(
          `/api/timetable?className=${encodeURIComponent(resolvedClassName)}`,
        )
        if (!isMounted) {
          return
        }

        if (timetableResponse.ok) {
          const timetableJson: unknown = await timetableResponse.json()
          const normalized = normalizeTimetableCollection(
            (timetableJson as Record<string, unknown>)?.timetable,
          ).map(({ id, day, time, subject, teacher, location }) => ({
            id,
            day,
            time,
            subject,
            teacher,
            location,
          }))
          setTimetable(normalized)
        } else {
          setTimetable([])
        }

        const libraryData = await dbManager.getLibraryBooks(resolvedStudentId)
        if (!isMounted) {
          return
        }

        setLibraryBooks(normalizeIdentifiedCollection(libraryData, "book"))

        const attendanceData = await dbManager.getStudentAttendance(resolvedStudentId)
        if (!isMounted) {
          return
        }

        setAttendance(attendanceData)

        const eventsData = await dbManager.getUpcomingEvents(resolvedClassName)
        if (!isMounted) {
          return
        }

        setUpcomingEvents(normalizeIdentifiedCollection(eventsData, "event"))

        const profileData = await dbManager.getStudentProfile(resolvedStudentId)
        if (!isMounted) {
          return
        }

        const mergedProfile = {
          id: resolvedStudentId,
          name:
            (isRecord(profileData) && typeof profileData.name === "string"
              ? profileData.name
              : typeof getRecordValue(matchedStudent, "name") === "string"
                ? (getRecordValue(matchedStudent, "name") as string)
                : student.name) ?? student.name,
          email:
            (isRecord(profileData) && typeof profileData.email === "string"
              ? profileData.email
              : typeof getRecordValue(matchedStudent, "email") === "string"
                ? (getRecordValue(matchedStudent, "email") as string)
                : student.email) ?? student.email,
          class: resolvedClassName,
          admissionNumber:
            (isRecord(profileData) && typeof profileData.admissionNumber === "string"
              ? profileData.admissionNumber
              : typeof getRecordValue(matchedStudent, "admissionNumber") === "string"
                ? (getRecordValue(matchedStudent, "admissionNumber") as string)
                : student.admissionNumber) ?? student.admissionNumber,
        }

        setStudentProfile(mergedProfile)
        setEffectiveStudentId(resolvedStudentId)
        setEffectiveClassName(resolvedClassName)
        setStudentTeachers(Array.from(teacherSet))
      } catch (error) {
        logger.error("Failed to load student data", { error })
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadStudentData()

    return () => {
      isMounted = false
    }
  }, [student.admissionNumber, student.class, student.email, student.id, student.name])

  useEffect(() => {
    if (!effectiveStudentId) {
      return undefined
    }

    const handleGradesUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "grade")
      if (!record || normalizeKey(record.studentId) !== normalizeKey(effectiveStudentId)) {
        return
      }

      setSubjects((prev) =>
        prev.map((subject) => (subject.id === record.id ? { ...subject, ...record, total: toNumber(record.total) } : subject)),
      )
    }

    const handleAssignmentsUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "assignment")
      if (!record || normalizeKey(record.studentId) !== normalizeKey(effectiveStudentId)) {
        return
      }

      setAssignments((prev) => prev.map((assignment) => (assignment.id === record.id ? { ...assignment, ...record } : assignment)))
    }

    const handleAttendanceUpdate = (payload: unknown) => {
      if (isRecord(payload) && normalizeKey(payload.studentId) === normalizeKey(effectiveStudentId)) {
        setAttendance((prev) => ({
          present: Number(payload.present ?? prev.present),
          total: Number(payload.total ?? prev.total),
          percentage: Number(payload.percentage ?? prev.percentage),
        }))
      }
    }

    const handleEventsUpdate = (payload: unknown) => {
      if (isRecord(payload) && normalizeKey(payload.class) === normalizeKey(effectiveClassName)) {
        setUpcomingEvents(normalizeIdentifiedCollection(payload.events, "event"))
      }
    }

    const handleProfileUpdate = (payload: unknown) => {
      const record = toIdentifiedRecord(payload, "profile")
      if (record && normalizeKey(record.id) === normalizeKey(effectiveStudentId)) {
        setStudentProfile((prev) => ({
          ...prev,
          ...record,
          id: prev.id,
        }))
      }
    }

    dbManager.addEventListener("gradesUpdate", handleGradesUpdate)
    dbManager.addEventListener("assignmentsUpdate", handleAssignmentsUpdate)
    dbManager.addEventListener("attendanceUpdate", handleAttendanceUpdate)
    dbManager.addEventListener("eventsUpdate", handleEventsUpdate)
    dbManager.addEventListener("profileUpdate", handleProfileUpdate)

    return () => {
      dbManager.removeEventListener("gradesUpdate", handleGradesUpdate)
      dbManager.removeEventListener("assignmentsUpdate", handleAssignmentsUpdate)
      dbManager.removeEventListener("attendanceUpdate", handleAttendanceUpdate)
      dbManager.removeEventListener("eventsUpdate", handleEventsUpdate)
      dbManager.removeEventListener("profileUpdate", handleProfileUpdate)
    }
  }, [effectiveClassName, effectiveStudentId])

  const handleRenewBook = async (bookId: string) => {
    try {
      await dbManager.renewLibraryBook(bookId, effectiveStudentId)
      const updatedBooks = await dbManager.getLibraryBooks(effectiveStudentId)
      setLibraryBooks(normalizeIdentifiedCollection(updatedBooks, "book"))
    } catch (error) {
      logger.error("Failed to renew book", { error })
    }
  }

  const handleDownloadAssignmentResource = (assignment: IdentifiedRecord) => {
    const resourceUrl = typeof assignment.resourceUrl === "string" ? assignment.resourceUrl : ""
    if (!resourceUrl) {
      return
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    const link = document.createElement("a")
    link.href = resourceUrl
    link.download =
      typeof assignment.resourceName === "string" && assignment.resourceName.length > 0
        ? assignment.resourceName
        : `${typeof assignment.title === "string" ? assignment.title : "assignment"}.resource`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatAssignmentDate = (value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "--"
    }

    try {
      return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value))
    } catch (error) {
      return value
    }
  }

  const describeDueDate = (value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "No due date"
    }

    const dueDate = new Date(value)
    if (Number.isNaN(dueDate.getTime())) {
      return value
    }

    const oneDay = 1000 * 60 * 60 * 24
    const diff = Math.ceil((dueDate.getTime() - Date.now()) / oneDay)

    if (diff > 1) return `Due in ${diff} days`
    if (diff === 1) return "Due tomorrow"
    if (diff === 0) return "Due today"
    return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`
  }

  const getAssignmentStatusMeta = (status: unknown) => {
    const normalized = typeof status === "string" ? status : "sent"

    switch (normalized) {
      case "graded":
        return {
          label: "Graded",
          badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
          accent: "from-emerald-100/80",
          icon: <Award className="h-4 w-4 text-emerald-500" />,
        }
      case "submitted":
        return {
          label: "Submitted",
          badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
          accent: "from-blue-100/80",
          icon: <Upload className="h-4 w-4 text-blue-500" />,
        }
      case "overdue":
        return {
          label: "Overdue",
          badgeClass: "border-red-200 bg-red-50 text-red-700",
          accent: "from-red-100/80",
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        }
      default:
        return {
          label: "Awaiting submission",
          badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
          accent: "from-amber-100/80",
          icon: <Clock className="h-4 w-4 text-amber-500" />,
        }
    }
  }

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment) return

    try {
      const submissionData = {
        assignmentId: selectedAssignment.id,
        studentId: effectiveStudentId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        submittedFile: submissionForm.file?.name || null,
        submittedComment: submissionForm.comment,
      }

      // Save to database
      await dbManager.submitAssignment(submissionData)

      // Update local state
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === selectedAssignment.id ? { ...assignment, ...submissionData } : assignment,
        ),
      )

      setShowSubmitConfirm(false)
      setSelectedAssignment(null)
      setSubmissionForm({ file: null, comment: "" })
    } catch (error) {
      logger.error("Failed to submit assignment", { error })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading student data...</p>
        </div>
      </div>
    )
  }

  const averageGrade =
    subjects.length > 0
      ? Math.round(subjects.reduce((sum, subject) => sum + (subject.total || 0), 0) / subjects.length)
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {studentProfile.name}</h1>
            <p className="text-green-100">
              Student Portal - {(studentProfile.class || effectiveClassName) ?? "Unassigned"} - {resolvedSchoolName}
            </p>
            <p className="text-sm text-green-200">
              Admission No: {studentProfile.admissionNumber || student.admissionNumber}
            </p>
          </div>
          <TutorialLink href="https://www.youtube.com/watch?v=1FJD7jZqZEk" variant="inverse" />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{subjects.length}</p>
                <p className="text-sm text-gray-600">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{assignments.length}</p>
                <p className="text-sm text-gray-600">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{averageGrade}%</p>
                <p className="text-sm text-gray-600">Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{attendance.percentage}%</p>
                <p className="text-sm text-gray-600">Attendance</p>
                <p className="text-xs text-gray-500">
                  {attendance.present}/{attendance.total} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max flex-nowrap gap-1 bg-green-50 p-1">
            <TabsTrigger
              value="overview"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Subjects
            </TabsTrigger>
            <TabsTrigger
              value="timetable"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Timetable
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="library"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Library
            </TabsTrigger>
            <TabsTrigger
              value="spellingBee"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Spelling Bee
            </TabsTrigger>
            <TabsTrigger
              value="sentenceScramble"
              className="min-w-[150px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Sentence Scramble
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Academic Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subjects.slice(0, 3).map((subject, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{subject.subject}</span>
                        <span className="text-sm text-[#b29032] font-bold">{subject.grade}</span>
                      </div>
                      <Progress value={subject.total || 0} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.slice(0, 3).map((event, index) => (
                      <div key={index} className="p-2 bg-yellow-50 border-l-4 border-[#b29032] rounded">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-gray-600">{event.date}</p>
                        {event.description && <p className="text-xs text-gray-500">{event.description}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No upcoming events</p>
                  )}
                </div>
              </CardContent>
            </Card>

          <ExamScheduleOverview
            role="student"
            title="Upcoming Exams"
            description="Plan ahead with the latest exam schedule for your class."
            classNames={
              [studentProfile.class || effectiveClassName].filter(
                (value): value is string => typeof value === "string" && value.length > 0,
              )
            }
            className="h-full"
            emptyState="No upcoming exams scheduled for your class yet."
            limit={4}
          />
          <SchoolCalendarViewer role="student" className="md:col-span-2 xl:col-span-3" />
        </div>

        <div className="mt-8">
          <Noticeboard userRole="student" userName={studentProfile.name} />
        </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Subjects</CardTitle>
              <CardDescription>View your subjects and assigned teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjects.map((subject, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{subject.subject}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <User className="w-4 h-4 text-[#2d682d]" />
                        <p className="text-sm font-medium text-[#2d682d]">
                          Teacher: {subject.teacherName || "Not Assigned"}
                        </p>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Performance</span>
                          <span className="font-medium">{subject.total || 0}%</span>
                        </div>
                        <Progress value={subject.total || 0} className="h-2" />
                      </div>
                    </div>
                    <div className="ml-4 text-center">
                      <Badge variant="outline" className="text-[#b29032] border-[#b29032] font-bold text-lg px-3 py-1">
                        {subject.grade || "N/A"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Class Timetable</CardTitle>
              <CardDescription>Your weekly class schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <TimetableWeeklyView
                slots={timetable}
                emptyMessage="No timetable available yet. Check back soon."
                renderDetails={(slot) => (
                  <p className="text-sm text-emerald-700/80">
                    {slot.teacher && slot.teacher.trim().length > 0
                      ? `With ${slot.teacher}`
                      : "Teacher to be announced"}
                    {slot.location && slot.location.trim().length > 0 ? ` • ${slot.location}` : ""}
                  </p>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Assignments</CardTitle>
              <CardDescription>Track your assignments and submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {assignments.map((assignment) => {
                  const statusMeta = getAssignmentStatusMeta(assignment.status)
                  const submittedAt = typeof assignment.submittedAt === "string" ? assignment.submittedAt : ""
                  const grade = typeof assignment.grade === "string" ? assignment.grade : ""
                  const score =
                    typeof assignment.score === "number"
                      ? Math.round(assignment.score * 100) / 100
                      : null
                  const canSubmit = ["sent", "overdue"].includes(
                    typeof assignment.status === "string" ? assignment.status : "sent",
                  )

                  return (
                    <div
                      key={assignment.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${statusMeta.accent} via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                      />
                      <div className="relative z-10 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-800">
                            {statusMeta.icon}
                            <h3 className="text-lg font-semibold md:text-xl">
                              {typeof assignment.title === "string" ? assignment.title : "Assignment"}
                            </h3>
                          </div>
                          <Badge className={`${statusMeta.badgeClass} uppercase`}>{statusMeta.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                            {typeof assignment.subject === "string" ? assignment.subject : "Subject"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            {typeof assignment.teacher === "string" ? assignment.teacher : "Teacher"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-amber-500" /> Due {formatAssignmentDate(assignment.dueDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="h-3.5 w-3.5 text-purple-500" />
                            {resolveAssignmentMaximum(assignment, defaultAssignmentMaximum)} marks
                          </span>
                          <span className="text-slate-500">{describeDueDate(assignment.dueDate)}</span>
                        </div>
                        <p className="text-sm text-slate-700">
                          {typeof assignment.description === "string" && assignment.description.length > 0
                            ? assignment.description
                            : "No description provided for this assignment."}
                        </p>
                        {submittedAt ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                            <p className="flex items-center gap-2 font-medium">
                              <CheckCircle className="h-4 w-4 text-emerald-600" /> Submitted on {formatAssignmentDate(submittedAt)}
                            </p>
                            {typeof assignment.submittedFile === "string" && assignment.submittedFile.length > 0 ? (
                              <p className="mt-1 text-emerald-700/80">File: {assignment.submittedFile}</p>
                            ) : null}
                            {typeof assignment.submittedComment === "string" && assignment.submittedComment.length > 0 ? (
                              <p className="mt-1 italic text-emerald-700/80">“{assignment.submittedComment}”</p>
                            ) : null}
                          </div>
                        ) : null}
                        {grade || score !== null ? (
                          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                            <p className="flex items-center gap-2 font-medium">
                              <Trophy className="h-4 w-4 text-purple-600" />
                              Score: {score ?? "--"} / {resolveAssignmentMaximum(assignment, defaultAssignmentMaximum)}
                              {grade ? ` • Grade ${grade}` : ""}
                            </p>
                          </div>
                        ) : null}
                        {typeof assignment.resourceName === "string" && assignment.resourceName.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadAssignmentResource(assignment)}
                            className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                          >
                            <Download className="h-3.5 w-3.5" /> {assignment.resourceName}
                          </button>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {canSubmit ? (
                            <Button
                              size="sm"
                              className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                              onClick={() => {
                                setSelectedAssignment(assignment)
                                setShowSubmitConfirm(true)
                              }}
                            >
                              <Upload className="w-4 h-4 mr-1" /> Submit Assignment
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {grade ? "Keep up the great work!" : "You've already submitted this assignment."}
                            </p>
                          )}
                          {typeof assignment.status === "string" && assignment.status === "overdue" ? (
                            <p className="text-xs font-medium text-red-600">This assignment is overdue — submit as soon as possible.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Study Materials</CardTitle>
              <CardDescription>
                Access study materials for your class ({(studentProfile.class || effectiveClassName) ?? "Unassigned"})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudyMaterials
                userRole="student"
                studentClass={effectiveClassName}
                allowedTeacherNames={studentTeachers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Library Books</CardTitle>
              <CardDescription>Manage your borrowed books</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {libraryBooks.map((book) => (
                  <div key={book.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{book.title}</h3>
                      <p className="text-sm text-gray-600">by {book.author}</p>
                      <p className="text-sm text-gray-500">Due: {book.dueDate}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={book.status === "overdue" ? "destructive" : "default"}>{book.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRenewBook(book.id)}
                        disabled={book.status === "overdue"}
                      >
                        Renew
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spellingBee" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                        <Sparkles className="h-5 w-5" />
                        Spelling Bee Challenge
                      </CardTitle>
                      <CardDescription>
                        Listen to the audio prompt, type the correct spelling, and beat the countdown timer.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-[#b29032] text-[#b29032]">
                      Word {currentWordPosition} / {totalSpellingWords}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[#2d682d]">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-semibold">
                          {spellingActive ? `${spellingTimeLeft}s remaining` : "Timer paused"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#b29032]">
                        <Award className="h-5 w-5" />
                        <span className="text-sm font-semibold">
                          Score: {totalCorrectSpellings}/{totalSpellingWords}
                        </span>
                      </div>
                    </div>
                    <Progress value={timerProgress} className="h-2" />
                  </div>

                  {spellingFeedback ? (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm font-medium ${feedbackStyles[spellingFeedback.type]}`}
                    >
                      {spellingFeedback.message}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                      onClick={handleStartSpelling}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {spellingActive ? "Restart Challenge" : "Start Challenge"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleHearWordAgain} disabled={!spellingActive}>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Hear word again
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRevealHint}
                      disabled={!spellingActive || spellingHintVisible || spellingAnswered}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Reveal hint
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSkipWord}
                      disabled={!spellingActive || spellingAnswered}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Skip word
                    </Button>
                  </div>

                  <form className="space-y-4" onSubmit={handleSubmitSpelling}>
                    <div className="space-y-2">
                      <Label htmlFor="spelling-answer" className="text-sm font-medium">
                        Type what you hear
                      </Label>
                      <Input
                        ref={spellingInputRef}
                        id="spelling-answer"
                        value={spellingInput}
                        onChange={(event) => setSpellingInput(event.target.value)}
                        disabled={!spellingActive || spellingAnswered}
                        placeholder={spellingActive ? "Enter the word..." : "Tap start to begin"}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!canSubmitSpelling}>
                        Submit spelling
                      </Button>
                    </div>
                  </form>

                  {spellingHintVisible && currentSpellingWord ? (
                    <div className="rounded-lg border border-dashed border-[#b29032] bg-yellow-50 p-4 text-sm text-[#5f4a16]">
                      <p className="font-semibold">Hint</p>
                      <p className="mt-1">Definition: {currentSpellingWord.definition}</p>
                      <p className="mt-1">Syllables: {currentSpellingWord.syllables}</p>
                      <p className="mt-1 italic text-[#7c621d]">Example: {currentSpellingWord.example}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-[#2d682d]">Bee Tips</CardTitle>
                  <CardDescription>Use these strategies to earn full marks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
                    <li>Listen to the word twice before typing and visualize each syllable.</li>
                    <li>Break tricky words into syllables and type them slowly to avoid typos.</li>
                    <li>Use the hint sparingly—each word only gives you one chance!</li>
                    <li>After finishing, review the history panel to replay missed words.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                    <Trophy className="h-5 w-5" /> Progress Tracker
                  </CardTitle>
                  <CardDescription>Review each attempt and celebrate improvements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#2d682d]">Correct words</span>
                    <Badge variant="outline" className="border-[#2d682d] text-[#2d682d]">
                      {totalCorrectSpellings} / {totalSpellingWords}
                    </Badge>
                  </div>
                  <div>
                    <Progress value={spellingProgress} className="h-2" />
                    <p className="mt-2 text-xs text-gray-500">
                      {spellingAttempts.length} of {totalSpellingWords} words completed
                    </p>
                  </div>
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {spellingAttempts.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Your results will appear here after you submit each word.
                      </p>
                    ) : (
                      spellingAttempts.map((attempt, index) => (
                        <div key={`${attempt.word}-${index}`} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Word {index + 1}</p>
                            <Badge
                              className={
                                attempt.correct
                                  ? "border-transparent bg-[#2d682d] text-white"
                                  : attempt.outcome === "timeout"
                                    ? "border-transparent bg-orange-100 text-orange-700"
                                    : attempt.outcome === "skipped"
                                      ? "border-transparent bg-blue-100 text-blue-700"
                                      : "border-transparent bg-red-100 text-red-700"
                              }
                            >
                              {attempt.correct
                                ? "Correct"
                                : attempt.outcome === "timeout"
                                  ? "Time up"
                                  : attempt.outcome === "skipped"
                                    ? "Skipped"
                                    : "Try again"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">
                            Word: <span className="font-semibold text-[#2d682d]">{attempt.word}</span>
                          </p>
                          {attempt.userAnswer && attempt.userAnswer !== "(skipped)" ? (
                            <p className="text-xs text-gray-500">You typed: {attempt.userAnswer}</p>
                          ) : null}
                          <p className="text-xs text-gray-400">Time left: {attempt.timeRemaining}s</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-[#2d682d]">Practice Playlist</CardTitle>
                  <CardDescription>Replay words to build muscle memory.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-600">
                  <p>
                    Tap on any completed word to hear it again and practice on paper or with a study partner. Repetition
                    turns tricky spellings into easy wins.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spellingAttempts.map((attempt, index) => (
                      <Button
                        key={`replay-${attempt.word}-${index}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.speechSynthesis.cancel()
                          }
                          const word = spellingWords.find((entry) => entry.word === attempt.word)
                          if (!word || typeof window === "undefined") {
                            return
                          }
                          const synth = window.speechSynthesis
                          const wordUtterance = new SpeechSynthesisUtterance(word.word)
                          wordUtterance.lang = "en-US"
                          wordUtterance.rate = 0.95
                          synth.speak(wordUtterance)
                        }}
                      >
                        <Volume2 className="mr-2 h-4 w-4" />
                        {attempt.word}
                      </Button>
                    ))}
                    {spellingAttempts.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Complete a round to unlock quick replay buttons.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sentenceScramble" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden border-emerald-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-[#2d682d]">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                        Sentence Scramble Quest
                      </CardTitle>
                      <CardDescription>
                        Reorder the glowing word tiles to form smart sentences. Each win unlocks a tougher, longer
                        challenge!
                      </CardDescription>
                    </div>
                    <Badge className="flex items-center gap-1 bg-[#b29032]/10 text-[#b29032]">
                      <Trophy className="h-3.5 w-3.5" /> {totalSentenceCorrect} victories
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
                      <p className="font-semibold">Round</p>
                      <p className="text-xl font-bold">
                        {sentenceScrambleActive ? sentenceCurrentPosition : 0}/{totalSentenceRounds}
                      </p>
                      <p className="text-xs text-emerald-700/80">Work through each sentence to unlock mastery.</p>
                    </div>
                    <div
                      className={`rounded-xl border p-3 text-sm shadow-sm transition ${
                        currentSentenceRound
                          ? sentenceDifficultyBadges[currentSentenceRound.difficulty]
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <p className="font-semibold">Difficulty</p>
                      <p className="text-xl font-bold">
                        {currentSentenceRound ? sentenceDifficultyLabels[currentSentenceRound.difficulty] : "Warm-up"}
                      </p>
                      <p className="text-xs opacity-80">Sentences grow longer and trickier as you succeed.</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-700">
                      <p className="font-semibold">Timer</p>
                      <p className="text-xl font-bold">{sentenceScrambleActive ? `${sentenceTimeLeft}s` : "--"}</p>
                      <p className="text-xs text-amber-700/80">Beat the countdown before the sparkle fades.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-full bg-emerald-100/70 p-1">
                      <Progress value={sentenceTimerProgress} className="h-2 bg-emerald-200" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
                      <span>
                        {sentenceScrambleActive
                          ? `Stay sharp! ${sentenceTimeLeft}s remaining.`
                          : "Press start to begin the scramble journey."}
                      </span>
                      <span>
                        Overall progress: {sentenceAttempts.length}/{totalSentenceRounds} sentences
                      </span>
                    </div>
                  </div>

                  {sentenceFeedback ? (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-sm transition ${
                        sentenceFeedback.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : sentenceFeedback.type === "error"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {sentenceFeedback.message}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#2d682d]">Your sentence</h3>
                      {sentenceHintVisible && currentSentenceRound ? (
                        <span className="text-xs text-slate-500">
                          Hint: {currentSentenceRound.hint}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`min-h-[64px] rounded-xl border border-dashed border-emerald-200 bg-white/80 p-3 transition ${
                        sentenceSelectedWords.length === 0 ? "animate-pulse" : ""
                      }`}
                    >
                      {sentenceSelectedWords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {sentenceSelectedWords.map((word, index) => (
                            <span
                              key={`selected-${word}-${index}`}
                              className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 shadow-sm"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700/70">
                          Tap tiles below to build the sentence from start to finish.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#2d682d]">Word bank</h3>
                      <p className="text-xs text-slate-500">{sentenceScrambledWords.length} tiles remaining</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {sentenceScrambledWords.map((word, index) => (
                        <Button
                          key={`scramble-${word}-${index}`}
                          type="button"
                          variant="outline"
                          className="group h-12 justify-center rounded-xl border-emerald-200 bg-white text-sm font-semibold text-emerald-700 transition hover:-translate-y-1 hover:bg-emerald-500/10"
                          onClick={() => handleSentenceSelectWord(word)}
                          disabled={!sentenceScrambleActive || sentencePaused || sentenceAnswered}
                        >
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500 transition group-hover:rotate-12" />
                            {word}
                          </span>
                        </Button>
                      ))}
                      {sentenceScrambledWords.length === 0 && sentenceScrambleActive ? (
                        <p className="col-span-full text-center text-xs text-slate-400">
                          All tiles used — submit your sentence!
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="bg-[#2d682d] text-white hover:bg-[#2d682d]/90"
                      onClick={handleStartSentenceScramble}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {sentenceScrambleActive ? "Restart Quest" : "Start Quest"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSubmitSentence}
                      disabled={!sentenceCanSubmit}
                      className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Submit sentence
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSentenceHint}
                      disabled={!sentenceScrambleActive || sentencePaused || sentenceHintVisible || sentenceAnswered}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Reveal hint
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSentenceUndo}
                      disabled={!sentenceScrambleActive || sentencePaused || sentenceSelectedWords.length === 0}
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Undo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSentenceReset}
                      disabled={!sentenceScrambleActive || sentencePaused}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Shuffle tiles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-emerald-200">
                <CardHeader>
                  <CardTitle className="text-[#2d682d]">Achievement Tracker</CardTitle>
                  <CardDescription>
                    Watch your accuracy climb as sentences stretch from easy breezes to galaxy guru challenges.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                    <p className="text-xs uppercase text-emerald-600">Accuracy</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{sentenceAccuracy}%</p>
                    <Progress value={sentenceAccuracy} className="mt-2 h-2" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase text-slate-500">Completed</p>
                      <p className="text-lg font-semibold text-slate-800">{sentenceAttempts.length}</p>
                      <p className="text-xs text-slate-500">Sentences played</p>
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3">
                      <p className="text-xs uppercase text-purple-600">Perfect solves</p>
                      <p className="text-lg font-semibold text-purple-700">{totalSentenceCorrect}</p>
                      <p className="text-xs text-purple-600/80">Keep climbing to unlock mastery</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Journey progress</p>
                    <Progress value={sentenceProgress} className="h-2" />
                    <p className="mt-1 text-xs text-slate-500">
                      {sentenceAttempts.length} of {totalSentenceRounds} sentences tackled this run.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-[#2d682d]">Sentence Highlights</CardTitle>
                  <CardDescription>
                    Review each attempt to spot patterns and celebrate quick wins.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sentenceAttempts.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Complete your first scramble to unlock a timeline of victories and retries.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...sentenceAttempts]
                        .slice()
                        .reverse()
                        .map((attempt, index) => (
                          <div
                            key={`sentence-attempt-${attempt.id}-${index}`}
                            className={`rounded-xl border p-3 shadow-sm transition hover:-translate-y-0.5 ${
                              attempt.correct ? "border-emerald-200 bg-emerald-50/80" : "border-red-200 bg-red-50/70"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold ${sentenceDifficultyBadges[attempt.difficulty]}`}
                              >
                                {sentenceDifficultyLabels[attempt.difficulty]}
                              </Badge>
                              <Badge variant={attempt.correct ? "default" : "destructive"}>
                                {attempt.correct ? "Win" : "Retry"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[#2d682d]">
                              {attempt.correct ? "You solved it!" : "Needs another try"}
                            </p>
                            <p className="text-xs text-slate-600">
                              You built: <span className="font-medium">{attempt.userSentence || "(empty)"}</span>
                            </p>
                            <p className="text-xs text-slate-400">Time left: {attempt.timeRemaining}s</p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(spellingCelebration)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseSpellingCelebration()
          }
        }}
      >
        {spellingCelebration ? (
          <DialogContent className="sm:max-w-md border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white">
            <DialogHeader className="items-center text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  spellingCelebration.mode === "win"
                    ? "bg-emerald-500/20 text-emerald-600"
                    : "bg-red-500/10 text-red-600"
                }`}
              >
                {spellingCelebration.mode === "win" ? (
                  <PartyPopper className="h-8 w-8 animate-bounce" />
                ) : (
                  <Frown className="h-8 w-8 animate-pulse" />
                )}
              </div>
              <DialogTitle className="mt-4 text-2xl font-bold text-[#2d682d]">
                {spellingCelebration.mode === "win" ? "Spelling Superstar!" : "Keep Buzzing!"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                You spelled {spellingCelebration.correct} of {spellingCelebration.total} words correctly.
                {" "}
                {spellingCelebration.mode === "win"
                  ? "Your word wizardry lit up the hive."
                  : "Give it another whirl and aim for more sparkles."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-center">
              <p className="text-xs uppercase text-emerald-600">Accuracy</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">
                {Math.round((spellingCelebration.correct / spellingCelebration.total) * 100)}%
              </p>
              <Progress value={(spellingCelebration.correct / spellingCelebration.total) * 100} className="mt-3 h-2" />
            </div>
            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCloseSpellingCelebration}
              >
                Close
              </Button>
              <Button
                type="button"
                className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90"
                onClick={() => {
                  handleCloseSpellingCelebration()
                  handleStartSpelling()
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Play again
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(sentenceCelebration)}
        onOpenChange={(open) => {
          if (!open) {
            handleSentenceCelebrationClose()
          }
        }}
      >
        {sentenceCelebration ? (
          <DialogContent className="sm:max-w-lg border-purple-200 bg-gradient-to-b from-purple-50 via-white to-white">
            <DialogHeader className="items-center text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  sentenceCelebration.mode === "win"
                    ? "bg-purple-500/20 text-purple-600"
                    : "bg-red-500/10 text-red-600"
                }`}
              >
                {sentenceCelebration.mode === "win" ? (
                  <PartyPopper className="h-8 w-8 animate-bounce" />
                ) : (
                  <Frown className="h-8 w-8 animate-pulse" />
                )}
              </div>
              <DialogTitle className="mt-4 text-2xl font-bold text-[#2d682d]">
                {sentenceCelebration.mode === "win" ? "Sentence Sage!" : "Try Another Twist"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                {sentenceCelebration.context === "final"
                  ? `You completed ${sentenceCelebration.stats.correct} of ${sentenceCelebration.stats.total} sentences.`
                  : sentenceCelebration.mode === "win"
                    ? "That sentence sparkled into place. Ready for the next challenge?"
                    : "Rearrange the tiles and see if you can crack it this time."}
              </DialogDescription>
            </DialogHeader>
            {sentenceCelebration.context === "final" ? (
              <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 text-center">
                <p className="text-xs uppercase text-purple-600">Adventure stats</p>
                <p className="mt-1 text-3xl font-bold text-purple-700">
                  {Math.round(
                    (sentenceCelebration.stats.correct / (sentenceCelebration.stats.total || 1)) * 100,
                  )}%
                </p>
                <Progress
                  value={(sentenceCelebration.stats.correct / (sentenceCelebration.stats.total || 1)) * 100}
                  className="mt-3 h-2"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {sentenceCelebration.context === "round" && sentenceCelebration.round ? (
                  <>
                    <p className="font-semibold text-[#2d682d]">
                      {sentenceCelebration.round.words.length}-word sentence • {sentenceDifficultyLabels[sentenceCelebration.round.difficulty]}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">"{sentenceCelebration.round.sentence}"</p>
                  </>
                ) : null}
              </div>
            )}
            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full" onClick={handleSentenceCelebrationClose}>
                {sentenceCelebration.context === "final" ? "Close" : "Continue"}
              </Button>
              {sentenceCelebration.context === "final" ? (
                <Button
                  type="button"
                  className="w-full bg-[#2d682d] hover:bg-[#2d682d]/90"
                  onClick={() => {
                    handleSentenceCelebrationClose()
                    handleStartSentenceScramble()
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Restart adventure
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      {/* Assignment Submission Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
            <DialogDescription>
              {selectedAssignment?.title} - {selectedAssignment?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload File (Optional)</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) =>
                  setSubmissionForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] || null,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="comment">Comment (Optional)</Label>
              <Textarea
                id="comment"
                placeholder="Add any comments about your submission..."
                value={submissionForm.comment}
                onChange={(e) => setSubmissionForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">Are you sure you want to submit this assignment?</p>
              <p className="text-xs text-yellow-700 mt-1">
                Once submitted, the status will change to "Submitted" and your teacher will be notified.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              No, Cancel
            </Button>
            <Button onClick={handleSubmitAssignment} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
              Yes, Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
