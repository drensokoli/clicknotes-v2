import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@redis/client"
import { fetchJSON } from '../../../lib/secure-fetch'
import { sendEmail } from '../../../lib/email-service'

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

// Helper function to create backup Redis client
const createRedisClient2 = () => {
  const redisHost = process.env.REDIS_HOST_2
  const redisPassword = process.env.REDIS_PASSWORD_2
  const redisPort = process.env.REDIS_PORT_2

  if (!redisHost || !redisPassword || !redisPort) {
    throw new Error('Backup Redis configuration missing')
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
  
  // Must have at least 100 votes to ensure rating reliability
  if (voteCount < 10) return false;
  
  return true;
};

// Helper function to clear Redis data
async function clearRedisData(client: any, dataType: string) {
  try {
    console.log(`[CLEAR] Clearing Redis ${dataType} data...`);
    await client.del(dataType);
    console.log(`[CLEAR] Successfully cleared ${dataType} from Redis`);
  } catch (error) {
    console.error(`[CLEAR] Error clearing ${dataType} from Redis:`, error);
  }
}

// Helper function to store data in Redis with automatic size reduction
async function storeInRedisWithFallback(client: any, key: string, data: any[], initialLimit: number = 240) {
  let currentLimit = initialLimit;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    try {
      // Ensure the limit is divisible by 20
      const adjustedLimit = Math.floor(currentLimit / 20) * 20;
      const limitedData = data.slice(0, adjustedLimit);
      const jsonData = JSON.stringify(limitedData);
      
      console.log(`[REDIS] Attempting to store ${limitedData.length} items (limit: ${currentLimit}, adjusted: ${adjustedLimit})`);
      console.log(`[REDIS] JSON size: ${jsonData.length} characters`);
      
      await client.set(key, jsonData);
      console.log(`[REDIS] Successfully stored ${limitedData.length} items in Redis`);
      
      return limitedData;
    } catch (error: any) {
      attempts++;
      console.error(`[REDIS] Storage attempt ${attempts} failed:`, error.message);
      
      if (error.message.includes('OOM') || error.message.includes('maxmemory')) {
        // Reduce by 20 items to maintain divisibility by 20
        currentLimit -= 20;
        console.log(`[REDIS] Redis out of memory, reducing limit to ${currentLimit} items (divisible by 20)`);
        
        if (currentLimit <= 0) {
          console.error(`[REDIS] Cannot store any items, Redis memory limit too low`);
          throw new Error('Redis memory limit too low for any data storage');
        }
      } else {
        // Non-memory related error, don't retry
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to store data after ${maxAttempts} attempts`);
}

// Helper function to rotate API keys (move failed keys to end)
function rotateApiKeys(apiKeys: string[], failedIndex: number) {
  if (failedIndex >= 0 && failedIndex < apiKeys.length) {
    const failedKey = apiKeys.splice(failedIndex, 1)[0];
    apiKeys.push(failedKey);
    console.log(`[ROTATE] Moved failed API key ${failedIndex + 1} to end of array`);
  }
}

// Fetch movie details including OMDB data and Stremio link
async function fetchMovieWithDetails(movie: any, tmdbApiKey: string, omdbApiKeys: string[]) {
  try {
    console.log(`[MOVIE] Starting fetch for: ${movie.title} (ID: ${movie.id})`);
    console.log(`[MOVIE] Movie data structure:`, {
      hasTitle: !!movie.title,
      hasReleaseDate: !!movie.release_date,
      hasPosterPath: !!movie.poster_path,
      hasOverview: !!movie.overview,
      keys: Object.keys(movie)
    });
    
    // Fetch detailed movie info from TMDB
    console.log(`[MOVIE] Fetching TMDB details for: ${movie.title}`);
    const details = await fetchJSON(
      `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}&append_to_response=credits,videos`
    )
    console.log(`[MOVIE] TMDB response for ${movie.title}:`, {
      hasDetails: !!details,
      detailsKeys: details ? Object.keys(details) : [],
      hasCredits: !!details?.credits,
      hasVideos: !!details?.videos,
      creditsCount: details?.credits?.cast?.length || 0,
      videosCount: details?.videos?.results?.length || 0
    });

    // Fetch OMDB data for additional info
    let omdbData = null
    if (movie.release_date) {
      const year = movie.release_date.split('-')[0]
      console.log(`[MOVIE] Fetching OMDB data for ${movie.title} (${year})`);
      console.log(`[MOVIE] Available OMDB API keys: ${omdbApiKeys.filter(k => !!k).length}`);
      
      // Create a copy of the array to work with
      const workingKeys = [...omdbApiKeys];
      
      for (let i = 0; i < workingKeys.length; i++) {
        const omdbApiKey = workingKeys[i];
        if (!omdbApiKey) {
          console.log(`[MOVIE] Skipping empty OMDB API key ${i + 1}`);
          continue;
        }
        
        try {
          console.log(`[MOVIE] Trying OMDB API key ${i + 1} for ${movie.title}`);
          const omdbResult = await fetchJSON(
            `https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(movie.title)}&type=movie&y=${year}`
          )
          
          // Check if we got a valid response
          if (omdbResult && typeof omdbResult === 'object') {
            console.log(`[MOVIE] OMDB response for ${movie.title}:`, {
              hasResponse: !!omdbResult,
              response: omdbResult?.Response,
              hasImdbId: !!omdbResult?.imdbID,
              imdbId: omdbResult?.imdbID,
              hasRated: !!omdbResult?.Rated,
              hasRuntime: !!omdbResult?.Runtime,
              error: omdbResult?.Error || null
            });
            
          if (omdbResult.Response === "True") {
            omdbData = {
              imdbId: omdbResult.imdbID,
              rated: omdbResult.Rated,
              runtime: omdbResult.Runtime,
              awards: omdbResult.Awards,
            }
              console.log(`[MOVIE] OMDB data found for ${movie.title}: ${omdbResult.imdbID}`);
              console.log(`[MOVIE] OMDB data structure:`, omdbData);
            break
            } else if (omdbResult.Error) {
              console.log(`[MOVIE] OMDB response false for ${movie.title}: ${omdbResult.Error}`);
              // Check if it's a rate limit or API key issue
              if (omdbResult.Error.includes('API key') || omdbResult.Error.includes('limit') || omdbResult.Error.includes('quota')) {
                console.log(`[MOVIE] API key ${i + 1} appears to be rate limited or invalid, will rotate to end`);
                rotateApiKeys(omdbApiKeys, i);
              }
            }
          } else {
            console.log(`[MOVIE] Invalid OMDB response for ${movie.title}:`, omdbResult);
          }
        } catch (error) {
          console.error(`[MOVIE] Error fetching OMDB data for ${movie.title} with key ${i + 1}:`, error);
          
          // Check if it's an HTTP error that suggests rate limiting
          if (error instanceof Error) {
            if (error.message.includes('401') || error.message.includes('429') || error.message.includes('403')) {
              console.log(`[MOVIE] HTTP error suggests API key ${i + 1} is rate limited or invalid, will rotate to end`);
              rotateApiKeys(omdbApiKeys, i);
            }
          }
        }
      }
    } else {
      console.log(`[MOVIE] No release date for ${movie.title}, skipping OMDB fetch`);
    }

    // Create Stremio link
    const stremioLink = omdbData?.imdbId 
      ? `https://www.strem.io/s/movie/${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`
      : null

    if (stremioLink) {
      console.log(`[MOVIE] Created Stremio link for ${movie.title}: ${stremioLink}`);
    } else {
      console.log(`[MOVIE] No Stremio link created for ${movie.title} (missing IMDB ID)`);
    }

    const movieWithDetails = {
      ...movie,
      details,
      omdbData,
      stremioLink
    };
    
    console.log(`[MOVIE] Final movie structure for ${movie.title}:`, {
      hasDetails: !!movieWithDetails.details,
      hasOmdbData: !!movieWithDetails.omdbData,
      hasStremioLink: !!movieWithDetails.stremioLink,
      totalKeys: Object.keys(movieWithDetails).length,
      keys: Object.keys(movieWithDetails)
    });
    
    console.log(`[MOVIE] Completed movie: ${movie.title} - Has details: ${!!details}, Has OMDB: ${!!omdbData}`);
    return movieWithDetails;
  } catch (error) {
    console.error(`[MOVIE] Error fetching details for movie ${movie.title}:`, error);
    console.error(`[MOVIE] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      movieId: movie.id,
      movieTitle: movie.title
    });
    return movie
  }
}

// Fetch TV show details including OMDB data and Stremio link
async function fetchTVShowWithDetails(tvShow: any, tmdbApiKey: string, omdbApiKeys: string[]) {
  try {
    console.log(`[TVSHOW] Starting fetch for: ${tvShow.name} (ID: ${tvShow.id})`);
    console.log(`[TVSHOW] TV Show data structure:`, {
      hasName: !!tvShow.name,
      hasFirstAirDate: !!tvShow.first_air_date,
      hasPosterPath: !!tvShow.poster_path,
      hasOverview: !!tvShow.overview,
      keys: Object.keys(tvShow)
    });
    
    // Fetch detailed TV show info from TMDB
    console.log(`[TVSHOW] Fetching TMDB details for: ${tvShow.name}`);
    const details = await fetchJSON(
      `https://api.themoviedb.org/3/tv/${tvShow.id}?api_key=${tmdbApiKey}&append_to_response=credits,videos`
    )
    console.log(`[TVSHOW] TMDB response for ${tvShow.name}:`, {
      hasDetails: !!details,
      detailsKeys: details ? Object.keys(details) : [],
      hasCredits: !!details?.credits,
      hasVideos: !!details?.videos,
      creditsCount: details?.credits?.cast?.length || 0,
      videosCount: details?.videos?.results?.length || 0
    });

    // Fetch OMDB data for additional info
    let omdbData = null
    if (tvShow.first_air_date) {
      const year = tvShow.first_air_date.split('-')[0]
      console.log(`[TVSHOW] Fetching OMDB data for ${tvShow.name} (${year})`);
      console.log(`[TVSHOW] Available OMDB API keys: ${omdbApiKeys.filter(k => !!k).length}`);
      
      // Create a copy of the array to work with
      const workingKeys = [...omdbApiKeys];
      
      for (let i = 0; i < workingKeys.length; i++) {
        const omdbApiKey = workingKeys[i];
        if (!omdbApiKey) {
          console.log(`[TVSHOW] Skipping empty OMDB API key ${i + 1}`);
          continue;
        }
        
        try {
          console.log(`[TVSHOW] Trying OMDB API key ${i + 1} for ${tvShow.name}`);
          const omdbResult = await fetchJSON(
            `https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(tvShow.name)}&type=series&y=${year}`
          )
          
          // Check if we got a valid response
          if (omdbResult && typeof omdbResult === 'object') {
            console.log(`[TVSHOW] OMDB response for ${tvShow.name}:`, {
              hasResponse: !!omdbResult,
              response: omdbResult?.Response,
              hasImdbId: !!omdbResult?.imdbID,
              imdbId: omdbResult?.imdbID,
              hasRated: !!omdbResult?.Rated,
              hasRuntime: !!omdbResult?.Runtime,
              error: omdbResult?.Error || null
            });
            
          if (omdbResult.Response === "True") {
            omdbData = {
              imdbId: omdbResult.imdbID,
              rated: omdbResult.Rated,
              runtime: omdbResult.Runtime,
              awards: omdbResult.Awards,
            }
              console.log(`[TVSHOW] OMDB data found for ${tvShow.name}: ${omdbResult.imdbID}`);
              console.log(`[TVSHOW] OMDB data structure:`, omdbData);
            break
            } else if (omdbResult.Error) {
              console.log(`[TVSHOW] OMDB response false for ${tvShow.name}: ${omdbResult.Error}`);
              // Check if it's a rate limit or API key issue
              if (omdbResult.Error.includes('API key') || omdbResult.Error.includes('limit') || omdbResult.Error.includes('quota')) {
                console.log(`[TVSHOW] API key ${i + 1} appears to be rate limited or invalid, will rotate to end`);
                rotateApiKeys(omdbApiKeys, i);
              }
            }
          } else {
            console.log(`[TVSHOW] Invalid OMDB response for ${tvShow.name}:`, omdbResult);
          }
        } catch (error) {
          console.error(`[TVSHOW] Error fetching OMDB data for ${tvShow.name} with key ${i + 1}:`, error);
          
          // Check if it's an HTTP error that suggests rate limiting
          if (error instanceof Error) {
            if (error.message.includes('401') || error.message.includes('429') || error.message.includes('403')) {
              console.log(`[TVSHOW] HTTP error suggests API key ${i + 1} is rate limited or invalid, will rotate to end`);
              rotateApiKeys(omdbApiKeys, i);
            }
          }
        }
      }
    } else {
      console.log(`[TVSHOW] No first air date for ${tvShow.name}, skipping OMDB fetch`);
    }

    // Create Stremio link
    const stremioLink = omdbData?.imdbId 
      ? `https://www.strem.io/s/movie/${tvShow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`
      : null

    if (stremioLink) {
      console.log(`[TVSHOW] Created Stremio link for ${tvShow.name}: ${stremioLink}`);
    } else {
      console.log(`[TVSHOW] No Stremio link created for ${tvShow.name} (missing IMDB ID)`);
    }

    const tvShowWithDetails = {
      ...tvShow,
      details,
      omdbData,
      stremioLink
    };
    
    console.log(`[TVSHOW] Final TV show structure for ${tvShow.name}:`, {
      hasDetails: !!tvShowWithDetails.details,
      hasOmdbData: !!tvShowWithDetails.omdbData,
      hasStremioLink: !!tvShowWithDetails.stremioLink,
      totalKeys: Object.keys(tvShowWithDetails).length,
      keys: Object.keys(tvShowWithDetails)
    });
    
    console.log(`[TVSHOW] Completed TV show: ${tvShow.name} - Has details: ${!!details}, Has OMDB: ${!!omdbData}`);
    return tvShowWithDetails;
  } catch (error) {
    console.error(`[TVSHOW] Error fetching details for TV show ${tvShow.name}:`, error);
    console.error(`[TVSHOW] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      tvShowId: tvShow.id,
      tvShowName: tvShow.name
    });
    return tvShow
  }
}

// Fetch book details including Google Books data
async function fetchBookWithDetails(book: any, googleBooksApiKey: string) {
  try {
    console.log(`[BOOK] Starting processing for: ${book.title}`);
    console.log(`[BOOK] Book data structure:`, {
      hasTitle: !!book.title,
      hasIsbn: !!book.primary_isbn13,
      hasAuthor: !!book.author,
      hasDescription: !!book.description,
      hasBookImage: !!book.book_image,
      hasPublisher: !!book.publisher,
      keys: Object.keys(book)
    });
    
    // If book already has volumeInfo, it's from Google Books API
    if (book.volumeInfo) {
      console.log(`[BOOK] Book already has volumeInfo: ${book.title}`);
      console.log(`[BOOK] VolumeInfo structure:`, {
        hasTitle: !!book.volumeInfo.title,
        hasAuthors: !!book.volumeInfo.authors,
        hasDescription: !!book.volumeInfo.description,
        hasImageLinks: !!book.volumeInfo.imageLinks,
        volumeInfoKeys: Object.keys(book.volumeInfo)
      });
      return book
    }

    // If it's from NY Times API, fetch Google Books details
    if (book.primary_isbn13) {
      console.log(`[BOOK] Fetching Google Books data for ISBN: ${book.primary_isbn13}`);
      console.log(`[BOOK] Google Books API key available: ${!!googleBooksApiKey}`);
      
      try {
        const googleData = await fetchJSON(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${book.primary_isbn13}&key=${googleBooksApiKey}`
      )
        
        console.log(`[BOOK] Google Books response for ${book.title}:`, {
          hasData: !!googleData,
          hasItems: !!googleData?.items,
          itemsCount: googleData?.items?.length || 0,
          responseKeys: googleData ? Object.keys(googleData) : [],
          error: googleData?.error || null,
          totalItems: googleData?.totalItems || 0
        });
        
        if (googleData && googleData.items && googleData.items.length > 0) {
          const googleBook = googleData.items[0]
          console.log(`[BOOK] First Google Books item for ${book.title}:`, {
            hasId: !!googleBook.id,
            hasVolumeInfo: !!googleBook.volumeInfo,
            volumeInfoKeys: googleBook.volumeInfo ? Object.keys(googleBook.volumeInfo) : [],
            hasTitle: !!googleBook.volumeInfo?.title,
            hasAuthors: !!googleBook.volumeInfo?.authors,
            hasImageLinks: !!googleBook.volumeInfo?.imageLinks
          });
          
          // Ensure the book has the proper structure
          if (googleBook.volumeInfo) {
            console.log(`[BOOK] Successfully fetched Google Books data for: ${book.title}`);
            console.log(`[BOOK] Final Google Books structure:`, {
              id: googleBook.id,
              type: googleBook.type,
              hasVolumeInfo: !!googleBook.volumeInfo,
              volumeInfoKeys: Object.keys(googleBook.volumeInfo),
              title: googleBook.volumeInfo.title,
              authors: googleBook.volumeInfo.authors,
              hasImage: !!googleBook.volumeInfo.imageLinks?.thumbnail
            });
            return googleBook
          } else {
            console.warn(`[BOOK] Google Books data missing volumeInfo for: ${book.title}`);
          }
        } else {
          console.warn(`[BOOK] No Google Books items found for: ${book.title}`);
          if (googleData?.error) {
            console.error(`[BOOK] Google Books API error:`, googleData.error);
          }
        }
      } catch (fetchError) {
        console.error(`[BOOK] Error fetching from Google Books API for ${book.title}:`, fetchError);
        console.error(`[BOOK] Fetch error details:`, {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          stack: fetchError instanceof Error ? fetchError.stack : 'No stack trace',
          isbn: book.primary_isbn13
        });
      }
    } else {
      console.log(`[BOOK] No ISBN for ${book.title}, cannot fetch Google Books data`);
    }

    // If we can't get proper Google Books data, create a proper structure from NY Times data
    console.log(`[BOOK] Creating fallback structure for: ${book.title}`);
    const fallbackBook = {
      id: book.primary_isbn13 || book.isbn || `book-${Date.now()}`,
      type: 'book',
      volumeInfo: {
        title: book.title || 'Unknown Title',
        authors: book.author ? [book.author] : [],
        description: book.description || '',
        publishedDate: book.published_date || book.created_date?.split('T')[0] || '',
        pageCount: undefined, // NY Times doesn't provide this
        averageRating: undefined, // NY Times doesn't provide this
        imageLinks: {
          thumbnail: book.book_image || null,
          smallThumbnail: book.book_image || null
        },
        previewLink: book.amazon_product_url || '',
        infoLink: book.amazon_product_url || '',
        publisher: book.publisher || '',
        categories: []
      },
      // Add additional NY Times data that might be useful
      saleInfo: {
        saleability: 'FOR_SALE',
        listPrice: {
          amount: parseFloat(book.price) || 0,
          currencyCode: 'USD'
        }
      }
    };
    
    console.log(`[BOOK] Fallback book structure for ${book.title}:`, {
      id: fallbackBook.id,
      type: fallbackBook.type,
      hasVolumeInfo: !!fallbackBook.volumeInfo,
      volumeInfoKeys: Object.keys(fallbackBook.volumeInfo),
      title: fallbackBook.volumeInfo.title,
      authors: fallbackBook.volumeInfo.authors,
      hasImage: !!fallbackBook.volumeInfo.imageLinks.thumbnail,
      imageUrl: fallbackBook.volumeInfo.imageLinks.thumbnail,
      hasPublisher: !!fallbackBook.volumeInfo.publisher,
      publisher: fallbackBook.volumeInfo.publisher,
      hasSaleInfo: !!fallbackBook.saleInfo,
      price: fallbackBook.saleInfo.listPrice.amount
    });
    
    return fallbackBook;
  } catch (error) {
    console.error(`[BOOK] Error fetching details for book ${book.title || 'Unknown'}:`, error);
    console.error(`[BOOK] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      bookTitle: book.title,
      bookIsbn: book.primary_isbn13
    });
    
    // Return a minimal book structure to prevent crashes
    const minimalBook = {
      id: book.primary_isbn13 || book.isbn || `book-${Date.now()}`,
      type: 'book',
      volumeInfo: {
        title: book.title || 'Unknown Title',
        authors: book.author ? [book.author] : [],
        description: book.description || '',
        publishedDate: book.published_date || book.created_date?.split('T')[0] || '',
        pageCount: undefined,
        averageRating: undefined,
        imageLinks: {
          thumbnail: book.book_image || null,
          smallThumbnail: book.book_image || null
        },
        previewLink: book.amazon_product_url || '',
        infoLink: book.amazon_product_url || '',
        publisher: book.publisher || '',
        categories: []
      }
    };
    
    console.log(`[BOOK] Created minimal fallback book for ${book.title || 'Unknown'}:`, {
      id: minimalBook.id,
      type: minimalBook.type,
      hasVolumeInfo: !!minimalBook.volumeInfo,
      title: minimalBook.volumeInfo.title
    });
    
    return minimalBook;
  }
}

// Populate movies with immediate filtering (more efficient)
async function populateMovies(tmdbApiKey: string, omdbApiKeys: string[]) {
  console.log('[POPULATE] Starting movies population...');
  console.log('[POPULATE] Configuration:', {
    hasTmdbKey: !!tmdbApiKey,
    tmdbKeyLength: tmdbApiKey?.length || 0,
    omdbKeysCount: omdbApiKeys.length,
    omdbKeysAvailable: omdbApiKeys.filter(k => !!k).length,
    omdbKeys: omdbApiKeys.map((k, i) => ({ index: i, hasKey: !!k, keyLength: k?.length || 0 }))
  });
  console.log('[POPULATE] Fetching movies with immediate filtering until we have 240...');
  
  const client = createRedisClient()
  console.log('[POPULATE] Redis client created, connecting...');
  await client.connect()
  console.log('[POPULATE] Redis connected successfully');
  
  try {
    const filteredMovies = [];
    const seenIds = new Set();
    let totalProcessed = 0;
    
    // Fetch movies page by page until we have 240 filtered movies
    for (let page = 1; page <= 20; page++) {
      console.log(`[POPULATE] Fetching movies page ${page}/20...`);
      
      try {
        const url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}&include_adult=false`;
        console.log(`[POPULATE] TMDB URL for page ${page}: ${url.replace(tmdbApiKey, '***')}`);
        
        const moviesData = await fetchJSON(url)
        
        if (moviesData && moviesData.results) {
          console.log(`[POPULATE] Page ${page}: Found ${moviesData.results.length} movies`);
          console.log(`[POPULATE] Page ${page} response structure:`, {
            hasResults: !!moviesData.results,
            resultsLength: moviesData.results.length,
            hasPage: !!moviesData.page,
            page: moviesData.page,
            hasTotalPages: !!moviesData.total_pages,
            totalPages: moviesData.total_pages,
            responseKeys: Object.keys(moviesData)
          });
          
          for (let i = 0; i < moviesData.results.length; i++) {
            // Stop if we've reached 240 filtered movies
            if (filteredMovies.length >= 240) {
              console.log(`[POPULATE] Reached 240 filtered movies, stopping collection`);
              break;
            }
            
            const movie = moviesData.results[i];
            totalProcessed++;
            console.log(`[POPULATE] Processing movie ${totalProcessed}: ${movie.title} (ID: ${movie.id})`);
            
            if (!seenIds.has(movie.id)) {
              seenIds.add(movie.id);
              
              // Check filters immediately for this movie
              const description = (movie.overview || '').toLowerCase();
              const title = (movie.title || '').toLowerCase();
              
              // Filter out erotic content
              if (isEroticContent(title, description)) {
                console.log(`[POPULATE] ❌ Filtered out erotic movie: ${movie.title}`);
                continue; // Skip this movie and move to next
              }
              
              // Filter out low-quality movies (optional - you can uncomment if needed)
              if (!meetsQualityStandards(movie.vote_average, movie.vote_count || 0)) {
                console.log(`[POPULATE] ❌ Filtered out low-quality movie: ${movie.title} (rating: ${movie.vote_average}, votes: ${movie.vote_count})`);
                continue; // Skip this movie and move to next
              }
              
              console.log(`[POPULATE] ✅ Movie ${movie.title} passed filters, fetching details...`);
              
              const movieWithDetails = await fetchMovieWithDetails(movie, tmdbApiKey, omdbApiKeys);
              filteredMovies.push(movieWithDetails);
              
              console.log(`[POPULATE] ✅ Movie ${movie.title} processed and added to collection. Total filtered: ${filteredMovies.length}/240`);
              
              // Add delay between individual movie detail fetches
              console.log(`[POPULATE] Waiting 2 seconds before next movie...`);
              await delay(2000);
            } else {
              console.log(`[POPULATE] Duplicate movie skipped: ${movie.title} (ID: ${movie.id})`);
            }
          }
          
          // Stop processing pages if we've reached the limit
          if (filteredMovies.length >= 240) {
            console.log(`[POPULATE] Reached 240 filtered movies, stopping page processing`);
            break;
          }
        } else {
          console.warn(`[POPULATE] Page ${page}: Invalid response structure:`, {
            hasData: !!moviesData,
            hasResults: !!moviesData?.results,
            dataType: typeof moviesData,
            keys: moviesData ? Object.keys(moviesData) : []
          });
        }
        
        // Add delay between pages
        if (page < 20) {
          console.log(`[POPULATE] Waiting 2 seconds before next page...`);
          await delay(2000);
        }
      } catch (error) {
        console.error(`[POPULATE] Error fetching movies page ${page}:`, error);
        console.error(`[POPULATE] Page ${page} error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          page: page,
          attempt: 'retry on next iteration'
        });
      }
    }
    
    console.log(`[POPULATE] Total movies processed: ${totalProcessed}`);
    console.log(`[POPULATE] Total movies after filtering: ${filteredMovies.length}`);
    
    // Ensure we have exactly 240 movies (slice if we somehow got more)
    const finalMovies = filteredMovies.slice(0, 240);
    
    console.log(`[POPULATE] Final count sliced to 240: ${finalMovies.length} movies`);
    console.log(`[POPULATE] Movies collection structure:`, {
      totalCount: finalMovies.length,
      hasMovies: finalMovies.length > 0,
      firstMovieKeys: finalMovies[0] ? Object.keys(finalMovies[0]) : [],
      sampleMovie: finalMovies[0] ? {
        id: finalMovies[0].id,
        title: finalMovies[0].title,
        hasDetails: !!finalMovies[0].details,
        hasOmdbData: !!finalMovies[0].omdbData,
        hasStremioLink: !!finalMovies[0].stremioLink
      } : null
    });
    
    // Store paginated movies in Redis (6 groups of 40 = 240 total)
    console.log(`[POPULATE] Storing paginated movies in Redis (6 groups of 40 = 240 total)...`);
    
    // Create paginated keys: movies1, movies2, movies3, movies4, movies5, movies6
    // Each group has exactly 40 items
    const movies1 = finalMovies.slice(0, 40);
    const movies2 = finalMovies.slice(40, 80);
    const movies3 = finalMovies.slice(80, 120);
    const movies4 = finalMovies.slice(120, 160);
    const movies5 = finalMovies.slice(160, 200);
    const movies6 = finalMovies.slice(200, 240);
    
    console.log(`[POPULATE] Paginated movies: movies1(${movies1.length}), movies2(${movies2.length}), movies3(${movies3.length}), movies4(${movies4.length}), movies5(${movies5.length}), movies6(${movies6.length})`);
    
    // Store in both Redis databases
    try {
      // Store in primary Redis
      await client.set('movies1', JSON.stringify(movies1));
      await client.set('movies2', JSON.stringify(movies2));
      await client.set('movies3', JSON.stringify(movies3));
      await client.set('movies4', JSON.stringify(movies4));
      await client.set('movies5', JSON.stringify(movies5));
      await client.set('movies6', JSON.stringify(movies6));
      console.log(`[POPULATE] ✅ Stored paginated movies in primary Redis`);
      
      // Store in backup Redis
      const backupClient = createRedisClient2();
      await backupClient.connect();
      await backupClient.set('movies1', JSON.stringify(movies1));
      await backupClient.set('movies2', JSON.stringify(movies2));
      await backupClient.set('movies3', JSON.stringify(movies3));
      await backupClient.set('movies4', JSON.stringify(movies4));
      await backupClient.set('movies5', JSON.stringify(movies5));
      await backupClient.set('movies6', JSON.stringify(movies6));
      await backupClient.disconnect();
      console.log(`[POPULATE] ✅ Stored paginated movies in backup Redis`);
      
    } catch (error) {
      console.error(`[POPULATE] Error storing paginated movies:`, error);
      await sendErrorNotification('movies', error, 'Storing paginated movies');
    }
    
    return finalMovies;
  } catch (error) {
    console.error(`[POPULATE] Critical error in movies population:`, error);
    console.error(`[POPULATE] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Send error notification email
    await sendErrorNotification('movies', error, 'Movies population process');
    
    throw error;
  } finally {
    console.log(`[POPULATE] Disconnecting from Redis...`);
    await client.disconnect();
    console.log(`[POPULATE] Redis disconnected`);
  }
}

// Populate TV shows with immediate filtering (more efficient)
async function populateTVShows(tmdbApiKey: string, omdbApiKeys: string[]) {
  console.log('[POPULATE] Starting TV shows population...');
  console.log('[POPULATE] Configuration:', {
    hasTmdbKey: !!tmdbApiKey,
    tmdbKeyLength: tmdbApiKey?.length || 0,
    omdbKeysCount: omdbApiKeys.length,
    omdbKeysAvailable: omdbApiKeys.filter(k => !!k).length,
    omdbKeys: omdbApiKeys.map((k, i) => ({ index: i, hasKey: !!k, keyLength: k?.length || 0 }))
  });
  console.log('[POPULATE] Fetching TV shows with immediate filtering until we have 240...');
  
  const client = createRedisClient()
  console.log('[POPULATE] Redis client created, connecting...');
  await client.connect()
  console.log('[POPULATE] Redis connected successfully');
  
  try {
    const filteredTVShows = [];
    const seenIds = new Set();
    let totalProcessed = 0;
    
    // Fetch TV shows page by page until we have 240 filtered shows
    for (let page = 1; page <= 20; page++) {
      console.log(`[POPULATE] Fetching TV shows page ${page}/20...`);
      
      try {
        const url = `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`;
        console.log(`[POPULATE] TMDB URL for page ${page}: ${url.replace(tmdbApiKey, '***')}`);
        
        const tvShowsData = await fetchJSON(url)
        
        if (tvShowsData && tvShowsData.results) {
          console.log(`[POPULATE] Page ${page}: Found ${tvShowsData.results.length} TV shows`);
          console.log(`[POPULATE] Page ${page} response structure:`, {
            hasResults: !!tvShowsData.results,
            resultsLength: tvShowsData.results.length,
            hasPage: !!tvShowsData.page,
            page: tvShowsData.page,
            hasTotalPages: !!tvShowsData.total_pages,
            totalPages: tvShowsData.total_pages,
            responseKeys: Object.keys(tvShowsData)
          });
          
          for (let i = 0; i < tvShowsData.results.length; i++) {
            // Stop if we've reached 240 filtered TV shows
            if (filteredTVShows.length >= 240) {
              console.log(`[POPULATE] Reached 240 filtered TV shows, stopping collection`);
              break;
            }
            
            const tvShow = tvShowsData.results[i];
            totalProcessed++;
            console.log(`[POPULATE] Processing TV show ${totalProcessed}: ${tvShow.name} (ID: ${tvShow.id})`);
            
            if (!seenIds.has(tvShow.id)) {
              seenIds.add(tvShow.id);
              
              // Check filters immediately for this TV show
              const description = (tvShow.overview || '').toLowerCase();
              const title = (tvShow.name || '').toLowerCase();
              
              // Filter out erotic content
              if (isEroticContent(title, description)) {
                console.log(`[POPULATE] ❌ Filtered out erotic TV show: ${tvShow.name}`);
                continue; // Skip this TV show and move to next
              }
              
              // Filter out low-quality TV shows
              if (!meetsQualityStandards(tvShow.vote_average, tvShow.vote_count || 0)) {
                console.log(`[POPULATE] ❌ Filtered out low-quality TV show: ${tvShow.name} (rating: ${tvShow.vote_average}, votes: ${tvShow.vote_count})`);
                continue; // Skip this TV show and move to next
              }
              
              console.log(`[POPULATE] ✅ TV show ${tvShow.name} passed filters, fetching details...`);
              
              const tvShowWithDetails = await fetchTVShowWithDetails(tvShow, tmdbApiKey, omdbApiKeys);
              filteredTVShows.push(tvShowWithDetails);
              
              console.log(`[POPULATE] ✅ TV show ${tvShow.name} processed and added to collection. Total filtered: ${filteredTVShows.length}/240`);
              
              // Add delay between individual TV show detail fetches
              console.log(`[POPULATE] Waiting 2 seconds before next TV show...`);
              await delay(2000);
            } else {
              console.log(`[POPULATE] Duplicate TV show skipped: ${tvShow.name} (ID: ${tvShow.id})`);
            }
          }
          
          // Stop processing pages if we've reached the limit
          if (filteredTVShows.length >= 240) {
            console.log(`[POPULATE] Reached 240 filtered TV shows, stopping page processing`);
            break;
          }
        } else {
          console.warn(`[POPULATE] Page ${page}: Invalid response structure:`, {
            hasData: !!tvShowsData,
            hasResults: !!tvShowsData?.results,
            dataType: typeof tvShowsData,
            keys: tvShowsData ? Object.keys(tvShowsData) : []
          });
        }
        
        // Add delay between pages
        if (page < 20) {
          console.log(`[POPULATE] Waiting 2 seconds before next page...`);
          await delay(2000);
        }
      } catch (error) {
        console.error(`[POPULATE] Error fetching TV shows page ${page}:`, error);
        console.error(`[POPULATE] Page ${page} error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          page: page,
          attempt: 'retry on next iteration'
        });
      }
    }
    
    console.log(`[POPULATE] Total TV shows processed: ${totalProcessed}`);
    console.log(`[POPULATE] Total TV shows after filtering: ${filteredTVShows.length}`);
    
    // Ensure we have exactly 240 TV shows (slice if we somehow got more)
    const finalTVShows = filteredTVShows.slice(0, 240);
    
    console.log(`[POPULATE] Final count sliced to 240: ${finalTVShows.length} TV shows`);
    console.log(`[POPULATE] TV Shows collection structure:`, {
      totalCount: finalTVShows.length,
      hasTVShows: finalTVShows.length > 0,
      firstTVShowKeys: finalTVShows[0] ? Object.keys(finalTVShows[0]) : [],
      sampleTVShow: finalTVShows[0] ? {
        id: finalTVShows[0].id,
        name: finalTVShows[0].name,
        hasDetails: !!finalTVShows[0].details,
        hasOmdbData: !!finalTVShows[0].omdbData,
        hasStremioLink: !!finalTVShows[0].stremioLink
      } : null
    });
    
    // Store paginated TV shows in Redis (6 groups of 40 = 240 total)
    console.log(`[POPULATE] Storing paginated TV shows in Redis (6 groups of 40 = 240 total)...`);
    
    // Create paginated keys: tvshows1, tvshows2, tvshows3, tvshows4, tvshows5, tvshows6
    // Each group has exactly 40 items
    const tvshows1 = finalTVShows.slice(0, 40);
    const tvshows2 = finalTVShows.slice(40, 80);
    const tvshows3 = finalTVShows.slice(80, 120);
    const tvshows4 = finalTVShows.slice(120, 160);
    const tvshows5 = finalTVShows.slice(160, 200);
    const tvshows6 = finalTVShows.slice(200, 240);
    
    console.log(`[POPULATE] Paginated TV shows: tvshows1(${tvshows1.length}), tvshows2(${tvshows2.length}), tvshows3(${tvshows3.length}), tvshows4(${tvshows4.length}), tvshows5(${tvshows5.length}), tvshows6(${tvshows6.length})`);
    
    // Store in both Redis databases
    try {
      // Store in primary Redis
      await client.set('tvshows1', JSON.stringify(tvshows1));
      await client.set('tvshows2', JSON.stringify(tvshows2));
      await client.set('tvshows3', JSON.stringify(tvshows3));
      await client.set('tvshows4', JSON.stringify(tvshows4));
      await client.set('tvshows5', JSON.stringify(tvshows5));
      await client.set('tvshows6', JSON.stringify(tvshows6));
      console.log(`[POPULATE] ✅ Stored paginated TV shows in primary Redis`);
      
      // Store in backup Redis
      const backupClient = createRedisClient2();
      await backupClient.connect();
      await backupClient.set('tvshows1', JSON.stringify(tvshows1));
      await backupClient.set('tvshows2', JSON.stringify(tvshows2));
      await backupClient.set('tvshows3', JSON.stringify(tvshows3));
      await backupClient.set('tvshows4', JSON.stringify(tvshows4));
      await backupClient.set('tvshows5', JSON.stringify(tvshows5));
      await backupClient.set('tvshows6', JSON.stringify(tvshows6));
      await backupClient.disconnect();
      console.log(`[POPULATE] ✅ Stored paginated TV shows in backup Redis`);
      
    } catch (error) {
      console.error(`[POPULATE] Error storing paginated TV shows:`, error);
      await sendErrorNotification('tvshows', error, 'Storing paginated TV shows');
    }
    
    return finalTVShows;
  } catch (error) {
    console.error(`[POPULATE] Critical error in TV shows population:`, error);
    console.error(`[POPULATE] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Send error notification email
    await sendErrorNotification('tvshows', error, 'TV shows population process');
    
    throw error;
  } finally {
    console.log(`[POPULATE] Disconnecting from Redis...`);
    await client.disconnect();
    console.log(`[POPULATE] Redis disconnected`);
  }
}

// Populate books
async function populateBooks(googleBooksApiKey: string, nyTimesApiKey: string) {
  console.log('[POPULATE] Starting books population...');
  console.log('[POPULATE] Configuration:', {
    hasGoogleBooksKey: !!googleBooksApiKey,
    googleBooksKeyLength: googleBooksApiKey?.length || 0,
    hasNyTimesKey: !!nyTimesApiKey,
    nyTimesKeyLength: nyTimesApiKey?.length || 0
  });
  
  const client = createRedisClient()
  console.log('[POPULATE] Redis client created, connecting...');
  await client.connect()
  console.log('[POPULATE] Redis connected successfully');
  
  try {
    // Clear existing books data first
    await clearRedisData(client, 'books');
    
    console.log('[POPULATE] Fetching NY Times full overview...');
    
    // Use the full overview endpoint like in old clicknotes
    const nyTimesUrl = `https://api.nytimes.com/svc/books/v3/lists/full-overview.json?api-key=${nyTimesApiKey}`;
    console.log(`[POPULATE] NY Times URL: ${nyTimesUrl.replace(nyTimesApiKey, '***')}`);
    
    const nyTimesData = await fetchJSON(nyTimesUrl)
    
    if (!nyTimesData || !nyTimesData.results || !nyTimesData.results.lists) {
      throw new Error('Invalid NY Times API response structure');
    }
    
    console.log('[POPULATE] NY Times full overview received');
    console.log('[POPULATE] Available lists:', nyTimesData.results.lists.length);
    
    // Use the same list names as in old clicknotes
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
    let allIsbns: string[] = [];
    const seenIsbns = new Set<string>();
    
    listNames.forEach(listName => {
      const list = nyTimesData.results.lists.find((list: any) => list.list_name_encoded === listName);
      if (list && list.books) {
        console.log(`[POPULATE] ${listName}: Found ${list.books.length} books`);
        list.books.forEach((book: any) => {
          if (book.primary_isbn13 && !seenIsbns.has(book.primary_isbn13)) {
            seenIsbns.add(book.primary_isbn13);
            allIsbns.push(book.primary_isbn13);
          }
        });
      }
    });
    
    console.log(`[POPULATE] Total unique ISBNs collected: ${allIsbns.length}`);
    
    // Fetch Google Books details for each ISBN
    const booksWithDetails = [];
    let currentKeyIndex = 0;
    
    for (let i = 0; i < allIsbns.length; i++) {
      const isbn = allIsbns[i];
      console.log(`[POPULATE] Processing ISBN ${i + 1}/${allIsbns.length}: ${isbn}`);
      
      try {
        // Implement API key rotation for Google Books API
        const googleBooksApiKeys = [
          process.env.GOOGLE_BOOKS_API_KEY_1!,
          process.env.GOOGLE_BOOKS_API_KEY_2!
        ];
        
        let googleData = null;
        let usedKeyIndex = 0;
        
        // Try each API key until one works
        for (let keyIndex = 0; keyIndex < googleBooksApiKeys.length; keyIndex++) {
          try {
            const currentKey = googleBooksApiKeys[keyIndex];
            const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${currentKey}`;
            
            console.log(`[POPULATE] Trying Google Books API key ${keyIndex + 1} for ISBN ${isbn}`);
            googleData = await fetchJSON(googleBooksUrl);
            
            if (googleData && googleData.items && googleData.items.length > 0) {
              usedKeyIndex = keyIndex;
              console.log(`[POPULATE] ✅ Google Books API key ${keyIndex + 1} successful for ISBN ${isbn}`);
              break;
            }
          } catch (error) {
            console.log(`[POPULATE] ⚠️ Google Books API key ${keyIndex + 1} failed for ISBN ${isbn}:`, error);
            if (keyIndex === googleBooksApiKeys.length - 1) {
              throw error; // All keys failed
            }
          }
        }
        
        if (googleData && googleData.items && googleData.items.length > 0) {
          const googleBook = googleData.items[0];
          const bookTitle = googleBook.volumeInfo?.title;
          
          // Filter out books with no title
          if (!bookTitle || bookTitle.trim().length === 0) {
            console.log(`[POPULATE] ❌ Book filtered out (no title): ISBN ${isbn}`);
            continue;
          }
          
          console.log(`[POPULATE] Found Google Books data for ISBN ${isbn}: ${bookTitle}`);
          
          // Create a book object with the structure expected by the UI
          const bookWithDetails = {
            id: isbn,
            type: 'book',
            volumeInfo: googleBook.volumeInfo || {
              title: 'Unknown Title',
              authors: [],
              description: '',
              publishedDate: '',
              pageCount: undefined,
              averageRating: undefined,
              imageLinks: { thumbnail: null, smallThumbnail: null },
              previewLink: '',
              infoLink: '',
              publisher: '',
              categories: []
            }
          };
          
          booksWithDetails.push(bookWithDetails);
          console.log(`[POPULATE] Book "${bookTitle}" processed. Total: ${booksWithDetails.length}`);
        } else {
          console.log(`[POPULATE] No Google Books data found for ISBN ${isbn}`);
        }
        
        // Add delay between requests to avoid rate limiting
        if (i < allIsbns.length - 1) {
          console.log(`[POPULATE] Waiting 2 seconds before next ISBN...`);
          await delay(2000);
        }
        
      } catch (error) {
        console.error(`[POPULATE] Error processing ISBN ${isbn}:`, error);
        // Continue with next ISBN even if one fails
      }
    }
    
    console.log(`[POPULATE] Total books processed: ${booksWithDetails.length}`);
    
    // Ensure we have exactly 160 books (divisible by 40)
    const targetBookCount = Math.floor(booksWithDetails.length / 40) * 40;
    const finalBooks = booksWithDetails.slice(0, targetBookCount);
    
    console.log(`[POPULATE] Final book count adjusted to be divisible by 40: ${finalBooks.length} books`);
    console.log(`[POPULATE] Books collection structure:`, {
      totalCount: finalBooks.length,
      hasBooks: finalBooks.length > 0,
      firstBookKeys: finalBooks[0] ? Object.keys(finalBooks[0]) : [],
      sampleBook: finalBooks[0] ? {
        id: finalBooks[0].id,
        type: finalBooks[0].type,
        hasVolumeInfo: !!finalBooks[0].volumeInfo,
        title: finalBooks[0].volumeInfo?.title || 'Unknown',
        hasImage: !!finalBooks[0].volumeInfo?.imageLinks?.thumbnail
      } : null
    });
    
    // Store paginated books in Redis (4 groups of 40 = 160 total)
    console.log(`[POPULATE] Storing paginated books in Redis (4 groups of 40 = 160 total)...`);
    
    // Create paginated keys: books1, books2, books3, books4
    // Each group has exactly 40 items
    const books1 = finalBooks.slice(0, 40);
    const books2 = finalBooks.slice(40, 80);
    const books3 = finalBooks.slice(80, 120);
    const books4 = finalBooks.slice(120, 160);
    
    console.log(`[POPULATE] Created 4 book groups: books1(${books1.length}), books2(${books2.length}), books3(${books3.length}), books4(${books4.length})`);
    
    // Store in both Redis databases
    try {
      // Store in primary Redis
      await client.set('books1', JSON.stringify(books1));
      await client.set('books2', JSON.stringify(books2));
      await client.set('books3', JSON.stringify(books3));
      await client.set('books4', JSON.stringify(books4));
      console.log(`[POPULATE] ✅ Stored 4 paginated book groups in primary Redis`);
      
      // Store in backup Redis
      const backupClient = createRedisClient2();
      await backupClient.connect();
      await backupClient.set('books1', JSON.stringify(books1));
      await backupClient.set('books2', JSON.stringify(books2));
      await backupClient.set('books3', JSON.stringify(books3));
      await backupClient.set('books4', JSON.stringify(books4));
      await backupClient.disconnect();
      console.log(`[POPULATE] ✅ Stored 4 paginated book groups in backup Redis`);
      
    } catch (error) {
      console.error(`[POPULATE] Error storing paginated books:`, error);
      await sendErrorNotification('books', error, 'Storing paginated books');
    }
    
    // Verify storage of first group
    const storedBooks = await client.get('books1');
    console.log(`[POPULATE] Redis verification (books1):`, {
      hasStoredData: !!storedBooks,
      dataLength: storedBooks ? JSON.parse(storedBooks).length : 0
    });
    
    return finalBooks;
  } catch (error) {
    console.error(`[POPULATE] Critical error in books population:`, error);
    console.error(`[POPULATE] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Send error notification email
    await sendErrorNotification('books', error, 'Books population process');
    
    throw error;
  } finally {
    console.log(`[POPULATE] Disconnecting from Redis...`);
    await client.disconnect();
    console.log(`[POPULATE] Redis disconnected`);
  }
}

// Helper function to send error notification emails
async function sendErrorNotification(mediaType: string, error: any, operation: string) {
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

export async function GET(request: NextRequest) {
  try {
    const client = createRedisClient()
    await client.connect()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    console.log('Redis GET request received:', request.url);
    console.log('Requested type:', type);

    // Add a special case to list all keys for debugging
    if (type === 'debug') {
      const keys = await client.keys('*');
      console.log('All Redis keys:', keys);
      await client.disconnect();
      return NextResponse.json({ keys, message: 'Debug info' });
    }

    if (type === 'movies1' || type === 'movies2' || type === 'movies3') {
      const data = await client.get(type)
      console.log(`${type} from Redis:`, {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else if (type === 'tvshows1' || type === 'tvshows2' || type === 'tvshows3') {
      const data = await client.get(type)
      console.log(`${type} from Redis:`, {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else if (type && type.startsWith('books')) {
      const data = await client.get(type)
      console.log(`${type} from Redis:`, {
        hasData: !!data,
        dataType: typeof data,
        length: data ? JSON.parse(data).length : 0
      });
      await client.disconnect()
      return NextResponse.json(data ? JSON.parse(data) : null)
    } else {
      // Return all data
      console.log('Fetching all data from Redis...');
      const [movies, tvShows, books] = await Promise.all([
        client.get('movies'),
        client.get('tvshows'),
        client.get('books')
      ])
      
      console.log('All Redis data:', {
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
    console.error('Redis GET error:', error)
    return NextResponse.json(null, { status: 404 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[POST] POST request received');
    console.log('[POST] Request URL:', request.url);
    console.log('[POST] Request headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    console.log('[POST] Request body received:', {
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : [],
      action: body?.action
    });
    
    const { action } = body;
    console.log(`[POST] Processing action: ${action}`);
    
    if (action === 'populate-all') {
      console.log('[POST] Starting complete data population...');
      
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
      const nyTimesApiKey = process.env.NYTIMES_API_KEY!
      const omdbApiKeys = [
        process.env.OMDB_API_KEY_1!,
        process.env.OMDB_API_KEY_2!,
        process.env.OMDB_API_KEY_3!,
      ]

      console.log('[POST] API Keys available:', {
        tmdb: !!tmdbApiKey,
        tmdbKeyLength: tmdbApiKey?.length || 0,
        googleBooks: !!googleBooksApiKey,
        googleBooksKeyLength: googleBooksApiKey?.length || 0,
        nyTimes: !!nyTimesApiKey,
        nyTimesKeyLength: nyTimesApiKey?.length || 0,
        omdb: omdbApiKeys.filter(k => !!k).length,
        omdbKeys: omdbApiKeys.map((k, i) => ({ index: i, hasKey: !!k, keyLength: k?.length || 0 }))
      });

      // Populate movies and books in parallel (different APIs, no rate limiting conflict)
      console.log('[POST] Starting parallel population of movies and books...');
      const startTime = Date.now();
      
      const [movies, books] = await Promise.all([
        populateMovies(tmdbApiKey, omdbApiKeys),
        populateBooks(googleBooksApiKey, nyTimesApiKey)
      ]);
      
      console.log('[POST] Movies and books population completed!');
      console.log('[POST] Movies count:', movies.length);
      console.log('[POST] Books count:', books.length);
      
      // Now populate TV shows (after movies finish to avoid TMDB rate limiting)
      console.log('[POST] Starting TV shows population (after movies to avoid TMDB rate limiting)...');
      const tvShowsStartTime = Date.now();
      
      const tvShows = await populateTVShows(tmdbApiKey, omdbApiKeys);
      
      const tvShowsEndTime = Date.now();
      const tvShowsDuration = tvShowsEndTime - tvShowsStartTime;
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      console.log('[POST] Complete data population finished!');
      console.log('[POST] Total population duration:', `${totalDuration}ms (${Math.round(totalDuration / 1000)}s)`);
      console.log('[POST] TV shows population duration:', `${tvShowsDuration}ms (${Math.round(tvShowsDuration / 1000)}s)`);
      console.log('[POST] Final counts:', {
        movies: movies.length,
        tvShows: tvShows.length,
        books: books.length
      });
      
      const response = { 
        message: 'Complete data populated successfully',
        movies: movies.length,
        tvshows: tvShows.length,
        books: books.length,
        totalDuration: `${totalDuration}ms`,
        tvShowsDuration: `${tvShowsDuration}ms`
      };
      
      console.log('[POST] Sending response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-movies') {
      console.log('[POST] Starting movies-only population...');
      
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const omdbApiKeys = [
        process.env.OMDB_API_KEY_1!,
        process.env.OMDB_API_KEY_2!,
        process.env.OMDB_API_KEY_3!,
      ]
      
      console.log('[POST] Movies population configuration:', {
        hasTmdbKey: !!tmdbApiKey,
        tmdbKeyLength: tmdbApiKey?.length || 0,
        omdbKeysCount: omdbApiKeys.length,
        omdbKeysAvailable: omdbApiKeys.filter(k => !!k).length
      });
      
      const startTime = Date.now();
      const movies = await populateMovies(tmdbApiKey, omdbApiKeys);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('[POST] Movies population completed in:', `${duration}ms`);
      
      const response = { 
        message: 'Movies populated successfully',
        movies: movies.length,
        duration: `${duration}ms`
      };
      
      console.log('[POST] Sending movies response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-tvshows') {
      console.log('[POST] Starting TV shows-only population...');
      
      const tmdbApiKey = process.env.TMDB_API_KEY!
      const omdbApiKeys = [
        process.env.OMDB_API_KEY_1!,
        process.env.OMDB_API_KEY_2!,
        process.env.OMDB_API_KEY_3!,
      ]
      
      console.log('[POST] TV Shows population configuration:', {
        hasTmdbKey: !!tmdbApiKey,
        tmdbKeyLength: tmdbApiKey?.length || 0,
        omdbKeysCount: omdbApiKeys.length,
        omdbKeysAvailable: omdbApiKeys.filter(k => !!k).length
      });
      
      const startTime = Date.now();
      const tvShows = await populateTVShows(tmdbApiKey, omdbApiKeys);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('[POST] TV Shows population completed in:', `${duration}ms`);
      
      const response = { 
        message: 'TV shows populated successfully',
        tvshows: tvShows.length,
        duration: `${duration}ms`
      };
      
      console.log('[POST] Sending TV shows response:', response);
      return NextResponse.json(response);
      
    } else if (action === 'populate-books') {
      console.log('[POST] Starting books-only population...');
      
      const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2!
      const nyTimesApiKey = process.env.NYTIMES_API_KEY!
      
      console.log('[POST] Books population configuration:', {
        hasGoogleBooksKey: !!googleBooksApiKey,
        googleBooksKeyLength: googleBooksApiKey?.length || 0,
        hasNyTimesKey: !!nyTimesApiKey,
        nyTimesKeyLength: nyTimesApiKey?.length || 0
      });
      
      const startTime = Date.now();
      const books = await populateBooks(googleBooksApiKey, nyTimesApiKey);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('[POST] Books population completed in:', `${duration}ms`);
      
      const response = { 
        message: 'Books populated successfully',
        books: books.length,
        duration: `${duration}ms`
      };
      
      console.log('[POST] Sending books response:', response);
      return NextResponse.json(response);
    }

    console.log('[POST] Invalid action received:', action);
    console.log('[POST] Valid actions are: populate-all, populate-movies, populate-tvshows, populate-books');
    
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[POST] Redis POST error:', error);
    console.error('[POST] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      requestUrl: request.url
    });
    
    // Send error notification email for general population failure
    await sendErrorNotification('general', error, 'General population process');
    
    return NextResponse.json({ 
      error: 'Failed to populate data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
