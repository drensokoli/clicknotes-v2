import { cache } from "react"
import { fetchMovieDetails, fetchTVDetails } from "./tmdb-details"
import type { Movie, Series, Book } from "@/components/media-card"

// Fetches a single movie/series/book live from TMDB/Google Books - used by both
// the direct-visit /movie/[id] etc. pages (app/movie/[id]/page.tsx) and their
// app/@modal/(.)movie/[id]/page.tsx intercepting-route counterparts. Full
// `details` (genres/credits/videos) come along for free since the TMDB detail
// endpoint already returns them, so the details modal doesn't need a second
// fetch once these land in it.
//
// Wrapped in React's request-scoped cache() since each page also calls the
// same function again from generateMetadata() - without this every page load
// fired two (or more, see fetchBookItem's ISBN fallback) near-simultaneous
// duplicate requests to the same upstream API, which was enough to trip
// Google Books' burst rate limit (503 backendFailed) on its own.

export const fetchMovieItem = cache(async (id: number, tmdbApiKey: string): Promise<Movie | null> => {
  const details = await fetchMovieDetails(id, tmdbApiKey)
  if (!details) return null

  return {
    id: details.id,
    title: details.title,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    release_date: details.release_date,
    vote_average: details.vote_average,
    genre_ids: details.genres.map((g) => g.id),
    adult: false,
    type: "movie",
    details,
  }
})

export const fetchSeriesItem = cache(async (id: number, tmdbApiKey: string): Promise<Series | null> => {
  const details = await fetchTVDetails(id, tmdbApiKey)
  if (!details) return null

  return {
    id: details.id,
    name: details.name,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    first_air_date: details.first_air_date,
    vote_average: details.vote_average,
    genre_ids: details.genres.map((g) => g.id),
    number_of_seasons: details.number_of_seasons,
    type: "series",
    details,
  }
})

function toBook(id: string, vi: Record<string, unknown>, saleInfo: unknown): Book {
  return {
    id,
    type: "book",
    volumeInfo: {
      title: (vi.title as string) || "Untitled",
      authors: vi.authors as string[] | undefined,
      description: vi.description as string | undefined,
      publishedDate: vi.publishedDate as string | undefined,
      pageCount: vi.pageCount as number | undefined,
      averageRating: vi.averageRating as number | undefined,
      imageLinks: vi.imageLinks as Book["volumeInfo"]["imageLinks"],
      previewLink: vi.previewLink as string | undefined,
      infoLink: vi.infoLink as string | undefined,
      language: vi.language as string | undefined,
      publisher: vi.publisher as string | undefined,
      categories: vi.categories as string[] | undefined,
    },
    saleInfo: saleInfo as Book["saleInfo"],
  }
}

// 10 or 13 digit ISBN, which is what every Popular/Library book card's `id`
// actually is (see app/api/cron/route.ts's `id: isbn` during population) -
// only a card sourced from a live title search carries a real (alphanumeric)
// Google Books volume id.
const ISBN_PATTERN = /^\d{10}(\d{3})?$/

// Google Books' API returns a transient 503 ("backendFailed") often enough in
// practice that a bare single-shot fetch isn't reliable - retry once after a
// short delay before giving up.
async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400))
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // fall through to retry/return null below
    }
  }
  return null
}

async function fetchBookByVolumeId(id: string, googleBooksApiKey?: string): Promise<Book | null> {
  const url = googleBooksApiKey
    ? `https://www.googleapis.com/books/v1/volumes/${id}?key=${googleBooksApiKey}`
    : `https://www.googleapis.com/books/v1/volumes/${id}`

  const response = await fetchWithRetry(url)
  if (!response) return null

  const data = await response.json()
  return toBook(data.id, data.volumeInfo || {}, data.saleInfo)
}

async function fetchBookByIsbn(isbn: string, googleBooksApiKey?: string): Promise<Book | null> {
  const url = googleBooksApiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`

  const response = await fetchWithRetry(url)
  if (!response) return null

  const data = await response.json()
  const item = data.items?.[0]
  if (!item) return null

  // Keep the id the caller passed in (the ISBN) rather than swapping in
  // Google's real volume id, so it still matches the mediaId already used
  // for this book's saved/watched status elsewhere.
  return toBook(isbn, item.volumeInfo || {}, item.saleInfo)
}

export const fetchBookItem = cache(async (id: string, googleBooksApiKey?: string): Promise<Book | null> => {
  if (ISBN_PATTERN.test(id)) {
    return fetchBookByIsbn(id, googleBooksApiKey)
  }

  const direct = await fetchBookByVolumeId(id, googleBooksApiKey)
  if (direct) return direct

  // Not ISBN-shaped and the direct lookup still failed - unlikely, but try
  // an ISBN search anyway before giving up, in case it's an ISBN with a
  // shape we didn't anticipate.
  return fetchBookByIsbn(id, googleBooksApiKey)
})
