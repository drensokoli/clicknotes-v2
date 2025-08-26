// Secure fetch implementation with proper error handling and SSL configuration
import { configureNodeSSL, getFetchOptionsWithSSL, isDevelopment, isServer } from './ssl-config';

// Configure SSL on module load (server-side only)
configureNodeSSL();

// Export a configured fetch function
export const secureFetch = async (url: string, options: RequestInit = {}) => {
  const defaultOptions = getFetchOptionsWithSSL(options);

  try {
    // For Node.js environments, we might need to handle SSL differently
    if (isServer() && isDevelopment()) {
      console.log(`Fetching from ${url} in development mode`);
    }

    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error: any) {
    // Handle SSL certificate errors specifically
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || 
        error.message?.includes('self-signed certificate') ||
        error.message?.includes('certificate')) {
      
      console.warn(`SSL certificate issue detected for ${url}, attempting alternative approach...`);
      
      // Try with different SSL configuration if available
      try {
        // For Node.js environments, we can try to bypass SSL verification in development
        if (isServer() && isDevelopment()) {
          // This is a development-only fallback
          console.warn('Attempting to bypass SSL verification in development mode');
          
          // Try to use a different approach - could be axios or other HTTP client
          // For now, let's try the original fetch again but with a warning
          const retryResponse = await fetch(url, {
            ...defaultOptions,
            // Add any additional options that might help with SSL
          });
          
          if (retryResponse.ok) {
            console.log('SSL issue resolved on retry');
            return retryResponse;
          }
        }
      } catch (retryError) {
        console.error('SSL retry also failed:', retryError);
      }
    }
    
    console.error(`Fetch error for ${url}:`, error);
    throw error;
  }
};

// Helper function to get JSON data with error handling
export const fetchJSON = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await secureFetch(url, options);
    return await response.json();
  } catch (error) {
    console.error(`JSON fetch error for ${url}:`, error);
    return null;
  }
};

// Alternative fetch function that uses axios for better SSL handling
export const secureFetchWithAxios = async (url: string, options: any = {}) => {
  try {
    // Dynamic import to avoid bundling axios in client-side code
    const axios = (await import('axios')).default;
    
    // Configure axios with SSL settings
    let sslConfig = {};
    if (isServer() && isDevelopment()) {
      try {
        const https = await import('https');
        sslConfig = { 
          httpsAgent: new https.Agent({ 
            rejectUnauthorized: false,
            requestCert: false
          }) 
        };
      } catch (error) {
        console.warn('Could not create HTTPS agent:', error);
        // Continue without custom HTTPS agent
      }
    }
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'ClickNotes-v2/1.0.0',
        ...options.headers,
      },
      timeout: 10000,
      ...sslConfig,
      ...options,
    });
    
    return response;
  } catch (error: any) {
    console.error(`Axios fetch error for ${url}:`, error);
    throw error;
  }
};
