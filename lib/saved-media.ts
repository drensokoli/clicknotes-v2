import clientPromise from "@/lib/mongodb"
import type { Collection } from "mongodb"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"
const COLLECTION = "savedMedia"

export type MediaType = "movie" | "tvshow" | "book"
export type SavedStatus = "to_watch" | "watched"

// Slim card snapshot — only the fields MediaCard needs to render and to re-open
// the detail modal (which re-fetches full details from the id on demand). No
// details/credits/videos/omdb blobs are stored, keeping each doc ~300 bytes.
export interface SavedCard {
  id: number | string
  type: MediaType
  // movie / tvshow
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  // book
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    averageRating?: number
    imageLinks?: { thumbnail?: string | null }
  }
}

export interface SavedMediaDoc {
  userId: string
  mediaType: MediaType
  mediaId: string
  status: SavedStatus
  card: SavedCard
  createdAt: Date
  updatedAt: Date
}

let indexesEnsured = false

export async function getSavedMediaCollection(): Promise<Collection<SavedMediaDoc> | null> {
  const client = await clientPromise
  // lib/mongodb resolves to null when MongoDB is unavailable instead of throwing
  if (!client) return null

  const collection = client.db(db).collection<SavedMediaDoc>(COLLECTION)

  if (!indexesEnsured) {
    await Promise.all([
      collection.createIndex({ userId: 1, mediaType: 1, mediaId: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, status: 1 }),
    ])
    indexesEnsured = true
  }

  return collection
}

// Whitelist just the display fields for the given media type so we never persist
// the heavy `details` / `omdbData` / `stremioLink` blobs the client card may carry.
export function toSlimCard(mediaType: MediaType, card: SavedCard): SavedCard {
  if (mediaType === "movie") {
    return {
      id: card.id,
      type: "movie",
      title: card.title,
      overview: card.overview,
      poster_path: card.poster_path ?? null,
      backdrop_path: card.backdrop_path ?? null,
      release_date: card.release_date,
      vote_average: card.vote_average,
    }
  }

  if (mediaType === "tvshow") {
    return {
      id: card.id,
      type: "tvshow",
      name: card.name,
      overview: card.overview,
      poster_path: card.poster_path ?? null,
      backdrop_path: card.backdrop_path ?? null,
      first_air_date: card.first_air_date,
      vote_average: card.vote_average,
    }
  }

  // book
  const vi = card.volumeInfo || {}
  return {
    id: card.id,
    type: "book",
    volumeInfo: {
      title: vi.title,
      authors: vi.authors,
      description: vi.description,
      publishedDate: vi.publishedDate,
      averageRating: vi.averageRating,
      imageLinks: { thumbnail: vi.imageLinks?.thumbnail ?? null },
    },
  }
}

export interface ListFilter {
  status?: SavedStatus
  mediaType?: MediaType
}

export async function listForUser(userId: string, filter: ListFilter = {}): Promise<SavedMediaDoc[]> {
  const collection = await getSavedMediaCollection()
  if (!collection) return []

  const query: Record<string, unknown> = { userId }
  if (filter.status) query.status = filter.status
  if (filter.mediaType) query.mediaType = filter.mediaType

  return collection.find(query).sort({ updatedAt: -1 }).toArray()
}

// Toggle semantics for the two buttons (each toggles its own status):
//   - no existing doc            -> insert with `status`         => returns status
//   - existing doc, same status  -> delete (un-save)             => returns null
//   - existing doc, other status -> update to `status`           => returns status
export async function toggleStatus(
  userId: string,
  mediaType: MediaType,
  mediaId: string,
  status: SavedStatus,
  card: SavedCard,
): Promise<SavedStatus | null> {
  const collection = await getSavedMediaCollection()
  if (!collection) throw new Error("Database unavailable")

  const key = { userId, mediaType, mediaId }
  const existing = await collection.findOne(key)

  if (!existing) {
    const now = new Date()
    await collection.insertOne({
      userId,
      mediaType,
      mediaId,
      status,
      card: toSlimCard(mediaType, card),
      createdAt: now,
      updatedAt: now,
    })
    return status
  }

  if (existing.status === status) {
    await collection.deleteOne(key)
    return null
  }

  await collection.updateOne(key, {
    $set: { status, card: toSlimCard(mediaType, card), updatedAt: new Date() },
  })
  return status
}
