import "./setup" // Setup SSL configuration first
import { ClientNavigation } from "@/components/client-navigation"
import { ContentSection } from "@/components/content-section"
import { MediaDetailsModal } from "@/components/media-details-modal"
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

// Global cache for Redis data (server-side only)
let redisDataCache: {
  movies: Movie[] | null;
  tvshows: TVShow[] | null;
  books: Book[] | null;
  lastFetched: number | null;
} = {
  movies: null,
  tvshows: null,
  books: null,
  lastFetched: null
};

// Cache duration: 7 days in milliseconds
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Helper function to fetch specific page from Redis with proper caching
async function fetchPageFromRedis(baseUrl: string, mediaType: string, page: number = 1) {
  try {
    const key = `${mediaType}${page}`;
    console.log(`🔍 Fetching ${key} from Redis...`)
    const response = await fetch(`${baseUrl}/api/redisHandler?type=${key}`, {
      next: { revalidate: 60 * 60 * 24 * 7 } // Cache for 7 days
    })
    
    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ Redis ${key} data fetched successfully: ${data.length} items`)
        return data
      } else {
        console.log(`⚠️ Redis ${key} data is empty or invalid`)
        return null
      }
    } else {
      console.log(`❌ Redis ${key} response not OK:`, response.status)
      return null
    }
  } catch (error) {
    console.log("🚫 Redis fetch failed:", error)
    return null
  }
}

// Helper function to get cached Redis data or fetch if needed
async function getCachedRedisData(baseUrl: string) {
  const now = Date.now();
  
  // Check if we have valid cached data
  if (redisDataCache.lastFetched && 
      (now - redisDataCache.lastFetched) < CACHE_DURATION &&
      redisDataCache.movies && 
      redisDataCache.tvshows && 
      redisDataCache.books) {
    
    const cacheAgeHours = Math.round((now - redisDataCache.lastFetched) / (1000 * 60 * 60));
    console.log('✅ Using cached Redis data (age:', cacheAgeHours, 'hours)');
    console.log('📊 Cached data counts:', {
      movies: redisDataCache.movies?.length || 0,
      tvshows: redisDataCache.tvshows?.length || 0,
      books: redisDataCache.books?.length || 0
    });
    return {
      movies: redisDataCache.movies,
      tvshows: redisDataCache.tvshows,
      books: redisDataCache.books
    };
  }
  
  console.log('🔄 Cache expired or missing, fetching fresh data from Redis...');
  console.log('📊 Cache status:', {
    hasLastFetched: !!redisDataCache.lastFetched,
    lastFetchedAge: redisDataCache.lastFetched ? Math.round((now - redisDataCache.lastFetched) / (1000 * 60 * 60)) : 'N/A',
    hasMovies: !!redisDataCache.movies,
    hasTVShows: !!redisDataCache.tvshows,
    hasBooks: !!redisDataCache.books
  });
  
  // Fetch fresh data from Redis
  const [redisMovies, redisTVShows, redisBooks] = await Promise.allSettled([
    fetchPageFromRedis(baseUrl, 'movies', 1),
    fetchPageFromRedis(baseUrl, 'tvshows', 1),
    fetchPageFromRedis(baseUrl, 'books', 1)
  ]);
  
  // Check if all Redis data is available
  const hasRedisMovies = redisMovies.status === 'fulfilled' && redisMovies.value;
  const hasRedisTVShows = redisTVShows.status === 'fulfilled' && redisTVShows.value;
  const hasRedisBooks = redisBooks.status === 'fulfilled' && redisBooks.value;
  
  if (hasRedisMovies && hasRedisTVShows && hasRedisBooks) {
    // Update cache with fresh data
    redisDataCache = {
      movies: redisMovies.value,
      tvshows: redisTVShows.value,
      books: redisBooks.value,
      lastFetched: now
    };
    
    console.log('💾 Updated Redis data cache with fresh data');
    return {
      movies: redisMovies.value,
      tvshows: redisTVShows.value,
      books: redisBooks.value
    };
  } else {
    console.log('⚠️ Some Redis data missing, cannot cache');
    return null;
  }
}

// Helper function to clear cache (useful for development/testing)
function clearRedisCache() {
  redisDataCache = {
    movies: null,
    tvshows: null,
    books: null,
    lastFetched: null
  };
  console.log('🗑️ Redis data cache cleared');
}

// Expose cache clearing function globally for development
if (typeof global !== 'undefined') {
  (global as Record<string, unknown>).clearRedisCache = clearRedisCache;
}

// Helper function to get active Redis database with failover
async function getActiveRedis(baseUrl: string) {
  try {
    // Try primary Redis first
    const response = await fetch(`${baseUrl}/api/redisHandler?type=movies1`);
    if (response.ok) {
      console.log('✅ Using primary Redis database');
      return baseUrl;
    }
  } catch (error) {
    console.log(error instanceof Error ? error.message : "⚠️ Primary Redis failed, trying backup...");
  }
  
  // Try backup Redis (you'll need to implement this endpoint)
  try {
    const backupUrl = process.env.BACKUP_REDIS_URL || baseUrl.replace('3000', '3001');
    const response = await fetch(`${backupUrl}/api/redisHandler?type=movies1`);
    if (response.ok) {
      console.log('✅ Using backup Redis database');
      return backupUrl;
    }
  } catch (error) {
    console.log(error instanceof Error ? error.message : "❌ Both Redis databases failed");
  }
  
  return null; // Fall back to APIs
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

  let movies: Movie[] = []
  let tvShows: TVShow[] = []
  let books: Book[] = []
  
  // Track which Redis keys have been fetched for progressive loading
  const redisKeysFetched = {
    movies: 1, // Start with movies1
    tvshows: 1, // Start with tvshows1
    books: 1   // Start with books1
  }

  try {
    // Step 1: Try to get cached Redis data or fetch if needed
    console.log('🚀 Starting data fetch for server-side props...')
    
    // Try to get cached Redis data first
    const cachedData = await getCachedRedisData(baseUrl);
    
    if (cachedData) {
      // Use cached data
      console.log('✅ Using cached Redis data for server-side props');
      movies = cachedData.movies || [];
      tvShows = cachedData.tvshows || [];
      books = cachedData.books || [];
    } else {
      // No cached data available, try to get from Redis
      console.log('⚠️ No cached data, attempting Redis fetch...')
      
      // Get active Redis database
      const activeRedis = await getActiveRedis(baseUrl)
      if (!activeRedis) {
        console.log('❌ No Redis available, falling back to APIs')
        throw new Error('No Redis available')
      }
      
      console.log('📊 Fetching first pages from Redis...')
      
      // Fetch ONLY the first keys from Redis (movies1, tvshows1, books1)
      const [redisMovies, redisTVShows, redisBooks] = await Promise.allSettled([
        fetchPageFromRedis(activeRedis, 'movies', 1), // movies1
        fetchPageFromRedis(activeRedis, 'tvshows', 1), // tvshows1
        fetchPageFromRedis(activeRedis, 'books', 1)   // books1
      ])
      
      console.log('📊 Redis fetch results (first keys only):', {
        movies: redisMovies.status,
        tvshows: redisTVShows.status,
        books: redisBooks.status
      })
      
      // Check if Redis data is available for each type
      const hasRedisMovies = redisMovies.status === 'fulfilled' && redisMovies.value
      const hasRedisTVShows = redisTVShows.status === 'fulfilled' && redisTVShows.value
      const hasRedisBooks = redisBooks.status === 'fulfilled' && redisBooks.value
      
      console.log('📊 Redis data availability (first keys only):', {
        movies: hasRedisMovies && Array.isArray(redisMovies.value) ? redisMovies.value.length : 'missing',
        tvshows: hasRedisTVShows && Array.isArray(redisTVShows.value) ? redisTVShows.value.length : 'missing',
        books: hasRedisBooks && Array.isArray(redisBooks.value) ? redisBooks.value.length : 'missing'
      })
      
      // Use Redis data where available, fall back to APIs for missing data
      if (hasRedisMovies && hasRedisTVShows && hasRedisBooks) {
        // All Redis data is available - use first keys only
        console.log('✅ Using Redis data for all media types (first keys only)')
        movies = Array.isArray(redisMovies.value) ? redisMovies.value.map(movie => ({ ...movie, type: "movie" as const })) : []
        tvShows = Array.isArray(redisTVShows.value) ? redisTVShows.value.map(tvShow => ({ ...tvShow, type: "tvshow" as const })) : []
        books = Array.isArray(redisBooks.value) ? redisBooks.value.map(book => ({ ...book, type: "book" as const })) : []
      } else {
        // Some Redis data is missing, fetch missing data from APIs
        console.log('⚠️ Some Redis data missing, fetching missing data from APIs...')
        
        // Use Redis data where available, fetch from APIs where missing, and ensure arrays (not null)
        // For fallback API calls, only fetch 60 items to keep data manageable
        movies = hasRedisMovies && Array.isArray(redisMovies.value) ? redisMovies.value.map(movie => ({ ...movie, type: "movie" as const })) : (await fetchPopularMoviesWithFetch(tmdbApiKey) || []).map(movie => ({ ...movie, type: "movie" as const }))
        tvShows = hasRedisTVShows && Array.isArray(redisTVShows.value) ? redisTVShows.value.map(tvShow => ({ ...tvShow, type: "tvshow" as const })) : (await fetchPopularTVShowsWithFetch(tmdbApiKey) || []).map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
        books = hasRedisBooks && Array.isArray(redisBooks.value) ? redisBooks.value.map(book => ({ ...book, type: "book" as const })) : (await fetchBestsellersWithFetch(googleBooksApiKey, nyTimesApiKey, baseUrl) || []).map(book => ({ ...book, type: "book" as const }))
        
        // Limit fallback API data to 60 items maximum
        if (!hasRedisMovies && movies && movies.length > 60) {
          movies = movies.slice(0, 60);
          console.log('📊 Limited fallback movies to 60 items');
        }
        if (!hasRedisTVShows && tvShows && tvShows.length > 60) {
          tvShows = tvShows.slice(0, 60);
          console.log('📊 Limited fallback TV shows to 60 items');
        }
        if (!hasRedisBooks && books && books.length > 60) {
          books = books.slice(0, 60);
          console.log('📊 Limited fallback books to 60 items');
        }
        
        if (!hasRedisMovies && !movies) movies = fallbackMovies.map(movie => ({ ...movie, type: "movie" as const }))
        if (!hasRedisTVShows && !tvShows) tvShows = fallbackTVShows.map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
        if (!hasRedisBooks && !books) books = fallbackBooks.map(book => ({ ...book, type: "book" as const }))
      }
    }
  } catch (error) {
    console.error('❌ Error fetching initial data:', error)
    // Use fallback data if all methods fail, but limit to 60 items maximum
    movies = fallbackMovies.slice(0, 60).map(movie => ({ ...movie, type: "movie" as const }))
    tvShows = fallbackTVShows.slice(0, 60).map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
    books = fallbackBooks.slice(0, 60).map(book => ({ ...book, type: "book" as const }))
    console.log('📊 Using limited fallback data (60 items max per type)')
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
        <ClientNavigation />
        <main>
          <ContentSection 
            initialMovies={movies}
            initialTVShows={tvShows}
            initialBooks={books}
            tmdbApiKey={tmdbApiKey}
            googleBooksApiKey={googleBooksApiKey}
            redisKeysFetched={redisKeysFetched}
          />
          <MediaDetailsModal 
            omdbApiKeys={omdbApiKeys}
          />
        </main>
      </div>
    </div>
  )
}
