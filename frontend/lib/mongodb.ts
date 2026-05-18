import { MongoClient, Db } from 'mongodb';
import dns from 'dns';

// Override DNS to use public resolvers — local network DNS blocks MongoDB SRV lookups
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db('blur_chat');
  await ensureIndexes(db);
  return db;
}

let indexesEnsured = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  try {
    // TTL index: MongoDB automatically deletes room documents when expiresAt is reached.
    // expireAfterSeconds: 0 means "delete at the exact time stored in expiresAt".
    // sparse: true means documents where expiresAt is null/missing are ignored (permanent rooms).
    await db.collection('rooms').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, sparse: true, name: 'rooms_ttl_expiry' }
    );
  } catch (err) {
    // Index may already exist with different options — log but don't crash
    console.warn('TTL index creation skipped (may already exist):', err);
  }
}

export default clientPromise;
