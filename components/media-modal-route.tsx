"use client"

import { useRouter } from "next/navigation"
import { MediaDetailsModal } from "./media-details-modal"
import type { MediaItem } from "./media-card"
import { useBrowsableList } from "./browsable-list-provider"
import { getMediaHref } from "@/lib/media-url"

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
  // Whatever page opened this (currently just Home - see content-section.tsx)
  // publishes its on-screen list here; the Library's own modal instead navigates
  // in-place (components/saved-list.tsx) since it isn't route-based. Empty when the
  // opener never published one (e.g. a direct visit to /movie/[id]), in which case
  // this renders with no prev/next, same as before this list existed.
  const { list } = useBrowsableList()
  const index = list.findIndex((entry) => entry.type === item.type && String(entry.id) === String(item.id))
  const hasPrev = index > 0
  const hasNext = index !== -1 && index < list.length - 1

  // Prev/next navigate to the sibling's own canonical URL rather than swapping local
  // state, since this modal is a route (app/@modal/(.)movie|series|book/[id]), not an
  // in-place overlay - router.push here re-triggers the interception (same as
  // clicking a different card's Link) so only the modal slot's content changes.
  const goToSibling = (siblingIndex: number) => {
    const sibling = list[siblingIndex]
    if (sibling) router.push(getMediaHref(sibling.type, sibling.id))
  }

  return (
    <MediaDetailsModal
      item={item}
      isOpen
      onClose={() => router.back()}
      tmdbApiKey={tmdbApiKey}
      omdbApiKeys={omdbApiKeys}
      onPrev={hasPrev ? () => goToSibling(index - 1) : undefined}
      onNext={hasNext ? () => goToSibling(index + 1) : undefined}
      hasPrev={hasPrev}
      hasNext={hasNext}
      position={index !== -1 ? index + 1 : undefined}
      total={list.length || undefined}
    />
  )
}
