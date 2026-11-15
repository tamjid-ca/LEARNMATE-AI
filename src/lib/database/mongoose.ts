/**
 * LearnMate AI — Serverless MongoDB / Mongoose Connection Manager
 * Caches connection promises across warm serverless invocations (SRS Section 6.2 Rule 11).
 */

import mongoose, { type MongooseInstance } from 'mongoose';

export interface DatabaseConnectionConfig {
  uri: string;
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
}

export const DEFAULT_DB_POOL_CONFIG: Omit<DatabaseConnectionConfig, 'uri'> = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
};

export function buildDatabaseConnectionConfig(
  env: Record<string, string | undefined> = process.env,
): DatabaseConnectionConfig {
  const uri = env.MONGODB_URI?.trim() ?? '';
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured');
  }
  return {
    uri,
    ...DEFAULT_DB_POOL_CONFIG,
  };
}

interface GlobalMongooseCache {
  conn: MongooseInstance | null;
  promise: Promise<MongooseInstance> | null;
}

declare global {
  var __learnmateMongooseCache: GlobalMongooseCache | undefined;
}

const cached: GlobalMongooseCache = globalThis.__learnmateMongooseCache ?? {
  conn: null,
  promise: null,
};
globalThis.__learnmateMongooseCache = cached;

export async function connectToDatabase(): Promise<MongooseInstance> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const config = buildDatabaseConnectionConfig();
  if (!cached.promise) {
    cached.promise = mongoose.connect(config.uri, {
      maxPoolSize: config.maxPoolSize,
      minPoolSize: config.minPoolSize,
      serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
      socketTimeoutMS: config.socketTimeoutMS,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}
