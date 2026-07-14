import { NextRequest, NextResponse } from "next/server"

// Proxies TMDB's title search so the API key never reaches the browser (the
// client used to call TMDB directly with the key in the URL - see
// lib/api-helpers.ts's searchMoviesByTitle/searchSeriesByTitle).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const query = searchParams.get("q")

  if (!query || (type !== "movie" && type !== "tv")) {
    return NextResponse.json({ results: [] }, { status: 400 })
  }

  const tmdbApiKey = process.env.TMDB_API_KEY
  if (!tmdbApiKey) {
    return NextResponse.json({ results: [] }, { status: 500 })
  }

  try {
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(query)}&include_adult=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ results: [] })
    const data = await res.json()
    return NextResponse.json({ results: data.results ?? [] })
  } catch (error) {
    console.error("TMDB search proxy error:", error)
    return NextResponse.json({ results: [] })
  }
}
