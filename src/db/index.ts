import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import neonConfig from "../../neon";
import * as schema from "./schema";
import { withVerifiedSsl } from "./ssl";

/**
 * node-postgres pool over Neon's *pooled* URL (PgBouncer), as Neon recommends for
 * Vercel Fluid compute. `attachDatabasePool` lets Vercel close idle connections
 * before a function instance is suspended. Migrations and bulk imports use the
 * direct URL instead (see drizzle.config.ts and scripts/import_medmcqa.py).
 */
type Db = NodePgDatabase<typeof schema> & { $client: Pool };

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { medminutesDb?: Db };

/** Created lazily so `next build` works without database credentials. */
export function getDb(): Db {
  if (!globalForDb.medminutesDb) {
    const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
    const pool = new Pool({ connectionString: withVerifiedSsl(postgres.databaseUrl), max: 10 });
    attachDatabasePool(pool);
    globalForDb.medminutesDb = drizzle(pool, { schema });
  }
  return globalForDb.medminutesDb;
}
