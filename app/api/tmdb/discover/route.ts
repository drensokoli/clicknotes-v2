import { NextRequest, NextResponse } from "next/server"
import { isEroticContent } from "@/lib/content-quality"

interface TmdbListItem {
  id: number
  title?: string
  name?: string
  overview?: string
}

// Live "Popular by genre" for the Home page's genre pills - a flat Redis-cached
// Popular list can't be filtered deeply by genre (it's not partitioned that
// way), so a genre pill switches the grid to this instead. Quality/adult
// filtering mirrors the Redis population job (app/api/cron/route.ts): TMDB's
// own vote_average.gte/vote_count.gte/include_adult params replace
// meetsQualityStandards() (cheaper - filtered server-side by TMDB instead of
// fetched then discarded), and isEroticContent() (shared via
// lib/content-quality.ts) still runs post-fetch since TMDB's include_adult
// flag doesn't catch suggestive-but-unflagged content.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const genres = searchParams.get("genres")
  const page = searchParams.get("page") || "1"

  if ((type !== "movie" && type !== "tv") || !genres) {
    return NextResponse.json({ results: [], totalPages: 0 }, { status: 400 })
  }

  const tmdbApiKey = process.env.TMDB_API_KEY
  if (!tmdbApiKey) {
    return NextResponse.json({ results: [], totalPages: 0 }, { status: 500 })
  }

  // Pipe-separated = OR semantics ("Action or Comedy"), matching a multi-select
  // pill row rather than requiring every selected genre to match at once.
  const withGenres = genres
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .join("|")

  try {
    const url =
      `https://api.themoviedb.org/3/discover/${type}?api_key=${tmdbApiKey}&language=en-US&page=${page}` +
      `&with_genres=${encodeURIComponent(withGenres)}&sort_by=popularity.desc` +
      `&vote_average.gte=6&vote_count.gte=10&include_adult=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ results: [], totalPages: 0 })

    const data = await res.json()
    const results = ((data.results ?? []) as TmdbListItem[]).filter((item) => {
      const title = (item.title ?? item.name ?? "").toLowerCase()
      const description = (item.overview ?? "").toLowerCase()
      return !isEroticContent(title, description)
    })

    return NextResponse.json({ results, totalPages: data.total_pages ?? 1 })
  } catch (error) {
    console.error("TMDB discover proxy error:", error)
    return NextResponse.json({ results: [], totalPages: 0 })
  }
}
