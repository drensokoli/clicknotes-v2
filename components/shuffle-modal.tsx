"use client"

import { useState, useMemo, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { X, Shuffle as ShuffleIcon, Sparkles } from "lucide-react"
import { useModal } from "./modal-provider"
import type { MediaType, SavedStatus } from "./saved-media-provider"
import type { SavedCard } from "@/lib/saved-media"
import type { MediaItem } from "./media-card"

interface SavedItem {
  mediaType: MediaType
  mediaId: string
  status: SavedStatus
  card: SavedCard
}

interface ShuffleModalProps {
  items: SavedItem[]
  defaultStatus: SavedStatus
  onClose: () => void
}

type TypeFilter = "all" | MediaType

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tvshow", label: "TV shows" },
  { key: "book", label: "Books" },
]

const STATUS_OPTIONS: { key: SavedStatus; label: string }[] = [
  { key: "to_watch", label: "Saved" },
  { key: "watching", label: "In Progress" },
  { key: "watched", label: "Completed" },
]

// --- helpers to read display fields uniformly across the 3 media types ---

function getGenres(item: SavedItem): string[] {
  if (item.mediaType === "book") return item.card.volumeInfo?.categories ?? []
  return item.card.details?.genres?.map((g) => g.name) ?? []
}

function getYear(item: SavedItem): number | null {
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
function getRating(item: SavedItem): number | null {
  if (item.mediaType === "book") {
    const r = item.card.volumeInfo?.averageRating
    return typeof r === "number" ? r * 2 : null
  }
  return typeof item.card.vote_average === "number" ? item.card.vote_average : null
}

function getTitle(item: SavedItem): string {
  if (item.mediaType === "book") return item.card.volumeInfo?.title || "Untitled"
  return item.card.title || item.card.name || "Untitled"
}

function getPosterUrl(item: SavedItem): string | null {
  if (item.mediaType === "book") {
    const thumb = item.card.volumeInfo?.imageLinks?.thumbnail
    return thumb ? thumb.replace("http:", "https:") : null
  }
  return item.card.poster_path ? `https://image.tmdb.org/t/p/w342${item.card.poster_path}` : null
}

const CARD_WIDTH = 128 // px, including gap - keep in sync with the strip item's className

export function ShuffleModal({ items, defaultStatus, onClose }: ShuffleModalProps) {
  const { openModal } = useModal()

  const [phase, setPhase] = useState<"filter" | "spinning" | "result">("filter")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<SavedStatus>(defaultStatus)
  const [genreFilter, setGenreFilter] = useState<string>("all")
  const [minRating, setMinRating] = useState(0)

  const typeMatched = useMemo(
    () => items.filter((i) => typeFilter === "all" || i.mediaType === typeFilter),
    [items, typeFilter],
  )

  const availableYears = useMemo(() => {
    const years = typeMatched.map(getYear).filter((y): y is number => y !== null)
    if (years.length === 0) return { min: 1900, max: new Date().getFullYear() }
    return { min: Math.min(...years), max: Math.max(...years) }
  }, [typeMatched])

  const [yearRange, setYearRange] = useState<[number, number] | null>(null)
  const effectiveYearRange = useMemo(
    () => yearRange ?? [availableYears.min, availableYears.max],
    [yearRange, availableYears],
  )

  const availableGenres = useMemo(() => {
    const set = new Set<string>()
    for (const item of typeMatched) {
      for (const g of getGenres(item)) set.add(g)
    }
    return Array.from(set).sort()
  }, [typeMatched])

  const filteredItems = useMemo(() => {
    return typeMatched.filter((item) => {
      if (item.status !== statusFilter) return false
      if (genreFilter !== "all" && !getGenres(item).includes(genreFilter)) return false
      const year = getYear(item)
      if (year !== null && (year < effectiveYearRange[0] || year > effectiveYearRange[1])) return false
      const rating = getRating(item)
      if (minRating > 0 && (rating === null || rating < minRating)) return false
      return true
    })
  }, [typeMatched, statusFilter, genreFilter, effectiveYearRange, minRating])

  // Built once we start spinning, so the strip doesn't re-shuffle mid-animation.
  const [strip, setStrip] = useState<SavedItem[]>([])
  const [targetIndex, setTargetIndex] = useState(0)
  const [result, setResult] = useState<SavedItem | null>(null)

  const startShuffle = useCallback(() => {
    if (filteredItems.length === 0) return

    const REPEATS = 8
    const chosen = filteredItems[Math.floor(Math.random() * filteredItems.length)]

    // Repeat the filtered list enough times to fake a long spin, landing the LAST
    // repetition's copy of the chosen item roughly in the middle-to-end of the strip.
    const longStrip: SavedItem[] = []
    for (let r = 0; r < REPEATS; r++) longStrip.push(...filteredItems)
    const landingIndex = (REPEATS - 1) * filteredItems.length + filteredItems.indexOf(chosen)

    setStrip(longStrip)
    setTargetIndex(landingIndex)
    setResult(chosen)
    setPhase("spinning")
  }, [filteredItems])

  const handleViewDetails = () => {
    if (!result) return
    onClose()
    openModal(result.card as unknown as MediaItem)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase !== "spinning" ? onClose : undefined}
      />

      <motion.div
        className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/30">
          <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <ShuffleIcon className="w-4 h-4" />
            Shuffle
          </h2>
          {phase !== "spinning" && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === "filter" && (
            <motion.div
              key="filter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-5 sm:p-6 space-y-5"
            >
              {/* Media type */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Media type</h3>
                <div className="flex gap-2 flex-wrap">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setTypeFilter(opt.key); setGenreFilter("all"); setYearRange(null) }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:cursor-pointer ${
                        typeFilter === opt.key ? "bg-foreground text-background" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setStatusFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:cursor-pointer ${
                        statusFilter === opt.key ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre */}
              {availableGenres.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Genre</h3>
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated text-foreground text-sm border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="all">All genres</option>
                    {availableGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Year range */}
              {availableYears.min < availableYears.max && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Year: {effectiveYearRange[0]} - {effectiveYearRange[1]}
                  </h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={availableYears.min}
                      max={availableYears.max}
                      value={effectiveYearRange[0]}
                      onChange={(e) => setYearRange([Math.min(Number(e.target.value), effectiveYearRange[1]), effectiveYearRange[1]])}
                      className="w-full"
                    />
                    <input
                      type="range"
                      min={availableYears.min}
                      max={availableYears.max}
                      value={effectiveYearRange[1]}
                      onChange={(e) => setYearRange([effectiveYearRange[0], Math.max(Number(e.target.value), effectiveYearRange[0])])}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Minimum rating */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Minimum rating: {minRating === 0 ? "Any" : `${minRating}+`}
                </h3>
                <input
                  type="range"
                  min={0}
                  max={9}
                  step={1}
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={startShuffle}
                  disabled={filteredItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShuffleIcon className="w-4 h-4" />
                  {filteredItems.length === 0 ? "No matching items" : `Shuffle ${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </motion.div>
          )}

          {phase === "spinning" && (
            <motion.div
              key="spinning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5 sm:p-6"
            >
              <div className="relative h-48 overflow-hidden rounded-lg bg-surface-elevated">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-primary z-10" />
                <motion.div
                  className="absolute inset-y-0 flex items-center gap-3 px-3"
                  style={{ left: "50%" }}
                  initial={{ x: -(CARD_WIDTH / 2) }}
                  animate={{ x: -(targetIndex * CARD_WIDTH + CARD_WIDTH / 2) }}
                  transition={{ duration: 4, ease: [0.11, 0.83, 0.24, 1] }}
                  onAnimationComplete={() => setPhase("result")}
                >
                  {strip.map((item, i) => (
                    <div key={i} className="relative flex-shrink-0 w-28 h-40 rounded-md overflow-hidden bg-surface-tonal">
                      {getPosterUrl(item) ? (
                        <Image src={getPosterUrl(item)!} alt={getTitle(item)} fill sizes="112px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                          {getTitle(item)}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">Shuffling...</p>
            </motion.div>
          )}

          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 sm:p-6 flex flex-col items-center text-center"
            >
              <Sparkles className="w-5 h-5 text-primary mb-2" />
              <div className="relative w-32 h-48 rounded-lg overflow-hidden bg-surface-tonal shadow-lg mb-4">
                {getPosterUrl(result) ? (
                  <Image src={getPosterUrl(result)!} alt={getTitle(result)} fill sizes="128px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2">
                    {getTitle(result)}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-4">{getTitle(result)}</h3>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setPhase("filter")}
                  className="flex-1 px-4 py-2 bg-surface-elevated text-foreground rounded-lg font-medium text-sm hover:bg-surface-tonal transition-colors hover:cursor-pointer"
                >
                  Shuffle again
                </button>
                <button
                  onClick={handleViewDetails}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors hover:cursor-pointer"
                >
                  View details
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
