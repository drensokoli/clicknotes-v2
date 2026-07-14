"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Shuffle as ShuffleIcon } from "lucide-react"
import { useSavedMedia, type MediaType, type SavedStatus } from "./saved-media-provider"
import { MediaCard, type MediaItem } from "./media-card"
import { ShuffleModal } from "./shuffle-modal"
import { UserProfile } from "./user-profile"
import { LibraryFilters } from "./library-filters"
import { useSlashFocus } from "@/hooks/use-slash-focus"
import { ScrollToTopButton } from "./scroll-to-top-button"
import {
  type SavedItem,
  type SortField,
  type SortDir,
  getTitle,
  computeAvailableGenres,
  computeAvailableEras,
  matchesGenres,
  matchesEras,
  matchesRating,
  matchesRuntime,
  sortItems,
  SORT_FIELD_OPTIONS,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIR,
  RUNTIME_MAX,
  PAGES_MAX,
} from "@/lib/library-filters"

interface SavedListProps {
  items: SavedItem[]
}

// Homepage sections are addressed via URL hash (see components/client-navigation.tsx),
// using the plural "series" hash rather than our singular MediaType value.
const HOMEPAGE_SECTION_HASH: Record<MediaType, string> = {
  movie: "movies",
  series: "series",
  book: "books",
}

const TYPE_VALUES: MediaType[] = ["movie", "series", "book"]

// URL-only slugs for the status filter, matching the visible tab labels (Saved /
// In Progress / Completed) rather than the internal SavedStatus values - the
// stored/DB values (to_watch/watching/watched) are unaffected.
const STATUS_TO_SLUG: Record<SavedStatus, string> = {
  to_watch: "saved",
  watching: "in_progress",
  watched: "completed",
}
const SLUG_TO_STATUS: Record<string, SavedStatus> = {
  saved: "to_watch",
  in_progress: "watching",
  completed: "watched",
}

