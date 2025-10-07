"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ChallengeOption {
  label: string
  snippet: string
}

interface Challenge {
  id: string
  title: string
  concept: "loops" | "conditions" | "debugging" | "functions"
  prompt: string
  starter: string
  options: ChallengeOption[]
  answer: string
  reflection: string
  hint: string
}

const CONCEPT_BADGES: Record<Challenge["concept"], { label: string; style: string }> = {
  loops: { label: "Loop logic", style: "bg-sky-100 text-sky-700 border-sky-200" },
  conditions: { label: "Smart conditions", style: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  debugging: { label: "Bug busting", style: "bg-amber-100 text-amber-700 border-amber-200" },
  functions: { label: "Function flow", style: "bg-purple-100 text-purple-700 border-purple-200" },
}

const CHALLENGES: Challenge[] = [
  {
    id: "loop-robots",
    title: "Program the helper bots",
    concept: "loops",
    prompt:
      "Five helper bots need to pick up supplies. Fill in the loop so every bot grabs one box without repeating extra turns.",
    starter: `let boxes = ["paint", "markers", "scissors", "glue", "paper"]
let message = ""

// TODO: Add the right loop condition
for (let index = 0; ???; index++) {
  message += boxes[index] + " ready!\n"
}
`,
    options: [
      { label: "A", snippet: "index <= boxes.length" },
      { label: "B", snippet: "index < boxes.length" },
      { label: "C", snippet: "index <= boxes.length - 1" },
    ],
    answer: "index < boxes.length",
    reflection: "A loop stops at the array length so you don't read past the final box.",
    hint: "Remember that array indexes start at 0 and the last index is length - 1.",
  },
  {
    id: "rainy-field-trip",
    title: "Plan the field trip",
    concept: "conditions",
    prompt:
      "Students vote on indoor and outdoor activities. Write the condition that chooses the museum when rain is expected.",
    starter: `const forecast = "rain" // could be "rain" or "sun"
let activity = ""

if (???) {
  activity = "Visit the science museum"
} else {
  activity = "Hiking nature trail"
}
`,
    options: [
      { label: "A", snippet: "forecast === \"sun\"" },
      { label: "B", snippet: "forecast === \"rain\"" },
      { label: "C", snippet: "forecast !== \"rain\"" },
    ],
    answer: "forecast === \"rain\"",
    reflection: "Conditions compare values. When the forecast is rain, we pick the dry, indoor choice.",
    hint: "Use a triple equals (===) to check for a perfect match.",
  },
  {
    id: "debug-badge",
    title: "Fix the celebration counter",
    concept: "debugging",
    prompt:
      "The celebration counter should only cheer when the streak hits a multiple of 3. Which fix keeps the logic working?",
    starter: `let streak = 9
let message = ""

if (streak % 3 = 0) {
  message = "Confetti unlocked!"
}
`,
    options: [
      { label: "A", snippet: "streak % 3 === 0" },
      { label: "B", snippet: "streak % 3 == 0" },
      { label: "C", snippet: "streak / 3 === 0" },
    ],
    answer: "streak % 3 === 0",
    reflection: "The modulo operator (%) finds the remainder. Use === for a strict comparison.",
    hint: "Look closely at the operator inside the if statement.",
  },
  {
    id: "function-cheer",
    title: "Cheer for classmates",
    concept: "functions",
    prompt:
      "Create a function that wraps a student's name in a cheer message. Choose the line that returns the celebration text.",
    starter: `function cheerFor(name) {
  // TODO: return the message so other code can use it
  ???
}

const cheer = cheerFor("Jordan")
`,
    options: [
      { label: "A", snippet: "name => \"Go, \" + name + \"!\"" },
      { label: "B", snippet: "return \"Go, \" + name + \"!\"" },
      { label: "C", snippet: "console.log(\"Go, \" + name + \"!\")" },
    ],
    answer: "return \"Go, \" + name + \"!\"",
    reflection: "Functions send back values with return so the cheer can be stored or displayed.",
    hint: "Only one option actually returns something from the function.",
  },
]

const getNextIndex = (currentIndex: number, total: number) => Math.min(total - 1, currentIndex + 1)

export default function CodingChallenge() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [streak, setStreak] = useState(0)
  const [showHint, setShowHint] = useState(false)

  const challenge = CHALLENGES[currentIndex]
  const progressValue = useMemo(
    () => Math.round(((currentIndex + (selectedOption ? 0.5 : 0)) / CHALLENGES.length) * 100),
    [currentIndex, selectedOption],
  )

  const handleCheckAnswer = () => {
    if (!selectedOption) {
      return
    }

    if (selectedOption === challenge.answer) {
      const successMessage = `✅ ${challenge.title} — ${challenge.reflection}`
      setProgressLog((previous) => [successMessage, ...previous].slice(0, 6))
      setStreak((previous) => previous + 1)
      setShowHint(false)
      if (currentIndex === CHALLENGES.length - 1) {
        return
      }
      setTimeout(() => {
        setCurrentIndex((previous) => getNextIndex(previous, CHALLENGES.length))
        setSelectedOption(null)
      }, 360)
    } else {
      const retryMessage = `⏪ Try again: ${challenge.title}`
      setProgressLog((previous) => [retryMessage, ...previous].slice(0, 6))
      setStreak(0)
      setShowHint(false)
    }
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setProgressLog([])
    setStreak(0)
    setShowHint(false)
  }

  return (
    <Card className="border-slate-200 bg-white/80 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl font-semibold text-slate-900">Coding Challenge</CardTitle>
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            Logic level {currentIndex + 1} / {CHALLENGES.length}
          </Badge>
        </div>
        <CardDescription className="text-slate-600">
          Use loops, conditions, and smart debugging to help classmates solve coding puzzles. Pick the code that makes
          the program behave as described.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Puzzle progress</span>
            <span className="text-slate-500">{progressValue}% complete</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <Tabs value={challenge.id} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {CHALLENGES.map((item) => (
              <TabsTrigger key={item.id} value={item.id} disabled={item.id !== challenge.id} className="text-xs">
                {item.title.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
          {CHALLENGES.map((item) => {
            const conceptBadge = CONCEPT_BADGES[item.concept]
            return (
              <TabsContent key={item.id} value={item.id} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("border text-xs", conceptBadge.style)}>
                    {conceptBadge.label}
                  </Badge>
                  <span className="text-sm text-slate-500">{item.prompt}</span>
                </div>
                <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950/90 p-4 text-sm text-slate-100 shadow-inner">
{item.starter}
                </pre>
                <div className="grid gap-2">
                  {item.options.map((option) => {
                    const isSelected = selectedOption === option.snippet
                    return (
                      <Button
                        key={option.snippet}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "justify-start text-left font-mono",
                          isSelected ? "bg-indigo-600 hover:bg-indigo-600" : "bg-white",
                        )}
                        onClick={() => setSelectedOption(option.snippet)}
                        disabled={item.id !== challenge.id}
                      >
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700">
                          {option.label}
                        </span>
                        {option.snippet}
                      </Button>
                    )
                  })}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCheckAnswer} disabled={!selectedOption}>
            Check my code
          </Button>
          <Button variant="outline" onClick={() => setShowHint((previous) => !previous)}>
            {showHint ? "Hide hint" : "Need a hint?"}
          </Button>
          <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-700">
            Reset journey
          </Button>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Streak: {streak}
          </Badge>
        </div>

        {showHint && (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-700">
            💡 Hint: {challenge.hint}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Recent breakthroughs</h4>
          {progressLog.length === 0 ? (
            <p className="text-sm text-slate-500">Your solution log will appear here. Solve a puzzle to get started!</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600">
              {progressLog.map((entry, index) => (
                <li key={index} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
