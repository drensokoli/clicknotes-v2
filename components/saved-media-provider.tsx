"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export type MediaType = "movie" | "tvshow" | "book"
export type SavedStatus = "to_watch" | "watched"

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
        const res = await fetch("/api/media/saved")
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
