#!/usr/bin/env node

// One-time backfill for saved movies/series that predate the `genre_ids` field
// on SavedCard (see lib/saved-media.ts) - without this, the Library/Shuffle
// Genre filter has nothing to derive pills from for these older saves.
//
// For each saved movie/series doc missing both `card.details.genres` and
// `card.genre_ids`, fetches TMDB details for that title and stores the genre
// ids on `card.genre_ids` (lib/library-filters.ts's getGenres() already maps
// these through MOVIE_GENRES/TV_GENRES to names at read time).
//
// Usage:
//   node scripts/backfill-saved-genres.js               # dry run
//   node scripts/backfill-saved-genres.js --apply        # actually writes changes
//
// Reads connection info from MONGODB_URI / MONGODB_DB_NAME and TMDB_API_KEY
// (same as the app).

const { MongoClient } = require('mongodb')

const COLLECTION = 'savedMedia'
const REQUEST_DELAY_MS = 250

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchGenreIds(mediaType, tmdbId, tmdbApiKey) {
  const path = mediaType === 'movie' ? 'movie' : 'tv'
  const url = `https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${tmdbApiKey}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TMDB ${path}/${tmdbId} -> HTTP ${response.status}`)
  }
  const data = await response.json()
  return Array.isArray(data.genres) ? data.genres.map((g) => g.id) : []
}

async function main() {
  const shouldApply = process.argv.includes('--apply')
  console.log(shouldApply ? 'Mode: APPLY (will write changes)' : 'Mode: DRY RUN (pass --apply to write changes)')
  console.log('')

  const uri = process.env.MONGODB_URI
  const tmdbApiKey = process.env.TMDB_API_KEY
  if (!uri) {
    console.log('MONGODB_URI not set - aborting')
    return
  }
  if (!tmdbApiKey) {
    console.log('TMDB_API_KEY not set - aborting')
    return
  }

  const dbName = process.env.MONGODB_DB_NAME || 'clicknotes'
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const collection = client.db(dbName).collection(COLLECTION)

    const candidates = await collection
      .find({
        mediaType: { $in: ['movie', 'series'] },
        'card.genre_ids': { $exists: false },
        'card.details.genres': { $exists: false },
      })
      .toArray()

    console.log(`Found ${candidates.length} saved movie/series doc(s) with no genre data`)
    console.log('')

    let updated = 0
    let failed = 0

    for (const doc of candidates) {
      const title = doc.card.title || doc.card.name || doc.mediaId
      try {
        const genreIds = await fetchGenreIds(doc.mediaType, doc.card.id, tmdbApiKey)
        console.log(`${doc.mediaType} "${title}": genre_ids = [${genreIds.join(', ')}]`)

        if (shouldApply && genreIds.length > 0) {
          await collection.updateOne(
            { userId: doc.userId, mediaType: doc.mediaType, mediaId: doc.mediaId },
            { $set: { 'card.genre_ids': genreIds } },
          )
          updated++
        }
      } catch (error) {
        failed++
        console.error(`  Failed to fetch genres for "${title}":`, error.message)
      }

      await delay(REQUEST_DELAY_MS)
    }

    console.log('')
    if (shouldApply) {
      console.log(`Updated ${updated} doc(s), ${failed} failure(s)`)
    } else {
      console.log(`Dry run - pass --apply to write genre_ids to these ${candidates.length} doc(s) (${failed} would fail to fetch)`)
    }
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
