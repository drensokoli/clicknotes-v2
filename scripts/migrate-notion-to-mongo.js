#!/usr/bin/env node

// One-time migration: pulls each user's saved movies/series/books out of their
// OLD ClickNotes v1 Notion databases and inserts them into v2's `savedMedia`
// Mongo collection, matching v1 <-> v2 accounts by email.
//
// Only the identity (TMDB id / Google Books id) and saved status are trusted
// from Notion - all display metadata (title, poster, genres, rating, etc.) is
// re-fetched live from TMDB / Google Books, since fields stored on the Notion
// pages are frequently stale or blank (e.g. Poster/ratings often never filled
// in). This mirrors how the rest of the app treats TMDB/Google Books as the
// source of truth for content metadata (see scripts/backfill-saved-genres.js).
//
// v1 Notion structure (see v1's src/pages/api/getNotionDatabaseStatusList.ts,
// addMovieToNotion.ts, addTvShowToNotion.ts, addBookToNotion.ts):
//   - Movies + Series share ONE Notion database (a `connections` doc with
//     connection_type: "movies"), distinguished by the `Type` select property
//     ("Movie" | "TvShow"). `ID` (number) is the TMDB id.
//   - Books have their own database (connection_type: "books"). `ID`
//     (rich_text) is the Google Books volume id. `Type` there is
//     Book | Audiobook | Article - all three are migrated as v2's "book".
//   - `connections` doc fields: access_token (AES-encrypted, same
//     CryptoJS.AES scheme as v1's lib/encryption.ts) and template_id (the
//     Notion database id, stored as PLAIN text - not encrypted).
//   - Notion Status options: movies/series use "To watch"/"Watching"/"Watched";
//     books use "To read"/"Reading"/"Finished" - both map onto v2's
//     to_watch/watching/watched.
//
// Usage:
//   node scripts/migrate-notion-to-mongo.js               # dry run
//   node scripts/migrate-notion-to-mongo.js --apply        # actually writes
//
// Required env vars:
//   V1_MONGODB_URI, V1_MONGODB_DB_NAME, V1_ENCRYPTION_KEY  - v1's Mongo + AES key
//   MONGODB_URI, MONGODB_DB_NAME                           - v2's Mongo (this app's .env)
//   TMDB_API_KEY, GOOGLE_BOOKS_API_KEY_2                   - this app's .env

const { MongoClient } = require('mongodb')
const CryptoJS = require('crypto-js')
const { Client } = require('@notionhq/client')

const REQUEST_DELAY_MS = 200

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decryptData(ciphertext, secretKey) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey)
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}

const MOVIE_STATUS_MAP = { 'To watch': 'to_watch', Watching: 'watching', Watched: 'watched' }
const BOOK_STATUS_MAP = { 'To read': 'to_watch', Reading: 'watching', Finished: 'watched' }

async function fetchAllPages(notion, databaseId) {
  const results = []
  let cursor = undefined
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)
  return results
}

async function fetchMovieOrSeriesCard(tmdbId, mediaType, tmdbApiKey) {
  const path = mediaType === 'movie' ? 'movie' : 'tv'
  const res = await fetch(`https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${tmdbApiKey}`)
  if (!res.ok) return null
  const data = await res.json()
  const genre_ids = (data.genres || []).map((g) => g.id)

  if (mediaType === 'movie') {
    return {
      id: data.id,
      type: 'movie',
      title: data.title,
      overview: data.overview,
      poster_path: data.poster_path ?? null,
      backdrop_path: data.backdrop_path ?? null,
      release_date: data.release_date,
      vote_average: data.vote_average,
      genre_ids,
      details: { runtime: data.runtime, genres: data.genres || [] },
    }
  }
  return {
    id: data.id,
    type: 'series',
    name: data.name,
    overview: data.overview,
    poster_path: data.poster_path ?? null,
    backdrop_path: data.backdrop_path ?? null,
    first_air_date: data.first_air_date,
    vote_average: data.vote_average,
    genre_ids,
    details: { episode_run_time: data.episode_run_time || [], genres: data.genres || [] },
  }
}

