"use client"

import { X, Star, Calendar, ExternalLink, Play, Eye, Bookmark, User, MonitorPlay, BookOpen, Share2, Facebook, Twitter, MessageCircle, Link2, ChevronsUp, ChevronLeft, ChevronRight } from "lucide-react"
import { getOmdbData, type OmdbData } from "@/lib/omdb-helpers"
import Image from "next/image"
import { CriticsScores } from "./critics-scores"
import { RatingStars } from "./rating-stars"
import type { MediaItem } from "./media-card"
import { useSavedMedia } from "./saved-media-provider"
import { useEffect, useRef, useState } from "react"
import { fetchMovieDetails, fetchTVDetails, getGenreNames, getYouTubeTrailer, type MovieDetails, type TVDetails } from "@/lib/tmdb-details"
import { splitBookCategories } from "@/lib/book-categories"
import { getMediaHref } from "@/lib/media-url"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

interface MediaDetailsModalProps {
  item: MediaItem | null
  isOpen: boolean
  onClose: () => void
  tmdbApiKey: string
  omdbApiKeys: string[]
  // Optional carousel navigation through a list (used by the Library - Feature 3).
  // When provided, prev/next arrows, ← / → keys, and horizontal swipe move between
  // items. Omitted by the route-based modal, which shows a single item.
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function MediaDetailsModal({
  item,
  isOpen: isModalOpen,
  onClose: closeModal,
  tmdbApiKey,
  omdbApiKeys,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: MediaDetailsModalProps) {
  const { getStatus, toggle, getRating: getUserRating, rate, getBump, toggleBump } = useSavedMedia()
  const [detailedData, setDetailedData] = useState<MovieDetails | TVDetails | null>(null)
  const [omdbData, setOmdbData] = useState<OmdbData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement>(null)
  // Tracks the start of a horizontal swipe for carousel navigation (Feature 3).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Close the share menu on an outside click, same pattern as the user menu
  // (components/user-profile.tsx).
  useEffect(() => {
    if (!shareMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shareMenuOpen])

  // Block the page behind the modal from scrolling while it's open.
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isModalOpen])

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

  // Fetch detailed data when modal opens - only for movies and Series
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

      // Only fetch details for movies and Series, not books
      if ((item.type === 'movie' || item.type === 'series') && tmdbApiKey) {
        setIsLoading(true)

        // Live OMDB lookup (for the Stremio Watch link's IMDB id) - needed
        // whenever the item doesn't already carry `omdbData`, regardless of
        // whether its TMDB `details` are already cached.
        const fetchOmdbData = async () => {
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
        }

        const fetchDetails = async () => {
          try {
            // A `details` object only counts as "already cached" if it has a
            // `videos` key - some saved cards only ever got a stub `details`
            // (e.g. just `{ runtime }` from scripts/backfill-runtime.js, or
            // `{ genres }` alone) with no trailer/credits data ever fetched, and
            // treating those as complete permanently hid the Watch/Trailer
            // buttons and embed for them.
            const hasFullDetails = 'details' in item && item.details && typeof item.details === 'object' && 'videos' in item.details
            const existingOmdbData = 'omdbData' in item ? item.omdbData : undefined

            if (hasFullDetails) {
              setDetailedData(item.details as MovieDetails | TVDetails);

              // TMDB details being cached doesn't mean OMDB data is too - e.g.
              // items fetched fresh via lib/media-lookup.ts for the /movie/[id]
              // etc. pages always have full TMDB details but never embed
              // omdbData, so the Stremio Watch button still needs this fetch.
              if (existingOmdbData) {
                setOmdbData(existingOmdbData);
              } else {
                await fetchOmdbData();
              }

              setIsLoading(false);
              return;
            }

            // Fetch TMDB details only if not cached
            let details = null
            if (item.type === 'movie') {
              details = await fetchMovieDetails(item.id, tmdbApiKey)
            } else if (item.type === 'series') {
              details = await fetchTVDetails(item.id, tmdbApiKey)
            }
            setDetailedData(details)

            if (existingOmdbData) {
              setOmdbData(existingOmdbData);
            } else {
              await fetchOmdbData();
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

  // Arrow-key carousel navigation (Feature 3) - only active when the parent passed
  // prev/next handlers (i.e. the Library's in-place browser). Left/right respect the
  // list bounds via hasPrev/hasNext.
  useEffect(() => {
    if (!isModalOpen || (!onPrev && !onNext)) return
    const handleArrows = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && hasNext && onNext) onNext()
    }
    document.addEventListener('keydown', handleArrows)
    return () => document.removeEventListener('keydown', handleArrows)
  }, [isModalOpen, onPrev, onNext, hasPrev, hasNext])

  if (!isModalOpen || !item) return null

  // Current saved state for this item ("to_watch" | "watched" | null)
  const savedStatus = getStatus(item.type, item.id)
  // Whether the item is bumped (pinned to the top of the Library). Only meaningful
  // for saved items - the button is shown alongside the status buttons below.
  const isBumped = getBump(item.type, item.id) !== null

  // Search/discover results carry no credits or runtime; the save API enriches
  // movies/series from TMDB at save time (lib/save-enrichment.ts), so the card
  // itself is passed through as-is here - no client-side credit merging needed.

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
      // Use w342 for modal poster (displayed at ~100-150px)
      return `https://image.tmdb.org/t/p/w342${item.poster_path}`
    }
    if ('volumeInfo' in item && item.volumeInfo.imageLinks?.thumbnail) {
      return item.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')
    }
    return null
  }

  const getBackdropUrl = () => {
    if ('backdrop_path' in item && item.backdrop_path) {
      // Use w780 instead of w1280 for better performance (covers most screen sizes)
      return `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
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
      return splitBookCategories(item.volumeInfo.categories)
    }

    // For movies/TV, use detailed data if available
    if (detailedData && 'genres' in detailedData) {
      return detailedData.genres.map(g => g.name)
    }

    // Fallback to genre IDs with mapping for movies/TV
    if ('genre_ids' in item && (item.type === 'movie' || item.type === 'series')) {
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
    if (item.type === "series") return `https://www.themoviedb.org/tv/${item.id}`
    if (item.type === "book" && 'volumeInfo' in item && item.volumeInfo.infoLink) return item.volumeInfo.infoLink
    return null
  }

  const getShareUrl = () => `${window.location.origin}${getMediaHref(item.type, item.id)}`

  // Mobile/Safari-style native share sheet where available; everywhere else
  // (most desktop browsers don't implement the Web Share API) opens a small
  // menu with per-platform share links plus copy-link, instead of silently
  // just copying the link.
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: getTitle(), url: getShareUrl() })
      } catch {
        // User cancelled the share sheet - not an error.
      }
      return
    }

    setShareMenuOpen((open) => !open)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getShareUrl())
    toast('Link copied to clipboard')
    setShareMenuOpen(false)
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
      } else if (item.type === 'series' && 'created_by' in detailedData) {
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

  // Horizontal-swipe carousel navigation (Feature 3), mobile-friendly counterpart to
  // the arrow buttons / keys. Requires a clearly horizontal gesture so it doesn't
  // fight the modal's vertical scroll.
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || (!onPrev && !onNext)) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0 && hasNext && onNext) onNext()
    else if (dx > 0 && hasPrev && onPrev) onPrev()
  }

  const showNav = Boolean(onPrev || onNext)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
            {/* Utility cluster - Share / More / Close. These are chrome, not content
                actions, so they live in the header instead of competing for space in
                the action rows below. */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
              {/* Share - native share sheet where available (handleShare), else a
                  dropdown with per-platform links + copy-link. */}
              <div className="relative" ref={shareMenuRef}>
                <button
                  onClick={handleShare}
                  title="Share"
                  aria-label="Share"
                  className="w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm hover:cursor-pointer"
                >
                  <Share2 className="w-[18px] h-[18px]" />
                </button>

                <AnimatePresence>
                  {shareMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-2 right-0 w-48 bg-background rounded-xl py-2 z-20 shadow-lg border border-border"
                    >
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${getTitle()} ${getShareUrl()}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareMenuOpen(false)}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground theme-hover-light hover:cursor-pointer transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 mr-3 text-green-600" />
                        WhatsApp
                      </a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareMenuOpen(false)}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground theme-hover-light hover:cursor-pointer transition-colors"
                      >
                        <Facebook className="w-4 h-4 mr-3 text-blue-600" />
                        Facebook
                      </a>
                      <a
                        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(getTitle())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareMenuOpen(false)}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground theme-hover-light hover:cursor-pointer transition-colors"
                      >
                        <Twitter className="w-4 h-4 mr-3 text-sky-500" />
                        X (Twitter)
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground theme-hover-light hover:cursor-pointer transition-colors"
                      >
                        <Link2 className="w-4 h-4 mr-3 text-muted-foreground" />
                        Copy Link
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* More - the item's canonical page on TMDB / Google Books */}
              {getExternalLink() && (
                <a
                  href={getExternalLink()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on TMDB"
                  aria-label="View more details externally"
                  className="w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm hover:cursor-pointer"
                >
                  <ExternalLink className="w-[18px] h-[18px]" />
                </a>
              )}

              <button
                onClick={closeModal}
                title="Close"
                aria-label="Close"
                className="w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm hover:cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Carousel arrows (Feature 3) - only when the parent wires prev/next.
                Disabled at the list ends. Sit above the content, edge-centered. */}
            {showNav && (
              <>
                <button
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Previous item"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:bg-black/70 disabled:opacity-30 disabled:cursor-default hover:cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="Next item"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:bg-black/70 disabled:opacity-30 disabled:cursor-default hover:cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Scrollable content */}
            <div className="max-h-[90vh] overflow-y-auto" onTouchStart={showNav ? handleTouchStart : undefined} onTouchEnd={showNav ? handleTouchEnd : undefined}>
              {/* Header with backdrop */}
              <div className="relative h-48 sm:h-64 md:h-80 overflow-hidden">
                {getBackdropUrl() ? (
                  <Image
                    src={getBackdropUrl()!}
                    alt={getTitle() || 'Media backdrop image'}
                    fill
                    quality={75}
                    sizes="100vw"
                    // loading="lazy"
                    // placeholder="blur"
                    // blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjEyODAiIGhlaWdodD0iNzIwIiBmaWxsPSIjM0EzQTQ0Ii8+Cjwvc3ZnPg=="
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
                            quality={70}
                            sizes="(max-width: 640px) 120px, (max-width: 768px) 140px, (max-width: 1024px) 160px, 180px"
                            // loading="lazy"
                            // placeholder="blur"
                            // blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iIzNBM0E0NCIvPgo8L3N2Zz4="
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

              {/* Actions - two coherent groups instead of three mixed rows:
                    1. Primary: what you can do with this media right now
                       (Watch / Read / Trailer).
                    2. Your library: everything describing YOUR relationship to it
                       (status, rating, bump), bounded in one panel so it reads as a
                       single unit rather than being scattered between action rows.
                  Share / More moved to the header utility cluster - they're chrome. */}
              <div className="flex flex-col items-center gap-4 pt-5 sm:pt-6 px-4 sm:px-6">

                {/* 1. Primary actions */}
                {(item.type === 'book' || isLoading || omdbData?.imdbId || getTrailerUrl()) && (
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                    {/* Watch on Stremio - Only for movies/TV with IMDB ID */}
                    {!isLoading && (item.type === 'movie' || item.type === 'series') && omdbData?.imdbId && (
                      <motion.a
                        href={`https://www.strem.io/s/${item.type === 'movie' ? 'movie' : 'series'}/${getTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${omdbData.imdbId.replace('tt', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#7B5BF5] hover:bg-[#6344e2] text-white rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                        variants={buttonVariants}
                        custom={0}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <MonitorPlay className="w-4 h-4" />
                        Watch
                      </motion.a>
                    )}

                    {/* Read on Anna's Archive - Only for books */}
                    {item.type === 'book' && (
                      <motion.a
                        href={`https://annas-archive.org/search?q=${encodeURIComponent(getTitle())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                        variants={buttonVariants}
                        custom={1}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <BookOpen className="w-4 h-4" />
                        Read
                      </motion.a>
                    )}

                    {/* Loading placeholder for Watch/Trailer while their data is still
                        being fetched live (pre-fetched items resolve isLoading to false
                        almost immediately, so this only shows for the on-demand case) */}
                    {isLoading && (item.type === 'movie' || item.type === 'series') && (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-elevated text-muted-foreground text-sm sm:text-base">
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin" />
                        Loading
                      </div>
                    )}

                    {/* Watch Trailer - Only for movies/TV */}
                    {!isLoading && (item.type === 'movie' || item.type === 'series') && getTrailerUrl() && (
                      <motion.button
                        onClick={() => {
                          const trailerSection = document.getElementById('trailer-section')
                          if (trailerSection) trailerSection.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm sm:text-base hover:cursor-pointer"
                        variants={buttonVariants}
                        custom={2}
                        whileHover="hover"
                        whileTap="tap"
                        title="Scroll to trailer section"
                      >
                        <Play className="w-4 h-4" />
                        Trailer
                      </motion.button>
                    )}
                  </div>
                )}

                {/* 2. Your library - status, rating and bump in one bounded panel */}
                <div className="w-full max-w-xl rounded-xl border border-border/50 bg-surface-elevated/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {savedStatus ? 'In your library' : 'Add to your library'}
                    </h3>
                    {/* Bump lives here as a quiet secondary toggle - it only means
                        anything for an item that's already in the library. */}
                    {savedStatus && (
                      <button
                        onClick={() => toggleBump(item.type, item.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:cursor-pointer shrink-0 ${
                          isBumped
                            ? 'bg-amber-500 text-black'
                            : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                        }`}
                        title={isBumped ? 'Unpin from the top of your library' : 'Pin to the top of your library'}
                      >
                        <ChevronsUp className="w-3.5 h-3.5" />
                        {isBumped ? 'Pinned' : 'Pin to top'}
                      </button>
                    )}
                  </div>

                  {/* Status as a real segmented control - one state at a time, which is
                      what it actually is. Clicking the active segment removes the item. */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface">
                    <button
                      onClick={() => toggle(item.type, item.id, "to_watch", item)}
                      title={savedStatus === "to_watch" ? "Click again to remove from your library" : "Save for later"}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-2 rounded-md text-[11px] sm:text-sm font-medium leading-tight text-center whitespace-nowrap transition-colors hover:cursor-pointer ${
                        savedStatus === "to_watch"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 shrink-0 ${savedStatus === "to_watch" ? "fill-current" : ""}`} />
                      Saved
                    </button>

                    <button
                      onClick={() => toggle(item.type, item.id, "watching", item)}
                      title={savedStatus === "watching" ? "Click again to remove from your library" : "Mark as in progress"}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-2 rounded-md text-[11px] sm:text-sm font-medium leading-tight text-center whitespace-nowrap transition-colors hover:cursor-pointer ${
                        savedStatus === "watching"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                      }`}
                    >
                      <Play className={`w-4 h-4 shrink-0 ${savedStatus === "watching" ? "fill-current" : ""}`} />
                      In progress
                    </button>

                    <button
                      onClick={() => toggle(item.type, item.id, "watched", item)}
                      title={savedStatus === "watched" ? "Click again to remove from your library" : "Mark as completed"}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-2 rounded-md text-[11px] sm:text-sm font-medium leading-tight text-center whitespace-nowrap transition-colors hover:cursor-pointer ${
                        savedStatus === "watched"
                          ? "bg-green-600 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                      }`}
                    >
                      <Eye className={`w-4 h-4 shrink-0 ${savedStatus === "watched" ? "fill-current" : ""}`} />
                      Completed
                    </button>
                  </div>

                  {/* Rating - only meaningful once the item is in the library, and it
                      sits directly under the status it belongs with. */}
                  {savedStatus && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <RatingStars
                        value={getUserRating(item.type, item.id)}
                        onChange={(value) => rate(item.type, item.id, value)}
                      />
                    </div>
                  )}
                </div>
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

                {/* Runtime - moved up under Overview since it's core info, not a footnote */}
                {getRuntime() ? (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {item.type === 'movie' ? 'Runtime' : 'Episode Runtime'}
                    </h3>
                    <p className="text-foreground text-sm sm:text-base">
                      {getRuntime()} minutes
                    </p>
                  </div>
                ) : isLoading && (item.type === 'movie' || item.type === 'series') ? (
                  <div className="h-4 w-24 rounded bg-surface-elevated animate-pulse" />
                ) : null}

                {/* Critics scores (Rotten Tomatoes / Metacritic / IMDb) - movies &
                    Series only, from OMDB (see lib/omdb-helpers.ts). Shows nothing
                    for books or until omdbData resolves. */}
                {(item.type === 'movie' || item.type === 'series') && (
                  <CriticsScores
                    rottenTomatoes={omdbData?.rottenTomatoes}
                    metacritic={omdbData?.metacritic}
                    imdbRating={omdbData?.imdbRating}
                  />
                )}

                {/* Trailer - Only for movies and Series. Gated on !isLoading so it
                    doesn't silently pop in mid-fetch without the shared loading
                    indicator below having shown first (pre-fetched items skip this,
                    since isLoading resolves to false almost immediately for them). */}
                {!isLoading && (item.type === 'movie' || item.type === 'series') && getYouTubeVideoId() && (
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

                {/* Cast & Crew - Only for movies and Series */}
                {!isLoading && (item.type === 'movie' || item.type === 'series') && getCast().length > 0 && (
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
                                  quality={65}
                                  sizes="(max-width: 640px) 64px, 80px"
                                  // loading="lazy"
                                  // placeholder="blur"
                                  // blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjM0EzQTQ0Ii8+Cjwvc3ZnPg=="
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

                {/* Director/Creator - Only for movies and Series */}
                {!isLoading && (item.type === 'movie' || item.type === 'series') && getDirectorOrCreator() && (
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
                              quality={65}
                              sizes="48px"
                              // loading="lazy"
                              // placeholder="blur"
                              // blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjM0EzQTQ0Ii8+Cjwvc3ZnPg=="
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

                {/* Loading state covering everything that isn't already on the card:
                    trailer, cast, director/creator, runtime, seasons. Title/poster/date/
                    rating/overview/status-buttons render instantly above regardless. */}
                {isLoading && (item.type === 'movie' || item.type === 'series') && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Loading trailer, cast &amp; more...</span>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Seasons/Episodes for Series */}
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
