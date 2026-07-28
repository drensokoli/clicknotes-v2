"use client"

import { useRouter } from "next/navigation"
import { MediaDetailsModal } from "./media-details-modal"
import type { MediaItem } from "./media-card"

interface MediaModalRouteProps {
  item: MediaItem
  tmdbApiKey: string
  omdbApiKeys: string[]
}

// Rendered by the app/@modal/(.)movie|series|book/[id] intercepting routes -
// the item was already fetched server-side with full details, so this just
// shows it as an overlay on top of whatever page the click came from (Home
// grid, Library's filtered view, Shuffle) without navigating away from it.
// Closing goes back to that exact page/scroll/filter state via the router,
// the same way any other "opened a detail view" gesture would.
export function MediaModalRoute({ item, tmdbApiKey, omdbApiKeys }: MediaModalRouteProps) {
  const router = useRouter()

  return (
    <MediaDetailsModal
      item={item}
      isOpen
      onClose={() => router.back()}
      tmdbApiKey={tmdbApiKey}
      omdbApiKeys={omdbApiKeys}
    />
  )
}
