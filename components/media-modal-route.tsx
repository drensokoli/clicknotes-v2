"use client"

import { useEffect, useState } from "react"
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
  const { list, pendingNav, setPendingNav } = useBrowsableList()
  const index = list.findIndex((entry) => entry.type === item.type && String(entry.id) === String(item.id))
  const hasPrev = index > 0
  const hasNext = index !== -1 && index < list.length - 1

  // This component is a fresh instance on every prev/next step (Next.js re-runs the
  // intercepted route's server segment for the new id), so it can't track "which way
  // did we just move" in its own state the way the Library's persistent modal does -
  // it has to read it from context, captured once at mount before pendingNav gets
  // cleared below. A plain, non-carousel open (e.g. clicking a card) leaves pendingNav
  // null, so this correctly comes out as "don't animate the content, no direction".
  const [{ animateContentOnMount, initialDirection }] = useState(() => ({
    animateContentOnMount: pendingNav !== null,
    initialDirection: pendingNav?.direction ?? 1,
  }))

  useEffect(() => {
    setPendingNav(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prev/next navigate to the sibling's own canonical URL rather than swapping local
  // state, since this modal is a route (app/@modal/(.)movie|series|book/[id]), not an
  // in-place overlay - router.replace re-triggers the interception (same as clicking a
  // different card's Link) so only the modal slot's content changes. Using replace
  // instead of push keeps a single history entry for "the modal is open" no matter how
  // many items you page through, so closing always lands back on the underlying page
  // in one step instead of walking back through every item you visited.
  const goToSibling = (siblingIndex: number, direction: number) => {
    const sibling = list[siblingIndex]
    if (!sibling) return
    setPendingNav({ direction })
    router.replace(getMediaHref(sibling.type, sibling.id))
  }

  const handleClose = () => {
    setPendingNav(null)
    router.back()
  }

  return (
    <MediaDetailsModal
      item={item}
      isOpen
      onClose={handleClose}
      tmdbApiKey={tmdbApiKey}
      omdbApiKeys={omdbApiKeys}
      onPrev={hasPrev ? () => goToSibling(index - 1, -1) : undefined}
      onNext={hasNext ? () => goToSibling(index + 1, 1) : undefined}
      hasPrev={hasPrev}
      hasNext={hasNext}
      position={index !== -1 ? index + 1 : undefined}
      total={list.length || undefined}
      animateContentOnMount={animateContentOnMount}
      initialDirection={initialDirection}
    />
  )
}
