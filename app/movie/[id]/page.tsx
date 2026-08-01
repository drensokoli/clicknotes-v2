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
    alternates: {
      canonical: `/movie/${id}`,
    },
    openGraph: {
      type: "video.movie",
      title: item.title,
      description: item.overview,
      url: `/movie/${id}`,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
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

  const movieJsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: item.title,
    description: item.overview,
    image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
    datePublished: item.release_date || undefined,
    aggregateRating: item.vote_average
      ? {
          "@type": "AggregateRating",
          ratingValue: item.vote_average,
          bestRating: 10,
          worstRating: 0,
        }
      : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(movieJsonLd) }}
      />
      <MediaLandingClient item={item} tmdbApiKey={tmdbApiKey} omdbApiKeys={omdbApiKeys} />
    </>
  )
}
