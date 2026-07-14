"use client"

import { useState } from "react"
import { SlidersHorizontal, ArrowDownUp, ArrowUp, ArrowDown, ChevronDown } from "lucide-react"
import { PillGroup } from "./pill-group"
import { MobileDrawer } from "./mobile-drawer"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  decadeLabel,
  SEARCH_SORT_FIELD_OPTIONS,
  type SearchSortField,
  type SearchSortDir,
} from "@/lib/search-filters"

interface SearchFilterBarProps {
  isBook: boolean
  availableGenres: string[]
  selectedGenres: Set<string>
  onGenresChange: (next: Set<string>) => void
  availableEras: number[]
  selectedEras: Set<number>
  onErasChange: (next: Set<number>) => void
  minRating: number
  onMinRatingChange: (rating: number) => void
  sortField: SearchSortField
  onSortFieldChange: (field: SearchSortField) => void
  sortDir: SearchSortDir
  onSortDirChange: (dir: SearchSortDir) => void
}

// Genre/Era pills + a min-rating slider - shared between the desktop inline
// row and the mobile Filters drawer, just with a different wrapping layout.
function FilterControls({
  layout,
  availableGenres,
  selectedGenres,
  onGenresChange,
  availableEras,
  selectedEras,
  onErasChange,
  minRating,
  onMinRatingChange,
}: Pick<
  SearchFilterBarProps,
  "availableGenres" | "selectedGenres" | "onGenresChange" | "availableEras" | "selectedEras" | "onErasChange" | "minRating" | "onMinRatingChange"
> & { layout: "row" | "stack" }) {
  return (
    <div className={layout === "row" ? "flex flex-wrap items-start gap-6" : "space-y-6"}>
      <PillGroup label="Genre" options={availableGenres} selected={selectedGenres} onChange={onGenresChange} />
      <PillGroup label="Era" options={availableEras} selected={selectedEras} onChange={onErasChange} renderLabel={decadeLabel} />
      <div className={layout === "row" ? "w-40" : undefined}>
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
    </div>
  )
}

// Sort field + direction - used by the mobile Sort drawer. Desktop uses a
// DropdownMenu instead (see below), same field/direction radio-group shape.
function SortControls({
  isBook,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
}: Pick<SearchFilterBarProps, "isBook" | "sortField" | "onSortFieldChange" | "sortDir" | "onSortDirChange">) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort by</h3>
        <div className="flex flex-col gap-1.5">
          {SEARCH_SORT_FIELD_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => onSortFieldChange(option.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors hover:cursor-pointer ${
                sortField === option.key ? "bg-primary text-white" : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              {isBook && option.bookLabel ? option.bookLabel : option.label}
            </button>
          ))}
        </div>
      </div>

      {sortField !== "relevance" && (
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
      )}
    </div>
  )
}

// Shown above the results grid whenever there's an active search query -
// genre/era/rating filters + sort, applied client-side to whatever the search
// API already returned (see lib/search-filters.ts). Follows the same desktop
// dropdown / mobile drawer split as the Library page's sort control
// (components/saved-list.tsx, components/library-filters.tsx).
export function SearchFilterBar(props: SearchFilterBarProps) {
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false)
  const currentSortOption = SEARCH_SORT_FIELD_OPTIONS.find((o) => o.key === props.sortField)

  return (
    <div className="mb-5">
      <div className="hidden md:flex md:items-start md:justify-between md:gap-6">
        <FilterControls layout="row" {...props} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 gap-2 shrink-0">
              <ArrowDownUp className="w-4 h-4" />
              {(props.isBook && currentSortOption?.bookLabel ? currentSortOption.bookLabel : currentSortOption?.label) ?? "Sort"}
              <ChevronDown className="w-4 h-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={props.sortField} onValueChange={(v) => props.onSortFieldChange(v as SearchSortField)}>
              {SEARCH_SORT_FIELD_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key} onSelect={(e) => e.preventDefault()}>
                  {props.isBook && option.bookLabel ? option.bookLabel : option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {props.sortField !== "relevance" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Direction</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={props.sortDir} onValueChange={(v) => props.onSortDirChange(v as SearchSortDir)}>
                  <DropdownMenuRadioItem value="desc" onSelect={(e) => e.preventDefault()}>
                    <ArrowDown className="w-4 h-4" />
                    Descending
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="asc" onSelect={(e) => e.preventDefault()}>
                    <ArrowUp className="w-4 h-4" />
                    Ascending
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="md:hidden flex items-center gap-2">
        <button
          onClick={() => setFiltersDrawerOpen(true)}
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

      <MobileDrawer open={filtersDrawerOpen} onClose={() => setFiltersDrawerOpen(false)} title="Filters">
        <FilterControls layout="stack" {...props} />
      </MobileDrawer>

      <MobileDrawer open={sortDrawerOpen} onClose={() => setSortDrawerOpen(false)} title="Sort">
        <SortControls {...props} />
      </MobileDrawer>
    </div>
  )
}
