"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { X, PartyPopper } from "lucide-react"
import { RatingStars } from "./rating-stars"

interface RatingCelebrationProps {
  title: string
  poster: string | null
  // Current rating (usually null - this fires for freshly-completed, unrated items).
  value: number | null
  onRate: (value: number | null) => void
  onClose: () => void
}

const CONFETTI_COLORS = ["#1a56db", "#f5b301", "#16a34a", "#dc2626", "#7b5bf5", "#0ea5e9"]

// A short, celebratory overlay shown when an item is marked Completed but not yet
// rated (triggered centrally from SavedMediaProvider so it fires whether the user
// completed from the grid card or the detail modal). Picking a rating persists it
// and closes; the confetti is built from motion divs - no extra dependency.
export function RatingCelebration({ title, poster, value, onRate, onClose }: RatingCelebrationProps) {
  const [picked, setPicked] = useState<number | null>(value)

  // Stable random confetti pieces for this mount.
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.8 + Math.random() * 1.4,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  )

  const handlePick = (next: number | null) => {
    setPicked(next)
    onRate(next)
    // Let the user see their pick land, then close.
    if (next !== null) window.setTimeout(onClose, 650)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <motion.div
            key={p.id}
            className="absolute top-[-5%] rounded-[2px]"
            style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
            initial={{ y: "-10vh", opacity: 0, rotate: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: p.rotate }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md rounded-2xl bg-surface shadow-2xl p-6 sm:p-8 text-center"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors hover:cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {poster && (
          <motion.div
            initial={{ rotate: -6, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="mx-auto -mt-2 mb-4 w-24 h-36 relative overflow-hidden rounded-lg shadow-lg"
          >
            <Image src={poster} alt={title} fill quality={70} sizes="96px" className="object-cover" />
          </motion.div>
        )}

        <div className="flex items-center justify-center gap-2 text-primary mb-1">
          <PartyPopper className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Completed!</span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1 line-clamp-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-5">How would you rate it?</p>

        <div className="flex justify-center mb-5">
          <RatingStars value={picked} onChange={handlePick} size="large" />
        </div>

        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:cursor-pointer"
        >
          Maybe later
        </button>
      </motion.div>
    </div>
  )
}
