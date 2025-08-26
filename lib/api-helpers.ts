import axios from 'axios';
import { isDevelopment, isServer } from './ssl-config';

// Configure axios to handle SSL certificates properly
const axiosInstance = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'ClickNotes-v2/1.0.0'
  }
});

// Configure SSL handling for development
if (isDevelopment() && isServer()) {
  try {
    // Create a custom HTTPS agent for development that handles SSL issues
    const https = require('https');
    const httpsAgent = new https.Agent({
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

// Movie API helpers
export const fetchPopularMovies = async (tmdbApiKey: string, totalPages: number = 20) => {
  let popularMoviesResults = [];

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

export const searchMoviesByTitle = async (title: string, tmdbApiKey: string) => {
  try {
    const response = await axiosInstance.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(title)}&include_adult=false`
    );
    return response.data.results;
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
};

// TV Shows API helpers
export const fetchPopularTVShows = async (tmdbApiKey: string, totalPages: number = 20) => {
  let popularTvShowsResults = [];

  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await axiosInstance.get(
        `https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`
      );
      popularTvShowsResults.push(...response.data.results);
    } catch (error) {
      console.error(`Error fetching TV shows page ${page}:`, error);
    }
  }

  return popularTvShowsResults;
};

export const searchTVShowsByTitle = async (title: string, tmdbApiKey: string) => {
  try {
    const response = await axiosInstance.get(
      `https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(title)}`
    );
    return response.data.results;
  } catch (error) {
    console.error('Error searching TV shows:', error);
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
  } catch (error) {
    console.log('Redis cache not available, fetching from APIs...');
  }

  // Fallback to fetching from NY Times and Google Books APIs
  try {
    const response = await axiosInstance.get(
      `https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${nyTimesApiKey}`
    );
    
    const isbns = response.data.results.books.map((book: any) => book.primary_isbn13);
    const bookDetailsPromises = isbns.map(async (isbn: string) => 
      axiosInstance.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`)
    );
    
    const bookDetailsResponses = await Promise.all(bookDetailsPromises);
    const bestsellers = bookDetailsResponses.flatMap((response: any) => {
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

export const searchBooksByTitle = async (title: string, googleBooksApiKey: string) => {
  try {
    const response = await axiosInstance.get(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=40&key=${googleBooksApiKey}`
    );
    return response.data.items || [];
  } catch (error) {
    console.error('Error searching books:', error);
    return [];
  }
};

// Content search helper (similar to v1's searchContentByTitle)
export const searchContentByTitle = async ({ 
  title, 
  tmdbApiKey, 
  type 
}: { 
  title: string; 
  tmdbApiKey: string; 
  type: 'movie' | 'tv' 
}) => {
  if (type === 'movie') {
    return searchMoviesByTitle(title, tmdbApiKey);
  } else {
    return searchTVShowsByTitle(title, tmdbApiKey);
  }
};
