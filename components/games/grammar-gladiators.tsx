"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ArenaChallenge {
  id: string
  title: string
  focus: "parts-of-speech" | "sentences" | "punctuation" | "proofreading"
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

const FOCUS_BADGES: Record<ArenaChallenge["focus"], { label: string; style: string }> = {
  "parts-of-speech": { label: "Parts of speech", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  sentences: { label: "Sentence surgeon", style: "border-amber-200 bg-amber-50 text-amber-700" },
  punctuation: { label: "Punctuation pro", style: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  proofreading: { label: "Proofreading hero", style: "border-purple-200 bg-purple-50 text-purple-700" },
}

const CHALLENGES: ArenaChallenge[] = [
  {
    id: "stage-1",
    title: "Identify the noun",
    focus: "parts-of-speech",
    prompt: "Choose the word that names a person, place, or thing in the sentence: 'The brave pilot guided the plane safely.'",
    options: ["brave", "pilot", "guided", "safely"],
    answer: "pilot",
    explanation: "A noun names a person, place, or thing. 'Pilot' names a person in the sentence.",
  },
  {
    id: "stage-2",
    title: "Fix the fragment",
    focus: "sentences",
    prompt: "Which choice completes the fragment 'While the students prepared their speeches'?",
    options: [
      "the teachers set up the auditorium.",
      "After the bell.",
      "Because they were excited.",
      "During the assembly.",
    ],
    answer: "the teachers set up the auditorium.",
    explanation: "A sentence needs a subject and predicate. The correct option adds a predicate that finishes the thought.",
  },
  {
    id: "stage-3",
    title: "Choose the correct punctuation",
    focus: "punctuation",
    prompt: "Select the punctuation that correctly completes the sentence: 'Bring your notebooks pencils rulers and calculators'",
    options: [",", "?", ";", "!"],
    answer: ",",
    explanation: "Commas separate items in a list. The other options change the meaning or create fragments.",
  },
  {
    id: "stage-4",
    title: "Polish the paragraph",
    focus: "proofreading",
    prompt: "Which revision fixes the run-on sentence? 'We studied verbs today we acted each one out.'",
    options: [
      "We studied verbs today and acted each one out.",
      "We studied verbs today acted each one out.",
      "We studied verbs today, we acted each one out.",
      "Studied verbs today, acted each one out.",
    ],
    answer: "We studied verbs today and acted each one out.",
    explanation: "Adding a conjunction joins the two ideas correctly without creating a comma splice.",
  },
]

const MAX_HEALTH = 100
const DAMAGE = 34

export default function GrammarGladiators() {
  const [stageIndex, setStageIndex] = useState(0)
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH)
  const [rivalHealth, setRivalHealth] = useState(MAX_HEALTH)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const stage = CHALLENGES[stageIndex]

  const progressValue = useMemo(
    () => Math.round(((stageIndex + (rivalHealth < MAX_HEALTH ? 0.5 : 0)) / CHALLENGES.length) * 100),
    [rivalHealth, stageIndex],
  )
  const victories = useMemo(
    () => Math.min(CHALLENGES.length, stageIndex + (rivalHealth === 0 ? 1 : 0)),
    [rivalHealth, stageIndex],
  )

  const handleAnswer = (choice: string) => {
    if (playerHealth <= 0 || rivalHealth <= 0) {
      return
    }

    setSelected(choice)

    if (choice === stage.answer) {
      const newHealth = Math.max(0, rivalHealth - DAMAGE)
      setRivalHealth(newHealth)
      setBattleLog((previous) =>
        [`⚔️ Correct! ${stage.explanation}`, ...previous].slice(0, 6),
      )
      if (newHealth === 0 && stageIndex < CHALLENGES.length - 1) {
        setTimeout(() => {
          setStageIndex((previous) => previous + 1)
          setRivalHealth(MAX_HEALTH)
          setSelected(null)
        }, 420)
      }
    } else {
      const newPlayer = Math.max(0, playerHealth - DAMAGE)
      setPlayerHealth(newPlayer)
      setBattleLog((previous) =>
        [`🛡️ Missed! ${stage.answer} was the best move.`, ...previous].slice(0, 6),
      )
    }
  }

  const handleReset = () => {
    setStageIndex(0)
    setPlayerHealth(MAX_HEALTH)
    setRivalHealth(MAX_HEALTH)
    setBattleLog([])
    setSelected(null)
  }

  const arenaStatus = useMemo(() => {
    if (playerHealth <= 0) {
      return { label: "Battle lost — try again", className: "border-rose-200 bg-rose-50 text-rose-700" }
    }
    if (stageIndex === CHALLENGES.length - 1 && rivalHealth === 0) {
      return { label: "Grammar champion!", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    }
    if (rivalHealth === MAX_HEALTH) {
      return { label: "Ready for the bell", className: "border-slate-200 bg-slate-100 text-slate-700" }
    }
    return { label: "Keep striking!", className: "border-indigo-200 bg-indigo-50 text-indigo-700" }
  }, [playerHealth, rivalHealth, stageIndex])

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl font-semibold text-slate-900">Grammar Gladiators</CardTitle>
          <Badge variant="outline" className={arenaStatus.className}>
            {arenaStatus.label}
          </Badge>
        </div>
        <CardDescription className="text-slate-600">
          Battle grammar challenges in the arena. Each correct answer powers up your gladiator, while mistakes chip away
          at your shield. Clear every stage to become the grammar champion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Arena progress</span>
            <span className="text-slate-500">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <Tabs value={stage.id} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {CHALLENGES.map((challenge) => (
              <TabsTrigger key={challenge.id} value={challenge.id} disabled={challenge.id !== stage.id} className="text-xs">
                {challenge.title.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
          {CHALLENGES.map((challenge) => {
            const badge = FOCUS_BADGES[challenge.focus]
            return (
              <TabsContent key={challenge.id} value={challenge.id} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("border text-xs", badge.style)}>
                    {badge.label}
                  </Badge>
                  <span className="text-sm text-slate-500">{challenge.prompt}</span>
                </div>
                <div className="grid gap-2">
                  {challenge.options.map((option) => {
                    const isSelected = selected === option
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "justify-start text-left",
                          isSelected ? "bg-purple-600 hover:bg-purple-600" : "bg-white",
                        )}
                        onClick={() => handleAnswer(option)}
                        disabled={challenge.id !== stage.id || playerHealth <= 0 || rivalHealth <= 0}
                      >
                        {option}
                      </Button>
                    )
                  })}
                </div>
                {challenge.id === stage.id && selected !== null && (
                  <p className="text-sm text-slate-500">
                    {selected === stage.answer ? stage.explanation : `Review: ${stage.explanation}`}
                  </p>
                )}
              </TabsContent>
            )
          })}
        </Tabs>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700">Gladiator health</h4>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>You</span>
                  <span>{playerHealth}</span>
                </div>
                <Progress value={playerHealth} className="h-2 bg-slate-200" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Opponent</span>
                  <span>{rivalHealth}</span>
                </div>
                <Progress value={rivalHealth} className="h-2 bg-slate-200" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm text-sm text-slate-600">
            <h4 className="text-sm font-semibold text-slate-700">Battle log</h4>
            {battleLog.length === 0 ? (
              <p className="text-sm text-slate-500">Strike with a correct answer to see your moves recorded here!</p>
            ) : (
              <ul className="space-y-2">
                {battleLog.map((entry, index) => (
                  <li key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    {entry}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleReset}>Reset arena</Button>
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
            Stage {stageIndex + 1} / {CHALLENGES.length}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Victories: {victories} / {CHALLENGES.length}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
