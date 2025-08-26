# Redis Setup for ClickNotes v2

This document explains how to set up and use Redis caching for ClickNotes v2 to improve performance and reduce API rate limiting.

## Overview

The Redis system caches three types of media data:
- **Movies**: Popular movies with TMDB details, OMDB data, and Stremio links
- **TV Shows**: Popular TV shows with TMDB details, OMDB data, and Stremio links  
- **Books**: NY Times bestsellers with Google Books details

## Environment Variables

Add these to your `.env.local` file:

```bash
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password
TMDB_API_KEY=your-tmdb-api-key
GOOGLE_BOOKS_API_KEY_2=your-google-books-api-key
NYTIMES_API_KEY=your-nytimes-api-key
OMDB_API_KEY_1=your-omdb-api-key-1
OMDB_API_KEY_2=your-omdb-api-key-2
OMDB_API_KEY_3=your-omdb-api-key-3
BASE_URL=http://localhost:3000
```

## Manual Population

To manually populate Redis with data (useful for testing):

```bash
# Start your development server first
npm run dev

# In another terminal, run the populate script
node scripts/populate-redis.js
```

Or manually trigger via API:

```bash
curl -X POST http://localhost:3000/api/redisHandler \
  -H "Content-Type: application/json" \
  -d '{"action": "populate"}'
```

## Automatic Population (Vercel Cron)

The system is configured to automatically populate Redis every Thursday at 23:00 UTC via Vercel cron jobs.

The cron job calls `/api/cron` which:
1. Fetches popular movies from TMDB (up to 50)
2. Fetches popular TV shows from TMDB (up to 50)
3. Fetches bestsellers from NY Times and Google Books (up to 50)
4. Stores all data with full details in Redis
5. Uses 5-second delays between API calls to respect rate limits

## API Endpoints

### GET /api/redisHandler
Retrieve cached data:
- `?type=movies` - Get movies
- `?type=tvshows` - Get TV shows  
- `?type=books` - Get books
- No query params - Get all data

### POST /api/redisHandler
Populate Redis with fresh data:
```json
{
  "action": "populate"
}
```

### GET /api/cron
Vercel cron job endpoint that populates Redis automatically.

## Data Structure

Each cached item includes:

**Movies & TV Shows:**
- Basic TMDB info (title, overview, poster, etc.)
- Full TMDB details (credits, videos, genres)
- OMDB data (IMDB ID, rating, runtime, awards)
- Stremio streaming link

**Books:**
- NY Times bestseller info
- Google Books volume details
- Cover images, descriptions, ratings

## Fallback Behavior

The system automatically falls back to direct API calls if:
- Redis is unavailable
- Redis data is empty or corrupted
- Redis connection fails

This ensures the app continues to work even without Redis.

## Performance Benefits

- **Instant loading**: Cached data loads immediately
- **Reduced API calls**: Only fetches from external APIs when needed
- **Better UX**: No waiting for API responses
- **Rate limit protection**: Respects API limits with delays

## Monitoring

Check Redis status by calling:
```bash
curl http://localhost:3000/api/redisHandler
```

Successful response should show cached data counts for all media types.

## Troubleshooting

1. **Redis connection failed**: Check `REDIS_HOST` and `REDIS_PASSWORD`
2. **No data in cache**: Run manual population script
3. **API rate limits**: The system automatically delays between calls
4. **Cron job not working**: Verify Vercel deployment and cron configuration

## Development vs Production

- **Development**: Uses localhost:3000 as BASE_URL
- **Production**: Uses your production domain as BASE_URL
- **Redis**: Same Redis instance for both environments
