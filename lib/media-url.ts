import type { MediaType } from "@/components/saved-media-provider"

// Canonical, shareable URL for a single media item - /movie/{tmdbId},
// /series/{tmdbId}, /book/{googleBooksId}. Used both to build share links and
// to detect "is the current route a media detail page" (see modal-provider.tsx).
export function getMediaHref(mediaType: MediaType, id: string | number): string {
  return `/${mediaType}/${id}`
}

const MEDIA_PATH_PATTERN = /^\/(movie|series|book)\/[^/]+$/

export function isMediaHref(pathname: string): boolean {
  return MEDIA_PATH_PATTERN.test(pathname)
}
