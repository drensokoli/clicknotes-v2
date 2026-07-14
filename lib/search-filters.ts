import type { MediaItem } from "@/components/media-card"
import { MOVIE_GENRES, TV_GENRES } from "@/lib/tmdb-details"
import { splitBookCategories } from "@/lib/book-categories"
import { getDecade, decadeLabel, toggleInSet, pillClass } from "@/lib/library-filters"

// Parallel to lib/library-filters.ts, but typed against the raw MediaItem
// (Movie | Series | Book) that Home's search/discover results actually are,
// rather than the Library's SavedItem wrapper ({mediaType, card, savedAt, ...}).
// Re-exports the bits that don't depend on that wrapper shape so callers only
// need to import from one place.
export { getDecade, decadeLabel, toggleInSet, pillClass }

// --- helpers to read display fields uniformly across the 3 media types ---

// Search/discover results only ever carry `genre_ids` (never the full
// `details.genres` objects Redis-cached Popular cards have), but this still
// checks `details` first in case a result was seeded from a saved/populated
// card (e.g. a person's filmography item reused elsewhere) that does have it.
export function getSearchGenres(item: MediaItem): string[] {
  if (item.type === "book") return splitBookCategories(item.volumeInfo?.categories)

  const namedGenres = item.details?.genres?.map((g) => g.name)
  if (namedGenres && namedGenres.length > 0) return namedGenres

  const genreMap = item.type === "movie" ? MOVIE_GENRES : TV_GENRES
  return (item.genre_ids ?? []).map((id) => genreMap[id]).filter((name): name is string => Boolean(name))
}

export function getSearchYear(item: MediaItem): number | null {
  const dateStr =
    item.type === "book"
      ? item.volumeInfo?.publishedDate
      : item.type === "movie"
        ? item.release_date
        : item.first_air_date
  if (!dateStr) return null
  const year = parseInt(dateStr.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

// Full release/publish date as a timestamp (unlike getSearchYear, which only
// reads the leading 4 digits) so items from the same year still sort correctly.
export function getSearchPublishedTime(item: MediaItem): number | null {
  const dateStr =
    item.type === "book"
      ? item.volumeInfo?.publishedDate
      : item.type === "movie"
        ? item.release_date
        : item.first_air_date
  if (!dateStr) return null
  const time = new Date(dateStr).getTime()
  return Number.isFinite(time) ? time : null
}

// Normalized to a 0-10 scale (Google Books averages are out of 5, TMDB out of 10).
export function getSearchRating(item: MediaItem): number | null {
  if (item.type === "book") {
    const r = item.volumeInfo?.averageRating
    return typeof r === "number" ? r * 2 : null
  }
  return typeof item.vote_average === "number" ? item.vote_average : null
}

export function computeAvailableSearchGenres(items: MediaItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    for (const g of getSearchGenres(item)) set.add(g)
  }
  return Array.from(set).sort()
}

export function computeAvailableSearchEras(items: MediaItem[]): number[] {
  const decades = new Set<number>()
  for (const item of items) {
    const year = getSearchYear(item)
    if (year !== null) decades.add(getDecade(year))
  }
  return Array.from(decades).sort()
}

// A genre filter always passes books through even when active - Google Books'
// `categories` field is absent on a large share of raw search results (unlike
// curated bestseller data), so excluding untagged books would hide a lot of
// otherwise-matching results.
export function matchesSearchGenres(item: MediaItem, selectedGenres: Set<string>): boolean {
  if (selectedGenres.size === 0) return true
  const genres = getSearchGenres(item)
  if (item.type === "book" && genres.length === 0) return true
  return genres.some((g) => selectedGenres.has(g))
}

export function matchesSearchEras(item: MediaItem, selectedEras: Set<number>): boolean {
  if (selectedEras.size === 0) return true
  const year = getSearchYear(item)
  return year !== null && selectedEras.has(getDecade(year))
}

export function matchesSearchRating(item: MediaItem, minRating: number): boolean {
  if (minRating <= 0) return true
  const rating = getSearchRating(item)
  return rating !== null && rating >= minRating
}

// --- sorting ---

// No "saved date" (nonsensical for search) and no runtime/page-count sort
// (not available on search/discover results without an extra per-item detail
// fetch each). "relevance" is the API's own result order and is the default,
// so turning filters on never silently reorders results the user didn't ask
// to reorder.
export type SearchSortField = "relevance" | "date" | "rating"
export type SearchSortDir = "asc" | "desc"

export const DEFAULT_SEARCH_SORT_FIELD: SearchSortField = "relevance"
export const DEFAULT_SEARCH_SORT_DIR: SearchSortDir = "desc"

export const SEARCH_SORT_FIELD_OPTIONS: { key: SearchSortField; label: string; bookLabel?: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "date", label: "Release Date", bookLabel: "Published Date" },
  { key: "rating", label: "Rating" },
]

function getSearchSortValue(item: MediaItem, field: SearchSortField): number | null {
  switch (field) {
    case "date":
      return getSearchPublishedTime(item)
    case "rating":
      return getSearchRating(item)
    case "relevance":
      return null
  }
}

// Items missing the sorted-on value always sink to the bottom, regardless of
// direction. "relevance" is a no-op - preserves the API's own result order.
export function sortSearchItems(items: MediaItem[], field: SearchSortField, dir: SearchSortDir): MediaItem[] {
  if (field === "relevance") return items

  const sign = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    const av = getSearchSortValue(a, field)
    const bv = getSearchSortValue(b, field)
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return (av - bv) * sign
  })
}
