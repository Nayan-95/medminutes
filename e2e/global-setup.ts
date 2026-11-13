import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "dotenv";
import { encode } from "next-auth/jwt";
import { Client } from "pg";

import { withVerifiedSsl } from "../src/db/ssl";

import { E2E_USER, STORAGE_STATE } from "./constants";

config({ path: ".env.local", quiet: true });

/**
 * Google sign-in can't be automated, so tests use a dedicated user and a
 * session cookie minted with the app's own AUTH_SECRET (same format Auth.js
 * issues). Its data is deleted in global-teardown.ts.
 */
export default async function globalSetup() {
  const secret = process.env.AUTH_SECRET;
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!secret || !url) throw new Error("e2e needs AUTH_SECRET and DATABASE_URL_UNPOOLED in .env.local");

  const db = new Client({ connectionString: withVerifiedSsl(url) });
  await db.connect();
  try {
    await db.query(
      `insert into users (id, name, email) values ($1, $2, $3)
       on conflict (id) do nothing`,
      [E2E_USER.id, E2E_USER.name, E2E_USER.email],
    );
    // Start every run from a clean slate.
    await db.query("delete from practice_sessions where user_id = $1", [E2E_USER.id]);
    await db.query("delete from review_cards where user_id = $1", [E2E_USER.id]);
  } finally {
    await db.end();
  }

  const cookieName = "authjs.session-token"; // non-secure cookie name used on http://localhost
  const value = await encode({
    token: { sub: E2E_USER.id, name: E2E_USER.name, email: E2E_USER.email },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  });

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  writeFileSync(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [
        {
          name: cookieName,
          value,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 60 * 60,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
