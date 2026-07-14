import "../../setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchSeriesItem } from "@/lib/media-lookup"
import { MediaLandingClient } from "@/components/media-landing-client"

interface SeriesPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { id } = await params
  const item = await fetchSeriesItem(Number(id), process.env.TMDB_API_KEY!)
  if (!item) return {}

  const image = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined

  return {
    title: `${item.name} - ClickNotes`,
    description: item.overview,
    openGraph: {
      title: item.name,
      description: item.overview,
      images: image ? [image] : undefined,
    },
  }
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { id } = await params
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const item = await fetchSeriesItem(Number(id), tmdbApiKey)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <MediaLandingClient item={item} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
}
