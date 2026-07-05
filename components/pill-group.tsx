"use client"

import { toggleInSet, pillClass } from "@/lib/library-filters"

interface PillGroupProps<T> {
  label: string
  options: T[]
  selected: Set<T>
  onChange: (next: Set<T>) => void
  renderLabel?: (option: T) => string
}

// Shared by the Library sidebar (components/library-filters.tsx) and the Shuffle
// modal (components/shuffle-modal.tsx) so Genre/Era pills look and behave
// identically in both places. Multi-select - the "All" pill just clears the set
// (an empty set already means "match everything" to matchesGenres/matchesEras),
// and picking any real option implicitly un-highlights "All".
export function PillGroup<T>({ label, options, selected, onChange, renderLabel }: PillGroupProps<T>) {
  if (options.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</h3>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onChange(new Set())} className={pillClass(selected.size === 0)}>
          All
        </button>
        {options.map((option) => (
          <button
            key={String(option)}
            onClick={() => onChange(toggleInSet(selected, option))}
            className={pillClass(selected.has(option))}
          >
            {renderLabel ? renderLabel(option) : String(option)}
          </button>
        ))}
      </div>
    </div>
  )
}
