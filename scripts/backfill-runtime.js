#!/usr/bin/env node

// One-time backfill: the Shuffle/Library runtime filter silently matched
// everything for most saved movies/series because `card.details.runtime`
// (movies) / `card.details.episode_run_time` (series) was never populated for
// them - either they predate this field, or (for the ~1116 items brought in by
// scripts/migrate-notion-to-mongo.js) the migration only ever fetched
// genre_ids, not a `details` object at all. This fetches fresh TMDB details
// for every saved movie/series missing that field and fills it in - same
// pattern as scripts/backfill-saved-genres.js.
//
// Usage:
//   node scripts/backfill-runtime.js               # dry run
//   node scripts/backfill-runtime.js --apply        # actually writes changes
//
// Reads connection info from MONGODB_URI / MONGODB_DB_NAME and TMDB_API_KEY
// (same as the app).

const { MongoClient } = require('mongodb')

const REQUEST_DELAY_MS = 250

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRuntime(mediaType, tmdbId, tmdbApiKey) {
  const path = mediaType === 'movie' ? 'movie' : 'tv'
  const url = `https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${tmdbApiKey}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TMDB ${path}/${tmdbId} -> HTTP ${response.status}`)
  }
  const data = await response.json()
  return mediaType === 'movie'
    ? { runtime: data.runtime }
    : { episode_run_time: data.episode_run_time || [] }
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
    const collection = client.db(dbName).collection('savedMedia')

    const candidates = await collection
      .find({
        $or: [
          { mediaType: 'movie', 'card.details.runtime': { $exists: false } },
          { mediaType: 'series', 'card.details.episode_run_time': { $exists: false } },
        ],
      })
      .toArray()

    console.log(`Found ${candidates.length} saved movie/series doc(s) with no runtime data`)
    console.log('')

    let updated = 0
    let failed = 0

    for (const doc of candidates) {
      const title = doc.card.title || doc.card.name || doc.mediaId
      try {
        const runtimeFields = await fetchRuntime(doc.mediaType, doc.card.id, tmdbApiKey)
        const label = doc.mediaType === 'movie' ? `${runtimeFields.runtime}m` : `${runtimeFields.episode_run_time.join(',')}m`
        console.log(`${doc.mediaType} "${title}": ${label}`)

        if (shouldApply) {
          // Merge into the whole `details` object rather than a dot-path $set -
          // some docs have `card.details` explicitly stored as `null` (not just
          // missing), and Mongo refuses to create a sub-field inside a null value.
          const mergedDetails = { ...(doc.card.details || {}), ...runtimeFields }
          await collection.updateOne(
            { userId: doc.userId, mediaType: doc.mediaType, mediaId: doc.mediaId },
            { $set: { 'card.details': mergedDetails } },
          )
          updated++
        }
      } catch (error) {
        failed++
        console.error(`  Failed to fetch runtime for "${title}":`, error.message)
      }

      await delay(REQUEST_DELAY_MS)
    }

    console.log('')
    if (shouldApply) {
      console.log(`Updated ${updated} doc(s), ${failed} failure(s)`)
    } else {
      console.log(`Dry run - pass --apply to write runtime data to these ${candidates.length} doc(s) (${failed} would fail to fetch)`)
    }
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
