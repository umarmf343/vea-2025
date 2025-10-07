"use client"

import { StudentGameHub } from "@/components/student-game-hub"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function StudentGamesPage() {
  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-[#2d682d]">Student Game Arcade</CardTitle>
          <CardDescription className="text-slate-600">
            Boost your skills with quick-thinking math sprints, confident spelling practice, and sentence adventures.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>
            Choose any challenge below to begin. Each game tracks your progress and celebrates your wins with a joyful
            confetti shower when you complete a session.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4 rounded-3xl border border-emerald-100 bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#2d682d]">Habit Builders for Stronger Memory</h2>
          <p className="text-sm text-slate-600">
            Layer these daily mini-games into the arcade to help students strengthen recall and stick with productive
            study habits.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-full border-emerald-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-semibold text-[#2d682d]">Memory Trail Tracker</CardTitle>
              <CardDescription>Daily storytelling streaks that turn revision into a rewarding quest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                Students rebuild a short story from visual cards each day. A streak counter and gentle reminders keep the
                habit alive while spaced prompts revisit earlier scenes to deepen long-term retention.
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Highlights what changed since yesterday to reinforce comparison-based recall.</li>
                <li>Unlocks bonus art frames after every 5-day streak to celebrate consistency.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="h-full border-amber-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-semibold text-[#2d682d]">Focus Garden Builder</CardTitle>
              <CardDescription>Mindful study sprints that grow a virtual garden through repetition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                Learners schedule short review bursts; each completed session waters specific plants linked to a subject.
                Missing a session gently wilts leaves, nudging them to return before the garden fades.
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Weekly reflection prompts ask students to recall key facts while tending their plants.</li>
                <li>Habit analytics spotlight the best time-of-day streaks to build metacognitive awareness.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <StudentGameHub />
    </div>
  )
}

