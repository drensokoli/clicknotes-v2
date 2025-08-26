#!/usr/bin/env node

// Test script to verify SSL configuration is working
// Run with: node scripts/test-ssl.js

const https = require('https');

// Test SSL configuration
console.log('🔒 Testing SSL configuration...');

// Test 1: Check if we can make HTTPS requests
console.log('\n📡 Testing HTTPS request to TMDB API...');

const testTMDBRequest = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.themoviedb.org',
      port: 443,
      path: '/3/movie/popular?api_key=test&language=en-US&page=1',
      method: 'GET',
      headers: {
        'User-Agent': 'ClickNotes-v2/1.0.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 401) {
          // This is expected - we're using a test API key
          console.log('✅ HTTPS request successful (401 Unauthorized is expected with test key)');
          resolve(true);
        } else {
          console.log(`✅ HTTPS request successful (Status: ${res.statusCode})`);
          resolve(true);
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        console.error('❌ SSL certificate error detected');
        reject(error);
      } else {
        console.error('❌ Request failed:', error.message);
        reject(error);
      }
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

// Test 2: Check environment variables
console.log('\n🔧 Checking environment configuration...');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`NODE_TLS_REJECT_UNAUTHORIZED: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED || 'undefined'}`);

// Test 3: Check if we're in Node.js environment
console.log('\n🌐 Environment check:');
console.log(`Running in Node.js: ${typeof window === 'undefined'}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node version: ${process.version}`);

// Run the test
async function runTests() {
  try {
    await testTMDBRequest();
    console.log('\n🎉 All SSL tests passed!');
    console.log('\n💡 If you were getting SSL errors before, they should now be resolved.');
    console.log('   The application will automatically handle SSL certificate issues in development.');
  } catch (error) {
    console.error('\n❌ SSL test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure you\'re running in development mode (NODE_ENV=development)');
    console.log('2. Check if your system has proper SSL certificates installed');
    console.log('3. If using a corporate network, check proxy/firewall settings');
    console.log('4. Try running: export NODE_TLS_REJECT_UNAUTHORIZED=0 (development only)');
  }
}

runTests();
