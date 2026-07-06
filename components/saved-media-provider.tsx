"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export type MediaType = "movie" | "series" | "book"
export type SavedStatus = "to_watch" | "watching" | "watched"

// The full card item to persist. Typed as `unknown` here (rather than importing
// MediaItem from media-card) to avoid a circular import — media-card imports this
// module for the useSavedMedia hook. The provider only forwards it as the POST body.
interface SavedMediaContextType {
  getStatus: (type: MediaType, id: string | number) => SavedStatus | null
  toggle: (type: MediaType, id: string | number, status: SavedStatus, item: unknown) => Promise<void>
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

export function SavedMediaProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const isAuthenticated = sessionStatus === "authenticated"

  // Map of "type:id" -> status for the current user's saved items.
  const [statusMap, setStatusMap] = useState<Record<string, SavedStatus>>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Load the user's saved keys once when they become authenticated.
  useEffect(() => {
    if (sessionStatus === "loading") return

    if (!isAuthenticated) {
      setStatusMap({})
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
        for (const item of data.items) {
          next[keyOf(item.mediaType, item.mediaId)] = item.status
        }
        setStatusMap(next)
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
    [isAuthenticated, statusMap, router],
  )

  return (
    <SavedMediaContext.Provider value={{ getStatus, toggle, isAuthenticated, isLoaded }}>
      {children}
    </SavedMediaContext.Provider>
  )
}
