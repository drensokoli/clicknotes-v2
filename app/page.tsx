import "./setup" // Setup SSL configuration first
import { Navigation } from "@/components/navigation"
import { ContentSection } from "@/components/content-section"
import { MediaDetailsModal } from "@/components/media-details-modal"
import { fetchPopularMoviesWithFetch, fetchPopularTVShowsWithFetch, fetchBestsellersWithFetch } from "@/lib/fetch-helpers"
import { fallbackMovies, fallbackTVShows, fallbackBooks } from "@/lib/fallback-data"
import type { Metadata } from "next"

// Force static generation with revalidation
export const revalidate = 60 * 60 * 24 * 7 // 7 days

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

// Helper function to fetch data from Redis
async function fetchFromRedis(baseUrl: string) {
  try {
    console.log('🔍 Attempting to fetch data from Redis...')
    const response = await fetch(`${baseUrl}/api/redisHandler`, {
      next: { revalidate: 60 * 60 * 24 * 7 } // Cache for 7 days
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Redis data fetched successfully:', {
        movies: data.movies?.length || 0,
        tvshows: data.tvshows?.length || 0,
        books: data.books?.length || 0
      })
      return data
    } else {
      console.log('❌ Redis response not OK:', response.status)
      return null
    }
  } catch (error) {
    console.log('🚫 Redis fetch failed:', error)
    return null
  }
}

export default async function Home() {
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
  const nyTimesApiKey = process.env.NYTIMES_API_KEY!
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const omdbApiKeys = [
    process.env.OMDB_API_KEY_1!,
    process.env.OMDB_API_KEY_2!,
    process.env.OMDB_API_KEY_3!,
  ]

  let movies: any[] = []
  let tvShows: any[] = []
  let books: any[] = []

  try {
    // First, try to get data from Redis
    console.log('🔄 Step 1: Attempting Redis fetch...')
    const redisData = await fetchFromRedis(baseUrl)
    
    if (redisData && redisData.movies && redisData.tvshows && redisData.books) {
      // Redis has all the data we need
      console.log('✅ Using Redis data for all media types')
      movies = redisData.movies
      tvShows = redisData.tvshows
      books = redisData.books
    } else {
      // Redis is missing some or all data, fall back to API calls
      console.log('⚠️ Redis data incomplete, falling back to API calls...')
      
      // Fetch data in parallel using fetch API for better SSL handling
      // Fetch full dataset like in v1 (20 pages = ~400 movies/shows)
      const results = await Promise.allSettled([
        fetchPopularMoviesWithFetch(tmdbApiKey, 20, baseUrl),
        fetchPopularTVShowsWithFetch(tmdbApiKey, 20, baseUrl),
        fetchBestsellersWithFetch(googleBooksApiKey, nyTimesApiKey, baseUrl)
      ])

      movies = results[0].status === 'fulfilled' ? results[0].value || fallbackMovies : fallbackMovies
      tvShows = results[1].status === 'fulfilled' ? results[1].value || fallbackTVShows : fallbackTVShows
      books = results[2].status === 'fulfilled' ? results[2].value || fallbackBooks : fallbackBooks
    }
  } catch (error) {
    console.error('❌ Error fetching initial data:', error)
    // Use fallback data if all methods fail
    movies = fallbackMovies
    tvShows = fallbackTVShows
    books = fallbackBooks
  }

  console.log('📊 Final data counts:', {
    movies: movies.length,
    tvShows: tvShows.length,
    books: books.length
  })

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
        <Navigation />
        <main>
          <ContentSection 
            initialMovies={movies}
            initialTVShows={tvShows}
            initialBooks={books}
            tmdbApiKey={tmdbApiKey}
            googleBooksApiKey={googleBooksApiKey}
          />
        </main>
        
        {/* Global Modal */}
        <MediaDetailsModal omdbApiKeys={omdbApiKeys} />
      </div>
    </div>
  )
}
