import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listForUser, type MediaType, type SavedStatus } from "@/lib/saved-media"

const MEDIA_TYPES: MediaType[] = ["movie", "tvshow", "book"]
const STATUSES: SavedStatus[] = ["to_watch", "watched"]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status") as SavedStatus | null
    const typeParam = searchParams.get("type") as MediaType | null
    const withCards = searchParams.get("withCards") === "1"

    const docs = await listForUser(session.user.id, {
      status: statusParam && STATUSES.includes(statusParam) ? statusParam : undefined,
      mediaType: typeParam && MEDIA_TYPES.includes(typeParam) ? typeParam : undefined,
    })

    // Default response is lightweight keys (for hydrating button state); include the
    // full slim card only when explicitly requested (used to render the My List page).
    const items = docs.map((d) =>
      withCards
        ? { mediaType: d.mediaType, mediaId: d.mediaId, status: d.status, card: d.card }
        : { mediaType: d.mediaType, mediaId: d.mediaId, status: d.status },
    )

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("List saved media error:", error)
    return NextResponse.json({ error: "Failed to list saved media" }, { status: 500 })
  }
}
