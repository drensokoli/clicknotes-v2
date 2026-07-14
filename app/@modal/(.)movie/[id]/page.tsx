import "@/app/setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import { fetchMovieItem } from "@/lib/media-lookup"
import { MediaModalRoute } from "@/components/media-modal-route"

interface InterceptedMoviePageProps {
  params: Promise<{ id: string }>
}

// Intercepts a same-app click on a movie card's Link (href="/movie/[id]") into
// this parallel @modal route instead of a real navigation to app/movie/[id] -
// see that page for the direct-visit/reload fallback, and
// components/media-modal-route.tsx for how this renders/closes.
export default async function InterceptedMoviePage({ params }: InterceptedMoviePageProps) {
  const { id } = await params
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const item = await fetchMovieItem(Number(id), tmdbApiKey)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <MediaModalRoute item={item} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
