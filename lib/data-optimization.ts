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

/**
 * Optimize movie data by removing redundant and unnecessary fields
 */
export function optimizeMovieData(movie: any): OptimizedMovie {
  const optimized: OptimizedMovie = {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
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
        .map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          profile_path: actor.profile_path
        }));
    }

    // Keep only the main director from crew
    if (movie.details.credits?.crew) {
      const director = movie.details.credits.crew.find((member: any) => member.job === "Director");
      if (director) {
        optimized.details.credits.crew = [{
          id: director.id,
          name: director.name,
          job: director.job,
          profile_path: director.profile_path
        }];
      }
    }

    // Keep only the trailer from videos
    if (movie.details.videos?.results) {
      const trailer = movie.details.videos.results.find((video: any) => 
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
export function optimizeTVShowData(tvShow: any): OptimizedTVShow {
  const optimized: OptimizedTVShow = {
    id: tvShow.id,
    name: tvShow.name,
    overview: tvShow.overview,
    poster_path: tvShow.poster_path,
    backdrop_path: tvShow.backdrop_path,
    first_air_date: tvShow.first_air_date,
    vote_average: tvShow.vote_average,
    vote_count: tvShow.vote_count,
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
        .map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          profile_path: actor.profile_path
        }));
    }

    // Keep only the main director from crew
    if (tvShow.details.credits?.crew) {
      const director = tvShow.details.credits.crew.find((member: any) => member.job === "Director");
      if (director) {
        optimized.details.credits.crew = [{
          id: director.id,
          name: director.name,
          job: director.job,
          profile_path: director.profile_path
        }];
      }
    }

    // Keep only the trailer from videos
    if (tvShow.details.videos?.results) {
      const trailer = tvShow.details.videos.results.find((video: any) => 
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
export function optimizeBookData(book: any): OptimizedBook {
  const optimized: OptimizedBook = {
    id: book.id,
    type: "book",
    volumeInfo: {
      title: book.volumeInfo?.title,
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
export function calculateSizeReduction(original: any, optimized: any): number {
  const originalSize = JSON.stringify(original).length;
  const optimizedSize = JSON.stringify(optimized).length;
  const reduction = ((originalSize - optimizedSize) / originalSize) * 100;
  return Math.round(reduction * 100) / 100;
}

/**
 * Log optimization results
 */
export function logOptimization(type: string, original: any, optimized: any) {
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
