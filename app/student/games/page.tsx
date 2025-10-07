"use client"

import { StudentGameHub } from "@/components/student-game-hub"
import CodingChallenge from "@/components/games/coding-challenge"
import MathRacing from "@/components/games/math-racing"
import GrammarGladiators from "@/components/games/grammar-gladiators"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function StudentGamesPage() {
  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-[#2d682d]">Student Game Arcade</CardTitle>
          <CardDescription className="text-slate-600">
            Boost your skills with code puzzles, lightning-fast math races, and grammar duels designed to power up your
            classroom confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>
            Choose any challenge below to begin. Each adventure includes streak trackers, progress meters, and quick
            feedback so you can celebrate every win.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-6 rounded-3xl border border-emerald-100 bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#2d682d]">Skill Quests</h2>
          <p className="text-sm text-slate-600">
            Dive into these interactive quests to sharpen logic, increase speed, and polish grammar while staying inside
            the arcade.
          </p>
        </div>

        <div className="grid gap-6">
          <MathRacing />
          <CodingChallenge />
          <GrammarGladiators />
        </div>
      </section>

      <StudentGameHub />
    </div>
  )
}

