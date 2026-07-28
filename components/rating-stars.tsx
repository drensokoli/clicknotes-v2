"use client"

import { Star, X } from "lucide-react"
import { useState } from "react"

interface RatingStarsProps {
  // Current 1-10 rating, or null when unrated.
  value: number | null
  // Called with the new rating, or null when the user clears it.
  onChange: (value: number | null) => void
  // "inline" (default) is the compact form used in the detail modal; "large" is the
  // celebratory form used by the completion overlay.
  size?: "inline" | "large"
  disabled?: boolean
}

// Plain-language feedback for each point on the scale, so the score means something
// as you hover rather than being a bare digit.
const RATING_LABELS: Record<number, string> = {
  1: "Awful",
  2: "Bad",
  3: "Poor",
  4: "Weak",
  5: "Okay",
  6: "Decent",
  7: "Good",
  8: "Great",
  9: "Amazing",
  10: "Masterpiece",
}

// The app's 10-point personal rating scale (matching how TMDB/IMDb scores are shown
// elsewhere). Deliberately explicit rather than clever: the label, the stars and the
// readout each get their own line so nothing competes for horizontal space (ten stars
// plus a label does not fit on a phone), every star is a real tap target, the current
// score is spelled out in words, and clearing is its own labelled button rather than a
// hidden "click the active star again" gesture.
export function RatingStars({ value, onChange, size = "inline", disabled = false }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const preview = hover ?? value ?? 0
  const isLarge = size === "large"

  // Sized to fit ten stars within the narrowest container each variant lives in
  // (the modal's library panel / the celebration card) on a 375px-wide screen.
  const starClass = isLarge ? "w-6 h-6 sm:w-7 sm:h-7" : "w-[22px] h-[22px] sm:w-6 sm:h-6"
  // Padding is what turns each star into a comfortable tap target rather than a
  // pixel-hunting exercise; the same amount works for both variants.
  const hitPadding = "p-0.5 sm:p-1"

  const clearButton = value !== null && !disabled && (
    <button
      type="button"
      onClick={() => onChange(null)}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors hover:cursor-pointer"
      title="Remove your rating"
    >
      <X className="w-3 h-3" />
      Clear
    </button>
  )

  const stars = (
    <div className="flex items-center -mx-0.5" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(n)}
          className={`${hitPadding} rounded hover:cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
          aria-label={`Rate ${n} out of 10 - ${RATING_LABELS[n]}`}
          aria-pressed={value === n}
          title={`${n}/10 - ${RATING_LABELS[n]}`}
        >
          <Star
            className={`${starClass} transition-all ${disabled ? "" : "hover:scale-110"} ${
              n <= preview ? "text-amber-400" : "text-muted-foreground/30"
            }`}
            strokeWidth={1.5}
            fill={n <= preview ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  )

  // Readout keeps a fixed min-height so the layout doesn't jump between states.
  const readout = (
    <div className={`min-h-5 flex items-center gap-2 ${isLarge ? "justify-center" : ""}`}>
      {preview > 0 ? (
        <>
          <span className={`font-bold text-foreground tabular-nums ${isLarge ? "text-lg" : "text-sm"}`}>
            {preview}/10
          </span>
          <span className={`font-medium text-amber-500 ${isLarge ? "text-base" : "text-sm"}`}>
            {RATING_LABELS[preview]}
          </span>
        </>
      ) : (
        <span className={`text-muted-foreground ${isLarge ? "text-sm" : "text-xs"}`}>
          Tap a star to rate this
        </span>
      )}
    </div>
  )

  if (isLarge) {
    return (
      <div className="flex flex-col items-center gap-2">
        {stars}
        {readout}
        {clearButton}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Your rating
        </span>
        {clearButton}
      </div>
      {stars}
      {readout}
    </div>
  )
}
