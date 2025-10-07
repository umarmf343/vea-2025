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

      <StudentGameHub />
    </div>
  )
}

