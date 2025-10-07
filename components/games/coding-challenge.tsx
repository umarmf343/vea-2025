"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const htmlSnippet = `<section class="profile-card">
  <img src="student-avatar.png" alt="Student avatar" class="profile-card__photo" />
  <h1 class="profile-card__name">Amina the Coder</h1>
  <p class="profile-card__tagline">Building bright ideas with code and kindness.</p>
  <a href="#projects" class="profile-card__button">See Projects</a>
</section>`

const cssSnippet = `.profile-card {
  background: linear-gradient(135deg, #fef9c3, #d9f99d);
  border: 2px solid #65a30d;
  border-radius: 20px;
  max-width: 320px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 18px 35px -20px rgba(34, 197, 94, 0.9);
}

.profile-card__photo {
  border-radius: 50%;
  border: 4px solid #22c55e;
  width: 96px;
  height: 96px;
  object-fit: cover;
  margin-bottom: 16px;
}

.profile-card__name {
  font: 600 1.5rem/1.2 "Poppins", system-ui;
  color: #14532d;
}

.profile-card__tagline {
  color: #1f2937;
  line-height: 1.6;
  margin: 12px 0 24px;
}

.profile-card__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 999px;
  background-color: #16a34a;
  color: #f7fee7;
  font-weight: 600;
  text-decoration: none;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.profile-card__button:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 25px -18px rgba(22, 163, 74, 0.9);
}`

export default function CodingChallenge() {
  return (
    <Card className="border-slate-200 bg-white/90">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-slate-900">Coding Game: Simple HTML &amp; CSS</CardTitle>
        <CardDescription className="text-slate-600">
          Use the starter markup and styles to craft a playful profile card. Swap colors, add icons, or remix the layout to
          make it your own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm text-slate-700">
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-emerald-700">1. Set the scene</h3>
          <p>
            Copy this HTML into a blank page. It has just enough structure for you to design a card for your favorite
            classmate, club, or superhero.
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs font-mono text-emerald-100 shadow-inner">
            <code>{htmlSnippet}</code>
          </pre>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-emerald-700">2. Style it up</h3>
          <p>
            Drop these CSS rules into a <code>&lt;style&gt;</code> tag or a separate stylesheet. Adjust the gradient, fonts, and
            spacing to match the vibe of your character.
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs font-mono text-emerald-100 shadow-inner">
            <code>{cssSnippet}</code>
          </pre>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-emerald-700">3. Add your twist</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>Add a fun fact list using plain <code>&lt;ul&gt;</code> and <code>&lt;li&gt;</code> tags.</li>
            <li>Create a second button that links to a class project or helpful resource.</li>
            <li>Experiment with CSS hover effects, borders, or background images for extra flair.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-emerald-900">
          <h3 className="text-lg font-semibold">Pro tip</h3>
          <p>
            Keep your code tidy by grouping related CSS rules and naming classes clearly. Small tweaks like consistent
            spacing and matching colors make a simple HTML + CSS build look like a polished web app.
          </p>
        </section>
      </CardContent>
    </Card>
  )
}
