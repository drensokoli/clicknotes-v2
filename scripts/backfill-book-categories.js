#!/usr/bin/env node

// One-time backfill: Google Books' `categories` often combines a top-level
// BISAC category and subcategory into one string, e.g.
// "Biography & Autobiography / General" - this splits every saved book's
// (and the Redis-cached `books` browsing list's) categories into separate
// genre-like tags ("Biography & Autobiography", "General") instead of one
// long combined pill. See lib/book-categories.ts's splitBookCategories(),
// which lib/data-optimization.ts and lib/saved-media.ts now apply going
// forward - this script fixes what's already on disk.
//
// Usage:
//   node scripts/backfill-book-categories.js               # dry run
//   node scripts/backfill-book-categories.js --apply        # actually writes
//
// Reads connection info from MONGODB_URI / MONGODB_DB_NAME and
// REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (same as the app).

const { MongoClient } = require('mongodb')
const { createClient } = require('@redis/client')

function splitBookCategories(categories) {
  const result = new Set()
  for (const category of categories ?? []) {
    for (const part of String(category).split('/')) {
      const trimmed = part.trim()
      if (trimmed) result.add(trimmed)
    }
  }
  return Array.from(result)
}

function categoriesNeedSplitting(categories) {
  const split = splitBookCategories(categories)
  return split.length !== (categories ?? []).length || split.some((c, i) => c !== categories[i])
}

async function migrateMongo(shouldApply) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('MONGODB_URI not set - skipping Mongo backfill')
    return
  }

  const dbName = process.env.MONGODB_DB_NAME || 'clicknotes'
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const collection = client.db(dbName).collection('savedMedia')

    const books = await collection.find({ mediaType: 'book' }).toArray()
    let needsFix = 0

    for (const doc of books) {
      const categories = doc.card?.volumeInfo?.categories
      if (!categories || !categoriesNeedSplitting(categories)) continue

      needsFix++
      const split = splitBookCategories(categories)
      const title = doc.card?.volumeInfo?.title || doc.mediaId
      console.log(`  "${title}": ${JSON.stringify(categories)} -> ${JSON.stringify(split)}`)

      if (shouldApply) {
        await collection.updateOne(
          { userId: doc.userId, mediaType: 'book', mediaId: doc.mediaId },
          { $set: { 'card.volumeInfo.categories': split } },
        )
      }
    }

    console.log(`\nMongo: ${books.length} saved book(s) checked, ${needsFix} needed splitting`)
    if (needsFix > 0 && !shouldApply) {
      console.log('Mongo: dry run - pass --apply to write these changes')
    }
  } finally {
    await client.close()
  }
}

async function migrateRedis(shouldApply) {
  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  const redisPort = process.env.REDIS_PORT

  if (!redisHost || !redisPassword || !redisPort) {
    console.log('Redis env vars not set - skipping Redis backfill')
    return
  }

  const client = createClient({
    password: redisPassword,
    username: 'default',
    socket: { host: redisHost, port: parseInt(redisPort) },
  })

  await client.connect()

  try {
    const stored = await client.get('books')
    if (!stored) {
      console.log('Redis: no "books" key found - nothing to backfill')
      return
    }

    const books = JSON.parse(stored)
    let needsFix = 0

    const fixed = books.map((book) => {
      const categories = book.volumeInfo?.categories
      if (!categories || !categoriesNeedSplitting(categories)) return book
      needsFix++
      return { ...book, volumeInfo: { ...book.volumeInfo, categories: splitBookCategories(categories) } }
    })

    console.log(`Redis: ${books.length} cached book(s) checked, ${needsFix} needed splitting`)

    if (needsFix > 0) {
      if (shouldApply) {
        await client.set('books', JSON.stringify(fixed))
        console.log('Redis: updated "books" key')
      } else {
        console.log('Redis: dry run - pass --apply to write these changes')
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
  console.error('Backfill failed:', error)
  process.exit(1)
})
