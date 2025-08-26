import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@redis/client"
import { fetchJSON } from '../../../lib/secure-fetch'

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

// Fetch movie details including OMDB data and Stremio link
async function fetchMovieWithDetails(movie: any, tmdbApiKey: string, omdbApiKeys: string[]) {
  try {
    // Fetch detailed movie info from TMDB
    const details = await fetchJSON(
      `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}&append_to_response=credits,videos`
    )

    // Fetch OMDB data for additional info
    let omdbData = null
    if (movie.release_date) {
      const year = movie.release_date.split('-')[0]
      for (const omdbApiKey of omdbApiKeys) {
        try {
          const omdbResult = await fetchJSON(
            `https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(movie.title)}&type=movie&y=${year}`
          )
          if (omdbResult.Response === "True") {
            omdbData = {
              imdbId: omdbResult.imdbID,
              rated: omdbResult.Rated,
              runtime: omdbResult.Runtime,
              awards: omdbResult.Awards,
            }
            break
          }
        } catch (error) {
          console.error(`Error fetching OMDB data for ${movie.title}:`, error)
        }
      }
    }

    // Create Stremio link
    const stremioLink = omdbData?.imdbId 
      ? `https://www.strem.io/s/movie/${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`
      : null

    return {
      ...movie,
      details,
      omdbData,
      stremioLink
    }
  } catch (error) {
    console.error(`Error fetching details for movie ${movie.title}:`, error)
    return movie
  }
}

// Fetch TV show details including OMDB data and Stremio link
async function fetchTVShowWithDetails(tvShow: any, tmdbApiKey: string, omdbApiKeys: string[]) {
  try {
    // Fetch detailed TV show info from TMDB
    const details = await fetchJSON(
      `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${tmdbApiKey}&append_to_response=credits,videos`
    )

    // Fetch OMDB data for additional info
    let omdbData = null
    if (tvShow.first_air_date) {
      const year = tvShow.first_air_date.split('-')[0]
      for (const omdbApiKey of omdbApiKeys) {
        try {
          const omdbResult = await fetchJSON(
            `https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(tvShow.name)}&type=series&y=${year}`
          )
          if (omdbResult.Response === "True") {
            omdbData = {
              imdbId: omdbResult.imdbID,
              rated: omdbResult.Rated,
              runtime: omdbResult.Runtime,
              awards: omdbResult.Awards,
            }
            break
          }
        } catch (error) {
          console.error(`Error fetching OMDB data for ${tvShow.name}:`, error)
        }
      }
    }

    // Create Stremio link
    const stremioLink = omdbData?.imdbId 
      ? `https://www.strem.io/s/movie/${tvShow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`
      : null

    return {
      ...tvShow,
      details,
      omdbData,
      stremioLink
    }
  } catch (error) {
    console.error(`Error fetching details for TV show ${tvShow.name}:`, error)
    return tvShow
  }
}