async function fetchBookCard(googleBooksId, googleBooksApiKey) {
  const url = googleBooksApiKey
    ? `https://www.googleapis.com/books/v1/volumes/${googleBooksId}?key=${googleBooksApiKey}`
    : `https://www.googleapis.com/books/v1/volumes/${googleBooksId}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const vi = data.volumeInfo || {}
  return {
    id: data.id,
    type: 'book',
    volumeInfo: {
      title: vi.title,
      authors: vi.authors,
      description: vi.description,
      publishedDate: vi.publishedDate,
      averageRating: vi.averageRating,
      categories: vi.categories,
      pageCount: vi.pageCount,
      imageLinks: { thumbnail: vi.imageLinks?.thumbnail ?? null },
    },
  }
}

async function migrateMoviesAndSeries({ connection, v2Db, v1EncryptionKey, tmdbApiKey, userId, shouldApply, stats }) {
  const savedMedia = v2Db.collection('savedMedia')
  const apiKey = decryptData(connection.access_token, v1EncryptionKey)
  const databaseId = connection.template_id
  const notion = new Client({ auth: apiKey })

  const pages = await fetchAllPages(notion, databaseId)
  console.log(`  Movies/Series database: ${pages.length} page(s)`)

  for (const page of pages) {
    const props = page.properties
    const tmdbId = props.ID?.number
    const typeVal = props.Type?.select?.name // "Movie" | "TvShow"
    const statusName = props.Status?.status?.name
    const status = MOVIE_STATUS_MAP[statusName]

    if (!tmdbId || !typeVal || !status) {
      stats.skippedInvalid++
      continue
    }

    const mediaType = typeVal === 'Movie' ? 'movie' : 'series'
    const mediaId = String(tmdbId)

    const existing = await savedMedia.findOne({ userId, mediaType, mediaId })
    if (existing) {
      stats.skippedExisting++
      continue
    }

    const card = await fetchMovieOrSeriesCard(tmdbId, mediaType, tmdbApiKey)
    await delay(REQUEST_DELAY_MS)
    if (!card) {
      stats.fetchFailed++
      console.warn(`  Failed to fetch TMDB ${mediaType} ${tmdbId}`)
      continue
    }

    stats.toInsert++
    console.log(`  [${mediaType}] ${card.title || card.name} -> ${status}`)
    if (shouldApply) {
      const now = new Date()
      await savedMedia.insertOne({ userId, mediaType, mediaId, status, card, createdAt: now, updatedAt: now })
    }
  }
}

async function migrateBooks({ connection, v2Db, v1EncryptionKey, googleBooksApiKey, userId, shouldApply, stats }) {
  const savedMedia = v2Db.collection('savedMedia')
  const apiKey = decryptData(connection.access_token, v1EncryptionKey)
  const databaseId = connection.template_id
  const notion = new Client({ auth: apiKey })

  const pages = await fetchAllPages(notion, databaseId)
  console.log(`  Books database: ${pages.length} page(s)`)

  for (const page of pages) {
    const props = page.properties
    const googleBooksId = props.ID?.rich_text?.[0]?.plain_text
    const statusName = props.Status?.status?.name
    const status = BOOK_STATUS_MAP[statusName]

    if (!googleBooksId || !status) {
      stats.skippedInvalid++
      continue
    }

    const mediaId = googleBooksId
    const existing = await savedMedia.findOne({ userId, mediaType: 'book', mediaId })
    if (existing) {
      stats.skippedExisting++
      continue
    }

    const card = await fetchBookCard(googleBooksId, googleBooksApiKey)
    await delay(REQUEST_DELAY_MS)
    if (!card) {
      stats.fetchFailed++
      console.warn(`  Failed to fetch Google Books volume ${googleBooksId}`)
      continue
    }

    stats.toInsert++
    console.log(`  [book] ${card.volumeInfo.title} -> ${status}`)
    if (shouldApply) {
      const now = new Date()
      await savedMedia.insertOne({ userId, mediaType: 'book', mediaId, status, card, createdAt: now, updatedAt: now })
    }
  }
}

async function main() {
  const shouldApply = process.argv.includes('--apply')
  console.log(shouldApply ? 'Mode: APPLY (will write changes)' : 'Mode: DRY RUN (pass --apply to write changes)')
  console.log('')

  const v1Uri = process.env.V1_MONGODB_URI
  const v1DbName = process.env.V1_MONGODB_DB_NAME
  const v1EncryptionKey = process.env.V1_ENCRYPTION_KEY
  const v2Uri = process.env.MONGODB_URI
  const v2DbName = process.env.MONGODB_DB_NAME || 'clicknotes'
  const tmdbApiKey = process.env.TMDB_API_KEY
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY_2

  if (!v1Uri || !v1DbName || !v1EncryptionKey) {
    console.log('V1_MONGODB_URI / V1_MONGODB_DB_NAME / V1_ENCRYPTION_KEY not set - aborting')
    return
  }
  if (!v2Uri || !tmdbApiKey) {
    console.log('MONGODB_URI / TMDB_API_KEY not set - aborting')
    return
  }

  const v1Client = new MongoClient(v1Uri)
  const v2Client = new MongoClient(v2Uri)

  const stats = { toInsert: 0, skippedExisting: 0, skippedInvalid: 0, fetchFailed: 0, usersSkippedNoV2Account: 0, usersWithErrors: 0 }

  try {
    await v1Client.connect()
    await v2Client.connect()
    const v1Db = v1Client.db(v1DbName)
    const v2Db = v2Client.db(v2DbName)

    const emails = (await v1Db.collection('connections').distinct('email')).filter(Boolean)
    console.log(`Found ${emails.length} v1 user(s) with a Notion connection\n`)

    for (const email of emails) {
      console.log(`User: ${email}`)
      const v2User = await v2Db.collection('users').findOne({ email })
      if (!v2User) {
        console.log('  Skipping - no matching v2 account for this email\n')
        stats.usersSkippedNoV2Account++
        continue
      }
      const userId = v2User._id.toString()

      const userConnections = await v1Db.collection('connections').find({ email }).toArray()
      const moviesConn = userConnections.find((c) => c.connection_type === 'movies')
      const booksConn = userConnections.find((c) => c.connection_type === 'books')

      if (moviesConn) {
        try {
          await migrateMoviesAndSeries({ connection: moviesConn, v2Db, v1EncryptionKey, tmdbApiKey, userId, shouldApply, stats })
        } catch (error) {
          stats.usersWithErrors++
          console.warn(`  Movies/Series database unreachable for ${email}: ${error.message}`)
        }
      }
      if (booksConn) {
        try {
          await migrateBooks({ connection: booksConn, v2Db, v1EncryptionKey, googleBooksApiKey, userId, shouldApply, stats })
        } catch (error) {
          stats.usersWithErrors++
          console.warn(`  Books database unreachable for ${email}: ${error.message}`)
        }
      }
      console.log('')
    }

    console.log('--- Summary ---')
    console.log(`${shouldApply ? 'Inserted' : 'Would insert'}: ${stats.toInsert}`)
    console.log(`Already in v2 (skipped): ${stats.skippedExisting}`)
    console.log(`Invalid/no status (skipped): ${stats.skippedInvalid}`)
    console.log(`Failed to fetch from TMDB/Google Books: ${stats.fetchFailed}`)
    console.log(`Users with no matching v2 account: ${stats.usersSkippedNoV2Account}`)
    console.log(`Users with an unreachable Notion database (revoked/deleted): ${stats.usersWithErrors}`)
  } finally {
    await v1Client.close()
    await v2Client.close()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
