# ClickNotes v2

A Next.js application for saving and organizing movies, TV shows, and books. Built with modern web technologies and optimized for performance.

## Features

- **Media Management**: Save and organize movies, TV shows, and books
- **Progressive Loading**: Efficient data loading with infinite scroll
- **Redis Caching**: Fast data access with server-side caching
- **Responsive Design**: Works on desktop and mobile devices
- **Theme Support**: Light and dark mode
- **Search Functionality**: Find specific media items quickly

## Architecture

### Data Structure

The application uses Redis for data storage of initial page data—popular movies, TV shows, and NY Times bestsellers—using a paginated key structure:

- **Movies**: 6 keys of 40 items each (240 total)
  - `movies1`, `movies2`, `movies3`, `movies4`, `movies5`, `movies6`
- **TV Shows**: 6 keys of 40 items each (240 total)
  - `tvshows1`, `tvshows2`, `tvshows3`, `tvshows4`, `tvshows5`, `tvshows6`
- **Books**: 4 keys of 40 items each (160 total)
  - `books1`, `books2`, `books3`, `books4`

### Caching System

- **Server-Side Cache**: In-memory cache for Redis data (7-day duration)
- **Progressive Loading**: Initial load shows first 20 items, loads more on scroll
- **Fallback System**: API fallback if Redis is unavailable

## Getting Started

### Prerequisites

- Node.js 18+ 
- Redis database
- API keys for:
  - TMDB (movies and TV shows)
  - Google Books (book details)
  - NY Times (bestseller lists)
  - OMDB (IMDB IDs)

### Environment Variables

Create a `.env.local` file with:

```bash
# Redis
REDIS_URL=your_redis_url
REDIS_URL_2=your_backup_redis_url

# API Keys
TMDB_API_KEY=your_tmdb_key
GOOGLE_BOOKS_API_KEY=your_google_books_key
NY_TIMES_API_KEY=your_ny_times_key
OMDB_API_KEY=your_omdb_key

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
- Fetch popular movies and TV shows from TMDB (sequentially to avoid rate limiting)
- Fetch bestseller books from NY Times and enrich with Google Books API
- Store data in both primary and backup Redis databases
- Create paginated keys for efficient loading
- Send email notifications if any errors occur during Redis uploads

## API Endpoints

- `GET /api/redisHandler?type={mediaType}{keyNumber}` - Fetch paginated media data
- `POST /api/cron` - Populate Redis with fresh data
  - `{ "action": "populate-all" }` - Populate all media types
  - `{ "action": "populate-movies" }` - Populate movies only
  - `{ "action": "populate-tvshows" }` - Populate TV shows only
  - `{ "action": "populate-books" }` - Populate books only
- `GET /api/auth/*` - Authentication endpoints

## Error Handling & Monitoring

The system includes comprehensive error handling with email notifications:

- **Redis Upload Failures**: Automatic email alerts to administrators
- **API Rate Limiting**: Smart sequencing to avoid TMDB conflicts
- **Fallback Systems**: Backup Redis and API fallbacks for reliability
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
- 🔄 **Retry TV Shows Population** - Repopulate TV shows only  
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

1. Server fetches initial data from Redis (first key of each media type)
2. Data is cached in server-side memory for 7 days
3. Client receives initial 20 items
4. On scroll, client fetches next Redis key
5. Progressive loading continues until all keys are exhausted

## Performance Features

- **Server-Side Caching**: Prevents repeated Redis calls on page reloads
- **Progressive Loading**: Loads data in chunks to improve initial page load
- **Redis Failover**: Automatic fallback to backup Redis if primary fails
- **Optimized Images**: Next.js Image optimization for media posters
- **Efficient State Management**: Minimal re-renders and optimized updates
- **Smart API Sequencing**: Avoids rate limiting by running movies and TV shows sequentially

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