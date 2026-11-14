"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/current-user";

/** Opt out of (or back into) other people's leaderboards. */
export async function setLeaderboardHidden(formData: FormData) {
  const hidden = formData.get("hidden") === "true";
  const userId = await requireUserId("/leaderboard");
  await getDb().update(users).set({ leaderboardHidden: hidden }).where(eq(users.id, userId));
  revalidatePath("/leaderboard");
}
