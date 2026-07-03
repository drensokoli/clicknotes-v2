import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@redis/client"
import { revalidateTag } from 'next/cache'
import { fetchJSON } from '../../../lib/secure-fetch'
import { sendEmail } from '../../../lib/email-service'
import { Book } from '@/components/media-card'
import { optimizeMovieData, optimizeTVShowData, optimizeBookData } from '../../../lib/data-optimization'

// Force dynamic execution to prevent caching issues with Vercel cron jobs
export const dynamic = 'force-dynamic'
// Allow the full population run (movies + tvshows + books) to complete in one invocation.
// Vercel Hobby (Fluid Compute) and Pro both support up to 300s - if this project is capped
// lower, split populate-all into separate cron-triggered calls per media type instead.
export const maxDuration = 300

interface NYTimesList {
  list_name_encoded: string;
  books: Book[];
}

interface NYTimesBook extends Book {
  primary_isbn13: string;
}

// Helper function to create Redis client
const createRedisClient = () => {
  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  const redisPort = process.env.REDIS_PORT

  if (!redisHost || !redisPassword || !redisPort) {
    throw new Error('Redis configuration missing')
  }

  return createClient({
    password: redisPassword,
    username: "default",
    socket: {
      host: redisHost,
      port: parseInt(redisPort)
    }
  })
}

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Free-tier Redis plans cap monthly upload/download bandwidth, so we avoid re-fetching
// and re-writing a key if it was already refreshed within the last week (matches the
// weekly cron schedule in vercel.json). Pass force=true to bypass this and repopulate anyway.
const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000
const updatedAtKey = (key: string) => `${key}:updated_at`

async function isFresh(client: ReturnType<typeof createRedisClient>, key: string): Promise<boolean> {
  const [data, updatedAt] = await Promise.all([
    client.get(key),
    client.get(updatedAtKey(key)),
  ])
  if (!data || !updatedAt) return false
  return Date.now() - parseInt(updatedAt, 10) < FRESHNESS_MS
}

async function markUpdated(client: ReturnType<typeof createRedisClient>, key: string) {
  await client.set(updatedAtKey(key), Date.now().toString())
}

// Helper function to check if content is erotic or inappropriate
const isEroticContent = (title: string, description: string) => {
  const eroticKeywords = [
    'erotic', 'porn', 'sex', 'nude',
    'nudity', 'explicit', 'mature', 'softcore',
    'hardcore', 'xxx', 'erotica', 'sensual',
    'intimate', 'romance novel', 'adult romance',
    'mature film', 'adult cinema', 'adult film', 'adult movie',
    'sultry', 'seduct', 'seduce', 'kinky', 'flirt', 'lude'
  ];

  // Check if any erotic keywords are in the description or title
  const hasEroticContent = eroticKeywords.some(keyword =>
    description.includes(keyword) || title.includes(keyword)
  );

  // Check if any erotic keywords are in the title
  const hasEroticTitle = eroticKeywords.some(keyword =>
    title.includes(keyword)
  );

  return hasEroticContent || hasEroticTitle;
};

// Helper function to check if content meets quality standards
const meetsQualityStandards = (rating: number, voteCount: number) => {
  // Must have rating >= 6.0
  if (rating < 6.0) return false;

  // Must have at least 10 votes to ensure rating reliability
  if (voteCount < 10) return false;

  return true;
};

