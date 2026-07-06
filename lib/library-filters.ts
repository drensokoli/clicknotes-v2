import type { MediaType, SavedStatus } from "@/components/saved-media-provider"
import type { SavedCard } from "@/lib/saved-media"
import { MOVIE_GENRES, TV_GENRES } from "@/lib/tmdb-details"
import { splitBookCategories } from "@/lib/book-categories"

// Shared by the Library sidebar (components/library-filters.tsx + saved-list.tsx)
// and the Shuffle modal (components/shuffle-modal.tsx) so both compute the same
// genre/era options - and filter items the same way - from one place.

export interface SavedItem {
  mediaType: MediaType
  mediaId: string
  status: SavedStatus
  card: SavedCard
}

// --- helpers to read display fields uniformly across the 3 media types ---

export function getGenres(item: SavedItem): string[] {
  // Defensive: also splits any pre-existing un-split "X / Y" categories still on
  // disk from before scripts/backfill-book-categories.js ran.
  if (item.mediaType === "book") return splitBookCategories(item.card.volumeInfo?.categories)

  // Prefer the full genre objects from `details.genres` (from the expensive
  // per-item TMDB detail fetch during population) when present, but fall back to
  // the cheap `genre_ids` that's always on the browsing card (from TMDB's list
  // endpoint) mapped through the id->name tables - see SavedCard.genre_ids.
  const namedGenres = item.card.details?.genres?.map((g) => g.name)
  if (namedGenres && namedGenres.length > 0) return namedGenres

  const genreMap = item.mediaType === "movie" ? MOVIE_GENRES : TV_GENRES
  return (item.card.genre_ids ?? []).map((id) => genreMap[id]).filter((name): name is string => Boolean(name))
}

export function getYear(item: SavedItem): number | null {
  const dateStr =
    item.mediaType === "book"
      ? item.card.volumeInfo?.publishedDate
      : item.mediaType === "movie"
        ? item.card.release_date
        : item.card.first_air_date
  if (!dateStr) return null
  const year = parseInt(dateStr.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

// Normalized to a 0-10 scale (Google Books averages are out of 5, TMDB out of 10).
export function getRating(item: SavedItem): number | null {
  if (item.mediaType === "book") {
    const r = item.card.volumeInfo?.averageRating
    return typeof r === "number" ? r * 2 : null
  }
  return typeof item.card.vote_average === "number" ? item.card.vote_average : null
}

export function getTitle(item: SavedItem): string {
  if (item.mediaType === "book") return item.card.volumeInfo?.title || "Untitled"
  return item.card.title || item.card.name || "Untitled"
}

export function getPosterUrl(item: SavedItem): string | null {
  if (item.mediaType === "book") {
    const thumb = item.card.volumeInfo?.imageLinks?.thumbnail
    return thumb ? thumb.replace("http:", "https:") : null
  }
  return item.card.poster_path ? `https://image.tmdb.org/t/p/w342${item.card.poster_path}` : null
}

// Movies use a single `runtime`; series use their typical per-episode runtime
// (the first entry of `episode_run_time` - TMDB returns it as an array since it
// can vary across a show's history, but one representative value is enough for
// filtering). Books have no comparable field, so this is a pass-through for them.
export function getRuntime(item: SavedItem): number | null {
  if (item.mediaType === "movie") {
    return typeof item.card.details?.runtime === "number" ? item.card.details.runtime : null
  }
  if (item.mediaType === "series") {
    const episodeRuntime = item.card.details?.episode_run_time?.[0]
    return typeof episodeRuntime === "number" ? episodeRuntime : null
  }
  return null
}

export function getPageCount(item: SavedItem): number | null {
  if (item.mediaType !== "book") return null
  return typeof item.card.volumeInfo?.pageCount === "number" ? item.card.volumeInfo.pageCount : null
}

export function getDecade(year: number): number {
  return Math.floor(year / 10) * 10
}

export function decadeLabel(decade: number): string {
  return `${String(decade % 100).padStart(2, "0")}s`
}

export function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// Genre/era pills reflect whatever the user has actually saved for the selected
// media type - no fixed canonical genre list, since a genre/era you've never
// saved anything in isn't a useful thing to filter or shuffle by.
export function computeAvailableGenres(items: SavedItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    for (const g of getGenres(item)) set.add(g)
  }
  return Array.from(set).sort()
}

export function computeAvailableEras(items: SavedItem[]): number[] {
  const decades = new Set<number>()
  for (const item of items) {
    const year = getYear(item)
    if (year !== null) decades.add(getDecade(year))
  }
  return Array.from(decades).sort()
}

export function matchesGenres(item: SavedItem, selectedGenres: Set<string>): boolean {
  if (selectedGenres.size === 0) return true
  const genres = getGenres(item)
  return genres.some((g) => selectedGenres.has(g))
}

export function matchesEras(item: SavedItem, selectedEras: Set<number>): boolean {
  if (selectedEras.size === 0) return true
  const year = getYear(item)
  return year !== null && selectedEras.has(getDecade(year))
}

export function matchesRating(item: SavedItem, minRating: number): boolean {
  if (minRating <= 0) return true
  const rating = getRating(item)
  return rating !== null && rating >= minRating
}

// Movies/series use `maxRuntime` (minutes), books use `maxPages` - whichever
// applies to the item's type, at its own "no cap" ceiling (RUNTIME_MAX/PAGES_MAX).
export const RUNTIME_MIN = 60
export const RUNTIME_MAX = 240
export const PAGES_MIN = 100
export const PAGES_MAX = 1000

export function matchesRuntime(item: SavedItem, maxRuntime: number, maxPages: number): boolean {
  if (item.mediaType === "book") {
    if (maxPages >= PAGES_MAX) return true
    const pages = getPageCount(item)
    return pages === null || pages <= maxPages
  }
  if (maxRuntime >= RUNTIME_MAX) return true
  const runtime = getRuntime(item)
  return runtime === null || runtime <= maxRuntime
}

// Shared pill button styling used by both the Library sidebar and the Shuffle modal.
export function pillClass(active: boolean, activeClass = "bg-primary text-white"): string {
  return `px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:cursor-pointer ${
    active ? activeClass : "bg-surface-elevated text-muted-foreground hover:text-foreground"
  }`
}
