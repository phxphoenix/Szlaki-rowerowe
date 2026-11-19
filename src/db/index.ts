import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type AppDatabase = NeonHttpDatabase<typeof schema>;

let cachedDb: AppDatabase | null = null;
let cachedConnectionString: string | null = null;

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && url.length > 0);
}

export function getDb(): AppDatabase {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL in environment variables to access Neon Postgres.",
    );
  }

  if (cachedDb && cachedConnectionString === databaseUrl) {
    return cachedDb;
  }

  const sql = neon(databaseUrl);
  cachedDb = drizzle(sql, { schema });
  cachedConnectionString = databaseUrl;
  return cachedDb;
}
