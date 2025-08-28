// Alternative fetch-based API helpers for better SSL handling
import { fetchJSON } from './secure-fetch';
import type { Movie, TVShow, Book } from '@/components/media-card';

// Interfaces for API responses
interface NYTimesBook {
  primary_isbn13: string;
  title: string;
  author: string;
  description: string;
  rank: number;
  weeks_on_list: number;
}

interface GoogleBooksVolumeInfo {
  title: string;
  authors?: string[];
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  averageRating?: number;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
  previewLink?: string;
  infoLink?: string;
  language?: string;
  publisher?: string;
  categories?: string[];
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
}

// Movie API helpers using secure fetch with parallel requests - fetch up to 240 items
export const fetchPopularMoviesWithFetch = async (tmdbApiKey: string): Promise<Movie[]> => {
  const seenIds = new Set();
  const allMovies: Movie[] = [];
  
  // Calculate how many pages we need to get 240 movies
  // TMDB returns 20 movies per page, so we need 12 pages minimum
  const pagesNeeded = Math.max(12, Math.ceil(240 / 20));
  console.log(`🎬 Fetching movies: targeting 240 items, will fetch ${pagesNeeded} pages`);
  
  // Create parallel requests for better performance
  const pagePromises = Array.from({ length: pagesNeeded }, (_, i) => {
    const page = i + 1;
    return fetchJSON(
      `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}&include_adult=false`
    ).catch((error) => {
      console.error(`Error fetching movies page ${page}:`, error);
      return null;
    });
  });

  try {
    const results = await Promise.all(pagePromises);
    
    // Process results and collect movies until we have 240
    for (const data of results) {
      if (!data || !data.results) continue;
      
      for (const movie of data.results) {
        if (seenIds.has(movie.id)) continue;
        
        seenIds.add(movie.id);
        allMovies.push(movie);
        
        // Stop when we reach 240 movies
        if (allMovies.length >= 240) break;
      }
      
      // Stop processing pages if we have enough movies
      if (allMovies.length >= 240) break;
    }

    console.log(`🎬 Final movies count: ${allMovies.length} (targeted 240)`);
    return allMovies;
  } catch (error) {
    console.error('Error in parallel movie fetching:', error);
    return [];
  }
};

// TV Shows API helpers using secure fetch with parallel requests - fetch up to 240 items
export const fetchPopularTVShowsWithFetch = async (tmdbApiKey: string): Promise<TVShow[]> => {
  const seenIds = new Set();
  const allTVShows: TVShow[] = [];
  
  // Calculate how many pages we need to get 240 TV shows
  // TMDB returns 20 TV shows per page, so we need 12 pages minimum
  const pagesNeeded = Math.max(12, Math.ceil(240 / 20));
  console.log(`📺 Fetching TV shows: targeting 240 items, will fetch ${pagesNeeded} pages`);
  
  // Create parallel requests for better performance
  const pagePromises = Array.from({ length: pagesNeeded }, (_, i) => {
    const page = i + 1;
    return fetchJSON(
      `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`
    ).catch((error) => {
      console.error(`Error fetching TV shows page ${page}:`, error);
      return null;
    });
  });

  try {
    const results = await Promise.all(pagePromises);
    
    // Process results and collect TV shows until we have 240
    for (const data of results) {
      if (!data || !data.results) continue;
      
      for (const show of data.results) {
        if (seenIds.has(show.id)) continue;
        
        seenIds.add(show.id);
        allTVShows.push(show);
        
        // Stop when we reach 240 TV shows
        if (allTVShows.length >= 240) break;
      }
      
      // Stop processing pages if we have enough TV shows
      if (allTVShows.length >= 240) break;
    }

    console.log(`📺 Final TV shows count: ${allTVShows.length} (targeted 240)`);
    return allTVShows;
  } catch (error) {
    console.error('Error in parallel TV show fetching:', error);
    return [];
  }
};

// Books API helpers using secure fetch with better error handling and data validation
export const fetchBestsellersWithFetch = async (googleBooksApiKey: string, nyTimesApiKey: string, baseUrl: string): Promise<Book[]> => {
  console.log('📚 fetchBestsellersWithFetch called with baseUrl:', baseUrl);
  
  try {
    // Fetch from NY Times API
    const nyTimesData = await fetchJSON(
      `https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${nyTimesApiKey}`
    );
    
    if (!nyTimesData || !nyTimesData.results || !nyTimesData.results.books) {
      console.error('Invalid NY Times API response');
      return [];
    }
    
    const isbns = nyTimesData.results.books
      .map((book: NYTimesBook) => book.primary_isbn13)
      .filter((isbn: string) => isbn && isbn.length > 0); // Filter out empty ISBNs
    
    console.log('📚 Found valid ISBNs:', isbns.length);
    
    // Fetch book details from Google Books API with better error handling
    const bookDetailsPromises = isbns.map(async (isbn: string, index: number) => {
      try {
        // Add delay to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const bookData = await fetchJSON(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`
        );
        
        if (!bookData || !bookData.items || !Array.isArray(bookData.items)) {
          console.warn(`No valid items for ISBN ${isbn}`);
          return null;
        }
        
        // Return the first (and usually best) result
        return bookData.items[0];
      } catch (error) {
        console.error(`Error fetching book details for ISBN ${isbn}:`, error);
        return null;
      }
    });
    
    const bookDetailsResponses = await Promise.all(bookDetailsPromises);
    
    // Filter and validate book data
    const validBooks = bookDetailsResponses
      .filter((book): book is GoogleBooksItem => book !== null)
      .filter((book: GoogleBooksItem) => {
        // Ensure book has required fields
        const hasRequiredFields = book.volumeInfo && 
          book.volumeInfo.title && 
          book.volumeInfo.title.trim().length > 0;
        
        if (!hasRequiredFields) {
          console.warn('Filtering out book with missing title:', book);
        }
        
        return hasRequiredFields;
      })
      .map((book: GoogleBooksItem) => ({
        ...book,
        // Ensure type is set
        type: 'book' as const,
        // Add fallback values for missing fields
        volumeInfo: {
          ...book.volumeInfo,
          title: book.volumeInfo.title || 'Untitled Book',
          authors: book.volumeInfo.authors || ['Unknown Author'],
          description: book.volumeInfo.description || 'No description available.',
          publishedDate: book.volumeInfo.publishedDate || 'Unknown Date',
          pageCount: book.volumeInfo.pageCount || 0,
          averageRating: book.volumeInfo.averageRating || 0,
                  imageLinks: {
          thumbnail: book.volumeInfo.imageLinks?.thumbnail || undefined,
          smallThumbnail: book.volumeInfo.imageLinks?.smallThumbnail || undefined,
        },
          previewLink: book.volumeInfo.previewLink || '',
          infoLink: book.volumeInfo.infoLink || '',
          language: book.volumeInfo.language || 'en',
          publisher: book.volumeInfo.publisher || 'Unknown Publisher',
        }
      }));

    console.log('📚 Final valid books count:', validBooks.length);
    return validBooks;
  } catch (error) {
    console.error('Error fetching bestsellers:', error);
    return [];
  }
};
