"use client"

import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import type { MediaType } from "./saved-media-provider"

export interface BrowsableListEntry {
  type: MediaType
  id: string | number
}

interface BrowsableListContextType {
  list: BrowsableListEntry[]
  setList: (list: BrowsableListEntry[]) => void
}

const BrowsableListContext = createContext<BrowsableListContextType | null>(null)

// Lets a page-level grid (currently just the Home "Popular" sections in
// components/content-section.tsx) publish the exact ordered list of items it has on
// screen right now - respecting whatever search/genre/person filter is active - so
// that the intercepted detail modal (components/media-modal-route.tsx), which is a
// server-rendered sibling under app/@modal rather than a child of the grid, can look
// up prev/next siblings for the item it's currently showing. This mirrors the
// Library's in-place carousel (components/saved-list.tsx), but since Home's modal is
// route-based rather than in-place, prev/next there navigates via router.push to the
// sibling's own /movie|series|book/[id] URL instead of just swapping local state.
export function BrowsableListProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<BrowsableListEntry[]>([])

  const value = useMemo(() => ({ list, setList }), [list])

  return <BrowsableListContext.Provider value={value}>{children}</BrowsableListContext.Provider>
}

export function useBrowsableList() {
  const ctx = useContext(BrowsableListContext)
  if (!ctx) throw new Error("useBrowsableList must be used within BrowsableListProvider")
  return ctx
}

// Convenience for registering a grid's currently-visible list. Call from a
// useEffect keyed on the list itself, e.g.:
//   const { setList } = useBrowsableList()
//   useEffect(() => setList(items.map(toBrowsableEntry)), [items, setList])
export function toBrowsableEntry(item: { type: MediaType; id: string | number }): BrowsableListEntry {
  return { type: item.type, id: item.id }
}
