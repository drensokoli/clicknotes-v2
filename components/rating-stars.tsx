"use client"

import { Star } from "lucide-react"
import { useState } from "react"

interface RatingStarsProps {
  // Current 1-10 rating, or null when unrated.
  value: number | null
  // Called with the new rating, or null when the user clicks the current value to clear it.
  onChange: (value: number | null) => void
  // Star size in px (default 22). The celebration overlay uses a larger size.
  size?: number
  disabled?: boolean
}

// A row of 10 stars for the app's 10-point personal rating scale (chosen to match
// how TMDB/IMDb scores are shown elsewhere). Hover previews the score; clicking the
// star that's already selected clears the rating.
export function RatingStars({ value, onChange, size = 22, disabled = false }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? value ?? 0

  return (
    <div className="inline-flex items-center gap-3">
      <div className="flex items-center" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            className="p-0.5 hover:cursor-pointer disabled:cursor-default"
            aria-label={`Rate ${n} out of 10`}
            aria-pressed={value === n}
          >
            <Star
              className={`transition-transform ${disabled ? "" : "hover:scale-110"} ${
                n <= active ? "text-amber-400" : "text-muted-foreground/40"
              }`}
              style={{ width: size, height: size }}
              strokeWidth={1.5}
              fill={n <= active ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-foreground tabular-nums min-w-[3ch]">
        {active > 0 ? `${active}/10` : "—"}
      </span>
    </div>
  )
}
