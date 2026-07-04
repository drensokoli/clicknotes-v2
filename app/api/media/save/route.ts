import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { toggleStatus, type MediaType, type SavedStatus, type SavedCard } from "@/lib/saved-media"

const MEDIA_TYPES: MediaType[] = ["movie", "tvshow", "book"]
const STATUSES: SavedStatus[] = ["to_watch", "watched"]

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

    const newStatus = await toggleStatus(
      session.user.id,
      mediaType,
      `${mediaId}`,
      status,
      card,
    )

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error("Save media error:", error)
    return NextResponse.json({ error: "Failed to save media" }, { status: 500 })
  }
}
