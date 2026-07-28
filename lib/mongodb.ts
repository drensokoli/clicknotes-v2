import { MongoClient } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {}

let client
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Deliberately no .catch() here that swallows a connection failure into a resolved
// `null` - this promise is handed directly to `MongoDBAdapter(clientPromise, ...)`
// in lib/auth.ts, and third-party adapter code has no reason to expect anything but
// a real MongoClient. A resolved `null` crashed inside the adapter's own internals
// (an unhandled rejection when it called `client.db(...)`), which is fatal to the
// whole serverless function - not something any of our own try/catch blocks could
// reach. Letting the promise reject naturally means every consumer's own try/catch
// (including MongoDBAdapter's) actually gets a chance to handle it. Call sites that
// want graceful degradation instead of a throw - see getSavedMediaCollection() in
// lib/saved-media.ts - should catch the rejection themselves.
// Log-only: attaching a rejection handler (without using its result) is what marks
// this promise as "handled" for Node's unhandledRejection detection, without
// altering what `await clientPromise` resolves/rejects to for real consumers.
clientPromise.catch((error) => {
  console.error('MongoDB connection failed:', error.message);
});

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise
