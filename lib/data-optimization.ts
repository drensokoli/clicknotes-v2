// Data optimization utilities for reducing Redis payload size

export interface OptimizedMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  type: "movie";
  details?: {
    runtime: number;
    genres: Array<{ id: number; name: string }>;
    credits: {
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }>; // Limited to first 10
      crew: Array<{
        id: number;
        name: string;
        job: string;
        profile_path: string | null;
      }>; // Only director
    };
    videos: {
      results: Array<{
        key: string;
        name: string;
        site: string;
        type: string;
        official: boolean;
      }>; // Only trailer
    };
  };
  omdbData?: {
    imdbId: string;
    rated: string;
    runtime: string;
    awards: string;
  };
  stremioLink?: string;
}

export interface OptimizedTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  type: "tvshow";
  details?: {
    genres: Array<{ id: number; name: string }>;
    number_of_seasons: number;
    number_of_episodes: number;
    status: string;
    tagline: string;
    type: string;
    credits: {
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }>; // Limited to first 10
      crew: Array<{
        id: number;
        name: string;
        job: string;
        profile_path: string | null;
      }>; // Only director
    };
    videos: {
      results: Array<{
        key: string;
        name: string;
        site: string;
        type: string;
        official: boolean;
      }>; // Only trailer
    };
  };
  omdbData?: {
    imdbId: string;
    rated: string;
    runtime: string;
    awards: string;
  };
  stremioLink?: string;
}

export interface OptimizedBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    averageRating?: number;
    imageLinks?: {
      thumbnail?: string | null;
    };
    previewLink?: string;
    infoLink?: string;
    language?: string;
    publisher?: string;
    categories?: string[];
  };
  type: "book";
}

// Minimal raw shapes for inputs used by optimizers
interface RawCreditPerson {
  id: number;
  name: string;
  job?: string;
  character?: string;
  profile_path: string | null;
}

interface RawVideoItem {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

interface RawMovieDetails {
  runtime: number;
  genres?: Array<{ id: number; name: string }>;
  credits?: {
    cast?: RawCreditPerson[];
    crew?: RawCreditPerson[];
  };
  videos?: {
    results?: RawVideoItem[];
  };
}

interface RawMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  details?: RawMovieDetails;
  omdbData?: OptimizedMovie["omdbData"] | null;
  stremioLink?: string | null;
}

interface RawTVDetails {
  genres?: Array<{ id: number; name: string }>;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  tagline: string;
  type: string;
  credits?: {
    cast?: RawCreditPerson[];
    crew?: RawCreditPerson[];
  };
  videos?: {
    results?: RawVideoItem[];
  };
}

interface RawTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count?: number;
  details?: RawTVDetails;
  omdbData?: OptimizedTVShow["omdbData"] | null;
  stremioLink?: string | null;
}

interface RawBookVolumeInfo {
  title: string;
  authors?: string[];
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  averageRating?: number;
  imageLinks?: {
    thumbnail?: string | null;
  };
  previewLink?: string;
  infoLink?: string;
  language?: string;
  publisher?: string;
  categories?: string[];
}

interface RawBook {
  id: string;
  volumeInfo?: RawBookVolumeInfo;
}

/**
 * Optimize movie data by removing redundant and unnecessary fields
 */
export function optimizeMovieData(movie: RawMovie): OptimizedMovie {
  const optimized: OptimizedMovie = {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count ?? 0,
    type: "movie"
  };

  // Optimize details if present - remove duplicates and keep only unique fields
  if (movie.details) {
    optimized.details = {
      runtime: movie.details.runtime,
      genres: movie.details.genres || [],
      credits: {
        cast: [],
        crew: []
      },
      videos: {
        results: []
      }
    };

    // Keep only first 10 cast members with minimal data
    if (movie.details.credits?.cast) {
      optimized.details.credits.cast = movie.details.credits.cast
        .slice(0, 10)
        .map((actor: RawCreditPerson) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character ?? "",
          profile_path: actor.profile_path
        }));
    }

    // Keep only the main director from crew
    if (movie.details.credits?.crew) {
      const director = movie.details.credits.crew.find((member: RawCreditPerson) => member.job === "Director");
      if (director) {
        optimized.details.credits.crew = [{
          id: director.id,
          name: director.name,
          job: director.job ?? "Director",
          profile_path: director.profile_path
        }];
      }
    }

    // Keep only the trailer from videos
    if (movie.details.videos?.results) {
      const trailer = movie.details.videos.results.find((video: RawVideoItem) => 
        video.type === "Trailer" && video.site === "YouTube"
      );
      if (trailer) {
        optimized.details.videos.results = [{
          key: trailer.key,
          name: trailer.name,
          site: trailer.site,
          type: trailer.type,
          official: trailer.official
        }];
      }
    }
  }

  // Keep OMDB data as is (already minimal)
  if (movie.omdbData) {
    optimized.omdbData = movie.omdbData;
  }

  // Keep Stremio link
  if (movie.stremioLink) {
    optimized.stremioLink = movie.stremioLink;
  }

  return optimized;
}

/**
 * Optimize TV show data by removing redundant and unnecessary fields
 */
export function optimizeTVShowData(tvShow: RawTVShow): OptimizedTVShow {
  const optimized: OptimizedTVShow = {
    id: tvShow.id,
    name: tvShow.name,
    overview: tvShow.overview,
    poster_path: tvShow.poster_path,
    backdrop_path: tvShow.backdrop_path,
    first_air_date: tvShow.first_air_date,
    vote_average: tvShow.vote_average,
    vote_count: tvShow.vote_count ?? 0,
    type: "tvshow"
  };

  // Optimize details if present - remove duplicates and keep only unique fields
  if (tvShow.details) {
    optimized.details = {
      genres: tvShow.details.genres || [],
      number_of_seasons: tvShow.details.number_of_seasons,
      number_of_episodes: tvShow.details.number_of_episodes,
      status: tvShow.details.status,
      tagline: tvShow.details.tagline,
      type: tvShow.details.type,
      credits: {
        cast: [],
        crew: []
      },
      videos: {
        results: []
      }
    };

    // Keep only first 10 cast members with minimal data
    if (tvShow.details.credits?.cast) {
      optimized.details.credits.cast = tvShow.details.credits.cast
        .slice(0, 10)
        .map((actor: RawCreditPerson) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character ?? "",
          profile_path: actor.profile_path
        }));
    }

    // Keep only the main director from crew
    if (tvShow.details.credits?.crew) {
      const director = tvShow.details.credits.crew.find((member: RawCreditPerson) => member.job === "Director");
      if (director) {
        optimized.details.credits.crew = [{
          id: director.id,
          name: director.name,
          job: director.job ?? "Director",
          profile_path: director.profile_path
        }];
      }
    }

    // Keep only the trailer from videos
    if (tvShow.details.videos?.results) {
      const trailer = tvShow.details.videos.results.find((video: RawVideoItem) => 
        video.type === "Trailer" && video.site === "YouTube"
      );
      if (trailer) {
        optimized.details.videos.results = [{
          key: trailer.key,
          name: trailer.name,
          site: trailer.site,
          type: trailer.type,
          official: trailer.official
        }];
      }
    }
  }

  // Keep OMDB data as is (already minimal)
  if (tvShow.omdbData) {
    optimized.omdbData = tvShow.omdbData;
  }

  // Keep Stremio link
  if (tvShow.stremioLink) {
    optimized.stremioLink = tvShow.stremioLink;
  }

  return optimized;
}

/**
 * Optimize book data by removing unnecessary fields
 */
export function optimizeBookData(book: RawBook): OptimizedBook {
  const optimized: OptimizedBook = {
    id: book.id,
    type: "book",
    volumeInfo: {
      title: book.volumeInfo?.title ?? "",
      authors: book.volumeInfo?.authors,
      description: book.volumeInfo?.description,
      publishedDate: book.volumeInfo?.publishedDate,
      pageCount: book.volumeInfo?.pageCount,
      averageRating: book.volumeInfo?.averageRating,
      previewLink: book.volumeInfo?.previewLink,
      infoLink: book.volumeInfo?.infoLink,
      language: book.volumeInfo?.language,
      publisher: book.volumeInfo?.publisher,
      categories: book.volumeInfo?.categories
    }
  };

  // Keep only thumbnail from imageLinks
  if (book.volumeInfo?.imageLinks?.thumbnail) {
    optimized.volumeInfo.imageLinks = {
      thumbnail: book.volumeInfo.imageLinks.thumbnail
    };
  }

  return optimized;
}

/**
 * Calculate the size reduction percentage
 */
export function calculateSizeReduction(original: unknown, optimized: unknown): number {
  const originalSize = JSON.stringify(original).length;
  const optimizedSize = JSON.stringify(optimized).length;
  const reduction = ((originalSize - optimizedSize) / originalSize) * 100;
  return Math.round(reduction * 100) / 100;
}

/**
 * Log optimization results
 */
export function logOptimization(type: string, original: unknown, optimized: unknown) {
  const reduction = calculateSizeReduction(original, optimized);
  const originalSize = JSON.stringify(original).length;
  const optimizedSize = JSON.stringify(optimized).length;
  
  console.log(`[OPTIMIZE] ${type} optimization:`, {
    originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
    optimizedSize: `${(optimizedSize / 1024).toFixed(2)}KB`,
    reduction: `${reduction}%`,
    savedBytes: originalSize - optimizedSize
  });
}
