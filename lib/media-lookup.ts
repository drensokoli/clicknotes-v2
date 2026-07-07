import { fetchMovieDetails, fetchTVDetails } from "./tmdb-details"
import type { Movie, Series, Book } from "@/components/media-card"

// Fetches a single movie/series/book live from TMDB/Google Books for the
// /movie/[id], /series/[id], /book/[id] share-link pages (app/movie/[id]/page.tsx
// etc.) - full `details` (genres/credits/videos) come along for free since the
// TMDB detail endpoint already returns them, so the details modal doesn't need
// a second fetch once these land in it.

export async function fetchMovieItem(id: number, tmdbApiKey: string): Promise<Movie | null> {
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
}

export async function fetchSeriesItem(id: number, tmdbApiKey: string): Promise<Series | null> {
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
}

export async function fetchBookItem(id: string, googleBooksApiKey?: string): Promise<Book | null> {
  const url = googleBooksApiKey
    ? `https://www.googleapis.com/books/v1/volumes/${id}?key=${googleBooksApiKey}`
    : `https://www.googleapis.com/books/v1/volumes/${id}`

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const vi = data.volumeInfo || {}

  return {
    id: data.id,
    type: "book",
    volumeInfo: {
      title: vi.title || "Untitled",
      authors: vi.authors,
      description: vi.description,
      publishedDate: vi.publishedDate,
      pageCount: vi.pageCount,
      averageRating: vi.averageRating,
      imageLinks: vi.imageLinks,
      previewLink: vi.previewLink,
      infoLink: vi.infoLink,
      language: vi.language,
      publisher: vi.publisher,
      categories: vi.categories,
    },
    saleInfo: data.saleInfo,
  }
}
