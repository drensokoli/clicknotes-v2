import "@/app/setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import { fetchSeriesItem } from "@/lib/media-lookup"
import { MediaModalRoute } from "@/components/media-modal-route"

interface InterceptedSeriesPageProps {
  params: Promise<{ id: string }>
}

// Intercepts a same-app click on a series card's Link (href="/series/[id]")
// into this parallel @modal route instead of a real navigation to
// app/series/[id] - see that page for the direct-visit/reload fallback, and
// components/media-modal-route.tsx for how this renders/closes.
export default async function InterceptedSeriesPage({ params }: InterceptedSeriesPageProps) {
  const { id } = await params
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const item = await fetchSeriesItem(Number(id), tmdbApiKey)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <MediaModalRoute item={item} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
