/** @type {import('next').NextConfig} */
const runtimeCaching = require("next-pwa/cache");

const nextConfig = {
  images: {
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
