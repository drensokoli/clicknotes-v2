#!/usr/bin/env node

// One-time cleanup for Redis keys left over from the old (pre-v2) caching architecture.
// These keys are no longer read by any part of the app - the homepage and infinite
// scroll only ever read `movies_v2` / `tvshows_v2` / `books_v2`.
//
// Usage:
//   node scripts/cleanup-legacy-redis-keys.js               # dry run, lists what would be deleted
//   node scripts/cleanup-legacy-redis-keys.js --delete      # actually deletes the keys
//
// Reads connection info from REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (same as the app).
// If you still have a second/backup Redis instance, also run this against it by setting
// REDIS_HOST_2 / REDIS_PORT_2 / REDIS_PASSWORD_2 as REDIS_HOST / REDIS_PORT / REDIS_PASSWORD
// for a second invocation.

const { createClient } = require('@redis/client')

const LEGACY_KEY_PATTERNS = [
  'movies1', 'movies2', 'movies3', 'movies4', 'movies5', 'movies6',
  'tvshows1', 'tvshows2', 'tvshows3', 'tvshows4',
  'books1', 'books2', 'books3', 'books4',
  'movie:*',
  'tvshow:*',
  'book:*',
  'popular_ranking:*',
]

async function scanMatching(client, pattern) {
  const matches = []
  for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    matches.push(key)
  }
  return matches
}

async function main() {
  const shouldDelete = process.argv.includes('--delete')

  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  const redisPort = process.env.REDIS_PORT

  if (!redisHost || !redisPassword || !redisPort) {
    console.error('Missing REDIS_HOST / REDIS_PASSWORD / REDIS_PORT environment variables')
    process.exit(1)
  }

  const client = createClient({
    password: redisPassword,
    username: 'default',
    socket: { host: redisHost, port: parseInt(redisPort) },
  })

  await client.connect()

  console.log(`Connected to Redis at ${redisHost}:${redisPort}`)
  console.log(shouldDelete ? 'Mode: DELETE (will remove matching keys)' : 'Mode: DRY RUN (pass --delete to actually remove keys)')
  console.log('')

  let totalFound = 0
  let totalDeleted = 0

  try {
    for (const pattern of LEGACY_KEY_PATTERNS) {
      const keys = await scanMatching(client, pattern)

      if (keys.length === 0) {
        continue
      }

      totalFound += keys.length
      console.log(`${pattern}: found ${keys.length} key(s)`)
      keys.slice(0, 10).forEach(k => console.log(`  - ${k}`))
      if (keys.length > 10) {
        console.log(`  ... and ${keys.length - 10} more`)
      }

      if (shouldDelete) {
        const deleted = await client.del(keys)
        totalDeleted += deleted
        console.log(`  deleted ${deleted} key(s)`)
      }
    }

    console.log('')
    console.log(`Total legacy keys found: ${totalFound}`)
    if (shouldDelete) {
      console.log(`Total legacy keys deleted: ${totalDeleted}`)
    } else {
      console.log('Nothing deleted (dry run). Re-run with --delete to remove these keys.')
    }
  } finally {
    await client.disconnect()
  }
}

main().catch(error => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})
