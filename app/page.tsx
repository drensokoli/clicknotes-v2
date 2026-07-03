import "./setup" // Setup SSL configuration first
import { MainContent } from "@/components/main-content"
import { fetchPopularMoviesWithFetch, fetchPopularTVShowsWithFetch, fetchBestsellersWithFetch } from "@/lib/fetch-helpers"
import { fallbackMovies, fallbackTVShows, fallbackBooks } from "@/lib/fallback-data"
import type { Metadata } from "next"
import type { Movie, TVShow, Book } from "@/components/media-card"

// Force static generation with revalidation
export const revalidate = 604800 // 7 days in seconds

export const metadata: Metadata = {
  title: "ClickNotes v2 - Save Movies, TV Shows & Books",
  description: "Discover and organize your favorite movies, TV shows, and books in one beautiful interface. Browse popular content and search for your favorites.",
  keywords: ["movies", "tv shows", "books", "entertainment", "discover", "organize"],
  authors: [{ name: "Dren Sokoli" }],
  openGraph: {
    title: "ClickNotes v2 - Save Movies, TV Shows & Books",
    description: "Discover and organize your favorite movies, TV shows, and books in one beautiful interface.",
    type: "website",
    siteName: "ClickNotes v2"
  },
  twitter: {
    card: "summary_large_image",
    title: "ClickNotes v2 - Save Movies, TV Shows & Books",
    description: "Discover and organize your favorite movies, TV shows, and books in one beautiful interface.",
  }
}

// Fetch the first 20 v2 cards for a media type directly from Redis.
// Redis stores only minimal card fields; the modal fetches full details on demand.
async function fetchInitialCards(baseUrl: string, mediaType: string) {
  try {
    const response = await fetch(
      `${baseUrl}/api/redisHandler?type=v2-range&mediaType=${mediaType}&start=0&end=19`,
      // Cache for 7 days, but tagged so /api/cron can bust this the moment it writes fresh
      // data to Redis - otherwise a stale (or empty) response gets stuck for the full week.
      { next: { revalidate: 60 * 60 * 24 * 7, tags: [`v2-cards-${mediaType}`] } }
    )

    if (!response.ok) {
      console.error(`❌ Failed to fetch v2-range cards for ${mediaType}`)
      return null
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.items) || data.items.length === 0) {
      console.log(`⚠️ No ${mediaType} v2 cards found`)
      return null
    }

    return data.items
  } catch (error) {
    console.error(`❌ Error fetching ${mediaType} v2 cards:`, error)
    return null
  }
}

export default async function Home() {
  console.log('🏗️ [SERVER COMPONENT] Home component rendering on server-side...');
  
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
  const nyTimesApiKey = process.env.NYTIMES_API_KEY!
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1!,
    process.env.OMDB_API_KEY_2!,
    process.env.OMDB_API_KEY_3!,
  ]

  let movies: Movie[] = []
  let tvShows: TVShow[] = []
  let books: Book[] = []
  
  // Track which Redis keys have been fetched for progressive loading
  const redisKeysFetched = {
    movies: 1, // Start with movies1
    tvshows: 1, // Start with tvshows1
    books: 1   // Start with books1
  }

  // Rankings are no longer populated server-side; kept as empty arrays for the props contract.
  const movieRanking: Array<{value: string, score: number}> = [];
  const tvShowRanking: Array<{value: string, score: number}> = [];
  const bookRanking: Array<{value: string, score: number}> = [];

  try {
    console.log('🚀 Starting data fetch for server-side props...')

    // Fetch the first 20 items from each media type directly from Redis (v2 cards)
    const [dataMovies, dataTVShows, dataBooks] = await Promise.allSettled([
      fetchInitialCards(baseUrl, 'movies'),
      fetchInitialCards(baseUrl, 'tvshows'),
      fetchInitialCards(baseUrl, 'books'),
    ])

    // Check if data is available for each type
    const hasMovies = dataMovies.status === 'fulfilled' && dataMovies.value
    const hasTVShows = dataTVShows.status === 'fulfilled' && dataTVShows.value
    const hasBooks = dataBooks.status === 'fulfilled' && dataBooks.value

    // Use data where available, fall back to APIs for missing data
    if (hasMovies && hasTVShows && hasBooks) {
      movies = Array.isArray(dataMovies.value) ? dataMovies.value.map(movie => ({ ...movie, type: "movie" as const })) : []
      tvShows = Array.isArray(dataTVShows.value) ? dataTVShows.value.map(tvShow => ({ ...tvShow, type: "tvshow" as const })) : []
      books = Array.isArray(dataBooks.value) ? dataBooks.value.map(book => ({ ...book, type: "book" as const })) : []
    } else {
      // Some data is missing, fetch missing data from APIs
      console.log('⚠️ Some data missing, fetching missing data from APIs...')

      // Use data where available, fetch from APIs where missing, and ensure arrays (not null)
      // For fallback API calls, only fetch 60 items to keep data manageable
      movies = hasMovies && Array.isArray(dataMovies.value) ? dataMovies.value.map(movie => ({ ...movie, type: "movie" as const })) : (await fetchPopularMoviesWithFetch(tmdbApiKey) || []).map(movie => ({ ...movie, type: "movie" as const }))
      tvShows = hasTVShows && Array.isArray(dataTVShows.value) ? dataTVShows.value.map(tvShow => ({ ...tvShow, type: "tvshow" as const })) : (await fetchPopularTVShowsWithFetch(tmdbApiKey) || []).map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
      books = hasBooks && Array.isArray(dataBooks.value) ? dataBooks.value.map(book => ({ ...book, type: "book" as const })) : (await fetchBestsellersWithFetch(googleBooksApiKey, nyTimesApiKey, baseUrl) || []).map(book => ({ ...book, type: "book" as const }))

      // Limit fallback API data to 60 items maximum
      if (!hasMovies && movies && movies.length > 60) {
        movies = movies.slice(0, 60);
      }
      if (!hasTVShows && tvShows && tvShows.length > 60) {
        tvShows = tvShows.slice(0, 60);
      }
      if (!hasBooks && books && books.length > 60) {
        books = books.slice(0, 60);
      }

      if (!hasMovies && !movies) movies = fallbackMovies.map(movie => ({ ...movie, type: "movie" as const }))
      if (!hasTVShows && !tvShows) tvShows = fallbackTVShows.map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
      if (!hasBooks && !books) books = fallbackBooks.map(book => ({ ...book, type: "book" as const }))
    }
  } catch (error) {
    console.error('❌ Error fetching initial data:', error)
    // Use fallback data if all methods fail, but limit to 60 items maximum
    movies = fallbackMovies.slice(0, 60).map(movie => ({ ...movie, type: "movie" as const }))
    tvShows = fallbackTVShows.slice(0, 60).map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
    books = fallbackBooks.slice(0, 60).map(book => ({ ...book, type: "book" as const }))
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(26,86,219,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(28,100,242,0.05),transparent_50%)]" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
              <MainContent
        initialMovies={movies}
        initialTVShows={tvShows}
        initialBooks={books}
        movieRanking={movieRanking}
        tvShowRanking={tvShowRanking}
        bookRanking={bookRanking}
        tmdbApiKey={tmdbApiKey}
        googleBooksApiKey={googleBooksApiKey}
        redisKeysFetched={redisKeysFetched}
        omdbApiKeys={omdbApiKeys}
      />
      </div>
    </div>
  )
}
