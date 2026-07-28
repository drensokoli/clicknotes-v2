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
    // series only - per-episode runtime(s) in minutes, from TMDB's tv details
    // endpoint. getRuntime() in lib/library-filters.ts reads the first entry.
    episode_run_time?: number[]
    genres?: Array<{ id: number; name: string }>
    number_of_seasons?: number
    number_of_episodes?: number
    status?: string
    tagline?: string
    type?: string
    videos?: { results: Array<{ key: string; name: string; site: string; type: string; official: boolean }> }
    // Present on Popular/Redis cards (population embeds a trimmed credits list) and on
    // items enriched at save time (lib/save-enrichment.ts) or by the detail modal's
    // live fetch. Used to derive the searchable `people` list below, and rendered by
    // the modal's Cast / Director sections for these enriched saves.
    credits?: {
      cast?: Array<{ id: number; name: string; character?: string; profile_path: string | null }>
      crew?: Array<{ id: number; name: string; job?: string; profile_path: string | null }>
    }
    created_by?: Array<{ id: number; name: string; profile_path: string | null }>
  }
  omdbData?: { imdbId: string; rated: string; runtime: string; awards: string; rottenTomatoes?: string; metacritic?: string; imdbRating?: string }
  stremioLink?: string
  // Lowercased searchable names (cast + director/creator + writers) so the Library
  // search matches on people, not just the title. Derived in toSlimCard from the
  // card's embedded credits; absent for books (their authors live in volumeInfo).
  people?: string[]
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
  // The user's own 1-10 rating for this item, if they've rated it. Independent of
  // status - an item can be rated at any status (see setRating below).
  rating?: number
  // When set, the item is "bumped" - pinned to the top of the Library view so the
  // user can queue up what to watch/read next. The timestamp orders multiple bumped
  // items (most-recently-bumped first). See setBump below.
  bumpedAt?: Date
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
// Crew jobs whose names are worth searching by (the "writers etc." the Library
// search should match, alongside cast and the director/creator).
const SEARCHABLE_CREW_JOBS = new Set(["Director", "Writer", "Screenplay", "Story"])

// Build the lowercased searchable name list from whatever credits the incoming
// card carries. Popular/Redis cards embed a trimmed credits list; search-result
// cards carry none (until the modal enriches them - see media-details-modal.tsx),
// so this is best-effort and just returns undefined when there's nothing to index.
function derivePeople(card: SavedCard): string[] | undefined {
  const names = new Set<string>()
  for (const person of card.details?.credits?.cast ?? []) {
    if (person.name) names.add(person.name.toLowerCase())
  }
  for (const person of card.details?.credits?.crew ?? []) {
    if (person.name && person.job && SEARCHABLE_CREW_JOBS.has(person.job)) names.add(person.name.toLowerCase())
  }
  for (const person of card.details?.created_by ?? []) {
    if (person.name) names.add(person.name.toLowerCase())
  }
  return names.size > 0 ? Array.from(names) : undefined
}

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
      people: derivePeople(card) ?? card.people,
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
      people: derivePeople(card) ?? card.people,
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
  const slimCard = toSlimCard(mediaType, card)
  // Don't let a status change from a credits-less card (e.g. a search-result grid
  // card) wipe searchable people we'd already indexed from a richer save.
  if (!slimCard.people && existing.card.people) slimCard.people = existing.card.people
  await collection.updateOne(key, {
    $set: { mediaType, status, card: slimCard, updatedAt: new Date() },
  })
  return status
}

// Set (or clear, with rating === null) the user's personal 1-10 rating for an
// item they've saved. Rating is only meaningful on a saved item, so this is a
// no-op returning null when no doc exists - callers should have saved it first.
export async function setRating(
  userId: string,
  mediaType: MediaType,
  mediaId: string,
  rating: number | null,
): Promise<number | null> {
  const collection = await getSavedMediaCollection()
  if (!collection) throw new Error("Database unavailable")

  const legacyTypes = mediaType === "series" ? ["series", "tvshow"] : [mediaType]
  const existing = await collection.findOne({
    userId,
    mediaId,
    mediaType: { $in: legacyTypes },
  } as Record<string, unknown>)
  if (!existing) return null

  const key = { userId, mediaId, mediaType: existing.mediaType }

  if (rating === null) {
    // $set mediaType too, self-healing a legacy "tvshow" doc like toggleStatus does.
    await collection.updateOne(key, { $unset: { rating: "" }, $set: { mediaType, updatedAt: new Date() } })
    return null
  }

  await collection.updateOne(key, { $set: { rating, mediaType, updatedAt: new Date() } })
  return rating
}

// Bump (pin to top, with the current time) or un-bump a saved item. Like setRating,
// this is a no-op returning null when the item isn't saved. Returns the new bumpedAt
// timestamp, or null when cleared.
export async function setBump(
  userId: string,
  mediaType: MediaType,
  mediaId: string,
  bumped: boolean,
): Promise<Date | null> {
  const collection = await getSavedMediaCollection()
  if (!collection) throw new Error("Database unavailable")

  const legacyTypes = mediaType === "series" ? ["series", "tvshow"] : [mediaType]
  const existing = await collection.findOne({
    userId,
    mediaId,
    mediaType: { $in: legacyTypes },
  } as Record<string, unknown>)
  if (!existing) return null

  const key = { userId, mediaId, mediaType: existing.mediaType }

  if (!bumped) {
    await collection.updateOne(key, { $unset: { bumpedAt: "" }, $set: { mediaType, updatedAt: new Date() } })
    return null
  }

  const bumpedAt = new Date()
  await collection.updateOne(key, { $set: { bumpedAt, mediaType, updatedAt: new Date() } })
  return bumpedAt
}
