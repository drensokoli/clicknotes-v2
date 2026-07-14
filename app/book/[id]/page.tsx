import "../../setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchBookItem } from "@/lib/media-lookup"
import { MediaLandingClient } from "@/components/media-landing-client"

interface BookPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { id } = await params
  const item = await fetchBookItem(id, process.env.GOOGLE_BOOKS_API_KEY_2)
  if (!item) return {}

  const image = item.volumeInfo.imageLinks?.thumbnail ?? undefined

  return {
    title: `${item.volumeInfo.title} - ClickNotes`,
    description: item.volumeInfo.description,
    openGraph: {
      title: item.volumeInfo.title,
      description: item.volumeInfo.description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function BookPage({ params }: BookPageProps) {
  const { id } = await params
  const item = await fetchBookItem(id, process.env.GOOGLE_BOOKS_API_KEY_2)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return (
    <MediaLandingClient item={item} tmdbApiKey={process.env.TMDB_API_KEY || ""} omdbApiKeys={omdbApiKeys} />
  )
}
