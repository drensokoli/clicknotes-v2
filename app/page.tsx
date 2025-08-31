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

let serverCache: ServerCache | null = null;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Helper function to save cache to server memory
function saveCacheToMemory(cacheData: ServerCache) {
  serverCache = cacheData;
  console.log('💾 Cache saved to server memory');
}

// Helper function to load cache from server memory
function loadCacheFromMemory() {
  if (serverCache && (Date.now() - serverCache.lastFetched) < CACHE_DURATION) {
    console.log('📥 Cache loaded from server memory');
    return serverCache;
  }
  return null;
}

// Helper function to fetch specific page from data source using ranking system
async function fetchPageFromDataSource(baseUrl: string, mediaType: string, page: number = 1) {
  try {
    console.log(`🔍 Fetching ${mediaType} page ${page} from data source...`)

    // For page 1, fetch the first 40 items using ranking system
    if (page === 1) {
      const startIndex = 0;
      const endIndex = 39; // Fetch first 40 items (0-indexed)

      try {
        // Step 1: Get the first 40 IDs from the ranking
        console.log(`📊 Fetching ${mediaType} IDs from ranking range: ${startIndex}-${endIndex}`)
        const rankingResponse = await fetch(`${baseUrl}/api/redisHandler?type=ranking-range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`)

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
        const itemsResponse = await fetch(`${baseUrl}/api/redisHandler?type=fetch-by-ids&mediaType=${singularMediaType}&ids=${idsString}`)

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

  // Try to load cache from memory first
  const cachedData = loadCacheFromMemory();

  // Check if we have valid cached data (only require movies and rankings)
  if (cachedData &&
      cachedData.lastFetched &&
      (now - cachedData.lastFetched) < CACHE_DURATION &&
      cachedData.movies &&
      cachedData.movieRanking) {

    const cacheAgeHours = Math.round((now - cachedData.lastFetched) / (1000 * 60 * 60));
    console.log('✅ Using cached data (age:', cacheAgeHours, 'hours)');

    return {
      movies: cachedData.movies,
      tvshows: cachedData.tvshows || [], // Use empty array if missing
      books: cachedData.books || [], // Use empty array if missing
      movieRanking: cachedData.movieRanking,
      tvShowRanking: cachedData.tvShowRanking || [], // Use empty array if missing
      bookRanking: cachedData.bookRanking || [] // Use empty array if missing
    };
  }
  
  console.log('🔄 Cache expired or missing, fetching fresh data from Redis...');
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

    // Save to memory for persistence
    saveCacheToMemory(cacheData);

    console.log('💾 Updated server cache with available data');
    console.log(`📊 Cached: ${hasMovies ? dataMovies.value!.length : 0} movies, ${popularRankings.movieRanking?.length || 0} movie rankings`);

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
      cache: 'no-store'
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
function clearServerCache() {
  serverCache = null;
  console.log('🗑️ Server cache cleared');
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

    // Try to get cached data first
    const cachedData = await getCachedData(baseUrl);

    if (cachedData) {
      // Use cached data
      console.log('✅ Using cached data for server-side props');
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
      
      console.log('📊 Fetching first 40 items from data source...')

      // Fetch the first 40 items from each media type using new structure
      const [dataMovies, dataTVShows, dataBooks, rankingsResult] = await Promise.allSettled([
        fetchPageFromDataSource(activeRedis, 'movies', 1),   // First 40 movies from popular ranking
        fetchPageFromDataSource(activeRedis, 'tvshows', 1),  // First 40 TV shows from popular ranking
        fetchPageFromDataSource(activeRedis, 'books', 1),    // First 40 books from popular ranking
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
