import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { setRating, type MediaType } from "@/lib/saved-media"

const MEDIA_TYPES: MediaType[] = ["movie", "series", "book"]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaType, mediaId, rating } = body as {
      mediaType?: MediaType
      mediaId?: string | number
      rating?: number | null
    }

    if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Invalid or missing mediaType" }, { status: 400 })
    }
    if (mediaId === undefined || mediaId === null || `${mediaId}`.length === 0) {
      return NextResponse.json({ error: "Missing mediaId" }, { status: 400 })
    }
    // null clears the rating; otherwise require an integer 1-10.
    if (rating !== null && (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 10)) {
      return NextResponse.json({ error: "Rating must be an integer 1-10, or null to clear" }, { status: 400 })
    }

    const newRating = await setRating(session.user.id, mediaType, `${mediaId}`, rating ?? null)

    return NextResponse.json({ success: true, rating: newRating })
  } catch (error) {
    console.error("Rate media error:", error)
    return NextResponse.json({ error: "Failed to rate media" }, { status: 500 })
  }
}
