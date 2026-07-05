"use client"

import { useState, useMemo, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { X, Shuffle as ShuffleIcon, Sparkles } from "lucide-react"
import { useModal } from "./modal-provider"
import type { MediaType, SavedStatus } from "./saved-media-provider"
import type { MediaItem } from "./media-card"
import {
  type SavedItem,
  getRating,
  getTitle,
  getPosterUrl,
  getRuntime,
  getPageCount,
  decadeLabel,
  computeAvailableGenres,
  computeAvailableEras,
  matchesGenres,
  matchesEras,
  pillClass,
} from "@/lib/library-filters"
import { PillGroup } from "./pill-group"

interface ShuffleModalProps {
  items: SavedItem[]
  defaultStatus: SavedStatus
  initialType: MediaType
  initialGenres?: Set<string>
  initialEras?: Set<number>
  onClose: () => void
}

const TYPE_OPTIONS: { key: MediaType; label: string }[] = [
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
  { key: "book", label: "Books" },
]

const STATUS_OPTIONS: { key: SavedStatus; label: string }[] = [
  { key: "to_watch", label: "Saved" },
  { key: "watching", label: "In Progress" },
  { key: "watched", label: "Completed" },
]

const RUNTIME_MIN = 60
const RUNTIME_MAX = 240
const PAGES_MIN = 100
const PAGES_MAX = 1000

const CARD_WIDTH = 128 // px, including gap - keep in sync with the strip item's className

export function ShuffleModal({ items, defaultStatus, initialType, initialGenres, initialEras, onClose }: ShuffleModalProps) {
  const { openModal } = useModal()

  const [phase, setPhase] = useState<"filter" | "spinning" | "result">("filter")
  const [typeFilter, setTypeFilter] = useState<MediaType>(initialType)
  const [statusFilter, setStatusFilter] = useState<SavedStatus>(defaultStatus)
  // Seeded from whatever the Library sidebar has active (one-way - editing here
  // doesn't write back to the Library's own filter state).
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(() => new Set(initialGenres))
  const [selectedEras, setSelectedEras] = useState<Set<number>>(() => new Set(initialEras))
  const [minRating, setMinRating] = useState(0)
  const [maxRuntime, setMaxRuntime] = useState(RUNTIME_MAX)
  const [maxPages, setMaxPages] = useState(PAGES_MAX)

  const typeMatched = useMemo(
    () => items.filter((i) => i.mediaType === typeFilter),
    [items, typeFilter],
  )

  // Genre/era pills reflect whatever the user has actually saved for the selected
  // media type - no fixed canonical genre list, since a genre you've never
  // saved anything in isn't a useful "mood" to shuffle from.
  const availableGenres = useMemo(() => computeAvailableGenres(typeMatched), [typeMatched])
  const availableEras = useMemo(() => computeAvailableEras(typeMatched), [typeMatched])

  const filteredItems = useMemo(() => {
    return typeMatched.filter((item) => {
      if (item.status !== statusFilter) return false
      if (!matchesGenres(item, selectedGenres)) return false
      if (!matchesEras(item, selectedEras)) return false

      const rating = getRating(item)
      if (minRating > 0 && (rating === null || rating < minRating)) return false

      if (typeFilter === "book") {
        if (maxPages < PAGES_MAX) {
          const pages = getPageCount(item)
          if (pages !== null && pages > maxPages) return false
        }
      } else if (maxRuntime < RUNTIME_MAX) {
        const runtime = getRuntime(item)
        if (runtime !== null && runtime > maxRuntime) return false
      }

      return true
    })
  }, [typeMatched, statusFilter, selectedGenres, selectedEras, minRating, maxRuntime, maxPages, typeFilter])

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
        <div className="flex items-center justify-end px-5 sm:px-6 py-3 border-b border-border/30">
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
                      onClick={() => {
                        setTypeFilter(opt.key)
                        setSelectedGenres(new Set())
                        setSelectedEras(new Set())
                      }}
                      className={pillClass(typeFilter === opt.key, "bg-foreground text-background")}
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
                      className={pillClass(statusFilter === opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <PillGroup label={"I'm in the mood for..."} options={availableGenres} selected={selectedGenres} onChange={setSelectedGenres} />
              <PillGroup label="Era" options={availableEras} selected={selectedEras} onChange={setSelectedEras} renderLabel={decadeLabel} />

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

              {/* Max runtime / pages */}
              {typeFilter === "book" ? (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Max pages: {maxPages >= PAGES_MAX ? "Any" : maxPages}
                  </h3>
                  <input
                    type="range"
                    min={PAGES_MIN}
                    max={PAGES_MAX}
                    step={50}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Max runtime: {maxRuntime >= RUNTIME_MAX ? "Any" : `${maxRuntime}m`}
                  </h3>
                  <input
                    type="range"
                    min={RUNTIME_MIN}
                    max={RUNTIME_MAX}
                    step={10}
                    value={maxRuntime}
                    onChange={(e) => setMaxRuntime(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

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
