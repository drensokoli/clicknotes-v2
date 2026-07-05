# ClickNotes

A Next.js application for saving and organizing movies, series, and books. Built with modern web technologies and optimized for performance.

## Features

- **Media Management**: Save and organize movies, series, and books
- **Progressive Loading**: Efficient data loading with infinite scroll
- **Redis Caching**: Fast data access with server-side caching
- **Responsive Design**: Works on desktop and mobile devices
- **Theme Support**: Light and dark mode
- **Search Functionality**: Find specific media items quickly

## Architecture

### Data Structure

The application uses Redis for data storage of popular movies, series, and NY Times bestsellers. Each media type is stored as a single JSON array under one key, holding minimal "card" fields (title, poster, rating, etc.) - detail pages fetch full TMDB/OMDB data live on demand.

- `movies` - up to 240 movie cards
- `series` - up to 240 series cards
- `books` - book cards in multiples of 40

Cards are read via range queries (`GET /api/redisHandler?type=range&mediaType=...&start=...&end=...`), 20 at a time.

### Caching System

- **Next.js Data Cache**: Server component fetches are cached for 7 days via `next: { revalidate }`
- **Progressive Loading**: Initial load shows first 20 items, loads more on scroll
- **Fallback System**: Live API fallback (TMDB/Google Books/NY Times) if Redis has no data yet

## Getting Started

### Prerequisites

- Node.js 18+ 
- Redis database
- API keys for:
  - TMDB (movies and Series)
  - Google Books (book details)
  - NY Times (bestseller lists)
  - OMDB (IMDB IDs)

### Environment Variables

Create a `.env.local` file with:

```bash
# Redis
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password

# API Keys
TMDB_API_KEY=your_tmdb_key
GOOGLE_BOOKS_API_KEY_1=your_google_books_key
GOOGLE_BOOKS_API_KEY_2=your_google_books_key
NYTIMES_API_KEY=your_ny_times_key
OMDB_API_KEY_1=your_omdb_key

# Email Notifications (for error alerts)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables
4. Run the development server:
   ```bash
   npm run dev
   ```

## Data Population

To populate Redis with media data:

```bash
POST /api/cron
Body: { "action": "populate-all" }
```

This will:
- Fetch popular movies and Series from TMDB (movies and books in parallel, Series after to avoid rate limiting)
- Fetch bestseller books from NY Times and enrich with Google Books API
- Store minimal card data in Redis (`movies`, `series`, `books`)
- Send email notifications if any errors occur during Redis uploads

This also runs automatically once a week (Mondays at 13:00 UTC) via the Vercel cron job configured in `vercel.json` (`GET /api/cron`).

Since the app uses a single free-tier Redis instance with limited monthly bandwidth, each media type is only refetched and rewritten if its data is more than a week old - population is a no-op otherwise. Pass `{ "force": true }` in the POST body (or `node scripts/populate-redis.js all --force`) to bypass this and repopulate immediately.

## API Endpoints

- `GET /api/redisHandler?type=range&mediaType={movies|series|books}&start={n}&end={n}` - Fetch a range of media cards
- `POST /api/cron` - Populate Redis with fresh data
  - `{ "action": "populate-all" }` - Populate all media types
  - `{ "action": "populate-movies" }` - Populate movies only
  - `{ "action": "populate-series" }` - Populate series only
  - `{ "action": "populate-books" }` - Populate books only
- `GET /api/auth/*` - Authentication endpoints

## Error Handling & Monitoring

The system includes comprehensive error handling with email notifications:

- **Redis Upload Failures**: Automatic email alerts to administrators
- **API Rate Limiting**: Smart sequencing to avoid TMDB conflicts
- **Fallback Systems**: Live API fallback for reliability if Redis is empty or unreachable
- **Detailed Logging**: Comprehensive logging for debugging

### Email Notifications

When Redis population fails, the system automatically sends detailed error reports to:
- drensokoli@gmail.com
- sokolidren@gmail.com

Notifications include:
- Media type that failed
- Specific operation that failed
- Error message and stack trace
- Timestamp of failure
- Immediate action required
- **Retry buttons** for manual population retry

### Manual Retry System

If Redis population fails, you can manually retry using the retry page:

**URL**: `/retry-population`

**⚠️ Security**: This page is restricted to `drensokoli@gmail.com` only. Unauthorized users will be redirected.

**Features**:
- Individual retry buttons for each media type
- Retry all media types at once
- Real-time status updates
- Error handling and success feedback
- Professional UI with loading states
- **Authentication required** - Only authorized users can access

**Retry Options**:
- 🔄 **Retry Movies Population** - Repopulate movies only
- 🔄 **Retry Series Population** - Repopulate Series only  
- 🔄 **Retry Books Population** - Repopulate books only
- 🚀 **Retry All Media Types** - Repopulate everything

**How it works**:
1. Click any retry button from the error email
2. Opens the retry page in your browser
3. Click the specific retry button for the failed media type
4. System attempts to repopulate Redis
5. Get immediate feedback on success/failure

## Development

### Key Components

- `app/page.tsx` - Main page with server-side data fetching
- `components/content-section.tsx` - Media display with infinite scroll
- `components/media-card.tsx` - Individual media item cards
- `components/media-details-modal.tsx` - Detailed media information modal
- `lib/fetch-helpers.ts` - Data fetching utilities
- `app/api/cron/route.ts` - Data population script with error handling
- `lib/email-service.ts` - Email notification service

### Data Flow

1. Server fetches the first 20 cards of each media type from Redis (`range`)
2. The fetch response is cached by Next.js's data cache for 7 days
3. Client receives the initial 20 items
4. On scroll, client fetches the next range of cards from Redis
5. Progressive loading continues until Redis has no more cards to return

## Performance Features

- **Next.js Data Caching**: Prevents repeated Redis calls on page reloads
- **Progressive Loading**: Loads data in chunks to improve initial page load
- **Live API Fallback**: Falls back to TMDB/Google Books/NY Times directly if Redis is empty
- **Optimized Images**: Next.js Image optimization for media posters
- **Efficient State Management**: Minimal re-renders and optimized updates
- **Smart API Sequencing**: Avoids rate limiting by running movies/books and Series sequentially

## Deployment

The application is optimized for Vercel deployment with:
- Server-side rendering for fast initial loads
- Efficient caching strategies for limited network usage
- Progressive loading to reduce bandwidth consumption
- Fallback systems for reliability
- Comprehensive error monitoring and alerting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.