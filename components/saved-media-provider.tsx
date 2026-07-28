"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RatingCelebration } from "./rating-celebration"

export type MediaType = "movie" | "series" | "book"
export type SavedStatus = "to_watch" | "watching" | "watched"

// The full card item to persist. Typed as `unknown` here (rather than importing
// MediaItem from media-card) to avoid a circular import — media-card imports this
// module for the useSavedMedia hook. The provider only forwards it as the POST body.
interface SavedMediaContextType {
  getStatus: (type: MediaType, id: string | number) => SavedStatus | null
  toggle: (type: MediaType, id: string | number, status: SavedStatus, item: unknown) => Promise<void>
  // The user's own 1-10 rating for an item, or null if unrated.
  getRating: (type: MediaType, id: string | number) => number | null
  // Set (or clear, with null) the user's rating. No-op unless the item is saved.
  rate: (type: MediaType, id: string | number, rating: number | null) => Promise<void>
  // The ISO timestamp an item was bumped (pinned to top), or null if not bumped.
  getBump: (type: MediaType, id: string | number) => string | null
  // Toggle an item's bumped/pinned state. No-op unless the item is saved.
  toggleBump: (type: MediaType, id: string | number) => Promise<void>
  isAuthenticated: boolean
  // True once the user's saved state has been fetched (or determined unavailable).
  isLoaded: boolean
}

const SavedMediaContext = createContext<SavedMediaContextType | undefined>(undefined)

export function useSavedMedia() {
  const context = useContext(SavedMediaContext)
  if (!context) {
    throw new Error("useSavedMedia must be used within a SavedMediaProvider")
  }
  return context
}

const keyOf = (type: MediaType, id: string | number) => `${type}:${id}`

const STATUS_LABELS: Record<SavedStatus, string> = {
  to_watch: "Saved",
  watching: "In Progress",
  watched: "Completed",
}

// Best-effort title extraction for the undo toast - `item` is untyped here (see note
// above), so this just probes the shapes MediaCard/media-details-modal already use.
function extractTitle(item: unknown): string {
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>
    if (typeof obj.title === "string") return obj.title
    if (typeof obj.name === "string") return obj.name
    const volumeInfo = obj.volumeInfo as Record<string, unknown> | undefined
    if (volumeInfo && typeof volumeInfo.title === "string") return volumeInfo.title
  }
  return "Item"
}

// Best-effort poster URL for the completion celebration - same untyped probing as
// extractTitle, mirroring MediaCard/modal's getPosterUrl (TMDB path for movies/series,
// Google Books thumbnail for books).
function extractPoster(item: unknown): string | null {
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>
    if (typeof obj.poster_path === "string" && obj.poster_path) {
      return `https://image.tmdb.org/t/p/w342${obj.poster_path}`
    }
    const volumeInfo = obj.volumeInfo as { imageLinks?: { thumbnail?: string | null } } | undefined
    const thumb = volumeInfo?.imageLinks?.thumbnail
    if (typeof thumb === "string" && thumb) return thumb.replace("http:", "https:")
  }
  return null
}

