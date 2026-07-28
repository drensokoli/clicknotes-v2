import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { setBump, type MediaType } from "@/lib/saved-media"

const MEDIA_TYPES: MediaType[] = ["movie", "series", "book"]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaType, mediaId, bumped } = body as {
      mediaType?: MediaType
      mediaId?: string | number
      bumped?: boolean
    }

    if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Invalid or missing mediaType" }, { status: 400 })
    }
    if (mediaId === undefined || mediaId === null || `${mediaId}`.length === 0) {
      return NextResponse.json({ error: "Missing mediaId" }, { status: 400 })
    }
    if (typeof bumped !== "boolean") {
      return NextResponse.json({ error: "Missing or invalid bumped flag" }, { status: 400 })
    }

    const bumpedAt = await setBump(session.user.id, mediaType, `${mediaId}`, bumped)

    return NextResponse.json({ success: true, bumpedAt: bumpedAt ? bumpedAt.toISOString() : null })
  } catch (error) {
    console.error("Bump media error:", error)
    return NextResponse.json({ error: "Failed to bump media" }, { status: 500 })
  }
}
