"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { MediaCard, MediaItem, Movie, Series, Book } from "./media-card"
import {
  searchContentByTitle,
  searchBooksByTitle,
  searchPeople,
  fetchPersonCredits,
  discoverByGenre,
  type PersonSearchResult,
} from "@/lib/api-helpers"
import {
  matchesSearchGenres,
  matchesSearchEras,
  matchesSearchRating,
  sortSearchItems,
  computeAvailableSearchGenres,
  computeAvailableSearchEras,
  DEFAULT_SEARCH_SORT_FIELD,
  DEFAULT_SEARCH_SORT_DIR,
  type SearchSortField,
  type SearchSortDir,
} from "@/lib/search-filters"
import { SearchFilterBar } from "./search-filter-bar"
import { PopularGenrePills } from "./popular-genre-pills"
import { PersonChipRow } from "./person-chip-row"
import { useSlashFocus } from "@/hooks/use-slash-focus"
import { ScrollToTopButton } from "./scroll-to-top-button"

type Section = "movies" | "series" | "books"

// Memoized so that typing in the search bar (which re-renders ContentSection on
// every keystroke, before the debounced fetch even runs) doesn't also re-render
// the whole media grid - only actual item/list changes do.
const MediaGrid = React.memo(function MediaGrid({
  items,
  activeSection,
  displayCounts,
}: {
  items: MediaItem[]
  activeSection: Section
  displayCounts: { movies: number; series: number; books: number }
}) {
  const originalCount = items.length
  const validItems = items.filter((item) => {
    // Filter out invalid items before rendering
    if (!item || !item.type) return false

    // Additional validation for books
    if (item.type === 'book') {
      if (!item.volumeInfo) return false
      // Ensure we have at least a title or authors
      const hasDisplayableContent = item.volumeInfo.title ||
        (item.volumeInfo.authors && item.volumeInfo.authors.length > 0)
      return hasDisplayableContent
    }

    return true
  })

  const filteredCount = originalCount - validItems.length
  if (filteredCount > 0 && process.env.NODE_ENV === 'development') {
    console.log(`🔍 Filtered out ${filteredCount} invalid items from ${originalCount} total items`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
      {validItems.map((item, index) => {
        // Calculate animation delay based on position in current page, not total index
        // Only animate the initial 40 items, and new items when loaded (20 at a time after that)
        const currentDisplayCount = displayCounts[activeSection]
        const previousDisplayCount = currentDisplayCount <= 40 ? 0 : currentDisplayCount - 20
        const isNewlyLoaded = index >= previousDisplayCount
        const animationIndex = isNewlyLoaded ? (index - previousDisplayCount) : index
        const shouldAnimate = index < 40 || isNewlyLoaded

        return (
          <div
            key={`${item.type}-${item.id}-${index}`}
            className={shouldAnimate ? "animate-in fade-in slide-in-from-bottom-4" : ""}
            style={shouldAnimate ? {
              animationDelay: `${Math.min(animationIndex * 50, 100)}ms`,
              animationFillMode: 'both'
            } : {}}
          >
            <MediaCard
              item={item}
              priority={index < 6}
              loading={index < 6 ? "eager" : "lazy"}
            />
          </div>
        )
      })}
    </div>
  )
})

// TMDB discover/credits responses are raw movie- or tv-shaped objects with no
// `type` discriminator (unlike the app's own Movie/Series). Casting through a
// union (Movie | Series) and branching on it directly confuses the type
// checker - branching on the raw items first, per media type, keeps each
// branch's cast unambiguous.
function mapToMediaItems(items: unknown[], mediaType: "movie" | "tv"): MediaItem[] {
  if (mediaType === "movie") {
    return (items as Omit<Movie, "type">[]).map((item) => ({ ...item, type: "movie" as const }))
  }
  return (items as Omit<Series, "type">[]).map((item) => ({ ...item, type: "series" as const }))
}

interface ContentSectionProps {
  initialMovies: Movie[]
  initialSeries: Series[]
  initialBooks: Book[]
  movieRanking?: Array<{value: string, score: number}>
  seriesRanking?: Array<{value: string, score: number}>
  bookRanking?: Array<{value: string, score: number}>
  googleBooksApiKey: string
  // Progressive loading props
  redisKeysFetched?: {
    movies: number
    series: number
    books: number
  }
  // External state management props
  externalActiveSection?: Section
  externalSearchQuery?: string
  externalSearchResults?: MediaItem[]
  // Split in two so a debounced results callback can never stomp the query the
  // user is actively typing - see the note on setSearchResults below.
  onQueryChange?: (query: string) => void
  onResultsChange?: (results: MediaItem[]) => void
}

export function ContentSection({
  initialMovies,
  initialSeries,
  initialBooks,
  movieRanking = [],
  seriesRanking = [],
  bookRanking = [],
  googleBooksApiKey,
  redisKeysFetched = { movies: 1, series: 1, books: 1 },
  externalActiveSection,
  externalSearchQuery,
  externalSearchResults,
  onQueryChange,
  onResultsChange
}: ContentSectionProps) {
  // Log rankings data for debugging
  useEffect(() => {
    console.log('📊 ContentSection rankings received:', {
      movieRanking: movieRanking.length,
      seriesRanking: seriesRanking.length,
      bookRanking: bookRanking.length,
      movieRankingSample: movieRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score })),
      seriesRankingSample: seriesRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score })),
      bookRankingSample: bookRanking.slice(0, 3).map(r => ({ id: r.value, rank: r.score }))
    });
  }, [movieRanking, seriesRanking, bookRanking]);
  
  // Use external state if provided, otherwise use internal state
  const [internalActiveSection, setInternalActiveSection] = useState<Section>("movies")
  const activeSection = externalActiveSection ?? internalActiveSection

  const [isInitialized, setIsInitialized] = useState(false)

  // Use external search state if provided, otherwise use internal state
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const [internalSearchResults, setInternalSearchResults] = useState<MediaItem[]>([])
  const searchQuery = externalSearchQuery ?? internalSearchQuery
  const searchResults = externalSearchResults ?? internalSearchResults

  // Deliberately does NOT also report results here (see setSearchResults below) -
  // conflating the two in one callback used to let a slow, stale debounced fetch
  // stomp the query the user is actively typing (see the request-guard note further
  // down for the full race condition this fixes).
  const setSearchQuery = useCallback((query: string) => {
    if (externalSearchQuery !== undefined && onQueryChange) {
      if (query !== externalSearchQuery) {
        onQueryChange(query)
      }
      return
    }
    setInternalSearchQuery(query)
  }, [externalSearchQuery, onQueryChange])

  const setSearchResults = useCallback((results: MediaItem[]) => {
    if (externalSearchQuery !== undefined && onResultsChange) {
      // If external state is provided, notify parent only if results are different
      // Compare length and first few items to avoid deep comparison
      const currentResults = externalSearchResults ?? []
      const isDifferent = currentResults.length !== results.length ||
        (results.length > 0 && currentResults.length > 0 && currentResults[0]?.id !== results[0]?.id)

      if (isDifferent) {
        onResultsChange(results)
      }
      return
    }
    setInternalSearchResults(results)
  }, [externalSearchQuery, onResultsChange, externalSearchResults])

  const [isSearching, setIsSearching] = useState(false)
  const [displayCounts, setDisplayCounts] = useState({
    movies: 40,
    series: 40,
    books: 40
  })

  // Search result filter/sort (genre/era/min rating + sort field/direction) -
  // applied client-side on top of whatever the title search (or a selected
  // person's filmography) already returned. See lib/search-filters.ts.
  const [selectedSearchGenres, setSelectedSearchGenres] = useState<Set<string>>(new Set())
  const [selectedSearchEras, setSelectedSearchEras] = useState<Set<number>>(new Set())
  const [minSearchRating, setMinSearchRating] = useState(0)
  const [searchSortField, setSearchSortField] = useState<SearchSortField>(DEFAULT_SEARCH_SORT_FIELD)
  const [searchSortDir, setSearchSortDir] = useState<SearchSortDir>(DEFAULT_SEARCH_SORT_DIR)

  // Popular genre pills (movies/series only) - selecting a genre switches the
  // grid from the Redis-cached Popular list to a live, paginated TMDB
  // discover call (see app/api/tmdb/discover/route.ts) instead of filtering
  // whatever happens to already be cached.
  const [popularGenreIds, setPopularGenreIds] = useState<Set<number>>(new Set())
  const [discoverResults, setDiscoverResults] = useState<MediaItem[]>([])
  const [discoverPage, setDiscoverPage] = useState(1)
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1)
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false)

  // Actor/director search (movies/series only) - a parallel, separately
  // debounced person-name search alongside the title search above. Selecting
  // a person switches the grid to their filmography (personCredits) until
  // cleared - see the effects further down.
  const [personResults, setPersonResults] = useState<PersonSearchResult[]>([])
  const [activePerson, setActivePerson] = useState<PersonSearchResult | null>(null)
  const [personCredits, setPersonCredits] = useState<MediaItem[]>([])
  const [isLoadingCredits, setIsLoadingCredits] = useState(false)
  const personDebounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const personRequestId = useRef(0)

  // Reset every bit of new filter/browse/person state on a section switch,
  // mirroring the existing hash-change handler's reset of searchQuery/searchResults.
  useEffect(() => {
    setSelectedSearchGenres(new Set())
    setSelectedSearchEras(new Set())
    setMinSearchRating(0)
    setSearchSortField(DEFAULT_SEARCH_SORT_FIELD)
    setSearchSortDir(DEFAULT_SEARCH_SORT_DIR)
    setPopularGenreIds(new Set())
    setDiscoverResults([])
    setDiscoverPage(1)
    setDiscoverTotalPages(1)
    setPersonResults([])
    setActivePerson(null)
    setPersonCredits([])
  }, [activeSection])

  // Clearing the search box exits "viewing a person's filmography" mode, same
  // as clicking the chip's own × (components/person-chip-row.tsx).
  useEffect(() => {
    if (!searchQuery.trim() && activePerson) {
      setActivePerson(null)
      setPersonCredits([])
    }
  }, [searchQuery, activePerson])

  // Actor/director search - parallel to the title search below, movies/series
  // only. Suppressed while a person is already selected (see the effect above
  // for how that gets exited) so typing doesn't fight with the pinned view.
  useEffect(() => {
    if (activeSection === "books" || !searchQuery.trim() || activePerson) {
      setPersonResults([])
      return
    }

    clearTimeout(personDebounceTimeout.current!)
    personRequestId.current += 1
    const requestId = personRequestId.current

    personDebounceTimeout.current = setTimeout(async () => {
      const people = await searchPeople(searchQuery)
      if (requestId !== personRequestId.current) return
      setPersonResults(people)
    }, 300)

    return () => clearTimeout(personDebounceTimeout.current!)
  }, [searchQuery, activeSection, activePerson])

  const handleSelectPerson = useCallback(async (person: PersonSearchResult) => {
    setActivePerson(person)
    setPersonResults([])
    setIsLoadingCredits(true)

    const mediaType = activeSection === "movies" ? "movie" : "tv"
    const credits = await fetchPersonCredits(person.id, mediaType)
    setPersonCredits(mapToMediaItems(credits, mediaType))
    setIsLoadingCredits(false)
  }, [activeSection])

  const handleClearPerson = useCallback(() => {
    setActivePerson(null)
    setPersonCredits([])
  }, [])

  // Live "Popular by genre" - fetches page 1 fresh whenever the selected
  // genres or active section change, replacing the Redis-cached Popular data
  // entirely while any genre is selected.
  useEffect(() => {
    if (searchQuery.trim() || popularGenreIds.size === 0 || activeSection === "books") {
      return
    }

    let cancelled = false
    setIsDiscoverLoading(true)
    const mediaType = activeSection === "movies" ? "movie" : "tv"

    discoverByGenre(mediaType, Array.from(popularGenreIds), 1).then(({ results, totalPages }) => {
      if (cancelled) return
      setDiscoverResults(mapToMediaItems(results, mediaType))
      setDiscoverPage(1)
      setDiscoverTotalPages(totalPages)
      setIsDiscoverLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [popularGenreIds, activeSection, searchQuery])

  const loadMoreDiscover = useCallback(async () => {
    if (isDiscoverLoading || discoverPage >= discoverTotalPages) return

    setIsDiscoverLoading(true)
    const mediaType = activeSection === "movies" ? "movie" : "tv"
    const nextPage = discoverPage + 1
    const { results, totalPages } = await discoverByGenre(mediaType, Array.from(popularGenreIds), nextPage)
    setDiscoverResults((prev) => [...prev, ...mapToMediaItems(results, mediaType)])
    setDiscoverPage(nextPage)
    setDiscoverTotalPages(totalPages)
    setIsDiscoverLoading(false)
  }, [isDiscoverLoading, discoverPage, discoverTotalPages, activeSection, popularGenreIds])

  const isBrowsingByGenre = !searchQuery.trim() && popularGenreIds.size > 0 && activeSection !== "books"

  // We start with 40 items server-fetched and displayed initially; subsequent
  // scroll-triggered batches load 20 more at a time.
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingNextPage, setIsLoadingNextPage] = useState(false)
  const [isPrefetching, setIsPrefetching] = useState<{[key in Section]: boolean}>({
    movies: false,
    series: false,
    books: false
  })
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestId = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(searchInputRef)
  
  // Progressive loading state - now tracks ranking position instead of Redis keys
  const [currentRankingPosition, setCurrentRankingPosition] = useState(redisKeysFetched)
  const [allMediaData, setAllMediaData] = useState({
    movies: initialMovies,
    series: initialSeries,
    books: initialBooks
  })
  
  // Function to prefetch next batch in background (no loading states)
  const prefetchNextBatch = useCallback(async (mediaType: Section) => {
    if (isLoadingNextPage || searchQuery || isPrefetching[mediaType]) {
      return;
    }

    const currentDataCount = allMediaData[mediaType].length;
    const startIndex = currentDataCount;
    const endIndex = startIndex + 19; // Prefetch next 20 items

    console.log(`🔄 Background prefetch: ${mediaType} cards range: ${startIndex}-${endIndex}`);

    // Set prefetching flag
    setIsPrefetching(prev => ({ ...prev, [mediaType]: true }));

    try {
      const cardsResponse = await fetch(
        `/api/redisHandler?type=range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`
      );

      if (!cardsResponse.ok) {
        console.error(`❌ Prefetch failed to fetch cards for ${mediaType}`);
        return;
      }

      const cardsData = await cardsResponse.json();

      if (cardsData.success && Array.isArray(cardsData.items) && cardsData.items.length > 0) {
        const newItems = cardsData.items;
        console.log(`✅ Prefetch successful: ${newItems.length} new ${mediaType} cards loaded in background`);

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
        console.log(`✅ No more ${mediaType} items available for prefetch`);
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
  }, [isLoadingNextPage, searchQuery, allMediaData, isPrefetching]);

  // Function to fetch next batch using ranking system (with loading states)
  const fetchNextBatch = useCallback(async (mediaType: Section) => {
    if (isLoadingNextPage || searchQuery || isPrefetching[mediaType]) {
      return;
    }

    const currentDataCount = allMediaData[mediaType].length;
    const startIndex = currentDataCount;
    const endIndex = startIndex + 19; // Fetch next 20 items (0-indexed, so 19 is the 20th item)

    setIsLoadingNextPage(true);

    try {
      console.log(`📦 Fetching ${mediaType} cards range: ${startIndex}-${endIndex}`);
      const cardsResponse = await fetch(
        `/api/redisHandler?type=range&mediaType=${mediaType}&start=${startIndex}&end=${endIndex}`
      );

      if (!cardsResponse.ok) {
        console.error(`❌ Failed to fetch cards for ${mediaType}`);
        return;
      }

      const cardsData = await cardsResponse.json();

      if (cardsData.success && Array.isArray(cardsData.items) && cardsData.items.length > 0) {
        const newItems = cardsData.items;
        console.log(`✅ Successfully fetched ${newItems.length} new ${mediaType} cards`);

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
          const newCount = prev[mediaType] + 20;
          return {
            ...prev,
            [mediaType]: newCount
          };
        });

      } else {
        console.log(`✅ No more ${mediaType} items available in cards`);
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
  }, [isLoadingNextPage, searchQuery, allMediaData, isPrefetching]);

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

    // Load 20 more items from current data
    setIsLoading(true);

    setTimeout(() => {
      const newDisplayCount = currentDisplayCount + 20;
      setDisplayCounts(prev => ({
        ...prev,
        [activeSection]: newDisplayCount
      }));
      setIsLoading(false);

      // Trigger prefetch when we're about to show the last portion of current cache
      // For the initial 40 items: prefetch when showing 21-30 items (so 41-50 is ready when we reach 31-40)
      // For subsequent batches: prefetch when we're 20 items from the end of loaded data
      const prefetchThreshold = loadedCount <= 40 ? 30 : loadedCount - 20;
      const shouldPrefetch = newDisplayCount >= prefetchThreshold && currentRankingPosition[activeSection] < 999;

      if (shouldPrefetch) {
        console.log(`🔄 Prefetch triggered: displaying ${newDisplayCount}/${loadedCount} items, prefetching next 20 items`);
        prefetchNextBatch(activeSection);
      }
    }, 0);
  }, [isLoading, isLoadingNextPage, searchQuery, activeSection, allMediaData, displayCounts, currentRankingPosition, fetchNextBatch, prefetchNextBatch, isPrefetching]);

  // While browsing Popular by genre, infinite scroll pages through the live
  // discover results instead of the Redis-cached Popular list.
  const handleLoadMore = useCallback(() => {
    if (isBrowsingByGenre) {
      loadMoreDiscover();
    } else {
      loadMore();
    }
  }, [isBrowsingByGenre, loadMoreDiscover, loadMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    // Only set up observer when not searching and component is initialized
    if (searchQuery || !isInitialized) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {

        if (entries[0].isIntersecting && !isLoading && !isLoadingNextPage && !isDiscoverLoading) {
          handleLoadMore();
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
  }, [activeSection, isLoading, isLoadingNextPage, isDiscoverLoading, searchQuery, isInitialized, displayCounts, allMediaData, handleLoadMore]);

  useEffect(() => {
    // Only handle hash changes if we're not using external state management
    if (externalActiveSection === undefined) {
      // Check initial hash. "tvshows" was the URL hash before the Series rename -
      // keep resolving old bookmarks/links to the same section.
      const rawHash = window.location.hash.slice(1)
      const hash = (rawHash === "tvshows" ? "series" : rawHash) as Section
      if (hash && ["movies", "series", "books"].includes(hash)) {
        if (externalActiveSection === undefined) {
          setInternalActiveSection(hash)
        }
      }

      // Listen for hash changes
      const handleHashChange = () => {
        const rawNewHash = window.location.hash.slice(1)
        const newHash = (rawNewHash === "tvshows" ? "series" : rawNewHash) as Section
        if (newHash && ["movies", "series", "books"].includes(newHash)) {
          if (externalActiveSection === undefined) {
            setInternalActiveSection(newHash)
          }
          if (externalSearchQuery === undefined) {
            setInternalSearchQuery("")
            setInternalSearchResults([])
          }
        }
      }

      window.addEventListener("hashchange", handleHashChange)
      return () => window.removeEventListener("hashchange", handleHashChange)
    } else {
      // Mark as initialized when using external state
      setIsInitialized(true)
    }
  }, [externalActiveSection, externalSearchQuery])

  // Scroll to top when switching sections
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    })
  }, [activeSection])

  useEffect(() => {
    // While viewing a selected person's filmography, the search box stays
    // populated but shouldn't re-trigger a title search - see the
    // person-search/activePerson effects below for how that view is entered/exited.
    if (!searchQuery.trim() || activePerson) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    clearTimeout(debounceTimeout.current!)

    // Guards against out-of-order responses: if a slower earlier request resolves
    // after a newer one has already started, its results are discarded instead of
    // overwriting the fresher results on screen.
    searchRequestId.current += 1
    const requestId = searchRequestId.current

    debounceTimeout.current = setTimeout(async () => {
      try {
        let results: MediaItem[] = []

        if (activeSection === "movies") {
          const movieResults = await searchContentByTitle({
            title: searchQuery,
            type: "movie"
          })
          results = movieResults.map((movie: Movie) => ({ ...movie, type: "movie" as const }))
        } else if (activeSection === "series") {
          const tvResults = await searchContentByTitle({
            title: searchQuery,
            type: "tv"
          })
          results = tvResults.map((tv: Series) => ({ ...tv, type: "series" as const }))
        } else if (activeSection === "books") {
          const bookResults = await searchBooksByTitle(searchQuery, googleBooksApiKey)
          results = bookResults.map((book: Book) => ({ ...book, type: "book" as const }))
        }

        if (requestId !== searchRequestId.current) return
        setSearchResults(results)
      } catch (error) {
        console.error("Search error:", error)
        if (requestId === searchRequestId.current) setSearchResults([])
      } finally {
        if (requestId === searchRequestId.current) setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimeout.current!)
  }, [searchQuery, activeSection, googleBooksApiKey, activePerson, setSearchResults])

  const getCurrentData = (): MediaItem[] => {
    if (searchQuery.trim()) {
      return activePerson ? personCredits : searchResults
    }

    if (isBrowsingByGenre) {
      return discoverResults
    }

    const currentDisplayCount = displayCounts[activeSection];
    switch (activeSection) {
      case "movies":
        return allMediaData.movies.slice(0, currentDisplayCount).map(movie => ({ ...movie, type: "movie" as const }))
      case "series":
        return allMediaData.series.slice(0, currentDisplayCount).map(tv => ({ ...tv, type: "series" as const }))
      case "books":
        return allMediaData.books.slice(0, currentDisplayCount).map(book => ({ ...book, type: "book" as const }))
      default:
        return allMediaData.movies.slice(0, currentDisplayCount).map(movie => ({ ...movie, type: "movie" as const }))
    }
  }

  const searchBaseData = activePerson ? personCredits : searchResults
  const availableSearchGenres = computeAvailableSearchGenres(searchBaseData)
  const availableSearchEras = computeAvailableSearchEras(searchBaseData)

  const rawData = getCurrentData()
  const filteredData = searchQuery.trim()
    ? sortSearchItems(
        rawData.filter((item) =>
          matchesSearchGenres(item, selectedSearchGenres) &&
          matchesSearchEras(item, selectedSearchEras) &&
          matchesSearchRating(item, minSearchRating)
        ),
        searchSortField,
        searchSortDir,
      )
    : rawData

  const getSectionTitle = () => {
    switch (activeSection) {
      case "movies":
        return "Movies"
      case "series":
        return "Series"
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
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${activeSection}...`}
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
                {searchQuery ? (
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
                ) : (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded border border-border/50 bg-surface-elevated text-[10px] font-medium text-muted-foreground pointer-events-none">
                    /
                  </kbd>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Grid Skeleton */}
        
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 sm:pt-12 pt-8">
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
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${activeSection}...`}
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
              {searchQuery ? (
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
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded border border-border/50 bg-surface-elevated text-[12px] font-semibold text-muted-foreground pointer-events-none">
                  /
                </kbd>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Search filters/sort, actor/director search (movies/series), and
          Popular genre browsing - mutually exclusive with each other based on
          whether there's an active search query. */}
      <div className="mb-8 sm:mb-12">
        {searchQuery.trim() ? (
          <>
            {activeSection !== "books" && (
              <PersonChipRow
                people={personResults}
                activePerson={activePerson}
                onSelectPerson={handleSelectPerson}
                onClearPerson={handleClearPerson}
              />
            )}
            <SearchFilterBar
              isBook={activeSection === "books"}
              availableGenres={availableSearchGenres}
              selectedGenres={selectedSearchGenres}
              onGenresChange={setSelectedSearchGenres}
              availableEras={availableSearchEras}
              selectedEras={selectedSearchEras}
              onErasChange={setSelectedSearchEras}
              minRating={minSearchRating}
              onMinRatingChange={setMinSearchRating}
              sortField={searchSortField}
              onSortFieldChange={setSearchSortField}
              sortDir={searchSortDir}
              onSortDirChange={setSearchSortDir}
            />
          </>
        ) : (
          activeSection !== "books" && (
            <PopularGenrePills
              mediaType={activeSection === "movies" ? "movie" : "tv"}
              selectedGenreIds={popularGenreIds}
              onGenreIdsChange={setPopularGenreIds}
            />
          )
        )}
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
      <MediaGrid items={filteredData} activeSection={activeSection} displayCounts={displayCounts} />

      {/* Search Loading Skeleton */}
      {(isSearching || isLoadingCredits) && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={`search-skeleton-${index}`}>
              {/* Image Skeleton */}
              <div className="aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-400 dark:to-gray-500 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      )}

      {/* Next Page Loading Indicator */}
      {(isLoadingNextPage || isDiscoverLoading) && (
        <div className="flex items-center justify-center pt-8">
          <div className="loader"></div>
        </div>
      )}


      {/* Infinite Scroll Trigger */}
      {!searchQuery && (() => {
        if (isBrowsingByGenre) {
          return discoverPage < discoverTotalPages && (
            <div ref={loadMoreRef} className="h-10 w-full mt-8" aria-hidden="true" />
          )
        }

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
      {filteredData.length === 0 && !isSearching && !isLoadingCredits && !isDiscoverLoading && (searchQuery.trim() || isBrowsingByGenre) && (
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
              {searchQuery.trim() ? (
                <>We couldn&apos;t find any {getSectionTitle().toLowerCase()} matching &quot;{searchQuery}&quot;. Try different keywords, or loosen the filters above.</>
              ) : (
                <>No {getSectionTitle().toLowerCase()} matched that genre. Try a different genre or clear the filter.</>
              )}
            </p>
            <button
              onClick={() => (searchQuery.trim() ? setSearchQuery("") : setPopularGenreIds(new Set()))}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-white rounded-lg sm:rounded-xl hover:bg-primary-hover transition-colors duration-300 font-medium text-sm sm:text-base"
            >
              {searchQuery.trim() ? "Clear Search" : "Clear Genre Filter"}
            </button>
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  )
}
