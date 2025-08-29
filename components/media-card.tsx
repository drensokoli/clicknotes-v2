import Image from "next/image"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModal } from "./modal-provider"
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
}

export function MediaCard({ item, className }: MediaCardProps) {
  const { openModal } = useModal()
  const { resolvedTheme } = useTheme()
  const [showButtons, setShowButtons] = useState(false)
  const [mounted, setMounted] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  
  // Prevent hydration mismatch by only using theme after component mounts
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Hide buttons when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowButtons(false)
      }
    }

    if (showButtons) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showButtons])
  
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
      return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    }
    if (item.type === "tvshow" && item.poster_path) {
      return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
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

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative overflow-hidden rounded-u bg-surface border border-border/30",
        className
      )}
    >
      {/* Poster/Cover Image */}
      <div 
        className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-surface-elevated to-surface-tonal"
        onClick={() => setShowButtons(!showButtons)}
      >
        {getPosterUrl() ? (
          <Image
            src={getPosterUrl()!}
            alt={getTitle() || 'Media poster image'}
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-tonal to-surface-tonal-20 text-muted-foreground/60">
            {item.type === "movie" && <Film className="h-16 w-16 opacity-40" />}
            {item.type === "tvshow" && <Tv className="h-16 w-16 opacity-40" />}
            {item.type === "book" && <BookOpen className="h-16 w-16 opacity-40" />}
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-150",
          "opacity-0 group-hover:opacity-100", // Desktop hover
          showButtons ? "opacity-100" : "", // Mobile tap state
        )} />
        
        {/* Action Buttons - Show on hover (desktop) or tap (mobile) */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-150",
          "opacity-0 group-hover:opacity-100", // Desktop hover
          showButtons ? "opacity-100" : "", // Mobile tap state
        )}>
          <div className="flex flex-col space-y-3">
            {/* Save Button */}
            <button
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-1 media-card-button",
                showButtons && "show"
              )}
              style={{
                backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
              }}
              title="Save to List"
              onClick={(e) => {
                e.stopPropagation();
                // Add save functionality here
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>
            
            {/* Mark as Watched Button */}
            <button
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:cursor-pointer",
                "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
                "button-slide-up delay-2 media-card-button",
                showButtons && "show"
              )}
              style={{
                backgroundColor: mounted && resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                color: mounted && resolvedTheme === 'dark' ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 39)'
              }}
              title="Mark as Watched"
              onClick={(e) => {
                e.stopPropagation();
                // Add watched functionality here
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            </button>
          
          {/* Details Button */}
          <button
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:cursor-pointer",
              "bg-white/80 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200",
              "button-slide-up delay-3 media-card-button",
              showButtons && "show"
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
        
        {/* Mobile Touch Indicator - always show on mobile when buttons are hidden */}
        {!showButtons && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded-lg text-xs backdrop-blur-sm opacity-70 sm:hidden">
            Tap for options
          </div>
        )}

        {/* Mobile Button Placeholders - show invisible clickable areas when buttons are hidden */}
        {!showButtons && (
          <div className="absolute inset-0 flex items-center justify-center sm:hidden">
            <div className="flex flex-col space-y-3">
              {/* Invisible clickable areas for each button */}
              <div 
                className="w-12 h-12 rounded-full cursor-pointer"
                onClick={() => setShowButtons(true)}
              />
              <div 
                className="w-12 h-12 rounded-full cursor-pointer"
                onClick={() => setShowButtons(true)}
              />
              <div 
                className="w-12 h-12 rounded-full cursor-pointer"
                onClick={() => setShowButtons(true)}
              />
            </div>
          </div>
        )}
        
        {/* Title on hover */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
          "opacity-0 group-hover:opacity-100", // Desktop hover
          showButtons ? "opacity-100" : "", // Mobile tap state
        )}>
          <h3 className="text-white text-sm font-semibold line-clamp-1">
            {getTitle()}
          </h3>
        </div>

        {/* Rating Badge - Always visible for all media types */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white shadow-lg z-10">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span>{getRating() > 0 ? getRating().toFixed(1) : 'N/A'}</span>
        </div>


      </div>




    </div>
  )
}

// Import necessary icons
import { Film, Tv, BookOpen } from "lucide-react"
