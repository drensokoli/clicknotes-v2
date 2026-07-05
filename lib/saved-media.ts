import clientPromise from "@/lib/mongodb"
import type { Collection } from "mongodb"
import { splitBookCategories } from "./book-categories"

const db = process.env.MONGODB_DB_NAME || "clicknotes"
const COLLECTION = "savedMedia"

export type MediaType = "movie" | "series" | "book"
export type SavedStatus = "to_watch" | "watching" | "watched"

// Docs saved before the "tvshow" -> "series" rename still have the old value on
// disk until scripts/migrate-tvshow-to-series.js has been run against them; treat
// it as an alias on every read so nothing goes invisible mid-migration.
function normalizeMediaType(value: string): MediaType {
  return value === "tvshow" ? "series" : (value as MediaType)
}

function normalizeDoc(doc: SavedMediaDoc): SavedMediaDoc {
  return {
    ...doc,
    mediaType: normalizeMediaType(doc.mediaType),
    card: { ...doc.card, type: normalizeMediaType(doc.card.type) },
  }
}

// Slim card snapshot — the fields MediaCard needs to render, plus a small trimmed
// `details`/`omdbData`/`stremioLink` (runtime, genres, one trailer, imdbId/rated/awards)
// mirroring what population embeds in movies/series Redis cards. This lets the detail modal's
// existing "already have details+omdbData? skip the live fetch" check apply to saved
// items too, so Library cards get instant Watch/Trailer buttons the same as browsing
// cards. No cast/crew/full videos list here - that stays on-demand only.
export interface SavedCard {
  id: number | string
  type: MediaType
  // movie / series
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  // Cheap genre signal always present on browsing cards (from TMDB's list endpoint),
  // independent of whether the expensive per-item `details.genres` fetch succeeded -
  // see getGenres() in lib/library-filters.ts for how these get turned into names.
  genre_ids?: number[]
  details?: {
    runtime?: number
    genres?: Array<{ id: number; name: string }>
    number_of_seasons?: number
    number_of_episodes?: number
    status?: string
    tagline?: string
    type?: string
    videos?: { results: Array<{ key: string; name: string; site: string; type: string; official: boolean }> }
  }
  omdbData?: { imdbId: string; rated: string; runtime: string; awards: string }
  stremioLink?: string
  // book
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    averageRating?: number
    categories?: string[]
    pageCount?: number
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

// Whitelist just the display + trimmed detail fields for the given media type. We still
// never persist the heavy stuff (cast/crew, full videos list) - only what population
// already trimmed down (see optimizeMovieData/optimizeSeriesData), preserved as-is if
// the incoming card carries it (e.g. saved straight from a browsing card that already
// has it embedded).
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
      genre_ids: card.genre_ids,
      details: card.details,
      omdbData: card.omdbData,
      stremioLink: card.stremioLink,
    }
  }

  if (mediaType === "series") {
    return {
      id: card.id,
      type: "series",
      name: card.name,
      overview: card.overview,
      poster_path: card.poster_path ?? null,
      backdrop_path: card.backdrop_path ?? null,
      first_air_date: card.first_air_date,
      vote_average: card.vote_average,
      genre_ids: card.genre_ids,
      details: card.details,
      omdbData: card.omdbData,
      stremioLink: card.stremioLink,
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
      categories: splitBookCategories(vi.categories),
      pageCount: vi.pageCount,
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
  // Docs saved pre-rename still have mediaType: "tvshow" on disk until the
  // migration script has run - match both so they don't disappear meanwhile.
  if (filter.mediaType) {
    query.mediaType = filter.mediaType === "series" ? { $in: ["series", "tvshow"] } : filter.mediaType
  }

  const docs = await collection.find(query).sort({ updatedAt: -1 }).toArray()
  return docs.map(normalizeDoc)
}

// Toggle semantics for the three buttons (each toggles its own status):
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

  // Match a pre-migration "tvshow" doc for the same item too, so toggling doesn't
  // create a duplicate "series" doc alongside it - see normalizeMediaType above.
  const legacyTypes = mediaType === "series" ? ["series", "tvshow"] : [mediaType]
  const existing = await collection.findOne({
    userId,
    mediaId,
    mediaType: { $in: legacyTypes },
  } as Record<string, unknown>)
  const key = existing ? { userId, mediaId, mediaType: existing.mediaType } : { userId, mediaId, mediaType }

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

  // $set mediaType too, so a legacy "tvshow" doc self-heals to "series" the next
  // time its status changes, even before the migration script runs.
  await collection.updateOne(key, {
    $set: { mediaType, status, card: toSlimCard(mediaType, card), updatedAt: new Date() },
  })
  return status
}
