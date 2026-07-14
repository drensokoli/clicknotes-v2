"use client"

import { useState } from "react"
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion"
import { SlidersHorizontal, X, ArrowDownUp, ArrowUp, ArrowDown } from "lucide-react"
import type { MediaType, SavedStatus } from "./saved-media-provider"
import {
  decadeLabel,
  RUNTIME_MIN,
  RUNTIME_MAX,
  PAGES_MIN,
  PAGES_MAX,
  SORT_FIELD_OPTIONS,
  type SortField,
  type SortDir,
} from "@/lib/library-filters"
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
  minRating: number
  onMinRatingChange: (rating: number) => void
  maxRuntime: number
  onMaxRuntimeChange: (runtime: number) => void
  maxPages: number
  onMaxPagesChange: (pages: number) => void
  sortField: SortField
  onSortFieldChange: (field: SortField) => void
  sortDir: SortDir
  onSortDirChange: (dir: SortDir) => void
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
  minRating,
  onMinRatingChange,
  maxRuntime,
  onMaxRuntimeChange,
  maxPages,
  onMaxPagesChange,
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
          onChange={(e) => onMinRatingChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

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
            onChange={(e) => onMaxPagesChange(Number(e.target.value))}
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
            onChange={(e) => onMaxRuntimeChange(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

// Mobile-only sort drawer contents - field choice as a button list (mirrors the
// Type group above) plus the direction as its own two-way choice, replacing the
// desktop's inline select+toggle (see saved-list.tsx) with something that works
// as a drawer sheet instead.
function SortGroup({
  typeFilter,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
}: Pick<LibraryFiltersProps, "typeFilter" | "sortField" | "onSortFieldChange" | "sortDir" | "onSortDirChange">) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort by</h3>
        <div className="flex flex-col gap-1.5">
          {SORT_FIELD_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => onSortFieldChange(option.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors hover:cursor-pointer ${
                sortField === option.key ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              {typeFilter === "book" && option.bookLabel ? option.bookLabel : option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Direction</h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSortDirChange("desc")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:cursor-pointer ${
              sortDir === "desc" ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDown className="w-4 h-4" />
            Descending
          </button>
          <button
            onClick={() => onSortDirChange("asc")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:cursor-pointer ${
              sortDir === "asc" ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUp className="w-4 h-4" />
            Ascending
          </button>
        </div>
      </div>
    </div>
  )
}

// Shared bottom-sheet shell for both the Filters and Sort mobile drawers -
// dragging the handle down past a threshold (or with enough velocity) closes
// it, like a native sheet. Drag is scoped to the handle (dragListener={false}
// + onPointerDown starting dragControls) so scrolling the content below it
// doesn't also drag the sheet.
function MobileDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const dragControls = useDragControls()

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border cursor-grab active:cursor-grabbing touch-none"
            />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function LibraryFilters(props: LibraryFiltersProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar - its parent row is height-capped (see saved-list.tsx),
          so this scrolls independently of the grid instead of the whole page
          scrolling both together. Sort lives inline next to the search bar on
          desktop instead (see saved-list.tsx), not in this sidebar. */}
      <aside className="hidden md:block w-56 shrink-0 md:h-full md:overflow-y-auto pr-3">
        <FilterGroups {...props} />
      </aside>

      {/* Mobile trigger row - Filters and Sort share the row equally, each
          opening its own drawer. */}
      <div className="md:hidden flex items-center gap-2">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-foreground text-sm font-medium hover:bg-border transition-colors hover:cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
        <button
          onClick={() => setSortDrawerOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-foreground text-sm font-medium hover:bg-border transition-colors hover:cursor-pointer"
        >
          <ArrowDownUp className="w-4 h-4" />
          Sort
        </button>
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters">
        <FilterGroups {...props} />
      </MobileDrawer>

      <MobileDrawer open={sortDrawerOpen} onClose={() => setSortDrawerOpen(false)} title="Sort">
        <SortGroup {...props} />
      </MobileDrawer>
    </>
  )
}
