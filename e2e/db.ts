import { config } from "dotenv";
import { Client } from "pg";

import { withVerifiedSsl } from "../src/db/ssl";

config({ path: ".env.local", quiet: true });

/** Runs `fn` with a direct database connection (tests only). */
export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("e2e needs DATABASE_URL_UNPOOLED in .env.local");
  const db = new Client({ connectionString: withVerifiedSsl(url) });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}
