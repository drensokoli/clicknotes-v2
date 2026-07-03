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

// Fetch minimal v2 cards by range: ?type=v2-range&mediaType=movies|tvshows|books&start=0&end=19
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type !== 'v2-range') {
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
      movies: 'movies_v2',
      tvshows: 'tvshows_v2',
      books: 'books_v2',
    }

    const v2Key = keyByMediaType[mediaType]
    if (!v2Key) {
      return NextResponse.json({ success: false, error: 'Invalid mediaType' }, { status: 400 })
    }

    await client.connect()
    const stored = await client.get(v2Key)

    if (!stored) {
      return NextResponse.json({ success: true, items: [], count: 0, start, end })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      return NextResponse.json({ success: false, error: 'Stored v2 data is not valid JSON' }, { status: 500 })
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
    console.error('❌ Error fetching v2 range:', error)
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
