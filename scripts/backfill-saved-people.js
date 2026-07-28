#!/usr/bin/env node

// One-time backfill for saved movies/series that predate the `people` field on
// SavedCard (see lib/saved-media.ts) - without this, the Library search can only
// match these older saves by title, not by cast/director/writer.
//
// For each saved movie/series doc missing `card.people`, fetches TMDB credits for
// that title and stores the lowercased searchable name list (cast + director/
// creator + writers) on `card.people`, mirroring derivePeople() in
// lib/saved-media.ts so backfilled and freshly-saved items index identically.
//
// Usage:
//   node scripts/backfill-saved-people.js               # dry run
//   node scripts/backfill-saved-people.js --apply        # actually writes changes
//
// Reads connection info from MONGODB_URI / MONGODB_DB_NAME and TMDB_API_KEY
// (same as the app and scripts/backfill-saved-genres.js).

const { MongoClient } = require('mongodb')

const COLLECTION = 'savedMedia'
const REQUEST_DELAY_MS = 250
const SEARCHABLE_CREW_JOBS = new Set(['Director', 'Writer', 'Screenplay', 'Story'])

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPeople(mediaType, tmdbId, tmdbApiKey) {
  const path = mediaType === 'movie' ? 'movie' : 'tv'
  const url = `https://api.themoviedb.org/3/${path}/${tmdbId}?api_key=${tmdbApiKey}&append_to_response=credits`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TMDB ${path}/${tmdbId} -> HTTP ${response.status}`)
  }
  const data = await response.json()

  const names = new Set()
  const cast = data.credits && Array.isArray(data.credits.cast) ? data.credits.cast.slice(0, 10) : []
  for (const person of cast) {
    if (person.name) names.add(person.name.toLowerCase())
  }
  const crew = data.credits && Array.isArray(data.credits.crew) ? data.credits.crew : []
  for (const person of crew) {
    if (person.name && SEARCHABLE_CREW_JOBS.has(person.job)) names.add(person.name.toLowerCase())
  }
  for (const person of Array.isArray(data.created_by) ? data.created_by : []) {
    if (person.name) names.add(person.name.toLowerCase())
  }
  return Array.from(names)
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
        'card.people': { $exists: false },
      })
      .toArray()

    console.log(`Found ${candidates.length} saved movie/series doc(s) with no people data`)
    console.log('')

    let updated = 0
    let failed = 0

    for (const doc of candidates) {
      const title = doc.card.title || doc.card.name || doc.mediaId
      try {
        const people = await fetchPeople(doc.mediaType, doc.card.id, tmdbApiKey)
        console.log(`${doc.mediaType} "${title}": ${people.length} name(s)`)

        if (shouldApply && people.length > 0) {
          await collection.updateOne(
            { userId: doc.userId, mediaType: doc.mediaType, mediaId: doc.mediaId },
            { $set: { 'card.people': people } },
          )
          updated++
        }
      } catch (error) {
        failed++
        console.error(`  Failed to fetch people for "${title}":`, error.message)
      }

      await delay(REQUEST_DELAY_MS)
    }

    console.log('')
    if (shouldApply) {
      console.log(`Updated ${updated} doc(s), ${failed} failure(s)`)
    } else {
      console.log(`Dry run - pass --apply to write people to these ${candidates.length} doc(s) (${failed} would fail to fetch)`)
    }
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
