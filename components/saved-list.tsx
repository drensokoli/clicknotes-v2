"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useModal } from "./modal-provider"
import { useSavedMedia, type MediaType, type SavedStatus } from "./saved-media-provider"
import { MediaCard, type MediaItem } from "./media-card"
import { MediaDetailsModal } from "./media-details-modal"
import { UserProfile } from "./user-profile"
import type { SavedCard } from "@/lib/saved-media"

interface SavedItem {
  mediaType: MediaType
  mediaId: string
  status: SavedStatus
  card: SavedCard
}

interface SavedListProps {
  items: SavedItem[]
  tmdbApiKey: string
  omdbApiKeys: string[]
}

type TypeFilter = "all" | MediaType

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tvshow", label: "TV Shows" },
  { key: "book", label: "Books" },
]

export function SavedList({ items, tmdbApiKey, omdbApiKeys }: SavedListProps) {
  const { setTmdbApiKey } = useModal()
  const { getStatus, isLoaded } = useSavedMedia()

  const [activeTab, setActiveTab] = useState<SavedStatus>("to_watch")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")

  // Make the detail modal able to fetch full details on card click.
  useEffect(() => {
    setTmdbApiKey(tmdbApiKey)
  }, [tmdbApiKey, setTmdbApiKey])

  // Effective status: show the server-provided status until the provider has loaded
  // its own copy, then follow live provider state so un-saving / moving reacts instantly.
  const effectiveStatus = (item: SavedItem): SavedStatus | null =>
    isLoaded ? getStatus(item.mediaType, item.mediaId) : item.status

  const visibleItems = items.filter((item) => {
    if (effectiveStatus(item) !== activeTab) return false
    if (typeFilter !== "all" && item.mediaType !== typeFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-40 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="h-14 w-14 sm:h-18 sm:w-18 relative">
                <Image src="/logo-blue.png" alt="ClickNotes Logo" fill className="object-contain" priority />
              </div>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">My List</h1>
            <UserProfile />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Status tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveTab("to_watch")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors hover:cursor-pointer ${
              activeTab === "to_watch"
                ? "bg-primary text-white"
                : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            To Watch / Read
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors hover:cursor-pointer ${
              activeTab === "watched"
                ? "bg-green-600 text-white"
                : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            Watched / Read
          </button>
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:cursor-pointer ${
                typeFilter === f.key
                  ? "bg-foreground text-background"
                  : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground text-lg mb-2">
              Nothing here yet
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              Save movies, TV shows, and books to build your list.
            </p>
            <Link
              href="/"
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors"
            >
              Browse popular
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8">
            {visibleItems.map((item) => (
              <MediaCard
                key={`${item.mediaType}:${item.mediaId}`}
                item={item.card as unknown as MediaItem}
              />
            ))}
          </div>
        )}
      </main>

      <MediaDetailsModal omdbApiKeys={omdbApiKeys} />
    </div>
  )
}
