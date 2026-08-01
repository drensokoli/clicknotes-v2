import type { MetadataRoute } from "next"

const SITE_URL = "https://www.clicknotes.site"
// Server-to-server base for hitting our own API route - same convention as app/page.tsx.
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

// Sitemap only needs to surface a useful slice of the Redis-cached popular
// items, not the full 240-item cache per media type.
const ITEMS_PER_TYPE = 100

async function fetchCachedIds(mediaType: "movies" | "series" | "books"): Promise<string[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/redisHandler?type=range&mediaType=${mediaType}&start=0&end=${ITEMS_PER_TYPE - 1}`,
      { next: { revalidate: 60 * 60 * 24 } },
    )
    if (!response.ok) return []

    const data = await response.json()
    if (!data.success || !Array.isArray(data.items)) return []

    return data.items
      .map((item: { id?: string | number }) => (item?.id !== undefined ? String(item.id) : null))
      .filter((id: string | null): id is string => Boolean(id))
  } catch {
    return []
  }
}

export const revalidate = 86400 // 1 day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [movieIds, seriesIds, bookIds] = await Promise.all([
    fetchCachedIds("movies"),
    fetchCachedIds("series"),
    fetchCachedIds("books"),
  ])

  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ]

  const dynamicRoutes = (
    [
      ["movie", movieIds],
      ["series", seriesIds],
      ["book", bookIds],
    ] as const
  ).flatMap(([segment, ids]) =>
    ids.map((id) => ({
      url: `${SITE_URL}/${segment}/${id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  )

  return [...staticRoutes, ...dynamicRoutes]
}
