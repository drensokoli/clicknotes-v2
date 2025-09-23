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

// In-memory server-side cache for movies data
interface ServerCache {
  movies: Movie[];
  tvshows: TVShow[];
  books: Book[];
  movieRanking: Array<{value: string, score: number}>;
  tvShowRanking: Array<{value: string, score: number}>;
  bookRanking: Array<{value: string, score: number}>;
  lastFetched: number;
}

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// In-memory cache as fallback (for current session only)
let memoryCache: ServerCache | null = null;

// Helper function to check for cached media data (disabled - no longer using Redis cache)
async function getCachedMediaData(baseUrl: string) {
  console.log('🔍 [SERVER COMPONENT] Cache checking disabled - no longer using Redis cache');
  return null;
}

// Helper function to save cache via API
async function saveCacheData(baseUrl: string, cacheData: ServerCache) {
  try {
    // Create a simplified cache to reduce memory usage
    const simplifiedCache = {
      movies: cacheData.movies,
      tvshows: cacheData.tvshows,
      books: cacheData.books,
      movieRanking: cacheData.movieRanking,
      tvShowRanking: cacheData.tvShowRanking,
      bookRanking: cacheData.bookRanking,
      lastFetched: cacheData.lastFetched
    };

    console.log('💾 Saving server cache to Redis...');
    const response = await fetch(`${baseUrl}/api/redisHandler?type=save-server-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simplifiedCache)
    });
    
    if (response.ok) {
      console.log('💾 Cache saved to Redis successfully');
    } else {
      console.error('❌ Failed to save cache to Redis');
    }
  } catch (error) {
    console.error('❌ Error saving cache:', error);
  }
}

// Helper function to fetch specific page from data source using ranking system
async function fetchPageFromDataSource(baseUrl: string, mediaType: string, page: number = 1) {
  try {
    console.log(`🔍 Fetching ${mediaType} page ${page} from data source...`)

    // For page 1, fetch the first 20 items using ranking system
    if (page === 1) {
      const startIndex = 0;
      const endIndex = 19; // Fetch first 20 items (0-indexed)

      try {
        // Step 1: Get the first 20 IDs from the ranking
        console.log(`📊 Fetching ${mediaType} IDs from ranking range: ${startIndex}-${endIndex}`)
        const rankingResponse = await fetch(`${baseUrl}/api/redisHandler?type=ranking-range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`, {
          cache: 'force-cache',
          next: { revalidate: 60 * 60 * 24 * 7 } // Cache for 7 days
        })

        if (!rankingResponse.ok) {
          console.error(`❌ Failed to fetch ranking range for ${mediaType}`)
          return null
        }

        const rankingData = await rankingResponse.json()

        if (!rankingData.success || !rankingData.ids || rankingData.ids.length === 0) {
          console.log(`⚠️ No ${mediaType} IDs found in ranking`)
          return null
        }

        const ids = rankingData.ids
        console.log(`📊 Got ${ids.length} ${mediaType} IDs from ranking`)

        // Step 2: Fetch the actual items by IDs
        const idsString = ids.join(',')
        // Convert plural to singular for Redis key format
        const singularMediaType = mediaType === 'movies' ? 'movie' :
                                 mediaType === 'tvshows' ? 'tvshow' :
                                 mediaType === 'books' ? 'book' : mediaType

        console.log(`🎬 Fetching ${ids.length} ${mediaType} items by IDs`)
        const itemsResponse = await fetch(`${baseUrl}/api/redisHandler?type=fetch-by-ids&mediaType=${singularMediaType}&ids=${idsString}`, {
          cache: 'force-cache',
          next: { revalidate: 60 * 60 * 24 * 7 } // Cache for 7 days
        })

        if (!itemsResponse.ok) {
          console.error(`❌ Failed to fetch ${mediaType} items by IDs`)
          return null
        }

        const itemsData = await itemsResponse.json()

        if (itemsData.success && itemsData.items && itemsData.items.length > 0) {
          const newItems = itemsData.items
          console.log(`✅ Successfully fetched ${newItems.length} ${mediaType} items`)
          return newItems
        } else {
          console.log(`⚠️ No ${mediaType} items found for the requested IDs`)
          return null
        }
      } catch (error) {
        console.error(`❌ Error fetching ${mediaType} from ranking system:`, error)
        return null
      }
    } else {
      // For other pages, fall back to old structure for backward compatibility
      const key = `${mediaType}${page}`;
      const response = await fetch(`${baseUrl}/api/redisHandler?type=${key}`, {
        cache: 'force-cache',
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
    }
  } catch (error) {
    console.log("🚫 Data source fetch failed:", error)
    return null
  }
}

// Helper function to get cached data or fetch if needed
async function getCachedData(baseUrl: string) {
  const now = Date.now();

  // Check in-memory cache first (for current serverless instance)
  if (memoryCache && memoryCache.movies && memoryCache.movies.length > 0) {
    const cacheAge = Math.round((now - memoryCache.lastFetched) / (1000 * 60 * 60));
    console.log(`📥 [SERVERLESS INSTANCE CACHE] ⚡️ Serving from current instance memory (age: ${cacheAge} hours)`);
    console.log(`📊 [INSTANCE CACHED] Movies: ${memoryCache.movies.length}, TV Shows: ${memoryCache.tvshows?.length || 0}, Books: ${memoryCache.books?.length || 0}`);
    
    return {
      movies: memoryCache.movies,
      tvshows: memoryCache.tvshows || [],
      books: memoryCache.books || [],
      movieRanking: memoryCache.movieRanking || [],
      tvShowRanking: memoryCache.tvShowRanking || [],
      bookRanking: memoryCache.bookRanking || []
    };
  }
  
  // Redis cache checking disabled - only use in-memory cache
  console.log('🔍 [SERVER COMPONENT] Redis cache disabled - only using in-memory cache for this serverless instance');
  
  console.log('🔄 [SERVER COMPONENT] No server cache found, will populate fresh data from Redis...');
  // Silent - remove cache status logging
  // console.log('📊 Cache status:', {
  //   hasCachedData: !!cachedData,
  //   cacheAge: cachedData?.lastFetched ? Math.round((now - cachedData.lastFetched) / (1000 * 60 * 60)) : 'N/A',
  //   hasMovies: !!(cachedData?.movies),
  //   hasTVShows: !!(cachedData?.tvshows),
  //   hasBooks: !!(cachedData?.books),
  //   hasMovieRanking: !!(cachedData?.movieRanking),
  //   hasTVShowRanking: !!(cachedData?.tvShowRanking),
  //   hasBookRanking: !!(cachedData?.bookRanking)
  // });
  
  // Fetch fresh data from data source
  const [dataMovies, dataTVShows, dataBooks, rankingsResult] = await Promise.allSettled([
    fetchPageFromDataSource(baseUrl, 'movies', 1),
    fetchPageFromDataSource(baseUrl, 'tvshows', 1),
    fetchPageFromDataSource(baseUrl, 'books', 1),
    fetchPopularRankings(baseUrl)
  ]);

  // Extract rankings data
  const popularRankings = rankingsResult.status === 'fulfilled' ? rankingsResult.value : { movieRanking: [], tvShowRanking: [], bookRanking: [] };

  // Check if all data is available
  const hasMovies = dataMovies.status === 'fulfilled' && dataMovies.value;
  const hasTVShows = dataTVShows.status === 'fulfilled' && dataTVShows.value;
  const hasBooks = dataBooks.status === 'fulfilled' && dataBooks.value;
  const hasPopularRankings = rankingsResult.status === 'fulfilled' && rankingsResult.value;

  // Cache data even if some types are missing, as long as we have movies and rankings
  if (hasMovies && hasPopularRankings) {
    // Prepare cache data with available data
    const cacheData = {
      movies: hasMovies ? dataMovies.value! : [],
      tvshows: hasTVShows ? dataTVShows.value! : [], // Use empty array if missing
      books: hasBooks ? dataBooks.value! : [], // Use empty array if missing
      lastFetched: now,
      movieRanking: popularRankings.movieRanking,
      tvShowRanking: popularRankings.tvShowRanking || [], // Use empty array if missing
      bookRanking: popularRankings.bookRanking || [] // Use empty array if missing
    };

    // Save to in-memory cache for this serverless instance
    memoryCache = cacheData;
    console.log('💾 [SERVERLESS INSTANCE] Saved to current instance memory');
    
    // Save cache for persistence to Redis (disabled - no longer storing in Redis)
    // await saveCacheData(baseUrl, cacheData);

    console.log('💾 [SERVER COMPONENT] Data saved and will be cached by Next.js server components');
    console.log(`📊 [CACHED COUNT] Movies: ${hasMovies ? dataMovies.value!.length : 0}, TV Shows: ${hasTVShows ? dataTVShows.value!.length : 0}, Books: ${hasBooks ? dataBooks.value!.length : 0}`);

    return {
      movies: hasMovies ? dataMovies.value! : [],
      tvshows: hasTVShows ? dataTVShows.value! : [],
      books: hasBooks ? dataBooks.value! : [],
      movieRanking: popularRankings.movieRanking,
      tvShowRanking: popularRankings.tvShowRanking || [],
      bookRanking: popularRankings.bookRanking || []
    };
  } else {
    console.log('❌ Essential data missing (movies or rankings), cannot cache');
    return null;
  }
}

// Helper function to fetch entire popular rankings from Redis
async function fetchPopularRankings(baseUrl: string) {
  try {
    console.log('📊 Fetching entire popular rankings from Redis...');
    const response = await fetch(`${baseUrl}/api/redisHandler?type=popular-rankings`, {
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 * 7 } // Cache for 7 days
    });

    if (response.ok) {
      const rankings = await response.json();
      if (rankings && rankings.movieRanking && rankings.tvShowRanking && rankings.bookRanking) {
        console.log('✅ Popular rankings fetched successfully:', {
          movieRanking: rankings.movieRanking.length,
          tvShowRanking: rankings.tvShowRanking.length,
          bookRanking: rankings.bookRanking.length
        });
        return rankings;
      } else {
        console.log('⚠️ Popular rankings data is invalid or incomplete');
        return null;
      }
    } else {
      console.log(`❌ Popular rankings response not OK:`, response.status);
      return null;
    }
  } catch (error) {
    console.log("🚫 Popular rankings fetch failed:", error);
    return null;
  }
}

// Helper function to clear cache (useful for development/testing)
async function clearServerCache() {
  try {
    // Clear in-memory cache
    memoryCache = null;
    
    // Revalidate the Next.js cache tags
    const { revalidateTag } = await import('next/cache');
    revalidateTag('server-media-cache');
    console.log('🗑️ Server cache cleared');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

// Expose cache clearing function globally for development
if (typeof global !== 'undefined') {
  (global as Record<string, unknown>).clearServerCache = clearServerCache;
}

// Helper function to get active Redis database with failover
async function getActiveRedis(baseUrl: string) {
  try {
    // Try primary Redis first - test with new structure (movies page 1, limit 40)
    const response = await fetch(`${baseUrl}/api/redisHandler?type=movies&page=1&limit=40`);
    if (response.ok) {
      console.log('✅ Using primary Redis database (new structure)');
      return baseUrl;
    }
  } catch (error) {
    console.log(error instanceof Error ? error.message : "⚠️ Primary Redis failed, trying backup...");
  }

  // Try backup Redis (you'll need to implement this endpoint) - test with new structure
  try {
    const backupUrl = process.env.BACKUP_REDIS_URL || baseUrl.replace('3000', '3001');
    const response = await fetch(`${backupUrl}/api/redisHandler?type=movies&page=1&limit=40`);
    if (response.ok) {
      console.log('✅ Using backup Redis database (new structure)');
      return backupUrl;
    }
  } catch (error) {
    console.log(error instanceof Error ? error.message : "❌ Both Redis databases failed");
  }

  return null; // Fall back to APIs
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

  // Initialize rankings variables
  let movieRanking: Array<{value: string, score: number}> = [];
  let tvShowRanking: Array<{value: string, score: number}> = [];
  let bookRanking: Array<{value: string, score: number}> = [];

  try {
    // Step 1: Try to get cached data or fetch if needed
    console.log('🚀 Starting data fetch for server-side props...')

    // Try to get cached data first (only in-memory cache now)
    const cachedData = await getCachedData(baseUrl);

    if (cachedData) {
      // Use cached data from in-memory cache
      console.log('✅ [SERVER COMPONENT] Using in-memory cached data for server-side props');
      movies = cachedData.movies || [];
      tvShows = cachedData.tvshows || [];
      books = cachedData.books || [];

      // Store rankings for server-side access
      movieRanking = cachedData.movieRanking || [];
      tvShowRanking = cachedData.tvShowRanking || [];
      bookRanking = cachedData.bookRanking || [];
    } else {
      // No cached data available, try to get from Redis
      console.log('⚠️ No cached data, attempting Redis fetch...')
      
      // Get active Redis database
      const activeRedis = await getActiveRedis(baseUrl)
      if (!activeRedis) {
        console.log('❌ No Redis available, falling back to APIs')
        throw new Error('No Redis available')
      }
      
      console.log('📊 Fetching first 20 items from data source...')

      // Fetch the first 20 items from each media type using new structure
      const [dataMovies, dataTVShows, dataBooks, rankingsResult] = await Promise.allSettled([
        fetchPageFromDataSource(activeRedis, 'movies', 1),   // First 20 movies from popular ranking
        fetchPageFromDataSource(activeRedis, 'tvshows', 1),  // First 20 TV shows from popular ranking
        fetchPageFromDataSource(activeRedis, 'books', 1),    // First 20 books from popular ranking
        fetchPopularRankings(activeRedis)               // Get entire rankings
      ])

      // Extract rankings data
      const popularRankings = rankingsResult.status === 'fulfilled' ? rankingsResult.value : { movieRanking: [], tvShowRanking: [], bookRanking: [] };

      console.log('📊 Data fetch results:', {
        movies: dataMovies.status,
        tvshows: dataTVShows.status,
        books: dataBooks.status,
        rankings: rankingsResult.status
      })

      // Check if data is available for each type
      const hasMovies = dataMovies.status === 'fulfilled' && dataMovies.value
      const hasTVShows = dataTVShows.status === 'fulfilled' && dataTVShows.value
      const hasBooks = dataBooks.status === 'fulfilled' && dataBooks.value
      const hasPopularRankings = rankingsResult.status === 'fulfilled' && rankingsResult.value

      console.log('📊 Data availability:', {
        movies: hasMovies && Array.isArray(dataMovies.value) ? dataMovies.value.length : 'missing',
        tvshows: hasTVShows && Array.isArray(dataTVShows.value) ? dataTVShows.value.length : 'missing',
        books: hasBooks && Array.isArray(dataBooks.value) ? dataBooks.value.length : 'missing',
        rankings: hasPopularRankings ? 'available' : 'missing'
      })

      // Use data where available, fall back to APIs for missing data
      if (hasMovies && hasTVShows && hasBooks && hasPopularRankings) {
        // All data is available - use data from popular rankings
        console.log('✅ Using data for all media types (from popular rankings)')
        movies = Array.isArray(dataMovies.value) ? dataMovies.value.map(movie => ({ ...movie, type: "movie" as const })) : []
        tvShows = Array.isArray(dataTVShows.value) ? dataTVShows.value.map(tvShow => ({ ...tvShow, type: "tvshow" as const })) : []
        books = Array.isArray(dataBooks.value) ? dataBooks.value.map(book => ({ ...book, type: "book" as const })) : []

        // Store rankings for server-side access
        movieRanking = popularRankings.movieRanking || [];
        tvShowRanking = popularRankings.tvShowRanking || [];
        bookRanking = popularRankings.bookRanking || [];
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
          // Silent - remove fallback logging
          // console.log('📊 Limited fallback movies to 60 items');
        }
        if (!hasTVShows && tvShows && tvShows.length > 60) {
          tvShows = tvShows.slice(0, 60);
          // Silent - remove fallback logging
          // console.log('📊 Limited fallback TV shows to 60 items');
        }
        if (!hasBooks && books && books.length > 60) {
          books = books.slice(0, 60);
          // Silent - remove fallback logging
          // console.log('📊 Limited fallback books to 60 items');
        }

        if (!hasMovies && !movies) movies = fallbackMovies.map(movie => ({ ...movie, type: "movie" as const }))
        if (!hasTVShows && !tvShows) tvShows = fallbackTVShows.map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
        if (!hasBooks && !books) books = fallbackBooks.map(book => ({ ...book, type: "book" as const }))
      }
    }
  } catch (error) {
    console.error('❌ Error fetching initial data:', error)
    // Use fallback data if all methods fail, but limit to 60 items maximum
    movies = fallbackMovies.slice(0, 60).map(movie => ({ ...movie, type: "movie" as const }))
    tvShows = fallbackTVShows.slice(0, 60).map(tvShow => ({ ...tvShow, type: "tvshow" as const }))
    books = fallbackBooks.slice(0, 60).map(book => ({ ...book, type: "book" as const }))
    // Silent - remove fallback data logging
    // console.log('📊 Using limited fallback data (60 items max per type)')
  }

  // Silent logging - remove this if not needed
  // console.log('📊 Final data counts:', {
  //   movies: movies.length,
  //   tvShows: tvShows.length,
  //   books: books.length
  // })

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
