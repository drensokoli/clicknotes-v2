import "@/app/setup" // Setup SSL configuration first
import { notFound } from "next/navigation"
import { fetchBookItem } from "@/lib/media-lookup"
import { MediaModalRoute } from "@/components/media-modal-route"

interface InterceptedBookPageProps {
  params: Promise<{ id: string }>
}

// Intercepts a same-app click on a book card's Link (href="/book/[id]") into
// this parallel @modal route instead of a real navigation to app/book/[id] -
// see that page for the direct-visit/reload fallback, and
// components/media-modal-route.tsx for how this renders/closes.
const googleBooksApiKeys = [process.env.GOOGLE_BOOKS_API_KEY_1, process.env.GOOGLE_BOOKS_API_KEY_2].filter(
  (key): key is string => Boolean(key),
)

export default async function InterceptedBookPage({ params }: InterceptedBookPageProps) {
  const { id } = await params
  const item = await fetchBookItem(id, googleBooksApiKeys)
  if (!item) notFound()

  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1 || "",
    process.env.OMDB_API_KEY_2 || "",
    process.env.OMDB_API_KEY_3 || "",
  ]

  return <MediaModalRoute item={item} tmdbApiKey={process.env.TMDB_API_KEY || ""} omdbApiKeys={omdbApiKeys} />
}
