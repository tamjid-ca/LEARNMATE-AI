/**
 * LearnMate AI — Serverless MongoDB / Mongoose Connection Manager Contract
 * Caches connection promises across warm serverless invocations (SRS Section 6.2 Rule 11).
 */

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
