import { NextRequest, NextResponse } from "next/server"

interface TmdbCreditItem {
  id: number
  media_type: "movie" | "tv"
  title?: string
  name?: string
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  genre_ids?: number[]
}

// A selected person's filmography for the requested media type - see
// components/person-chip-row.tsx. Uses combined_credits (cast + crew in one
// call) rather than making the user pick "actor" vs "director" up front: a
// person can be both (e.g. an actor who also directs), and combined_credits
// already tags each credit so nothing forces a wrong disambiguation.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const personId = searchParams.get("personId")
  const mediaType = searchParams.get("mediaType")

  if (!personId || (mediaType !== "movie" && mediaType !== "tv")) {
    return NextResponse.json({ results: [] }, { status: 400 })
  }

  const tmdbApiKey = process.env.TMDB_API_KEY
  if (!tmdbApiKey) {
    return NextResponse.json({ results: [] }, { status: 500 })
  }

  try {
    const url = `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${tmdbApiKey}&language=en-US`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ results: [] })

    const data = await res.json()
    const cast = (data.cast ?? []) as TmdbCreditItem[]
    const crew = (data.crew ?? []) as TmdbCreditItem[]

    // A person can both act in and write/direct the same title - dedupe by id
    // once cast+crew are merged, keeping whichever credit object we saw first.
    const byId = new Map<number, TmdbCreditItem>()
    for (const credit of [...cast, ...crew]) {
      if (credit.media_type !== mediaType) continue
      if (!byId.has(credit.id)) byId.set(credit.id, credit)
    }

    const results = Array.from(byId.values())
      .filter((c) => !!(c.title || c.name))
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("TMDB person credits proxy error:", error)
    return NextResponse.json({ results: [] })
  }
}
