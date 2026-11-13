import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Temporary guest identity until Google sign-in lands (see docs/ROADMAP.md).
 * Everyone using a guest-mode instance shares this one user, so guest mode is
 * only allowed in development or when GUEST_MODE=true is set explicitly.
 */
const GUEST_USER_ID = "local-guest";

function guestModeAllowed() {
  return process.env.NODE_ENV === "development" || process.env.GUEST_MODE === "true";
}

export function getCurrentUserId(): string {
  if (!guestModeAllowed()) {
    throw new Error("Sign-in is not available yet. Run locally, or set GUEST_MODE=true.");
  }
  return GUEST_USER_ID;
}

/** Makes sure the current user exists in the database before writing rows that reference it. */
export async function ensureCurrentUser(): Promise<string> {
  const id = getCurrentUserId();
  await getDb()
    .insert(users)
    .values({ id, name: "Guest" })
    .onConflictDoNothing({ target: users.id });
  return id;
}
