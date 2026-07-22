import axios from 'axios';
import { isDevelopment, isServer } from './ssl-config';

// Interfaces for API responses
interface NYTimesBook {
  primary_isbn13: string;
  title: string;
  author: string;
  description: string;
  rank: number;
  weeks_on_list: number;
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: {
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
  };
}

// Configure axios to handle SSL certificates properly
const axiosInstance = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'ClickNotes/1.0.0'
  }
});

// Configure SSL handling for development
const configureSSL = async () => {
  if (isDevelopment() && isServer()) {
    try {
      // Create a custom HTTPS agent for development that handles SSL issues
      const https = await import('https');
      const httpsAgent = new https.default.Agent({
        rejectUnauthorized: false,
        // Add additional SSL options if needed
        requestCert: false
      });
      
      axiosInstance.defaults.httpsAgent = httpsAgent;
      console.warn('⚠️  SSL verification disabled for development. DO NOT use in production!');
    } catch (error) {
      console.warn('⚠️  Could not create HTTPS agent:', error);
      // Continue without custom HTTPS agent - axios will use default settings
    }
  }
};

// Initialize SSL configuration
configureSSL();

// Movie API helpers
export const fetchPopularMovies = async (tmdbApiKey: string, totalPages: number = 20) => {
  const popularMoviesResults = [];

  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await axiosInstance.get(
        `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}&include_adult=false`
      );
      popularMoviesResults.push(...response.data.results);
    } catch (error) {
      console.error(`Error fetching movies page ${page}:`, error);
    }
  }

  return popularMoviesResults;
};

export const searchMoviesByTitle = async (title: string) => {
  try {
    const response = await fetch(`/api/tmdb/search?type=movie&q=${encodeURIComponent(title)}`);
    const data = await response.json();
    return data.results ?? [];
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
};

// Series API helpers
export const fetchPopularSeries = async (tmdbApiKey: string, totalPages: number = 20) => {
  const popularSeriesResults = [];

  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await axiosInstance.get(
        `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`
      );
      popularSeriesResults.push(...response.data.results);
    } catch (error) {
      console.error(`Error fetching Series page ${page}:`, error);
    }
  }

  return popularSeriesResults;
};

export const searchSeriesByTitle = async (title: string) => {
  try {
    const response = await fetch(`/api/tmdb/search?type=tv&q=${encodeURIComponent(title)}`);
    const data = await response.json();
    return data.results ?? [];
  } catch (error) {
    console.error('Error searching Series:', error);
    return [];
  }
};

// Books API helpers
export const fetchBestsellers = async (googleBooksApiKey: string, nyTimesApiKey: string, baseUrl: string) => {
  try {
    // First try to get from Redis cache
    const bestsellersData = await fetch(`${baseUrl}/api/redisHandler`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await bestsellersData.json();
    
    if (bestsellersData.status === 200 && data) {
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
  } catch {
    console.log('Redis cache not available, fetching from APIs...');
  }

  // Fallback to fetching from NY Times and Google Books APIs
  try {
    const response = await axiosInstance.get(
      `https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${nyTimesApiKey}`
    );
    
    const isbns = response.data.results.books.map((book: NYTimesBook) => book.primary_isbn13);
    const bookDetailsPromises = isbns.map(async (isbn: string) => 
      axiosInstance.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`)
    );
    
    const bookDetailsResponses = await Promise.all(bookDetailsPromises);
    const bestsellers = bookDetailsResponses.flatMap((response: { data?: { items?: GoogleBooksItem[] } }) => {
      const items = response.data?.items;
      if (Array.isArray(items) && items.length > 0) {
        return items;
      } else {
        return [];
      }
    });

    return bestsellers;
  } catch (error) {
    console.error('Error fetching bestsellers:', error);
    return [];
  }
};

// Tries each key in turn - Google Books' per-key daily quota is low enough
// to actually run out, and a single exhausted key otherwise takes book search
// down entirely with no fallback (same rotation shape as lib/omdb-helpers.ts's
// getOmdbData and lib/media-lookup.ts's book detail lookups).
export const searchBooksByTitle = async (title: string, googleBooksApiKeys: string[]) => {
  const keys = googleBooksApiKeys.length > 0 ? googleBooksApiKeys : [undefined];

  for (const key of keys) {
    // One retry per key on top of the rotation itself - Google Books' /volumes
    // search endpoint (unlike its direct /volumes/{id} lookup, which has been
    // reliable in the same testing) returns 503 "backendFailed" often enough
    // to be worth one extra attempt before moving to the next key.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        const response = await axiosInstance.get(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=40${key ? `&key=${key}` : ""}`
        );
        return response.data.items || [];
      } catch (error) {
        console.error('Error searching books:', error);
      }
    }
  }

  return [];
};

// Content search helper (similar to v1's searchContentByTitle)
export const searchContentByTitle = async ({
  title,
  type
}: {
  title: string;
  type: 'movie' | 'tv'
}) => {
  if (type === 'movie') {
    return searchMoviesByTitle(title);
  } else {
    return searchSeriesByTitle(title);
  }
};

// People/filmography helpers backing the Home page's actor/director search
// (components/person-chip-row.tsx) - proxied through app/api/tmdb/* so the
// TMDB key never reaches the browser for these calls.
export interface PersonSearchResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  popularity: number;
}

export const searchPeople = async (query: string): Promise<PersonSearchResult[]> => {
  try {
    const response = await fetch(`/api/tmdb/person-search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.people ?? [];
  } catch (error) {
    console.error('Error searching people:', error);
    return [];
  }
};

export const fetchPersonCredits = async (personId: number, mediaType: 'movie' | 'tv') => {
  try {
    const response = await fetch(`/api/tmdb/person-credits?personId=${personId}&mediaType=${mediaType}`);
    const data = await response.json();
    return data.results ?? [];
  } catch (error) {
    console.error('Error fetching person credits:', error);
    return [];
  }
};

// Live "Popular by genre" for the Home page's genre pills (movies/series only)
// - see app/api/tmdb/discover/route.ts for the quality/adult filtering this
// proxies through.
export const discoverByGenre = async (
  type: 'movie' | 'tv',
  genreIds: number[],
  page: number = 1
): Promise<{ results: unknown[]; totalPages: number }> => {
  try {
    const response = await fetch(
      `/api/tmdb/discover?type=${type}&genres=${genreIds.join(',')}&page=${page}`
    );
    const data = await response.json();
    return { results: data.results ?? [], totalPages: data.totalPages ?? 1 };
  } catch (error) {
    console.error('Error discovering by genre:', error);
    return { results: [], totalPages: 1 };
  }
};
