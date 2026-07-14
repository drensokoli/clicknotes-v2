import "../../setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchMovieItem } from "@/lib/media-lookup"
import { MediaLandingClient } from "@/components/media-landing-client"

interface MoviePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const { id } = await params
  const item = await fetchMovieItem(Number(id), process.env.TMDB_API_KEY!)
  if (!item) return {}

  const image = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined

  return {
    title: `${item.title} - ClickNotes`,
    description: item.overview,
    openGraph: {
      title: item.title,
      description: item.overview,
      images: image ? [image] : undefined,
    },
  }
}

export default async function MoviePage({ params }: MoviePageProps) {
  const { id } = await params
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const item = await fetchMovieItem(Number(id), tmdbApiKey)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <MediaLandingClient item={item} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
