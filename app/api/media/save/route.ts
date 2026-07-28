import "@/app/setup" // Setup SSL configuration before any secureFetch-based TMDB call
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { toggleStatus, type MediaType, type SavedStatus, type SavedCard } from "@/lib/saved-media"
import { enrichCardForSave } from "@/lib/save-enrichment"

const MEDIA_TYPES: MediaType[] = ["movie", "series", "book"]
const STATUSES: SavedStatus[] = ["to_watch", "watching", "watched"]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaType, mediaId, status, card } = body as {
      mediaType?: MediaType
      mediaId?: string | number
      status?: SavedStatus
      card?: SavedCard
    }

    if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Invalid or missing mediaType" }, { status: 400 })
    }
    if (mediaId === undefined || mediaId === null || `${mediaId}`.length === 0) {
      return NextResponse.json({ error: "Missing mediaId" }, { status: 400 })
    }
    if (!status || !STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid or missing status" }, { status: 400 })
    }
    if (!card || typeof card !== "object") {
      return NextResponse.json({ error: "Missing card" }, { status: 400 })
    }

    // Backfill runtime/genres/credits for movies & series saved without details
    // (e.g. straight from a title search) so the Library's runtime filter and
    // people/genre search work on them - see lib/save-enrichment.ts. Popular-card
    // saves already carry details and skip the fetch. Enrichment only matters when
    // the item is actually being saved (not un-saved); toggleStatus ignores the
    // card on the delete path anyway, so enriching unconditionally is harmless.
    const enrichedCard = await enrichCardForSave(mediaType, card, process.env.TMDB_API_KEY)

    const newStatus = await toggleStatus(
      session.user.id,
      mediaType,
      `${mediaId}`,
      status,
      enrichedCard,
    )

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error("Save media error:", error)
    return NextResponse.json({ error: "Failed to save media" }, { status: 500 })
  }
}