export function SavedList({ items }: SavedListProps) {
  const { getStatus, isLoaded } = useSavedMedia()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<SavedStatus>(() => {
    const s = searchParams.get("status")
    return (s && SLUG_TO_STATUS[s]) || "to_watch"
  })
  const [typeFilter, setTypeFilter] = useState<MediaType>(() => {
    const t = searchParams.get("type")
    return (TYPE_VALUES as string[]).includes(t ?? "") ? (t as MediaType) : "movie"
  })
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(() => {
    const g = searchParams.get("genre")
    return g ? new Set(g.split(",").filter(Boolean)) : new Set()
  })
  const [selectedEras, setSelectedEras] = useState<Set<number>>(() => {
    const e = searchParams.get("era")
    return e ? new Set(e.split(",").map(Number).filter((n) => !Number.isNaN(n))) : new Set()
  })
  const [minRating, setMinRating] = useState(() => {
    const r = Number(searchParams.get("minRating"))
    return Number.isFinite(r) && r > 0 ? r : 0
  })
  const [maxRuntime, setMaxRuntime] = useState(() => {
    const r = Number(searchParams.get("maxRuntime"))
    return Number.isFinite(r) && r > 0 ? r : RUNTIME_MAX
  })
  const [maxPages, setMaxPages] = useState(() => {
    const p = Number(searchParams.get("maxPages"))
    return Number.isFinite(p) && p > 0 ? p : PAGES_MAX
  })
  const [sortField, setSortField] = useState<SortField>(() => {
    const s = searchParams.get("sort")
    return (SORT_FIELD_OPTIONS.some((o) => o.key === s) ? (s as SortField) : DEFAULT_SORT_FIELD)
  })
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const d = searchParams.get("dir")
    return d === "asc" || d === "desc" ? d : DEFAULT_SORT_DIR
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [shuffleOpen, setShuffleOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)
  useSlashFocus(searchInputRef)

  // Reflect the active filters in the URL (shareable/bookmarkable, browser back/forward
  // works) without a full page reload. Type/status are always present so every
  // view has an explicit URL; genre/era are only added once something's selected
  // ("All" - the empty-set state - has no slug of its own).
  useEffect(() => {
    const params = new URLSearchParams()
    params.set("type", typeFilter)
    params.set("status", STATUS_TO_SLUG[activeTab])
    if (selectedGenres.size > 0) params.set("genre", Array.from(selectedGenres).join(","))
    if (selectedEras.size > 0) params.set("era", Array.from(selectedEras).join(","))
    if (minRating > 0) params.set("minRating", String(minRating))
    if (maxRuntime < RUNTIME_MAX) params.set("maxRuntime", String(maxRuntime))
    if (maxPages < PAGES_MAX) params.set("maxPages", String(maxPages))
    if (sortField !== DEFAULT_SORT_FIELD) params.set("sort", sortField)
    if (sortDir !== DEFAULT_SORT_DIR) params.set("dir", sortDir)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, activeTab, selectedGenres, selectedEras, minRating, maxRuntime, maxPages, sortField, sortDir, pathname])

  const handleTypeChange = (type: MediaType) => {
    setTypeFilter(type)
    setSelectedGenres(new Set())
    setSelectedEras(new Set())
    setMinRating(0)
    setMaxRuntime(RUNTIME_MAX)
    setMaxPages(PAGES_MAX)
  }

  // Effective status: show the server-provided status until the provider has loaded
  // its own copy, then follow live provider state so un-saving / moving reacts instantly.
  const effectiveStatus = (item: SavedItem): SavedStatus | null =>
    isLoaded ? getStatus(item.mediaType, item.mediaId) : item.status

  const typeMatchedItems = items.filter((item) => item.mediaType === typeFilter)
  const availableGenres = computeAvailableGenres(typeMatchedItems)
  const availableEras = computeAvailableEras(typeMatchedItems)

  const filteredItems = typeMatchedItems.filter(
    (item) =>
      matchesGenres(item, selectedGenres) &&
      matchesEras(item, selectedEras) &&
      matchesRating(item, minRating) &&
      matchesRuntime(item, maxRuntime, maxPages),
  )

  const countsByStatus: Record<SavedStatus, number> = {
    to_watch: 0,
    watching: 0,
    watched: 0,
  }
  for (const item of filteredItems) {
    const status = effectiveStatus(item)
    if (status) countsByStatus[status]++
  }

  const statusMatchedItems = filteredItems.filter((item) => effectiveStatus(item) === activeTab)
  const query = searchQuery.trim().toLowerCase()
  const searchedItems = query
    ? statusMatchedItems.filter((item) => getTitle(item).toLowerCase().includes(query))
    : statusMatchedItems
  const visibleItems = sortItems(searchedItems, sortField, sortDir)
  const totalCount = filteredItems.filter((item) => effectiveStatus(item) !== null).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-40 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="h-14 w-14 sm:h-18 sm:w-18 relative">
                <Image src="/logo-blue.png" alt="ClickNotes Logo" fill className="object-contain" priority />
              </div>
            </Link>
            <UserProfile />
          </div>
        </div>
      </nav>

      {/* Below the header, the sidebar and grid get their own independent scroll
          regions on desktop (md:h-full md:overflow-y-auto on each) instead of
          scrolling the whole page together - see LibraryFilters and the grid
          wrapper below. Mobile keeps normal whole-page scrolling. */}
      <div className="md:h-[calc(100vh-5rem)] md:overflow-hidden md:flex md:flex-col">
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:flex md:flex-col md:flex-1 md:min-h-0">
          <div className="flex items-center justify-between mb-5 gap-3 md:shrink-0">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold text-foreground">Your library</h2>
              <span className="text-xs text-muted-foreground">{totalCount} saved</span>
            </div>
            <button
              onClick={() => setShuffleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-foreground text-sm font-medium hover:bg-border transition-colors hover:cursor-pointer"
            >
              <ShuffleIcon className="w-4 h-4" />
              Shuffle
            </button>
          </div>

          {/* Search + desktop-only sort (mobile's sort lives in LibraryFilters'
              drawer instead - see components/library-filters.tsx) */}
          <div className="flex items-center gap-3 mb-5 md:shrink-0">
            <div className="relative max-w-md flex-1">
              <svg
                className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 left-3.5"
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
                placeholder="Search your library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full pl-10 pr-9 rounded-lg text-sm focus:outline-none border border-border/40 bg-surface-elevated focus:ring-2 focus:ring-primary/50"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded border border-border/50 bg-surface text-[12px] font-semibold text-muted-foreground pointer-events-none">
                  /
                </kbd>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                aria-label="Sort by"
                className="h-10 rounded-lg text-sm pl-3 pr-8 focus:outline-none border border-border/40 bg-surface-elevated focus:ring-2 focus:ring-primary/50 hover:cursor-pointer"
              >
                {SORT_FIELD_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {typeFilter === "book" && option.bookLabel ? option.bookLabel : option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
                className="h-10 px-3 rounded-lg text-sm font-medium border border-border/40 bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors hover:cursor-pointer"
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-8 md:flex-1 md:min-h-0">
            <LibraryFilters
              typeFilter={typeFilter}
              onTypeChange={handleTypeChange}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              countsByStatus={countsByStatus}
              availableGenres={availableGenres}
              selectedGenres={selectedGenres}
              onGenresChange={setSelectedGenres}
              availableEras={availableEras}
              selectedEras={selectedEras}
              onErasChange={setSelectedEras}
              minRating={minRating}
              onMinRatingChange={setMinRating}
              maxRuntime={maxRuntime}
              onMaxRuntimeChange={setMaxRuntime}
              maxPages={maxPages}
              onMaxPagesChange={setMaxPages}
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortDir={sortDir}
              onSortDirChange={setSortDir}
            />

            <div ref={gridScrollRef} className="flex-1 min-w-0 md:h-full md:overflow-y-auto md:pr-3">
              {visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p className="text-muted-foreground text-lg mb-2">
                    {query ? "No matches" : "Nothing here yet"}
                  </p>
                  <p className="text-muted-foreground text-sm mb-6">
                    {query
                      ? "Try a different search term."
                      : "Save movies, series, and books to build your library."}
                  </p>
                  {!query && (
                    <Link
                      href={`/#${HOMEPAGE_SECTION_HASH[typeFilter]}`}
                      className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors"
                    >
                      Browse popular
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 md:gap-8">
                  {visibleItems.map((item) => (
                    <MediaCard
                      key={`${item.mediaType}:${item.mediaId}`}
                      item={item.card as unknown as MediaItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {shuffleOpen && (
        <ShuffleModal
          items={items}
          defaultStatus={activeTab}
          initialType={typeFilter}
          initialGenres={selectedGenres}
          initialEras={selectedEras}
          initialMinRating={minRating}
          initialMaxRuntime={maxRuntime}
          initialMaxPages={maxPages}
          onClose={() => setShuffleOpen(false)}
        />
      )}

      <ScrollToTopButton target={gridScrollRef} />
    </div>
  )
}
