import { NextRequest, NextResponse } from "next/server"

interface TmdbPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  popularity?: number
}

export interface PersonResult {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  popularity: number
}

// Powers the actor/director "People" row above Home search results - see
// components/person-chip-row.tsx and app/api/tmdb/person-credits/route.ts
// (fetches a selected person's filmography).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ people: [] })
  }

  const tmdbApiKey = process.env.TMDB_API_KEY
  if (!tmdbApiKey) {
    return NextResponse.json({ people: [] }, { status: 500 })
  }

  try {
    const url = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(query)}&include_adult=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ people: [] })

    const data = await res.json()
    const people: PersonResult[] = ((data.results ?? []) as TmdbPerson[])
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path,
        known_for_department: p.known_for_department ?? null,
        popularity: p.popularity ?? 0,
      }))

    return NextResponse.json({ people })
  } catch (error) {
    console.error("TMDB person search proxy error:", error)
    return NextResponse.json({ people: [] })
  }
}
