import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getDb } from "@/db";
import { accounts, users } from "@/db/schema";

/**
 * Auth.js v5. Config is a function so the database client (and its env
 * validation) is only created on first use, never at build time.
 *
 * - Google is the only provider; it reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
 * - Users and linked Google accounts live in Postgres (Drizzle adapter).
 * - Sessions are signed+encrypted JWT cookies (AUTH_SECRET), so reading the
 *   session costs no database round trip.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), { usersTable: users, accountsTable: accounts }),
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
}));
