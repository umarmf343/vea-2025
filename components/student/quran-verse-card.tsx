"use client"

import { useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface QuranVerse {
  arabic: string
  transliteration: string
  translation: string
  reference: string
}

const DAILY_VERSE: QuranVerse = {
  arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
  transliteration: "Inna maʿa l-ʿusri yusrā",
  translation: "Indeed, with hardship [will be] ease.",
  reference: "Surah Ash-Sharh (94:6)",
}

export function QuranVerseCard() {
  const [showTransliteration, setShowTransliteration] = useState(false)

  const verse = useMemo(() => DAILY_VERSE, [])

  return (
    <Card className="border-emerald-100 bg-white/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-[#2d682d]">Daily Qur’an Verse</CardTitle>
          <CardDescription className="text-slate-600">
            Reflect on a short reminder from the Qur’an. Toggle transliteration to see the pronunciation and translation.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-transliteration"
            checked={showTransliteration}
            onCheckedChange={setShowTransliteration}
            aria-label="Toggle transliteration and translation"
          />
          <Label className="text-sm text-muted-foreground" htmlFor="toggle-transliteration">
            Show transliteration
          </Label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-inner">
          <p className="text-right text-3xl font-semibold leading-snug text-[#1c4b1c]">{verse.arabic}</p>
          {showTransliteration ? (
            <div className="mt-4 space-y-3 text-left">
              <p className="text-sm font-medium text-emerald-700">{verse.transliteration}</p>
              <p className="text-base text-slate-700">{verse.translation}</p>
            </div>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">{verse.reference}</p>
      </CardContent>
    </Card>
  )
}
