"use client"

import { StudentGameHub } from "@/components/student-game-hub"
import FocusGardenBuilder from "@/components/games/focus-garden-builder"
import MemoryTrailTracker from "@/components/games/memory-trail-tracker"
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

      <section className="space-y-6 rounded-3xl border border-emerald-100 bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#2d682d]">Habit Builders for Stronger Memory</h2>
          <p className="text-sm text-slate-600">
            Dive into these interactive routines to strengthen recall, celebrate consistency, and keep every study streak
            inside the arcade.
          </p>
        </div>

        <div className="grid gap-6">
          <MemoryTrailTracker />
          <FocusGardenBuilder />
        </div>
      </section>

      <StudentGameHub />
    </div>
  )
}

