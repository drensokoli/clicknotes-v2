import Image from "next/image"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModal } from "./modal-provider"
import { useSavedMedia } from "./saved-media-provider"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"

// Movie interface (from TMDB)
export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  genre_ids: number[]
  runtime?: number
  adult: boolean
  type: "movie"
  // Redis cached detailed data
  details?: {
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
  omdbData?: {
    imdbId: string
    rated: string
    runtime: string
    awards: string
  }
  stremioLink?: string
}

// TV Show interface (from TMDB)
export interface TVShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  genre_ids: number[]
  number_of_seasons?: number
  type: "tvshow"
  // Redis cached detailed data
  details?: {
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
  omdbData?: {
    imdbId: string
    rated: string
    runtime: string
    awards: string
  }
  stremioLink?: string
}

// Book interface (from Google Books API + NY Times API)
export interface Book {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    publishedDate?: string
    pageCount?: number
    averageRating?: number
    imageLinks?: {
      thumbnail?: string | null
      smallThumbnail?: string | null
    }
    previewLink?: string
    infoLink?: string
    language?: string
    publisher?: string
    categories?: string[]
  }
  saleInfo?: {
    saleability?: string
    listPrice?: {
      amount?: number
      currencyCode?: string
    }
  }
  type: "book"
}

// Union type for all media items
export type MediaItem = Movie | TVShow | Book

interface MediaCardProps {
  item: MediaItem
  className?: string
  priority?: boolean
  loading?: "lazy" | "eager"
}

