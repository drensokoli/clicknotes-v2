"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { MediaDetailsModal } from "./media-details-modal"
import type { MediaItem } from "./media-card"

interface MediaLandingClientProps {
  item: MediaItem
  tmdbApiKey: string
  omdbApiKeys: string[]
}

// Rendered by app/movie/[id]/page.tsx, app/series/[id]/page.tsx, and
// app/book/[id]/page.tsx for a directly-visited share link (typed URL, reload,
// or a link opened from outside the app) - there's no prior in-app page to
// return to, so closing navigates home instead of going back. Renders over a
// minimal background so there's something sensible underneath the modal.
//
// A same-app click on a card never reaches this file - it's intercepted into
// the @modal parallel route instead (see app/@modal/(.)movie/[id]/page.tsx and
// components/media-modal-route.tsx), which closes via router.back() to return
// to the exact page/scroll/filter state the user clicked from.
export function MediaLandingClient({ item, tmdbApiKey, omdbApiKeys }: MediaLandingClientProps) {
  const router = useRouter()

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
      <MediaDetailsModal
        item={item}
        isOpen
        onClose={() => router.push("/")}
        tmdbApiKey={tmdbApiKey}
        omdbApiKeys={omdbApiKeys}
      />
    </div>
  )
}
