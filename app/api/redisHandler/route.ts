import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@redis/client"

// Helper function to create Redis client
const createRedisClient = () => {
  const redisHost = process.env.REDIS_HOST
  const redisPassword = process.env.REDIS_PASSWORD
  const redisPort = process.env.REDIS_PORT

  if (!redisHost || !redisPassword || !redisPort) {
    throw new Error('Redis configuration missing')
  }

  return createClient({
    password: redisPassword,
    username: "default",
    socket: {
      host: redisHost,
      port: parseInt(redisPort)
    }
  })
}

// Fetch minimal cards by range: ?type=range&mediaType=movies|series|books&start=0&end=19
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type !== 'range') {
    return NextResponse.json({ success: false, error: 'Unsupported type' }, { status: 400 })
  }

  const client = createRedisClient()

  try {
    const mediaType = searchParams.get('mediaType')
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!mediaType || !startStr || !endStr) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: mediaType, start, end' },
        { status: 400 }
      )
    }

    const start = parseInt(startStr)
    const end = parseInt(endStr)

    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      return NextResponse.json(
        { success: false, error: 'Invalid start or end values' },
        { status: 400 }
      )
    }

    const keyByMediaType: Record<string, string> = {
      movies: 'movies',
      series: 'series',
      books: 'books',
    }
    // Legacy "_v2"-suffixed keys (and the pre-rename "tvshows_v2") from before the
    // Redis key rename - fall back to these until the next cron population (or
    // scripts/migrate-tvshow-to-series.js) has written the un-suffixed key.
    const legacyKeyByMediaType: Record<string, string[]> = {
      movies: ['movies_v2'],
      series: ['series_v2', 'tvshows_v2'],
      books: ['books_v2'],
    }

    const key = keyByMediaType[mediaType]
    if (!key) {
      return NextResponse.json({ success: false, error: 'Invalid mediaType' }, { status: 400 })
    }

    await client.connect()
    let stored = await client.get(key)
    if (!stored) {
      for (const legacyKey of legacyKeyByMediaType[mediaType] ?? []) {
        stored = await client.get(legacyKey)
        if (stored) break
      }
    }

    if (!stored) {
      return NextResponse.json({ success: true, items: [], count: 0, start, end })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      return NextResponse.json({ success: false, error: 'Stored data is not valid JSON' }, { status: 500 })
    }

    const items = Array.isArray(parsed) ? parsed.slice(start, end + 1) : []

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      start,
      end,
    })
  } catch (error) {
    console.error('❌ Error fetching range:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  } finally {
    if (client.isOpen) {
      await client.disconnect()
    }
  }
}
