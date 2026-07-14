import type { MediaType } from "@/components/saved-media-provider"

// Canonical, shareable URL for a single media item - /movie/{tmdbId},
// /series/{tmdbId}, /book/{googleBooksId}. Used both as the Link href that
// opens the details modal (see components/media-card.tsx, intercepted into
// the @modal parallel route) and to build the Share button's copyable link.
export function getMediaHref(mediaType: MediaType, id: string | number): string {
  return `/${mediaType}/${id}`
}
