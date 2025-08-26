#!/usr/bin/env node

// Redis population script with separate commands for different data types
// Usage: 
//   node scripts/populate-redis.js                    # Populate all data
//   node scripts/populate-redis.js movies             # Populate only movies
//   node scripts/populate-redis.js tvshows            # Populate only TV shows
//   node scripts/populate-redis.js books              # Populate only books

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function populateRedis(action = 'populate-all') {
  console.log(`Starting Redis population with action: ${action}`);
  console.log(`Using base URL: ${baseUrl}`);
  
  try {
    const response = await fetch(`${baseUrl}/api/cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Redis populated successfully:', result);
      return result;
    } else {
      const error = await response.text();
      console.error('Failed to populate Redis:', error);
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
  } catch (error) {
    console.error('Error during Redis population:', error.message);
    throw error;
  }
}

async function main() {
  const dataType = process.argv[2] || 'all';
  
  // Map command line arguments to API actions
  const actionMap = {
    'all': 'populate-all',
    'movies': 'populate-movies',
    'tvshows': 'populate-tvshows',
    'books': 'populate-books'
  };
  
  const action = actionMap[dataType];
  
  // Validate action
  if (!action) {
    console.error('Invalid data type. Valid types are:');
    console.error('   all      - Populate all data types');
    console.error('   movies   - Populate only movies');
    console.error('   tvshows  - Populate only TV shows');
    console.error('   books    - Populate only books');
    process.exit(1);
  }
  
  console.log('Redis Population Script');
  console.log('========================');
  console.log(`Data Type: ${dataType}`);
  console.log(`API Action: ${action}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log('');
  
  try {
    const result = await populateRedis(action);
    console.log('');
    console.log('Population completed successfully!');
    console.log('Results:', result);
  } catch (error) {
    console.error('');
    console.error('Population failed!');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { populateRedis };
