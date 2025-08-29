"use client"

import { X, Star, Calendar, ExternalLink, Play, Eye, Bookmark, User, MonitorPlay, BookOpen } from "lucide-react"
import { getOmdbData } from "@/lib/omdb-helpers"
import Image from "next/image"
import { useModal } from "./modal-provider"
import { useEffect, useState } from "react"
import { fetchMovieDetails, fetchTVDetails, getGenreNames, getYouTubeTrailer, type MovieDetails, type TVDetails } from "@/lib/tmdb-details"
import { motion, AnimatePresence } from "framer-motion"

interface MediaDetailsModalProps {
  omdbApiKeys: string[]
}

export function MediaDetailsModal({ omdbApiKeys }: MediaDetailsModalProps) {
  const { isModalOpen, modalContent: item, closeModal, tmdbApiKey } = useModal()
  const [detailedData, setDetailedData] = useState<MovieDetails | TVDetails | null>(null)
  const [omdbData, setOmdbData] = useState<{ imdbId: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Simple animation variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut" as const
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 10,
      transition: {
        duration: 0.25,
        ease: "easeIn" as const
      }
    }
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.25, ease: "easeIn" as const } }
  }

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.2,
        ease: "easeOut" as const
      }
    }
  }

  const buttonVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        delay: 0.4 + (i * 0.1),
        ease: "easeOut" as const
      }
    }),
    hover: {
      scale: 1.05,
      y: -2,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const
      }
    },
    tap: {
      scale: 0.95,
      transition: {
        duration: 0.1
      }
    }
  }

  // Fetch detailed data when modal opens - only for movies and TV shows
  useEffect(() => {
    if (isModalOpen && item) {
      // Reset data when modal opens
      setDetailedData(null)
      setOmdbData(null)
      setIsLoading(false)

      console.log('🔍 Modal opened with item:', {
        type: item.type,
        id: item.id,
        hasDetails: 'details' in item && !!item.details,
        hasOmdbData: 'omdbData' in item && !!item.omdbData,
        detailsKeys: 'details' in item && item.details ? Object.keys(item.details) : [],
        omdbDataKeys: 'omdbData' in item && item.omdbData ? Object.keys(item.omdbData) : []
      });

      // Only fetch details for movies and TV shows, not books
      if ((item.type === 'movie' || item.type === 'tvshow') && tmdbApiKey) {
        setIsLoading(true)

        const fetchDetails = async () => {
          try {
            // Check if we already have detailed data in the item (from Redis)
            if ('details' in item && item.details && 'omdbData' in item && item.omdbData) {
              console.log('✅ Using cached detailed data from Redis');
              setDetailedData(item.details);
              setOmdbData(item.omdbData);
              setIsLoading(false);
              return;
            }

            // Also check if the data might be nested differently
            if ('details' in item && item.details && typeof item.details === 'object') {
              console.log('✅ Found details data, checking structure...');
              // The details might already contain what we need
              setDetailedData(item.details);

              if ('omdbData' in item && item.omdbData) {
                setOmdbData(item.omdbData);
              }

              setIsLoading(false);
              return;
            }

            console.log('🔄 Fetching fresh details from APIs (not in Redis cache)');

            // Fetch TMDB details only if not cached
            let details = null
            if (item.type === 'movie') {
              details = await fetchMovieDetails(item.id, tmdbApiKey)
            } else if (item.type === 'tvshow') {
              details = await fetchTVDetails(item.id, tmdbApiKey)
            }
            setDetailedData(details)

            // Fetch OMDB data only if not cached
            if (!('omdbData' in item) || !item.omdbData) {
              const year = item.type === 'movie'
                ? new Date(item.release_date).getFullYear().toString()
                : new Date(item.first_air_date).getFullYear().toString()

              const omdb = await getOmdbData(
                omdbApiKeys,
                item.type === 'movie' ? item.title : item.name,
                year,
                item.type === 'movie' ? 'movie' : 'series'
              )
              if (omdb) setOmdbData(omdb)
            } else {
              setOmdbData(item.omdbData);
            }

          } catch (error) {
            console.error('Error fetching details:', error)
          } finally {
            setIsLoading(false)
          }
        }

        fetchDetails()
      }
    }
  }, [isModalOpen, item, tmdbApiKey, omdbApiKeys])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isModalOpen, closeModal])

  if (!isModalOpen || !item) return null

  const getTitle = () => {
    if ('title' in item && item.title) return item.title
    if ('name' in item && item.name) return item.name
    if ('volumeInfo' in item && item.volumeInfo?.title) return item.volumeInfo.title
    // For books without title, try to use authors or a fallback
    if (item.type === 'book' && item.volumeInfo?.authors?.length) {
      return `Book by ${item.volumeInfo.authors[0]}`;
    }
    return 'Untitled Book'
  }

  const getPosterUrl = () => {
    if ('poster_path' in item && item.poster_path) {
      return `https://image.tmdb.org/t/p/w500${item.poster_path}`
    }
    if ('volumeInfo' in item && item.volumeInfo.imageLinks?.thumbnail) {
      return item.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')
    }
    return null
  }

  const getBackdropUrl = () => {
    if ('backdrop_path' in item && item.backdrop_path) {
      return `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
    }
    // For books, use the cover image as backdrop
    if ('volumeInfo' in item && item.volumeInfo.imageLinks?.thumbnail) {
      return item.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')
    }
    return null
  }

  const getDescription = () => {
    if ('overview' in item) return item.overview
    if ('volumeInfo' in item) return item.volumeInfo.description
    return null
  }

  const getReleaseDate = () => {
    if ('release_date' in item) return item.release_date
    if ('first_air_date' in item) return item.first_air_date
    if ('volumeInfo' in item) return item.volumeInfo.publishedDate
    return null
  }

  const getRating = () => {
    if ('vote_average' in item) return item.vote_average
    if ('volumeInfo' in item && item.volumeInfo.averageRating) return item.volumeInfo.averageRating
    return null
  }

  const getGenres = () => {
    // For books, always use categories from volumeInfo
    if (item.type === 'book' && 'volumeInfo' in item) {
      return item.volumeInfo.categories || []
    }

    // For movies/TV, use detailed data if available
    if (detailedData && 'genres' in detailedData) {
      return detailedData.genres.map(g => g.name)
    }

    // Fallback to genre IDs with mapping for movies/TV
    if ('genre_ids' in item && (item.type === 'movie' || item.type === 'tvshow')) {
      return getGenreNames(item.genre_ids || [], item.type === 'movie' ? 'movie' : 'tv')
    }

    return []
  }

  const getAuthors = () => {
    if ('volumeInfo' in item) return item.volumeInfo.authors || []
    return []
  }

  const getExternalLink = () => {
    if (item.type === "movie") return `https://www.themoviedb.org/movie/${item.id}`
    if (item.type === "tvshow") return `https://www.themoviedb.org/tv/${item.id}`
    if (item.type === "book" && 'volumeInfo' in item && item.volumeInfo.infoLink) return item.volumeInfo.infoLink
    return null
  }

  const getCast = () => {
    if (detailedData && 'credits' in detailedData) {
      return detailedData.credits.cast.slice(0, 10)
    }
    return []
  }

  const getDirectorOrCreator = () => {
    if (detailedData && 'credits' in detailedData) {
      if (item.type === 'movie') {
        return detailedData.credits.crew.find(person => person.job === 'Director')
      } else if (item.type === 'tvshow' && 'created_by' in detailedData) {
        return detailedData.created_by[0]
      }
    }
    return null
  }

  const getTrailerUrl = () => {
    if (detailedData && 'videos' in detailedData) {
      return getYouTubeTrailer(detailedData.videos)
    }
    return null
  }

  const getYouTubeVideoId = () => {
    const trailerUrl = getTrailerUrl()
    if (!trailerUrl) return null

    // Extract video ID from YouTube URL
    const match = trailerUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  const getTrailerTitle = () => {
    if (detailedData && 'videos' in detailedData) {
      const trailer = detailedData.videos.results.find(video =>
        video.site === 'YouTube' &&
        video.type === 'Trailer' &&
        video.official
      ) || detailedData.videos.results.find(video =>
        video.site === 'YouTube' &&
        video.type === 'Trailer'
      ) || detailedData.videos.results.find(video =>
        video.site === 'YouTube'
      )
      return trailer?.name || `${getTitle()} Trailer`
    }
    return `${getTitle()} Trailer`
  }

  const getRuntime = () => {
    if (detailedData) {
      if ('runtime' in detailedData) return detailedData.runtime
      if ('episode_run_time' in detailedData) return detailedData.episode_run_time[0]
    }
    if ('runtime' in item) return item.runtime
    if ('episode_run_time' in item) return (item.episode_run_time as number[])?.[0]
    return null
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Close button - always visible */}
            <motion.button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm hover:cursor-pointer"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.4,
                ease: "easeOut"
              }}
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Scrollable content */}
            <div className="max-h-[90vh] overflow-y-auto">
              {/* Header with backdrop */}
              <div className="relative h-48 sm:h-64 md:h-80 overflow-hidden">
                {getBackdropUrl() ? (
                  <Image
                    src={getBackdropUrl()!}
                    alt={getTitle() || 'Media backdrop image'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

                {/* Content overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                                      <div className="flex flex-row gap-4 sm:gap-6 items-end">
                      {/* Poster */}
                      <div className="flex flex-shrink-0 mx-auto sm:mx-0 -mt-8 sm:mt-0">
                      <div className="w-[100px] h-[150px] xs:w-36 xs:h-54 sm:w-28 sm:h-42 md:w-32 md:h-48 lg:w-36 lg:h-54 xl:w-40 xl:h-60 relative overflow-hidden shadow-lg bg-surface-elevated">
                        {getPosterUrl() ? (
                          <Image
                            src={getPosterUrl()!}
                            alt={getTitle() || 'Media poster image'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-surface-elevated to-surface-tonal flex items-center justify-center">
                            <span className="text-muted-foreground text-xs text-center px-2">No Image</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title and basic info */}
                    <div className="flex-1 min-w-0 text-left">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 line-clamp-2">
                        {getTitle()}
                      </h1>

                      {getAuthors().length > 0 && (
                        <p className="text-base sm:text-lg text-muted-foreground mb-3">
                          by {getAuthors().slice(0, 2).join(", ")}
                          {getAuthors().length > 2 && ` +${getAuthors().length - 2} more`}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-start gap-3 sm:gap-4 mb-4">
                        {getRating() && (
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="font-semibold text-sm sm:text-base">
                              {typeof getRating() === 'number' ? getRating()!.toFixed(1) : getRating()}
                            </span>
                          </div>
                        )}

                        {getReleaseDate() && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm sm:text-base">{formatDate(getReleaseDate()!)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">

                {/* Save Button */}
                <motion.button
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                  variants={buttonVariants}
                  custom={3}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </motion.button>

                {/* Watched/Read Button */}
                <motion.button
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                  variants={buttonVariants}
                  custom={4}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.type === 'book' ? 'Mark Read' : 'Mark Watched'}</span>
                </motion.button>

                {/* Watch on Stremio - Only for movies/TV with IMDB ID */}
                {(item.type === 'movie' || item.type === 'tvshow') && omdbData?.imdbId && (
                  <motion.a
                    href={`https://www.strem.io/s/movie/${getTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#7B5BF5] hover:bg-[#6344e2] text-white rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                    variants={buttonVariants}
                    custom={0}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <MonitorPlay className="w-4 h-4" />
                    <span className="hidden sm:inline">Watch</span>
                  </motion.a>
                )}

                {/* Read on Anna's Archive - Only for books */}
                {item.type === 'book' && (
                  <motion.a
                    href={`https://annas-archive.org/search?q=${encodeURIComponent(getTitle())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                    variants={buttonVariants}
                    custom={1}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Read</span>
                  </motion.a>
                )}

                {/* Watch Trailer - Only for movies/TV */}
                {(item.type === 'movie' || item.type === 'tvshow') && getTrailerUrl() && (
                  <motion.button
                    onClick={() => {
                      // Scroll to trailer section
                      const trailerSection = document.getElementById('trailer-section')
                      if (trailerSection) {
                        trailerSection.scrollIntoView({ behavior: 'smooth' })
                      }
                    }}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                    variants={buttonVariants}
                    custom={2}
                    whileHover="hover"
                    whileTap="tap"
                    title="Scroll to trailer section"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">View Trailer</span>
                  </motion.button>
                )}
                {/* More Button */}
                {getExternalLink() && (
                  <motion.a
                    href={getExternalLink()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-600 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm sm:text-base hover:cursor-pointer"
                    variants={buttonVariants}
                    custom={5}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">More</span>
                  </motion.a>
                )}
              </div>
              {/* Content */}
              <motion.div
                className="p-4 sm:p-6 md:p-8 space-y-6"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Genres/Categories */}
                {getGenres().length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                  >
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {item.type === 'book' ? 'Categories' : 'Genres'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {getGenres().slice(0, 5).map((genre: string, index: number) => (
                        <motion.span
                          key={index}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.7 + (index * 0.1),
                            ease: "easeOut"
                          }}
                          whileHover={{ scale: 1.05 }}
                        >
                          {genre}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Description */}
                {getDescription() && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {item.type === 'book' ? 'Synopsis' : 'Overview'}
                    </h3>
                    <p className="text-foreground leading-relaxed text-sm sm:text-base">
                      {getDescription()}
                    </p>
                  </div>
                )}

                {/* Trailer - Only for movies and TV shows */}
                {(item.type === 'movie' || item.type === 'tvshow') && getYouTubeVideoId() && (
                  <motion.div
                    id="trailer-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.8 }}
                  >
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Trailer
                    </h3>
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeVideoId()}?rel=0&modestbranding=1&autoplay=0`}
                        title={getTrailerTitle()}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Click the play button to watch the trailer
                    </p>
                  </motion.div>
                )}

                {/* Cast & Crew - Only for movies and TV shows */}
                {!isLoading && (item.type === 'movie' || item.type === 'tvshow') && getCast().length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Cast
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {getCast().map((actor) => (
                        <div key={actor.id} className="text-center">
                          <a 
                            href={`https://google.com/search?q=${encodeURIComponent(actor.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block hover:cursor-pointer"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 relative overflow-hidden rounded-full bg-surface-elevated mx-auto mb-2 hover:scale-105 transition-transform">
                              {actor.profile_path ? (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                                  alt={actor.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-1 hover:text-primary transition-colors">
                              {actor.name}
                            </p>
                          </a>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {actor.character}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Director/Creator - Only for movies and TV shows */}
                {!isLoading && (item.type === 'movie' || item.type === 'tvshow') && getDirectorOrCreator() && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {item.type === 'movie' ? 'Director' : 'Creator'}
                    </h3>
                    <div className="flex items-center gap-3">
                      <a 
                        href={`https://google.com/search?q=${encodeURIComponent(getDirectorOrCreator()!.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:cursor-pointer"
                      >
                        <div className="w-12 h-12 relative overflow-hidden rounded-full bg-surface-elevated hover:scale-105 transition-transform">
                          {getDirectorOrCreator()!.profile_path ? (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${getDirectorOrCreator()!.profile_path}`}
                              alt={getDirectorOrCreator()!.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm sm:text-base font-medium text-foreground hover:text-primary transition-colors">
                          {getDirectorOrCreator()!.name}
                        </span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Loading state for cast/crew */}
                {isLoading && (item.type === 'movie' || item.type === 'tvshow') && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Loading details...</span>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Runtime */}
                  {getRuntime() && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                        {item.type === 'movie' ? 'Runtime' : 'Episode Runtime'}
                      </h4>
                      <p className="text-foreground text-sm sm:text-base">
                        {getRuntime()} minutes
                      </p>
                    </div>
                  )}

                  {/* Seasons/Episodes for TV shows */}
                  {detailedData && 'number_of_seasons' in detailedData && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Seasons</h4>
                      <p className="text-foreground text-sm sm:text-base">
                        {detailedData.number_of_seasons} seasons, {detailedData.number_of_episodes} episodes
                      </p>
                    </div>
                  )}

                  {/* Book specific info */}
                  {'volumeInfo' in item && item.volumeInfo.pageCount && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Pages</h4>
                      <p className="text-foreground text-sm sm:text-base">{item.volumeInfo.pageCount}</p>
                    </div>
                  )}

                  {'volumeInfo' in item && item.volumeInfo.publisher && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Publisher</h4>
                      <p className="text-foreground text-sm sm:text-base">{item.volumeInfo.publisher}</p>
                    </div>
                  )}

                  {/* Language */}
                  {('original_language' in item || ('volumeInfo' in item && item.volumeInfo.language)) && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Language</h4>
                      <p className="text-foreground text-sm sm:text-base">
                        {'original_language' in item ? (item.original_language as string)?.toUpperCase() :
                          'volumeInfo' in item ? (item.volumeInfo.language as string)?.toUpperCase() : 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
