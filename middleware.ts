import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Get the pathname of the request
  const pathname = request.nextUrl.pathname

  // For API routes, set appropriate cache headers to avoid no-store
  if (pathname.startsWith('/api/')) {
    // Auth routes should not be cached for security
    if (pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/api/cron')) {
      response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate')
    } 
    // Data routes can be cached briefly
    else if (pathname.startsWith('/api/redisHandler')) {
      response.headers.set('Cache-Control', 'public, max-age=60, must-revalidate')
    }
    // Per-user saved-media state changes on every save/watch click and must never
    // be served stale from the browser's HTTP cache (which is shared across tabs).
    else if (pathname.startsWith('/api/media/')) {
      response.headers.set('Cache-Control', 'private, no-store, must-revalidate')
    }
    // Default for other API routes
    else {
      response.headers.set('Cache-Control', 'private, max-age=300, must-revalidate')
    }
  }
  // For page routes, ensure they can be cached for bfcache
  else if (!pathname.startsWith('/_next/') && !pathname.includes('.')) {
    response.headers.set('Cache-Control', 'public, max-age=300, must-revalidate')
  }

  return response
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
