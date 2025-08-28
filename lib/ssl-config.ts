// SSL Configuration for different environments
// This file handles SSL certificate issues that commonly occur in development

export interface SSLConfig {
  rejectUnauthorized: boolean;
  strictSSL: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

// Get SSL configuration based on environment
export function getSSLConfig(): SSLConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isNode = typeof window === 'undefined';
  
  if (isDevelopment && isNode) {
    // In development mode on Node.js, be more lenient with SSL
    return {
      rejectUnauthorized: false,
      strictSSL: false,
    };
  }
  
  // Production or client-side: strict SSL
  return {
    rejectUnauthorized: true,
    strictSSL: true,
  };
}

// Set Node.js SSL environment variables safely
export function configureNodeSSL() {
  if (typeof window === 'undefined') {
    // Only run on server-side
    const config = getSSLConfig();
    
    // Only set this in development, never in production
    if (config.rejectUnauthorized === false && process.env.NODE_ENV === 'development') {
      // Double-check we're not in a production environment like Vercel
      if (process.env.VERCEL_ENV) {
        console.warn('⚠️  SSL verification disabled but running in Vercel environment. Skipping SSL configuration.');
        return;
      }
      
      try {
        // Set the environment variable safely
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        console.warn('⚠️  SSL verification disabled for development. DO NOT use in production!');
      } catch (error) {
        console.warn('⚠️  Could not set SSL environment variable:', error);
        // Continue without setting the variable - the HTTPS agent approach will still work
      }
    } else {
      console.log('🔒 SSL verification enabled for production environment');
    }
  }
}

// Get fetch options with SSL configuration
export function getFetchOptionsWithSSL(options: RequestInit = {}): RequestInit {
  
  return {
    ...options,
    // Add any SSL-specific headers or options here
    headers: {
      ...options.headers,
      'Accept': 'application/json',
      'User-Agent': 'ClickNotes-v2/1.0.0',
    },
  };
}

// Check if we're in a development environment
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Check if we're running on the server
export function isServer(): boolean {
  return typeof window === 'undefined';
}
