/** @type {import('next').NextConfig} */
const runtimeCaching = require("next-pwa/cache");

const nextConfig = {
  // Dev-only: logs each fetch() with its cache status (HIT/SKIP) in the terminal,
  // so it's easy to see whether the Redis fetch in app/page.tsx is being reused
  // from the Data Cache or hitting Redis fresh.
  logging: { fetches: { fullUrl: true } },
  // Enable source maps in production for better debugging and Lighthouse insights
  productionBrowserSourceMaps: true,
  
  // Configure cache headers for static assets and pages
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*\\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Enable bfcache for main pages
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, must-revalidate',
          },
        ],
      },
      {
        source: '/(login|signup|verify-email|forgot-password|reset-password)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, must-revalidate',
          },
        ],
      },
      // API routes that can be cached for better performance
      {
        source: '/api/redisHandler',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, must-revalidate',
          },
        ],
      },
    ]
  },
  
  images: {
    // Serve remote images straight from their own CDNs instead of routing them
    // through Vercel's Image Optimization.
    //
    // Every image this app renders is a poster/backdrop/profile shot from TMDB,
    // Google Books or NYT - already compressed, already on a global CDN, and already
    // requested at an explicit width (/t/p/w342, /t/p/w185, ...). Optimizing them
    // again bought us almost nothing, but each distinct source URL x each srcset
    // width counted as a separate transformation against the Vercel plan quota. With
    // 1000+ saved items that quota is exhausted quickly, and once it is, any variant
    // that isn't already cached fails to load - which is why posters went missing in
    // patches, and worse on mobile (mobile requests different, less-warmed widths).
    unoptimized: true,
    // Kept for the (now unused) optimizer path and for any future local images.
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static01.nyt.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Configure webpack to handle SSL issues in development
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      // In development server mode, we can be more lenient with SSL
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching,
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA(nextConfig);
