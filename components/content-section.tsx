"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { MediaCard, MediaItem, Movie, TVShow, Book } from "./media-card"
import { searchContentByTitle, searchBooksByTitle } from "@/lib/api-helpers"
import { useModal } from "./modal-provider"

type Section = "movies" | "tvshows" | "books"

interface ContentSectionProps {
  initialMovies: Movie[]
  initialTVShows: TVShow[]
  initialBooks: Book[]
  movieRanking?: Array<{value: string, score: number}>
  tvShowRanking?: Array<{value: string, score: number}>
  bookRanking?: Array<{value: string, score: number}>
  tmdbApiKey: string
  googleBooksApiKey: string
  // Progressive loading props
  redisKeysFetched?: {
    movies: number
    tvshows: number
    books: number
  }
  // External state management props
  externalActiveSection?: Section
  externalSearchQuery?: string
  externalSearchResults?: MediaItem[]
  onSearchChange?: (query: string, results: MediaItem[]) => void
}

export function ContentSection({
  initialMovies,
  initialTVShows,
  initialBooks,
  movieRanking = [],
  tvShowRanking = [],
  bookRanking = [],
  tmdbApiKey,
  googleBooksApiKey,
  redisKeysFetched = { movies: 1, tvshows: 1, books: 1 },
  externalActiveSection,
  externalSearchQuery,
  externalSearchResults,
  onSearchChange
}: ContentSectionProps) {
  const { setTmdbApiKey } = useModal()
  
  // Set TMDB API key in modal context
  useEffect(() => {
    setTmdbApiKey(tmdbApiKey)
  }, [tmdbApiKey, setTmdbApiKey])

  // Log rankings data for debugging
  useEffect(() => {
    console.log('📊 ContentSection rankings received:', {
      movieRanking: movieRanking.length,
      tvShowRanking: tvShowRanking.length,
      bookRanking: bookRanking.length,
      movieRankingSample: movieRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score })),
      tvShowRankingSample: tvShowRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score })),
      bookRankingSample: bookRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score }))
    });
  }, [movieRanking, tvShowRanking, bookRanking]);
  
  // Use external state if provided, otherwise use internal state
  const [internalActiveSection, setInternalActiveSection] = useState<Section>("movies")
  const activeSection = externalActiveSection ?? internalActiveSection
  const setActiveSection = useCallback((section: Section) => {
    if (externalActiveSection !== undefined) {
      // If external state is provided, don't update internal state
      return
    }
    setInternalActiveSection(section)
  }, [externalActiveSection])

  const [isInitialized, setIsInitialized] = useState(false)

  // Use external search state if provided, otherwise use internal state
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const [internalSearchResults, setInternalSearchResults] = useState<MediaItem[]>([])
  const searchQuery = externalSearchQuery ?? internalSearchQuery
  const searchResults = externalSearchResults ?? internalSearchResults

  const setSearchQuery = useCallback((query: string) => {
    if (externalSearchQuery !== undefined && onSearchChange) {
      // If external state is provided, notify parent
      onSearchChange(query, searchResults)
      return
    }
    setInternalSearchQuery(query)
  }, [externalSearchQuery, onSearchChange])

  const setSearchResults = useCallback((results: MediaItem[]) => {
    if (externalSearchQuery !== undefined && onSearchChange) {
      // If external state is provided, notify parent
      onSearchChange(searchQuery, results)
      return
    }
    setInternalSearchResults(results)
  }, [externalSearchQuery, onSearchChange])

  const [isSearching, setIsSearching] = useState(false)
  const [displayCounts, setDisplayCounts] = useState({
    movies: 20,
    tvshows: 20,
    books: 20
  })

  // Note: We start with 40 items in cache but only display 20 initially
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingNextPage, setIsLoadingNextPage] = useState(false)
  const [isPrefetching, setIsPrefetching] = useState<{[key in Section]: boolean}>({
    movies: false,
    tvshows: false,
    books: false
  })
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Progressive loading state - now tracks ranking position instead of Redis keys
  const [currentRankingPosition, setCurrentRankingPosition] = useState(redisKeysFetched)
  const [allMediaData, setAllMediaData] = useState({
    movies: initialMovies,
    tvshows: initialTVShows,
    books: initialBooks
  })
  
  // Function to prefetch next batch in background (no loading states)
  const prefetchNextBatch = useCallback(async (mediaType: Section) => {
    if (isLoadingNextPage || searchQuery || isPrefetching[mediaType]) {
      return;
    }

    const currentDataCount = allMediaData[mediaType].length;
    const startIndex = currentDataCount;
    const endIndex = startIndex + 9; // Prefetch next 10 items

    console.log(`🔄 Background prefetch: ${mediaType} IDs from ranking range: ${startIndex}-${endIndex}`);

    // Set prefetching flag
    setIsPrefetching(prev => ({ ...prev, [mediaType]: true }));

    try {
      // Step 1: Get the next batch of IDs from the ranking
      const rankingResponse = await fetch(`/api/redisHandler?type=ranking-range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`);

      if (!rankingResponse.ok) {
        console.error(`❌ Prefetch failed to fetch ranking range for ${mediaType}`);
        return;
      }

      const rankingData = await rankingResponse.json();

      if (!rankingData.success || !rankingData.ids || rankingData.ids.length === 0) {
        console.log(`✅ No more ${mediaType} items available for prefetch`);
        setCurrentRankingPosition(prev => ({
          ...prev,
          [mediaType]: 999
        }));
        return;
      }

      const ids = rankingData.ids;

      // Step 2: Fetch the actual items by IDs
      const idsString = ids.join(',');
      const singularMediaType = mediaType === 'movies' ? 'movie' :
                               mediaType === 'tvshows' ? 'tvshow' :
                               mediaType === 'books' ? 'book' : mediaType;

      const itemsResponse = await fetch(`/api/redisHandler?type=fetch-by-ids&mediaType=${singularMediaType}&ids=${idsString}`);

      if (!itemsResponse.ok) {
        console.error(`❌ Prefetch failed to fetch ${mediaType} items by IDs`);
        return;
      }

      const itemsData = await itemsResponse.json();

      if (itemsData.success && itemsData.items && itemsData.items.length > 0) {
        const newItems = itemsData.items;
        console.log(`✅ Prefetch successful: ${newItems.length} new ${mediaType} items loaded in background`);

        // Update data state (but don't update display count)
        setAllMediaData(prev => ({
          ...prev,
          [mediaType]: [...prev[mediaType], ...newItems]
        }));

        // Update the ranking position counter
        setCurrentRankingPosition(prev => ({
          ...prev,
          [mediaType]: endIndex + 1
        }));

      } else {
        console.log(`⚠️ Prefetch: No ${mediaType} items found for requested IDs`);
        setCurrentRankingPosition(prev => ({
          ...prev,
          [mediaType]: 999
        }));
      }
    } catch (error) {
      console.error(`❌ Error in prefetch for ${mediaType}:`, error);
      setCurrentRankingPosition(prev => ({
        ...prev,
        [mediaType]: 999
      }));
    } finally {
      // Reset prefetching flag
      setIsPrefetching(prev => ({ ...prev, [mediaType]: false }));
    }
  }, [isLoadingNextPage, searchQuery, allMediaData, currentRankingPosition, displayCounts, isPrefetching]);

  // Function to fetch next batch using ranking system (with loading states)
  const fetchNextBatch = useCallback(async (mediaType: Section) => {
    if (isLoadingNextPage || searchQuery || isPrefetching[mediaType]) {
      return;
    }

    const currentDataCount = allMediaData[mediaType].length;
    const startIndex = currentDataCount;
    const endIndex = startIndex + 9; // Fetch next 10 items (0-indexed, so 9 is the 10th item)

    setIsLoadingNextPage(true);

    try {
      // Step 1: Get the next batch of IDs from the ranking
      console.log(`📊 Fetching ${mediaType} IDs from ranking range: ${startIndex}-${endIndex}`);
      const rankingResponse = await fetch(`/api/redisHandler?type=ranking-range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`);

      if (!rankingResponse.ok) {
        console.error(`❌ Failed to fetch ranking range for ${mediaType}`);
        return;
      }

      const rankingData = await rankingResponse.json();

      if (!rankingData.success || !rankingData.ids || rankingData.ids.length === 0) {
        console.log(`✅ No more ${mediaType} items available in ranking (fetched ${currentDataCount} total)`);
        // Mark as end by setting a high number
        setCurrentRankingPosition(prev => ({
          ...prev,
          [mediaType]: 999 // High number to indicate end reached
        }));
        return;
      }

      const ids = rankingData.ids;
      console.log(`📊 Got ${ids.length} ${mediaType} IDs from ranking`);

      // Step 2: Fetch the actual items by IDs
      const idsString = ids.join(',');
      // Convert plural to singular for Redis key format
      const singularMediaType = mediaType === 'movies' ? 'movie' :
                               mediaType === 'tvshows' ? 'tvshow' :
                               mediaType === 'books' ? 'book' : mediaType;
      console.log(`🎬 Fetching ${ids.length} ${mediaType} items by IDs`);
      const itemsResponse = await fetch(`/api/redisHandler?type=fetch-by-ids&mediaType=${singularMediaType}&ids=${idsString}`);

      if (!itemsResponse.ok) {
        console.error(`❌ Failed to fetch ${mediaType} items by IDs`);
        return;
      }

      const itemsData = await itemsResponse.json();

      if (itemsData.success && itemsData.items && itemsData.items.length > 0) {
        const newItems = itemsData.items;
        console.log(`✅ Successfully fetched ${newItems.length} new ${mediaType} items`);

        // Update all states in the correct order
        setAllMediaData(prev => {
          const updatedData = {
            ...prev,
            [mediaType]: [...prev[mediaType], ...newItems]
          };
          return updatedData;
        });

        // Update the ranking position counter
        setCurrentRankingPosition(prev => {
          const updatedPosition = {
            ...prev,
            [mediaType]: endIndex + 1 // Next start position
          };
          return updatedPosition;
        });

        // Update display count to show the new items
        setDisplayCounts(prev => {
          const newCount = prev[mediaType] + 10;
          return {
            ...prev,
            [mediaType]: newCount
          };
        });

      } else {
        console.log(`⚠️ No ${mediaType} items found for the requested IDs`);
        // Mark as end
        setCurrentRankingPosition(prev => ({
          ...prev,
          [mediaType]: 999
        }));
      }
    } catch (error) {
      console.error(`❌ Error fetching next ${mediaType} batch:`, error);
      // On error, mark as end to prevent infinite retries
      setCurrentRankingPosition(prev => ({
        ...prev,
        [mediaType]: 999
      }));
    } finally {
      setIsLoadingNextPage(false);
    }
  }, [isLoadingNextPage, searchQuery, allMediaData, currentRankingPosition, displayCounts, isPrefetching]);

  // Handle infinite scroll with progressive loading and prefetching
  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingNextPage || searchQuery || isPrefetching[activeSection]) {
      return;
    }

    const currentData = allMediaData[activeSection];
    const currentDisplayCount = displayCounts[activeSection];
    const loadedCount = currentData.length;

    // Check if we need to fetch the next batch from ranking (when we've displayed all loaded items)
    if (currentDisplayCount >= loadedCount) {
      // Check if we've reached the end of the ranking (marked by high number)
      if (currentRankingPosition[activeSection] >= 999) {
        console.log(`✅ Reached end of ${activeSection} ranking`);
        return;
      }

      fetchNextBatch(activeSection);
      return;
    }

    // Load 10 more items from current data
    setIsLoading(true);

    setTimeout(() => {
      const newDisplayCount = currentDisplayCount + 10;
      setDisplayCounts(prev => ({
        ...prev,
        [activeSection]: newDisplayCount
      }));
      setIsLoading(false);

      // Trigger prefetch when we're about to show the last portion of current cache
      // For the initial 40 items: prefetch when showing 21-30 items (so 41-50 is ready when we reach 31-40)
      // For subsequent batches: prefetch when we're 10 items from the end of loaded data
      const prefetchThreshold = loadedCount <= 40 ? 30 : loadedCount - 10;
      const shouldPrefetch = newDisplayCount >= prefetchThreshold && currentRankingPosition[activeSection] < 999;

      if (shouldPrefetch) {
        console.log(`🔄 Prefetch triggered: displaying ${newDisplayCount}/${loadedCount} items, prefetching next 10 items`);
        prefetchNextBatch(activeSection);
      }
    }, 0);
  }, [isLoading, isLoadingNextPage, searchQuery, activeSection, allMediaData, displayCounts, currentRankingPosition, fetchNextBatch, prefetchNextBatch, isPrefetching]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    // Only set up observer when not searching and component is initialized
    if (searchQuery || !isInitialized) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        
        if (entries[0].isIntersecting && !isLoading && !isLoadingNextPage) {
          loadMore();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // Start loading 100px before reaching the trigger
      }
    );

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (loadMoreRef.current) {
        observer.observe(loadMoreRef.current);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [activeSection, isLoading, isLoadingNextPage, searchQuery, isInitialized, displayCounts, allMediaData, loadMore]);

  useEffect(() => {
    // Only handle hash changes if we're not using external state management
    if (externalActiveSection === undefined) {
      // Check initial hash
      const hash = window.location.hash.slice(1) as Section
      if (hash && ["movies", "tvshows", "books"].includes(hash)) {
        setActiveSection(hash)
      }

      // Listen for hash changes
      const handleHashChange = () => {
        const newHash = window.location.hash.slice(1) as Section
        if (newHash && ["movies", "tvshows", "books"].includes(newHash)) {
          setActiveSection(newHash)
          setSearchQuery("")
          setSearchResults([])
        }
      }

      window.addEventListener("hashchange", handleHashChange)
      return () => window.removeEventListener("hashchange", handleHashChange)
    } else {
      // Mark as initialized when using external state
      setIsInitialized(true)
    }
  }, [externalActiveSection])

  // Scroll to top when switching sections
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    })
  }, [activeSection])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    clearTimeout(debounceTimeout.current!)

    debounceTimeout.current = setTimeout(async () => {
      try {
        let results: MediaItem[] = []

        if (activeSection === "movies") {
          const movieResults = await searchContentByTitle({
            title: searchQuery,
            tmdbApiKey,
            type: "movie"
          })
          results = movieResults.map((movie: Movie) => ({ ...movie, type: "movie" as const }))
        } else if (activeSection === "tvshows") {
          const tvResults = await searchContentByTitle({
            title: searchQuery,
            tmdbApiKey,
            type: "tv"
          })
          results = tvResults.map((tv: TVShow) => ({ ...tv, type: "tvshow" as const }))
        } else if (activeSection === "books") {
          const bookResults = await searchBooksByTitle(searchQuery, googleBooksApiKey)
          results = bookResults.map((book: Book) => ({ ...book, type: "book" as const }))
        }

        setSearchResults(results)
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimeout.current!)
  }, [searchQuery, activeSection, tmdbApiKey, googleBooksApiKey])

  const getCurrentData = (): MediaItem[] => {
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults
    }

    const staticData = searchQuery.trim() ? [] : (() => {
      const currentDisplayCount = displayCounts[activeSection];
      switch (activeSection) {
        case "movies":
          return allMediaData.movies.slice(0, currentDisplayCount).map(movie => ({ ...movie, type: "movie" as const }))
        case "tvshows":
          return allMediaData.tvshows.slice(0, currentDisplayCount).map(tv => ({ ...tv, type: "tvshow" as const }))
        case "books":
          return allMediaData.books.slice(0, currentDisplayCount).map(book => ({ ...book, type: "book" as const }))
        default:
          return allMediaData.movies.slice(0, currentDisplayCount).map(movie => ({ ...movie, type: "movie" as const }))
      }
    })()

    return staticData
  }

  const filteredData = getCurrentData()

  const getSectionTitle = () => {
    switch (activeSection) {
      case "movies":
        return "Movies"
      case "tvshows":
        return "TV Shows"
      case "books":
        return "Books"
      default:
        return "Movies"
    }
  }


  
  // Don't render until hash is processed to prevent flash
  // Also wait for external active section if using external state management
  if (!isInitialized || (externalActiveSection !== undefined && activeSection === undefined)) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          {/* Search Bar */}
          <div className="mx-4 sm:mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
            <form onSubmit={(e) => {
              e.preventDefault();
              // Keep the search query when Enter is pressed
              // The search is already handled by onChange, so we just prevent form submission
            }}>
              <div className="relative">
                <svg 
                  className="w-5 h-5 text-muted-foreground absolute top-3.5 left-4 theme-text-gray-300" 
                  fill="currentColor" 
                  viewBox="0 0 18 18"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Keep the search query when Enter is pressed
                    }
                  }}
                  className="h-12 w-full px-12 rounded-lg focus:outline-none hover:cursor-pointer border-2 border-primary bg-white dark:bg-surface shadow-xl"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setSearchResults([])
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:cursor-pointer transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={index}>
              {/* Image Skeleton */}
              <div className="aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-400 dark:to-gray-500 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 sm:mb-12">
        {/* Search Bar */}
        <div className="mx-4 sm:mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
          <form onSubmit={(e) => {
            e.preventDefault();
            // Keep the search query when Enter is pressed
            // The search is already handled by onChange, so we just prevent form submission
          }}>
            <div className="relative">
              <svg 
                className="w-5 h-5 text-muted-foreground absolute top-3.5 left-4 theme-text-gray-300" 
                fill="currentColor" 
                viewBox="0 0 18 18"
              >
                <path 
                  fillRule="evenodd" 
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Keep the search query when Enter is pressed
                  }
                }}
                className="h-12 w-full px-12 rounded-lg focus:outline-none hover:cursor-pointer border-2 border-primary bg-white dark:bg-surface shadow-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setSearchResults([])
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Previous Implementation (Commented Out) */}
      {/*
        <div className="mb-8 sm:mb-12">
          <div className="text-center max-w-4xl mx-auto mb-6 sm:mb-8">
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className={cn(
                "flex items-center bg-surface-elevated/50 backdrop-blur-sm rounded-2xl p-2 border border-border/30 shadow-lg transition-all duration-500 ease-in-out",
                isSearchExpanded ? "w-full max-w-3xl" : "space-x-2 sm:space-x-3"
              )}>
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  const isThisItemExpanded = isActive && isSearchExpanded
                  
                  if (isThisItemExpanded) {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center space-x-3 bg-surface-elevated rounded-xl px-4 py-4 transition-all duration-500 ease-in-out w-full shadow-lg"
                      >
                        <button
                          onClick={() => handleSectionClick(item.id)}
                          className="flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-110 p-1 rounded-lg hover:bg-surface/80 text-primary"
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                        <div className="flex-1 relative min-w-0">
                          <input
                            type="text"
                            placeholder={`Search ${item.label.toLowerCase()}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 text-base bg-transparent rounded-lg focus:outline-none focus:ring-0 transition-all duration-300 placeholder:text-muted-foreground text-foreground"
                            autoFocus
                          />
                          {searchQuery && (
                            <button
                              onClick={() => {
                                setSearchQuery("")
                                setSearchResults([])
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSectionClick(item.id)}
                      className={cn(
                        "flex items-center rounded-xl transition-all duration-300 relative",
                        isSearchExpanded
                          ? "px-3 py-3 lg:py-2.5"
                          : "space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-3.5 lg:py-3",
                        "text-sm sm:text-base font-semibold",
                        isActive
                          ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105"
                          : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground hover:scale-102"
                      )}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      {!isSearchExpanded && <span>{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      */}

      {/* Grid - Always 2 columns on small screens */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
        {(() => {
          const originalCount = filteredData.length;
          const validItems = filteredData.filter((item) => {
            // Filter out invalid items before rendering
            if (!item || !item.type) return false;
            
            // Additional validation for books
            if (item.type === 'book') {
              if (!item.volumeInfo) return false;
              // Ensure we have at least a title or authors
              const hasDisplayableContent = item.volumeInfo.title || 
                (item.volumeInfo.authors && item.volumeInfo.authors.length > 0);
              return hasDisplayableContent;
            }
            
            return true;
          });
          
          const filteredCount = originalCount - validItems.length;
          if (filteredCount > 0 && process.env.NODE_ENV === 'development') {
            console.log(`🔍 Filtered out ${filteredCount} invalid items from ${originalCount} total items`);
          }
          
          return validItems;
        })()
          .map((item, index) => {
            // Calculate animation delay based on position in current page, not total index
            // Only animate the first 20 items initially, and new items when loaded
            const currentDisplayCount = displayCounts[activeSection];
            const previousDisplayCount = currentDisplayCount - 20;
            const isNewlyLoaded = index >= previousDisplayCount;
            const animationIndex = isNewlyLoaded ? (index - previousDisplayCount) : index;
            const shouldAnimate = index < 20 || isNewlyLoaded;
            
            return (
              <div
                key={`${item.type}-${item.id}-${index}`}
                className={shouldAnimate ? "animate-in fade-in slide-in-from-bottom-4" : ""}
                style={shouldAnimate ? { 
                  animationDelay: `${Math.min(animationIndex * 50, 1000)}ms`, 
                  animationFillMode: 'both' 
                } : {}}
              >
                <MediaCard item={item} />
              </div>
            )
          })}
      </div>

      {/* Search Loading Skeleton */}
      {isSearching && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={`search-skeleton-${index}`}>
              {/* Image Skeleton */}
              <div className="aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-400 dark:to-gray-500 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      )}

      {/* Progressive Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}


      {/* Infinite Scroll Trigger */}
      {!searchQuery && (() => {
        const totalItems = allMediaData[activeSection].length;
        const currentDisplayCount = displayCounts[activeSection];
        const hasReachedEndOfRanking = currentRankingPosition[activeSection] >= 999;

        // Show trigger if we haven't displayed all current items or haven't reached end of ranking
        const shouldShowTrigger = currentDisplayCount < totalItems ||
                                (currentDisplayCount >= totalItems && !hasReachedEndOfRanking);

        return shouldShowTrigger && (
          <div
            ref={loadMoreRef}
            className="h-10 w-full mt-8"
            aria-hidden="true"
          />
        )
      })()}

      {/* Empty State */}
      {filteredData.length === 0 && searchQuery && !isSearching && (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20">
          <div className="text-center max-w-md px-4">
            <div className="mb-6 relative">
              <div className="h-20 w-20 sm:h-24 sm:w-24 mx-auto rounded-full bg-surface-elevated/50 flex items-center justify-center">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                  <span className="text-muted-foreground/50 text-lg">🔍</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-r from-primary/20 to-primary-hover/20 animate-pulse" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">No results found</h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
              We couldn&apos;t find any {getSectionTitle().toLowerCase()} matching &quot;{searchQuery}&quot;. 
              Try different keywords or browse our collection.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-white rounded-lg sm:rounded-xl hover:bg-primary-hover transition-colors duration-300 font-medium text-sm sm:text-base"
            >
              Clear Search
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
