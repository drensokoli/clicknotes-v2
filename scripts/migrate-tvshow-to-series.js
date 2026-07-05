#!/usr/bin/env node

// One-time migration for the "tvshow" -> "series" rename and the "_v2" Redis key
// suffix drop.
//
// Updates existing `savedMedia` Mongo docs whose mediaType/card.type is still
// "tvshow" to "series", and copies each legacy "_v2"-suffixed Redis cache key
// (movies_v2, series_v2 or the pre-Series-rename tvshows_v2, books_v2) to its
// final un-suffixed name (movies, series, books). Source keys stay in place
// until scripts/cleanup-legacy-redis-keys.js removes them.
//
// The app already tolerates "tvshow" as an alias for "series" on read (see
// normalizeMediaType/normalizeDoc in lib/saved-media.ts) and falls back to the
// legacy "_v2" keys on read (see app/api/redisHandler/route.ts), so running
// this is a safe cleanup, not a prerequisite for correctness.
//
// Usage:
//   node scripts/migrate-tvshow-to-series.js               # dry run
//   node scripts/migrate-tvshow-to-series.js --apply        # actually writes changes
//
// Reads connection info from MONGODB_URI / MONGODB_DB_NAME and
// REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (same as the app).

const { MongoClient } = require('mongodb')
const { createClient } = require('@redis/client')

const COLLECTION = 'savedMedia'

async function migrateMongo(shouldApply) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('MONGODB_URI not set - skipping Mongo migration')
    return
  }

  const dbName = process.env.MONGODB_DB_NAME || 'clicknotes'
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const collection = client.db(dbName).collection(COLLECTION)

    const legacyDocs = await collection.find({ mediaType: 'tvshow' }).toArray()
    console.log(`Mongo: found ${legacyDocs.length} doc(s) with mediaType: "tvshow"`)

    if (legacyDocs.length > 0 && shouldApply) {
      const result = await collection.updateMany(
        { mediaType: 'tvshow' },
        { $set: { mediaType: 'series', 'card.type': 'series' } },
      )
      console.log(`Mongo: updated ${result.modifiedCount} doc(s) to mediaType: "series"`)
    } else if (legacyDocs.length > 0) {
      console.log('Mongo: dry run - pass --apply to update these docs')
    }
  } finally {
    await client.close()
  }
}

// Each entry: the final key name, and the legacy source key(s) to read from (in
// order) if the final key doesn't already have data.
const REDIS_KEY_MIGRATIONS = [
  { finalKey: 'movies', legacyKeys: ['movies_v2'] },
  { finalKey: 'series', legacyKeys: ['series_v2', 'tvshows_v2'] },
  { finalKey: 'books', legacyKeys: ['books_v2'] },
]

async function migrateRedis(shouldApply) {
  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  const redisPort = process.env.REDIS_PORT

  if (!redisHost || !redisPassword || !redisPort) {
    console.log('Redis env vars not set - skipping Redis migration')
    return
  }

  const client = createClient({
    password: redisPassword,
    username: 'default',
    socket: { host: redisHost, port: parseInt(redisPort) },
  })

  await client.connect()

  try {
    for (const { finalKey, legacyKeys } of REDIS_KEY_MIGRATIONS) {
      let legacyValue = null
      let sourceKey = null
      for (const key of legacyKeys) {
        legacyValue = await client.get(key)
        if (legacyValue) {
          sourceKey = key
          break
        }
      }

      if (!legacyValue) {
        console.log(`Redis: no legacy key found for "${finalKey}" (checked ${legacyKeys.join(', ')})`)
        continue
      }

      console.log(`Redis: found "${sourceKey}"`)

      if (shouldApply) {
        await client.set(finalKey, legacyValue)
        console.log(`Redis: copied "${sourceKey}" -> "${finalKey}"`)
      } else {
        console.log(`Redis: dry run - pass --apply to copy "${sourceKey}" to "${finalKey}"`)
      }
    }
  } finally {
    await client.disconnect()
  }
}

async function main() {
  const shouldApply = process.argv.includes('--apply')
  console.log(shouldApply ? 'Mode: APPLY (will write changes)' : 'Mode: DRY RUN (pass --apply to write changes)')
  console.log('')

  await migrateMongo(shouldApply)
  console.log('')
  await migrateRedis(shouldApply)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
