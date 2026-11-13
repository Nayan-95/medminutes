import { config } from "dotenv";
import { Client } from "pg";

import { E2E_USER } from "./constants";

config({ path: ".env.local", quiet: true });

/** Removes the test user; its sessions and attempts cascade. */
export default async function globalTeardown() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) return;
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query("delete from users where id = $1", [E2E_USER.id]);
  } finally {
    await db.end();
  }
}
