import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { listForUser } from "@/lib/saved-media"
import { SavedList } from "@/components/saved-list"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Library - ClickNotes",
  description: "Your saved movies, Series, and books.",
  robots: { index: false, follow: false },
}

export default async function LibraryPage() {
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
    rating: d.rating ?? null,
    bumpedAt: d.bumpedAt ? d.bumpedAt.toISOString() : null,
    card: d.card,
    savedAt: d.createdAt.toISOString(),
  }))

  // Keys for the Library's in-place detail modal (Feature 3) - the modal fetches
  // any missing details/OMDB live in the browser, same as the route-based modal
  // (components/media-modal-route.tsx) already passes these to the client.
  const tmdbApiKey = process.env.TMDB_API_KEY || ""
  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <SavedList items={items} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
