import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";

/**
 * Data access layer for "who is this?". Every page and Server Action asks here
 * instead of reading the session directly, so the auth check lives in one place.
 */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Auth.js uses crypto randomness when it refreshes the session cookie, so this
  // must run at request time, never during prerendering (Next.js 16 Cache Components).
  await connection();
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? null, email: u.email ?? null, image: u.image ?? null };
}

/** Returns the signed-in user's id, or redirects to the sign-in page. */
export async function requireUserId(returnTo = "/practice"): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(returnTo)}`);
  return user.id;
}