// Populate movies with minimal card payloads (no per-item TMDB/OMDB detail calls -
// detail pages/modals fetch full details live from TMDB on demand)
async function populateMovies(tmdbApiKey: string, force = false) {
  const client = createRedisClient()
  await client.connect()

  const moviesKey = 'movies_v2'

  try {
    if (!force && await isFresh(client, moviesKey)) {
      console.log('[POPULATE] movies_v2 was refreshed within the last week, skipping (pass force to override)')
      const stored = await client.get(moviesKey)
      return stored ? JSON.parse(stored) : []
    }

    console.log('[POPULATE] Starting movies_v2 population...');
    console.log('[POPULATE] Fetching minimal movies until we have 240 filtered cards...');

    type MovieInput = Parameters<typeof optimizeMovieData>[0]
    type MovieCard = ReturnType<typeof optimizeMovieData>

    const filteredMovies: MovieCard[] = []
    const seenIds = new Set<number>()
    let totalProcessed = 0
    let done = false

    // Fetch movies page by page until we have 240 filtered minimal movies
    for (let page = 1; page <= 20 && !done; page++) {
      console.log(`[POPULATE] Fetching movies page ${page}/20...`)

      const url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}&include_adult=false`
      const moviesData = await fetchJSON(url)

      if (!moviesData || !moviesData.results) {
        console.warn(`[POPULATE] Page ${page}: Invalid response structure`)
        continue
      }

      for (let i = 0; i < moviesData.results.length; i++) {
        if (filteredMovies.length >= 240) {
          done = true
          break
        }

        const movie = moviesData.results[i]
        totalProcessed++

        if (seenIds.has(movie.id)) continue
        seenIds.add(movie.id)

        const description = (movie.overview || '').toLowerCase()
        const title = (movie.title || '').toLowerCase()

        if (isEroticContent(title, description)) continue
        if (!meetsQualityStandards(movie.vote_average, movie.vote_count || 0)) continue

        // Store only minimal card fields; modal fetches full details on demand.
        const optimizedMovie = optimizeMovieData({
          id: movie.id,
          title: movie.title,
          overview: movie.overview,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count ?? 0,
        } as MovieInput)

        filteredMovies.push(optimizedMovie)
      }

      // Small delay between pages to reduce TMDB rate-limit pressure
      if (!done && page < 20) {
        await delay(500)
      }
    }

    const finalMovies = filteredMovies.slice(0, 240)
    console.log(`[POPULATE] Total processed: ${totalProcessed}`)
    console.log(`[POPULATE] Final movies_v2 count: ${finalMovies.length}`)

    await client.set(moviesKey, JSON.stringify(finalMovies))
    await markUpdated(client, moviesKey)
    revalidateTag('v2-cards-movies')

    return finalMovies
  } catch (error) {
    console.error('[POPULATE] Critical error in movies_v2 population:', error)
    await sendErrorNotification('movies', error as Error, 'Populate movies_v2 key')
    throw error
  } finally {
    await client.disconnect()
  }
}

// Populate TV shows with minimal card payloads (no per-item TMDB/OMDB detail calls)
async function populateTVShows(tmdbApiKey: string, force = false) {
  const client = createRedisClient()
  await client.connect()

  const tvShowsKey = 'tvshows_v2'

  try {
    if (!force && await isFresh(client, tvShowsKey)) {
      console.log('[POPULATE] tvshows_v2 was refreshed within the last week, skipping (pass force to override)')
      const stored = await client.get(tvShowsKey)
      return stored ? JSON.parse(stored) : []
    }

    console.log('[POPULATE] Starting tvshows_v2 population...');
    console.log('[POPULATE] Fetching minimal TV shows until we have 240 filtered cards...');

    type TVInput = Parameters<typeof optimizeTVShowData>[0]
    type TVCard = ReturnType<typeof optimizeTVShowData>

    const filteredTVShows: TVCard[] = []
    const seenIds = new Set<number>()
    let totalProcessed = 0
    let done = false

    for (let page = 1; page <= 20 && !done; page++) {
      console.log(`[POPULATE] Fetching TV shows page ${page}/20...`)

      const url = `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`
      const tvShowsData = await fetchJSON(url)

      if (!tvShowsData || !tvShowsData.results) {
        console.warn(`[POPULATE] Page ${page}: Invalid response structure`)
        continue
      }

      for (let i = 0; i < tvShowsData.results.length; i++) {
        if (filteredTVShows.length >= 240) {
          done = true
          break
        }

        const tvShow = tvShowsData.results[i]
        totalProcessed++

        if (seenIds.has(tvShow.id)) continue
        seenIds.add(tvShow.id)

        const description = (tvShow.overview || '').toLowerCase()
        const title = (tvShow.name || '').toLowerCase()

        if (isEroticContent(title, description)) continue
        if (!meetsQualityStandards(tvShow.vote_average, tvShow.vote_count || 0)) continue

        const optimizedTVShow = optimizeTVShowData({
          id: tvShow.id,
          name: tvShow.name,
          overview: tvShow.overview,
          poster_path: tvShow.poster_path,
          backdrop_path: tvShow.backdrop_path,
          first_air_date: tvShow.first_air_date,
          vote_average: tvShow.vote_average,
          vote_count: tvShow.vote_count ?? 0,
        } as TVInput)

        filteredTVShows.push(optimizedTVShow)
      }

      if (!done && page < 20) {
        await delay(500)
      }
    }

    const finalTVShows = filteredTVShows.slice(0, 240)
    console.log(`[POPULATE] Total processed: ${totalProcessed}`)
    console.log(`[POPULATE] Final tvshows_v2 count: ${finalTVShows.length}`)

    await client.set(tvShowsKey, JSON.stringify(finalTVShows))
    await markUpdated(client, tvShowsKey)
    revalidateTag('v2-cards-tvshows')

    return finalTVShows
  } catch (error) {
    console.error('[POPULATE] Critical error in tvshows_v2 population:', error)
    await sendErrorNotification('tvshows', error as Error, 'Populate tvshows_v2 key')
    throw error
  } finally {
    await client.disconnect()
  }
}

// Populate books with minimal card payloads (NY Times bestseller lists -> Google Books lookup per ISBN)
async function populateBooks(googleBooksApiKey: string, nyTimesApiKey: string, force = false) {
  const client = createRedisClient()
  await client.connect()

  const booksKey = 'books_v2'

  try {
    if (!force && await isFresh(client, booksKey)) {
      console.log('[POPULATE] books_v2 was refreshed within the last week, skipping (pass force to override)')
      const stored = await client.get(booksKey)
      return stored ? JSON.parse(stored) : []
    }

    console.log('[POPULATE] Starting books_v2 population...');
    console.log('[POPULATE] Fetching NY Times full overview...');

    const nyTimesUrl = `https://api.nytimes.com/svc/books/v3/lists/full-overview.json?api-key=${nyTimesApiKey}`;
    const nyTimesData = await fetchJSON(nyTimesUrl)

    if (!nyTimesData || !nyTimesData.results || !nyTimesData.results.lists) {
      throw new Error('Invalid NY Times API response structure');
    }

    console.log('[POPULATE] Available lists:', nyTimesData.results.lists.length);

    const listNames = [
      "combined-print-and-e-book-fiction",
      "combined-print-and-e-book-nonfiction",
      "hardcover-fiction",
      "hardcover-nonfiction",
      "trade-fiction-paperback",
      "paperback-nonfiction",
      "advice-how-to-and-miscellaneous",
      "childrens-middle-grade-hardcover",
      "picture-books",
      "series-books",
      "young-adult-hardcover",
      "audio-fiction",
      "audio-nonfiction",
      "business-books",
      "graphic-books-and-manga",
      "mass-market-monthly",
      "middle-grade-paperback-monthly",
      "young-adult-paperback-monthly"
    ];

    // Collect all ISBNs from the specified lists
    const allIsbns: string[] = [];
    const seenIsbns = new Set<string>();

    listNames.forEach(listName => {
      const list = nyTimesData.results.lists.find((list: NYTimesList) => list.list_name_encoded === listName);
      if (list && list.books) {
        console.log(`[POPULATE] ${listName}: Found ${list.books.length} books`);
        list.books.forEach((book: NYTimesBook) => {
          if (book.primary_isbn13 && !seenIsbns.has(book.primary_isbn13)) {
            seenIsbns.add(book.primary_isbn13);
            allIsbns.push(book.primary_isbn13);
          }
        });
      }
    });

    console.log(`[POPULATE] Total unique ISBNs collected: ${allIsbns.length}`);

    // Fetch Google Books details for each ISBN (this is the actual data source for book
    // metadata - NYT only gives us the ISBN, so this lookup can't be skipped)
    const booksWithDetails = [];
    const googleBooksApiKeys = [
      process.env.GOOGLE_BOOKS_API_KEY_1!,
      process.env.GOOGLE_BOOKS_API_KEY_2!
    ];

    for (let i = 0; i < allIsbns.length; i++) {
      const isbn = allIsbns[i];

      try {
        let googleData = null;

        for (let keyIndex = 0; keyIndex < googleBooksApiKeys.length; keyIndex++) {
          try {
            const currentKey = googleBooksApiKeys[keyIndex];
            const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${currentKey}`;
            googleData = await fetchJSON(googleBooksUrl);

            if (googleData && googleData.items && googleData.items.length > 0) {
              break;
            }
          } catch (error) {
            console.log(`[POPULATE] Google Books API key ${keyIndex + 1} failed for ISBN ${isbn}:`, error);
            if (keyIndex === googleBooksApiKeys.length - 1) {
              throw error;
            }
          }
        }

        if (googleData && googleData.items && googleData.items.length > 0) {
          const googleBook = googleData.items[0];
          const bookTitle = googleBook.volumeInfo?.title;

          if (!bookTitle || bookTitle.trim().length === 0) {
            continue;
          }

          const bookWithDetails = {
            id: isbn,
            type: 'book',
            volumeInfo: googleBook.volumeInfo || {
              title: 'Unknown Title',
              authors: [],
              description: '',
              publishedDate: '',
              imageLinks: { thumbnail: null, smallThumbnail: null },
              previewLink: '',
              infoLink: '',
              publisher: '',
              categories: []
            }
          };

          const optimizedBook = optimizeBookData(bookWithDetails);
          booksWithDetails.push(optimizedBook);
        }

        // Small delay between ISBN lookups to stay under Google Books rate limits
        if (i < allIsbns.length - 1) {
          await delay(300);
        }
      } catch (error) {
        console.error(`[POPULATE] Error processing ISBN ${isbn}:`, error);
      }
    }

    console.log(`[POPULATE] Total books processed: ${booksWithDetails.length}`);

    // Ensure we have a count divisible by 40 (matches the frontend's pagination expectations)
    const targetBookCount = Math.floor(booksWithDetails.length / 40) * 40;
    const finalBooks = booksWithDetails.slice(0, targetBookCount);

    console.log(`[POPULATE] Final books_v2 count: ${finalBooks.length}`);

    await client.set(booksKey, JSON.stringify(finalBooks));
    await markUpdated(client, booksKey);
    revalidateTag('v2-cards-books')

    return finalBooks;
  } catch (error) {
    console.error('[POPULATE] Critical error in books_v2 population:', error);
    await sendErrorNotification('books', error as Error, 'Populate books_v2 key');
    throw error;
  } finally {
    await client.disconnect();
  }
}

// Helper function to send error notification emails
async function sendErrorNotification(mediaType: string, error: Error | string, operation: string) {
  try {
    const emailConfig = {
      provider: 'resend' as const,
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'noreply@clicknotes.com',
      fromName: 'ClickNotes System'
    };

    if (!emailConfig.apiKey) {
      console.error('[EMAIL] RESEND_API_KEY not configured, cannot send error notification');
      return;
    }

    const subject = `🚨 ClickNotes Redis Population Failed - ${mediaType}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Redis Population Failed</h2>
        <p><strong>Media Type:</strong> ${mediaType}</p>
        <p><strong>Operation:</strong> ${operation}</p>
        <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Stack Trace:</strong></p>
        <pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;">
          ${error instanceof Error ? error.stack : 'No stack trace available'}
        </pre>
        <p>Please check the server logs and Redis connection immediately.</p>

        <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Quick Actions</h3>
          <p style="margin-bottom: 20px;">You can manually retry the failed operation using these buttons:</p>

          ${mediaType === 'movies' || mediaType === 'general' ? `
            <a href="https://yourdomain.com/retry-population"
               style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 500;">
              🔄 Retry Movies Population
            </a>
          ` : ''}

          ${mediaType === 'tvshows' || mediaType === 'general' ? `
            <a href="https://yourdomain.com/retry-population"
               style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 500;">
              🔄 Retry TV Shows Population
            </a>
          ` : ''}

          ${mediaType === 'books' || mediaType === 'general' ? `
            <a href="https://yourdomain.com/retry-population"
               style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 500;">
              🔄 Retry Books Population
            </a>
          ` : ''}

          ${mediaType === 'general' ? `
            <a href="https://yourdomain.com/retry-population"
               style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 500;">
              🚀 Retry All Media Types
            </a>
          ` : ''}

          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            <strong>Note:</strong> Click any button above to open the retry page. You can then manually trigger the population process for the failed media type.
          </p>
        </div>

        <p>Best regards,<br>The ClickNotes System</p>
      </div>
    `;

    const text = `
      Redis Population Failed

      Media Type: ${mediaType}
      Operation: ${operation}
      Error: ${error instanceof Error ? error.message : String(error)}
      Timestamp: ${new Date().toISOString()}

      Please check the server logs and Redis connection immediately.

      Best regards,
      The ClickNotes System
    `;

    // Send to both email addresses
    const recipients = ['drensokoli@gmail.com', 'sokolidren@gmail.com'];

    for (const recipient of recipients) {
      await sendEmail(emailConfig, recipient, subject, html, text);
      console.log(`[EMAIL] Error notification sent to ${recipient}`);
    }

  } catch (emailError) {
    console.error('[EMAIL] Failed to send error notification:', emailError);
  }
}

async function populateAll(force = false) {
  const tmdbApiKey = process.env.TMDB_API_KEY!
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
  const nyTimesApiKey = process.env.NYTIMES_API_KEY!

  if (!tmdbApiKey || !googleBooksApiKey || !nyTimesApiKey) {
    throw new Error('Missing required API keys for population');
  }

  console.log('[POPULATE] Starting parallel population of movies and books...');
  const startTime = Date.now();

  const [movies, books] = await Promise.all([
    populateMovies(tmdbApiKey, force),
    populateBooks(googleBooksApiKey, nyTimesApiKey, force)
  ]);

  // Populate TV shows after movies to reduce TMDB rate-limit pressure
  const tvShowsStartTime = Date.now();
  const tvShows = await populateTVShows(tmdbApiKey, force);
  const tvShowsDuration = Date.now() - tvShowsStartTime;

  const totalDuration = Date.now() - startTime;

  console.log('[POPULATE] Complete data population finished!', {
    movies: movies.length,
    tvshows: tvShows.length,
    books: books.length,
    totalDuration: `${totalDuration}ms`,
    tvShowsDuration: `${tvShowsDuration}ms`,
  });

  return { movies, tvShows, books, totalDuration, tvShowsDuration };
}

export async function GET(request: NextRequest) {
  try {
    console.log('[CRON] Vercel cron job started...');
    console.log('[CRON] Request headers:', {
      userAgent: request.headers.get('user-agent'),
      vercelCron: request.headers.get('x-vercel-cron')
    });

    const { movies, tvShows, books, totalDuration, tvShowsDuration } = await populateAll();

    return NextResponse.json({
      message: 'Cron job completed - data populated successfully',
      movies: movies.length,
      tvshows: tvShows.length,
      books: books.length,
      totalDuration: `${totalDuration}ms`,
      tvShowsDuration: `${tvShowsDuration}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON] Cron job failed:', error);

    await sendErrorNotification('general', error as Error, 'Cron job execution');

    return NextResponse.json({
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, force } = body;
    console.log(`[POST] Processing action: ${action}${force ? ' (forced)' : ''}`);

    if (action === 'populate-all') {
      const { movies, tvShows, books, totalDuration, tvShowsDuration } = await populateAll(!!force);

      return NextResponse.json({
        message: 'Data populated successfully',
        movies: movies.length,
        tvshows: tvShows.length,
        books: books.length,
        totalDuration: `${totalDuration}ms`,
        tvShowsDuration: `${tvShowsDuration}ms`,
      });
    } else if (action === 'populate-movies') {
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const startTime = Date.now();
      const movies = await populateMovies(tmdbApiKey, !!force);
      const duration = Date.now() - startTime;

      return NextResponse.json({
        message: 'Movies populated successfully',
        movies: movies.length,
        duration: `${duration}ms`,
      });
    } else if (action === 'populate-tvshows') {
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const startTime = Date.now();
      const tvShows = await populateTVShows(tmdbApiKey, !!force);
      const duration = Date.now() - startTime;

      return NextResponse.json({
        message: 'TV shows populated successfully',
        tvshows: tvShows.length,
        duration: `${duration}ms`,
      });
    } else if (action === 'populate-books') {
      const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
      const nyTimesApiKey = process.env.NYTIMES_API_KEY!
      const startTime = Date.now();
      const books = await populateBooks(googleBooksApiKey, nyTimesApiKey, !!force);
      const duration = Date.now() - startTime;

      return NextResponse.json({
        message: 'Books populated successfully',
        books: books.length,
        duration: `${duration}ms`,
      });
    }

    console.log('[POST] Invalid action received:', action);
    console.log('[POST] Valid actions are: populate-all, populate-movies, populate-tvshows, populate-books');

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[POST] Redis POST error:', error);

    await sendErrorNotification('general', error as Error, 'General population process');

    return NextResponse.json({
      error: 'Failed to populate data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
