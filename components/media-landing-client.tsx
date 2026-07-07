"use client"

import { useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useModal } from "./modal-provider"
import type { MediaItem } from "./media-card"

interface MediaLandingClientProps {
  item: MediaItem
  tmdbApiKey: string
}

// Rendered by app/movie/[id]/page.tsx, app/series/[id]/page.tsx, and
// app/book/[id]/page.tsx - opens the details modal for a directly-visited
// share link (see components/modal-provider.tsx's `seededFromUrl`), over a
// minimal background so there's something sensible if the modal is closed
// before it navigates home.
export function MediaLandingClient({ item, tmdbApiKey }: MediaLandingClientProps) {
  const { openModal, setTmdbApiKey } = useModal()

  useEffect(() => {
    setTmdbApiKey(tmdbApiKey)
    openModal(item, { seededFromUrl: true })
    // Only ever run once, for the item this page was loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-16 sm:h-20 items-center">
            <Link href="/" className="flex items-center">
              <div className="h-14 w-14 sm:h-18 sm:w-18 relative">
                <Image src="/logo-blue.png" alt="ClickNotes Logo" fill className="object-contain" priority />
              </div>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  )
}
