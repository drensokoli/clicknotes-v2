import { secureFetch } from './secure-fetch'

// TMDB Genre mapping
const MOVIE_GENRES: { [key: number]: string } = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western'
}

const TV_GENRES: { [key: number]: string } = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western'
}

export interface MovieDetails {
  id: number
  title: string
  overview: string
  release_date: string
  runtime: number
  vote_average: number
  poster_path: string
  backdrop_path: string
  genres: Array<{ id: number; name: string }>
  credits: {
    cast: Array<{
      id: number
      name: string
      character: string
      profile_path: string | null
      order: number
    }>
    crew: Array<{
      id: number
      name: string
      job: string
      department: string
      profile_path: string | null
    }>
  }
  videos: {
    results: Array<{
      id: string
      key: string
      name: string
      site: string
      type: string
      official: boolean
    }>
  }
}

export interface TVDetails {
  id: number
  name: string
  overview: string
  first_air_date: string
  episode_run_time: number[]
  vote_average: number
  poster_path: string
  backdrop_path: string
  genres: Array<{ id: number; name: string }>
  number_of_seasons: number
  number_of_episodes: number
  created_by: Array<{
    id: number
    name: string
    profile_path: string | null
  }>
  credits: {
    cast: Array<{
      id: number
      name: string
      character: string
      profile_path: string | null
      order: number
    }>
    crew: Array<{
      id: number
      name: string
      job: string
      department: string
      profile_path: string | null
    }>
  }
  videos: {
    results: Array<{
      id: string
      key: string
      name: string
      site: string
      type: string
      official: boolean
    }>
  }
}

export const fetchMovieDetails = async (movieId: number, apiKey: string): Promise<MovieDetails | null> => {
  try {
    const response = await secureFetch(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&append_to_response=credits,videos`
    )
    
    if (!response.ok) {
      console.error('Failed to fetch movie details:', response.status)
      return null
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching movie details:', error)
    return null
  }
}

export const fetchTVDetails = async (tvId: number, apiKey: string): Promise<TVDetails | null> => {
  try {
    const response = await secureFetch(
      `https://api.themoviedb.org/3/tv/${tvId}?api_key=${apiKey}&append_to_response=credits,videos`
    )
    
    if (!response.ok) {
      console.error('Failed to fetch TV details:', response.status)
      return null
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching TV details:', error)
    return null
  }
}

export const getGenreNames = (genreIds: number[], type: 'movie' | 'tv'): string[] => {
  const genreMap = type === 'movie' ? MOVIE_GENRES : TV_GENRES
  return genreIds.map(id => genreMap[id]).filter(Boolean)
}

export const getYouTubeTrailer = (videos: { results: Array<{ key: string; name: string; site: string; type: string; official: boolean }> }) => {
  // Find official trailer first, then any trailer, then any video
  const trailer = videos.results.find(video => 
    video.site === 'YouTube' && 
    video.type === 'Trailer' && 
    video.official
  ) || videos.results.find(video => 
    video.site === 'YouTube' && 
    video.type === 'Trailer'
  ) || videos.results.find(video => 
    video.site === 'YouTube'
  )
  
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null
}
