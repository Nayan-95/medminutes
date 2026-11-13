"use server";

import { signIn, signOut } from "@/auth";

/** Only allow same-site relative paths as post-sign-in destinations (no open redirects). */
function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/practice";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeReturnPath(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
