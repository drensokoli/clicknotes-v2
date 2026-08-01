import "../../setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { fetchBookItem } from "@/lib/media-lookup"
import { MediaLandingClient } from "@/components/media-landing-client"

interface BookPageProps {
  params: Promise<{ id: string }>
}

const googleBooksApiKeys = [process.env.GOOGLE_BOOKS_API_KEY_1, process.env.GOOGLE_BOOKS_API_KEY_2].filter(
  (key): key is string => Boolean(key),
)

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { id } = await params
  const item = await fetchBookItem(id, googleBooksApiKeys)
  if (!item) return {}

  const image = item.volumeInfo.imageLinks?.thumbnail ?? undefined

  return {
    title: `${item.volumeInfo.title} - ClickNotes`,
    description: item.volumeInfo.description,
    alternates: {
      canonical: `/book/${id}`,
    },
    openGraph: {
      type: "book",
      title: item.volumeInfo.title,
      description: item.volumeInfo.description,
      url: `/book/${id}`,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: item.volumeInfo.title,
      description: item.volumeInfo.description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function BookPage({ params }: BookPageProps) {
  const { id } = await params
  const item = await fetchBookItem(id, googleBooksApiKeys)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: item.volumeInfo.title,
    description: item.volumeInfo.description,
    image: item.volumeInfo.imageLinks?.thumbnail ?? undefined,
    author: item.volumeInfo.authors?.map((name) => ({ "@type": "Person", name })),
    datePublished: item.volumeInfo.publishedDate || undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }}
      />
      <MediaLandingClient item={item} tmdbApiKey={process.env.TMDB_API_KEY || ""} omdbApiKeys={omdbApiKeys} />
    </>
  )
}