export function MediaCard({ item, className, priority = false, loading = "lazy" }: MediaCardProps) {
  const { openModal } = useModal()
  const { getStatus, toggle } = useSavedMedia()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Explicit JS-driven reveal, distinct from desktop's CSS :hover reveal. Needed because
  // many mobile browsers simulate :hover on the first tap (a WebKit/touch quirk) - that
  // tap only triggers the hover state without registering as a real click, so a
  // hover-only reveal makes mobile need two taps just to reveal the buttons, then a
  // third to actually hit one. A plain boolean toggled on tap sidesteps that entirely.
  const [showButtons, setShowButtons] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch by only using theme after component mounts
  useEffect(() => {
    setMounted(true)
  }, [])

  // Note: deliberately no "click outside to hide" listener here. A raw DOM `mousedown`
  // listener (a separate event system from React's synthetic `click`) fires *before* the
  // button's own click, so if it ever misfired it could flip pointer-events to `none` on
  // the button container before the button's click actually dispatched - the exact kind
  // of race that made buttons need an extra tap. Toggling only happens by tapping the
  // poster (which the buttons stopPropagation to avoid re-triggering).

  // Safety check: ensure item has required properties
  if (!item || !item.type) {
    console.warn('MediaCard received invalid item:', item);
    return null;
  }
  
  // Debug logging for problematic items
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 MediaCard rendering item:`, {
      type: item.type,
      id: item.id,
      hasTitle: 'title' in item ? !!item.title : 'name' in item ? !!item.name : item.type === 'book' ? !!item.volumeInfo?.title : 'N/A',
      hasVolumeInfo: item.type === 'book' ? !!item.volumeInfo : 'N/A',
      volumeInfoKeys: item.type === 'book' && item.volumeInfo ? Object.keys(item.volumeInfo) : 'N/A'
    });
  }
  
  // Additional safety check for books - but be more lenient
  if (item.type === 'book') {
    if (!item.volumeInfo) {
      console.warn('Book item missing volumeInfo:', item);
      return null;
    }
    // Ensure we have at least a title or authors to display
    const hasDisplayableContent = item.volumeInfo.title || 
      (item.volumeInfo.authors && item.volumeInfo.authors.length > 0);
    
    if (!hasDisplayableContent) {
      console.warn('Book item missing both title and authors, filtering out:', item);
      return null;
    }
  }
  
  // Helper functions to extract data based on item type
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
    if (item.type === "movie" && item.poster_path) {
      // Use w342 for better size optimization (cards are ~150-200px wide)
      return `https://image.tmdb.org/t/p/w342${item.poster_path}`;
    }
    if (item.type === "tvshow" && item.poster_path) {
      // Use w342 for better size optimization (cards are ~150-200px wide)
      return `https://image.tmdb.org/t/p/w342${item.poster_path}`;
    }
    if (item.type === "book" && item.volumeInfo?.imageLinks?.thumbnail) {
      return item.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
    }
    return null;
  };

  const getRating = () => {
    if (item.type === "movie" || item.type === "tvshow") {
      return item.vote_average || 0;
    }
    if (item.type === "book") {
      return item.volumeInfo?.averageRating || 0;
    }
    return 0;
  };

  // Current saved state for this item ("to_watch" | "watching" | "watched" | null)
  const savedStatus = getStatus(item.type, item.id);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative overflow-hidden rounded-u bg-surface border border-border/30",
        showButtons && "buttons-visible",
        className
      )}
    >
      {/* Poster/Cover Image - toggles the action buttons (desktop also reveals them via
          real :hover; this toggle is what makes mobile taps work). The dedicated Info
          button (below) is now the only way to open the detail modal. */}
      <div
        className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-surface-elevated to-surface-tonal cursor-pointer"
        onClick={() => setShowButtons((prev) => !prev)}
      >
        {getPosterUrl() ? (
          <Image
            src={getPosterUrl()!}
            alt={getTitle() || 'Media poster image'}
            fill
            loading={loading}
            priority={priority}
            fetchPriority={priority ? "high" : undefined}
            quality={70}
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iIzNBM0E0NCIvPgo8L3N2Zz4="
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-tonal to-surface-tonal-20 text-muted-foreground/60">
            {item.type === "movie" && <Film className="h-16 w-16 opacity-40" />}
            {item.type === "tvshow" && <Tv className="h-16 w-16 opacity-40" />}
            {item.type === "book" && <BookOpen className="h-16 w-16 opacity-40" />}
          </div>
        )}
        
        {/* Gradient Overlay - revealed on desktop hover, or on mobile once tapped.
            card-reveal-on-hover's opacity is set in globals.css inside an
            @media (hover: hover) block, NOT via Tailwind's group-hover: utility - see
            the note on the Action Buttons block below for why. */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-300 ease-out",
          "opacity-0 card-reveal-on-hover",
          showButtons && "opacity-100",
        )} />

        {/* Action Buttons - revealed via real :hover on desktop, or via the showButtons
            JS toggle on mobile (see .button-slide-up + .group:hover / .buttons-visible
            rules in globals.css). The Info button is the only way to open the modal now -
            clicking the poster itself just toggles this reveal.

            IMPORTANT: pointer-events-auto for the hover path is gated behind
            @media (hover: hover) in globals.css, not Tailwind's group-hover: utility.
            Many mobile browsers simulate the :hover pseudo-class on the first tap (a
            long-documented WebKit/touch quirk) - if group-hover: classes were used here,
            that phantom hover match could flip pointer-events/opacity inconsistently
            between rules on the very tap meant to reveal+use a button, which is exactly
            what caused buttons to render visible but not be clickable until a second
            tap. Scoping the real-hover CSS inside @media (hover: hover) and (pointer:
            fine) means it's structurally impossible for it to activate on a touch
            device's primary input, regardless of any :hover simulation the browser
            does internally - touch devices report (hover: none) and skip the whole
            block, leaving the JS showButtons/buttons-visible path as the only trigger. */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none card-reveal-buttons",
          showButtons && "pointer-events-auto",
        )}>
          <div className="flex flex-col space-y-2">
            {/* Save Button */}
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-1 media-card-button",
              )}
              style={
                savedStatus === "to_watch"
                  ? { backgroundColor: "rgb(26, 86, 219)", color: "rgb(255, 255, 255)" }
                  : {
                      backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
                    }
              }
              title={savedStatus === "to_watch" ? "Saved" : "Save"}
              onClick={(e) => {
                e.stopPropagation();
                toggle(item.type, item.id, "to_watch", item);
              }}
            >
              <svg className="w-4 h-4" fill={savedStatus === "to_watch" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>

            {/* Mark as Watching Button */}
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-2 media-card-button",
              )}
              style={
                savedStatus === "watching"
                  ? { backgroundColor: "rgb(180, 83, 9)", color: "rgb(255, 255, 255)" }
                  : {
                      backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
                    }
              }
              title={savedStatus === "watching" ? "Remove from list" : "In Progress"}
              onClick={(e) => {
                e.stopPropagation();
                toggle(item.type, item.id, "watching", item);
              }}
            >
              <svg className="w-4 h-4" fill={savedStatus === "watching" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5v14l11-7z" />
              </svg>
            </button>

            {/* Mark as Watched Button */}
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-3 media-card-button",
              )}
              style={
                savedStatus === "watched"
                  ? { backgroundColor: "rgb(22, 163, 74)", color: "rgb(255, 255, 255)" }
                  : {
                      backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
                    }
              }
              title={savedStatus === "watched" ? "Remove from list" : "Completed"}
              onClick={(e) => {
                e.stopPropagation();
                toggle(item.type, item.id, "watched", item);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>

            {/* Info Button - the only way to open the detail modal */}
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-4 media-card-button",
              )}
              style={{
                backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
              }}
              title="View Details"
              onClick={(e) => {
                e.stopPropagation();
                openModal(item);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Title - revealed on desktop hover, or on mobile once tapped. pointer-events-none
            because this renders after (so visually on top of) the action buttons, and the
            vertically-centered button stack can overlap this bottom bar on narrow cards -
            without this, a tap meant for a button would land on this label instead and
            swallow the click, since this div has no click handler of its own to pass it on. */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ease-out pointer-events-none",
          "opacity-0 card-reveal-on-hover",
          showButtons && "opacity-100",
        )}>
          <h3 className="text-white text-sm font-semibold line-clamp-1">
            {getTitle()}
          </h3>
        </div>

        {/* Rating Badge - Always visible for all media types. pointer-events-none for the
            same reason as the title bar above - purely decorative, shouldn't ever be able
            to swallow a tap meant for a button underneath it. */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white shadow-lg z-10 pointer-events-none">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span>{getRating() > 0 ? getRating().toFixed(1) : 'N/A'}</span>
        </div>


      </div>




    </div>
  )
}

// Import necessary icons
import { Film, Tv, BookOpen } from "lucide-react"
