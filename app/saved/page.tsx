import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { listForUser } from "@/lib/saved-media"
import { SavedList } from "@/components/saved-list"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "My List - ClickNotes v2",
  description: "Your saved movies, TV shows, and books.",
}

export default async function SavedPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const docs = await listForUser(session.user.id)

  // Pass only plain, serializable fields to the client component.
  const items = docs.map((d) => ({
    mediaType: d.mediaType,
    mediaId: d.mediaId,
    status: d.status,
    card: d.card,
  }))

  const tmdbApiKey = process.env.TMDB_API_KEY || ""
  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <SavedList items={items} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
