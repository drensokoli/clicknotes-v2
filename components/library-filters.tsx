"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SlidersHorizontal, X } from "lucide-react"
import type { MediaType, SavedStatus } from "./saved-media-provider"
import { decadeLabel } from "@/lib/library-filters"
import { PillGroup } from "./pill-group"

export const STATUS_OPTIONS: { key: SavedStatus; label: string; activeClass: string }[] = [
  { key: "to_watch", label: "Saved", activeClass: "bg-primary text-white" },
  { key: "watching", label: "In Progress", activeClass: "bg-amber-600 text-white" },
  { key: "watched", label: "Completed", activeClass: "bg-green-600 text-white" },
]

export const TYPE_OPTIONS: { key: MediaType; label: string }[] = [
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
  { key: "book", label: "Books" },
]

interface LibraryFiltersProps {
  typeFilter: MediaType
  onTypeChange: (type: MediaType) => void
  activeTab: SavedStatus
  onTabChange: (tab: SavedStatus) => void
  countsByStatus: Record<SavedStatus, number>
  availableGenres: string[]
  selectedGenres: Set<string>
  onGenresChange: (genres: Set<string>) => void
  availableEras: number[]
  selectedEras: Set<number>
  onErasChange: (eras: Set<number>) => void
}

// Shared between the desktop sidebar and the mobile drawer - grouped so a future
// filter group can be added as a sibling without the layout becoming a single
// long row of filters. Type comes first since it's the primary axis - it
// determines which genres/eras are even available to filter by.
function FilterGroups({
  typeFilter,
  onTypeChange,
  activeTab,
  onTabChange,
  countsByStatus,
  availableGenres,
  selectedGenres,
  onGenresChange,
  availableEras,
  selectedEras,
  onErasChange,
}: LibraryFiltersProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Type</h3>
        <div className="flex flex-col gap-1.5">
          {TYPE_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => onTypeChange(f.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors hover:cursor-pointer ${
                typeFilter === f.key ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</h3>
        <div className="flex flex-col gap-1.5">
          {STATUS_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors hover:cursor-pointer ${
                activeTab === tab.key ? tab.activeClass : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={activeTab === tab.key ? "opacity-80" : "text-muted-foreground/70"}>
                {countsByStatus[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <PillGroup label="Genre" options={availableGenres} selected={selectedGenres} onChange={onGenresChange} />
      <PillGroup label="Era" options={availableEras} selected={selectedEras} onChange={onErasChange} renderLabel={decadeLabel} />
    </div>
  )
}

export function LibraryFilters(props: LibraryFiltersProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar - its parent row is height-capped (see saved-list.tsx),
          so this scrolls independently of the grid instead of the whole page
          scrolling both together. */}
      <aside className="hidden md:block w-56 shrink-0 md:h-full md:overflow-y-auto pr-3">
        <FilterGroups {...props} />
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-foreground text-sm font-medium hover:bg-border transition-colors hover:cursor-pointer"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
      </button>

      {/* Mobile bottom-sheet drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[70]">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border/60" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <FilterGroups {...props} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
