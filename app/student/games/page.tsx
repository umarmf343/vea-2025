import StudentGamesPageClient from "@/components/student/games-page-client"

export const dynamic =
  process.env.NEXT_BUILD_TARGET === "export" ? "force-static" : "force-dynamic"

export default function StudentGamesPage() {
  return <StudentGamesPageClient />
}