export function SavedMediaProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const isAuthenticated = sessionStatus === "authenticated"

  // Map of "type:id" -> status for the current user's saved items.
  const [statusMap, setStatusMap] = useState<Record<string, SavedStatus>>({})
  // Map of "type:id" -> the user's own 1-10 rating.
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({})
  // Map of "type:id" -> ISO timestamp for bumped (pinned) items.
  const [bumpMap, setBumpMap] = useState<Record<string, string>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  // The item whose completion celebration is currently open (null when none).
  const [celebration, setCelebration] = useState<
    { type: MediaType; id: string | number; title: string; poster: string | null } | null
  >(null)

  // Load the user's saved keys once when they become authenticated.
  useEffect(() => {
    if (sessionStatus === "loading") return

    if (!isAuthenticated) {
      setStatusMap({})
      setRatingMap({})
      setBumpMap({})
      setIsLoaded(true)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // Never serve this from any cache layer - it must reflect saves/watches
        // made just now, including from another tab of the same browser.
        const res = await fetch("/api/media/saved", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data.success || !Array.isArray(data.items)) return

        const next: Record<string, SavedStatus> = {}
        const nextRatings: Record<string, number> = {}
        const nextBumps: Record<string, string> = {}
        for (const item of data.items) {
          const k = keyOf(item.mediaType, item.mediaId)
          next[k] = item.status
          if (typeof item.rating === "number") nextRatings[k] = item.rating
          if (typeof item.bumpedAt === "string") nextBumps[k] = item.bumpedAt
        }
        setStatusMap(next)
        setRatingMap(nextRatings)
        setBumpMap(nextBumps)
      } catch (error) {
        console.error("Failed to load saved media:", error)
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, sessionStatus])

  const getStatus = useCallback(
    (type: MediaType, id: string | number): SavedStatus | null => {
      return statusMap[keyOf(type, id)] ?? null
    },
    [statusMap],
  )

  const toggle = useCallback(
    async (type: MediaType, id: string | number, status: SavedStatus, item: unknown) => {
      if (!isAuthenticated) {
        router.push("/login")
        return
      }

      const key = keyOf(type, id)
      const current = statusMap[key] ?? null
      // Predict the result: clicking the active status un-saves; otherwise sets it.
      const predicted: SavedStatus | null = current === status ? null : status

      // Optimistic update
      setStatusMap((prev) => {
        const next = { ...prev }
        if (predicted === null) delete next[key]
        else next[key] = predicted
        return next
      })

      try {
        const res = await fetch("/api/media/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaType: type, mediaId: id, status, card: item }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Reconcile with the server's authoritative result.
        setStatusMap((prev) => {
          const next = { ...prev }
          if (data.status === null || data.status === undefined) delete next[key]
          else next[key] = data.status
          return next
        })

        // Show an undo toast for any change to a previously-saved item - a full
        // removal or a plain status change (e.g. to_watch -> watched) - but not
        // for a brand new save (current === null), where there's nothing to undo
        // back to besides removing it again.
        const newStatus = data.status ?? null
        if (current && newStatus !== current) {
          const title = extractTitle(item)
          const message = newStatus
            ? `Moved "${title}" to ${STATUS_LABELS[newStatus as SavedStatus]}`
            : `Removed "${title}" from your library`
          toast(message, {
            duration: 5000,
            // Restores the previous status, whatever it was - re-inserts if the
            // item is now absent (toggling an absent item with a given status
            // inserts it - see the predicted-status logic above).
            action: { label: "Undo", onClick: () => toggle(type, id, current, item) },
          })
        }

        // Reward completing something: when an item transitions into "watched" and
        // isn't rated yet, open the celebration so the user can rate it. Fires
        // wherever Completed was clicked (grid card or detail modal) since it's here.
        if (newStatus === "watched" && current !== "watched" && ratingMap[key] === undefined) {
          setCelebration({ type, id, title: extractTitle(item), poster: extractPoster(item) })
        }
      } catch (error) {
        console.error("Failed to toggle saved media:", error)
        // Revert to previous state on failure.
        setStatusMap((prev) => {
          const next = { ...prev }
          if (current === null) delete next[key]
          else next[key] = current
          return next
        })
      }
    },
    [isAuthenticated, statusMap, ratingMap, router],
  )

  const getRating = useCallback(
    (type: MediaType, id: string | number): number | null => {
      return ratingMap[keyOf(type, id)] ?? null
    },
    [ratingMap],
  )

  const rate = useCallback(
    async (type: MediaType, id: string | number, rating: number | null) => {
      if (!isAuthenticated) {
        router.push("/login")
        return
      }

      const key = keyOf(type, id)
      const previous = ratingMap[key] ?? null

      // Optimistic update
      setRatingMap((prev) => {
        const next = { ...prev }
        if (rating === null) delete next[key]
        else next[key] = rating
        return next
      })

      try {
        const res = await fetch("/api/media/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaType: type, mediaId: id, rating }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Reconcile with the server's authoritative result.
        setRatingMap((prev) => {
          const next = { ...prev }
          if (typeof data.rating === "number") next[key] = data.rating
          else delete next[key]
          return next
        })
      } catch (error) {
        console.error("Failed to rate media:", error)
        // Revert on failure.
        setRatingMap((prev) => {
          const next = { ...prev }
          if (previous === null) delete next[key]
          else next[key] = previous
          return next
        })
      }
    },
    [isAuthenticated, ratingMap, router],
  )

  const getBump = useCallback(
    (type: MediaType, id: string | number): string | null => {
      return bumpMap[keyOf(type, id)] ?? null
    },
    [bumpMap],
  )

  const toggleBump = useCallback(
    async (type: MediaType, id: string | number) => {
      if (!isAuthenticated) {
        router.push("/login")
        return
      }

      const key = keyOf(type, id)
      const previous = bumpMap[key] ?? null
      const nextBumped = previous === null

      // Optimistic update
      setBumpMap((prev) => {
        const next = { ...prev }
        if (nextBumped) next[key] = new Date().toISOString()
        else delete next[key]
        return next
      })

      try {
        const res = await fetch("/api/media/bump", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaType: type, mediaId: id, bumped: nextBumped }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Reconcile with the server's authoritative timestamp.
        setBumpMap((prev) => {
          const next = { ...prev }
          if (typeof data.bumpedAt === "string") next[key] = data.bumpedAt
          else delete next[key]
          return next
        })
      } catch (error) {
        console.error("Failed to bump media:", error)
        // Revert on failure.
        setBumpMap((prev) => {
          const next = { ...prev }
          if (previous === null) delete next[key]
          else next[key] = previous
          return next
        })
      }
    },
    [isAuthenticated, bumpMap, router],
  )

  return (
    <SavedMediaContext.Provider value={{ getStatus, toggle, getRating, rate, getBump, toggleBump, isAuthenticated, isLoaded }}>
      {children}
      {celebration && (
        <RatingCelebration
          title={celebration.title}
          poster={celebration.poster}
          value={getRating(celebration.type, celebration.id)}
          onRate={(value) => rate(celebration.type, celebration.id, value)}
          onClose={() => setCelebration(null)}
        />
      )}
    </SavedMediaContext.Provider>
  )
}