// Fetch book details including Google Books data
async function fetchBookWithDetails(book: any, googleBooksApiKey: string) {
  try {
    // If book already has volumeInfo, it's from Google Books API
    if (book.volumeInfo) {
      return book
    }

    // If it's from NY Times API, fetch Google Books details
    if (book.primary_isbn13) {
      const googleResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${book.primary_isbn13}&key=${googleBooksApiKey}`
      )
      const googleData = await googleResponse.json()
      
      if (googleData.items && googleData.items.length > 0) {
        return googleData.items[0]
      }
    }

    return book
  } catch (error) {
    console.error(`Error fetching details for book ${book.title}:`, error)
    return book
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Redis GET request received:', request.url);
    
    const client = createRedisClient()
    await client.connect()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    console.log('📋 Requested type:', type);

    // Add a special case to list all keys for debugging
    if (type === 'debug') {
      const keys = await client.keys('*');
      console.log('🔍 All Redis keys:', keys);
      await client.disconnect();
      return NextResponse.json({ keys, message: 'Debug info' });
    }

    if (type === 'movies') {
      const data = await client.get('movies')
      console.log('🎬 Movies from Redis:', {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else if (type === 'tvshows') {
      const data = await client.get('tvshows')
      console.log('📺 TV Shows from Redis:', {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else if (type === 'books') {
      const data = await client.get('books')
      console.log('📚 Books from Redis:', {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else {
      // Return all data
      console.log('🔄 Fetching all data from Redis...');
      const [movies, tvShows, books] = await Promise.all([
        client.get('movies'),
        client.get('tvshows'),
        client.get('books')
      ])
      
      console.log('📊 All Redis data:', {
        movies: movies ? JSON.parse(movies).length : 0,
        tvShows: tvShows ? JSON.parse(tvShows).length : 0,
        books: books ? JSON.parse(books).length : 0
      });
      
      await client.disconnect()
      
      return NextResponse.json({
        movies: movies ? JSON.parse(movies) : null,
        tvshows: tvShows ? JSON.parse(tvShows) : null,
        books: books ? JSON.parse(books) : null
      })
    }
  } catch (error) {
    console.error('❌ Redis GET error:', error)
    return NextResponse.json(null, { status: 404 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'populate') {
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
      const nyTimesApiKey = process.env.NYTIMES_API_KEY!
      const omdbApiKeys = [
        process.env.OMDB_API_KEY_1!,
        process.env.OMDB_API_KEY_2!,
        process.env.OMDB_API_KEY_3!,
      ]

      const client = createRedisClient()
      await client.connect()

      try {
        // Fetch and store movies
        console.log('Fetching movies...')
        const moviesResponse = await fetch(
          `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=1&include_adult=false`
        )
        const moviesData = await moviesResponse.json()
        
        const moviesWithDetails = []
        for (let i = 0; i < Math.min(moviesData.results.length, 50); i++) {
          const movie = moviesData.results[i]
          const movieWithDetails = await fetchMovieWithDetails(movie, tmdbApiKey, omdbApiKeys)
          moviesWithDetails.push(movieWithDetails)
          
          // Add 5 second delay between calls
          if (i < Math.min(moviesData.results.length, 50) - 1) {
            await delay(5000)
          }
        }
        
        await client.set('movies', JSON.stringify(moviesWithDetails))
        console.log(`Stored ${moviesWithDetails.length} movies in Redis`)

        // Fetch and store TV shows
        console.log('Fetching TV shows...')
        const tvShowsResponse = await fetch(
          `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=1`
        )
        const tvShowsData = await tvShowsResponse.json()
        
        const tvShowsWithDetails = []
        for (let i = 0; i < Math.min(tvShowsData.results.length, 50); i++) {
          const tvShow = tvShowsData.results[i]
          const tvShowWithDetails = await fetchTVShowWithDetails(tvShow, tmdbApiKey, omdbApiKeys)
          tvShowsWithDetails.push(tvShowWithDetails)
          
          // Add 5 second delay between calls
          if (i < Math.min(tvShowsData.results.length, 50) - 1) {
            await delay(5000)
          }
        }
        
        await client.set('tvshows', JSON.stringify(tvShowsWithDetails))
        console.log(`Stored ${tvShowsWithDetails.length} TV shows in Redis`)

        // Fetch and store books
        console.log('Fetching books...')
        const nyTimesResponse = await fetch(
          `https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${nyTimesApiKey}`
        )
        const nyTimesData = await nyTimesResponse.json()
        
        const booksWithDetails = []
        for (let i = 0; i < Math.min(nyTimesData.results.books.length, 50); i++) {
          const book = nyTimesData.results.books[i]
          const bookWithDetails = await fetchBookWithDetails(book, googleBooksApiKey)
          booksWithDetails.push(bookWithDetails)
          
          // Add 5 second delay between calls
          if (i < Math.min(nyTimesData.results.books.length, 50) - 1) {
            await delay(5000)
          }
        }
        
        await client.set('books', JSON.stringify(booksWithDetails))
        console.log(`Stored ${booksWithDetails.length} books in Redis`)

        await client.disconnect()
        
        return NextResponse.json({ 
          message: 'Data populated successfully',
          movies: moviesWithDetails.length,
          tvshows: tvShowsWithDetails.length,
          books: booksWithDetails.length
        })
      } catch (error) {
        await client.disconnect()
        throw error
      }
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Redis POST error:', error)
    return NextResponse.json({ error: 'Failed to populate data' }, { status: 500 })
  }
}
