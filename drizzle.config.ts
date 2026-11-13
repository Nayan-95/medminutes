import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations must use the direct (non-pooled) connection; PgBouncer's
    // transaction mode breaks session-level operations.
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
  strict: true,
  verbose: true,
});
