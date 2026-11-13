import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/current-user";
import { formatScore } from "@/lib/format";
import { getTotalScore } from "@/lib/practice";

import { signInWithGoogle, signOutAction } from "./auth-actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedMinutes — NEET PG MCQ practice",
  description: "Practise NEET PG MCQs with real exam marking: +4 correct, −1 wrong, 0 skipped.",
};

/** Reads the session (a cookie), so it streams in behind a Suspense boundary. */
async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value="/practice" />
        <button type="submit" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          Sign in
        </button>
      </form>
    );
  }

  const total = await getTotalScore(user.id);
  return (
    <div className="flex items-center gap-4">
      <span className="tabular-nums" title="Lifetime score: +4 correct, −1 wrong, 0 skipped">
        Total score <strong className="ml-1 text-base text-zinc-900 dark:text-zinc-100">{formatScore(total)}</strong>
      </span>
      <span className="hidden sm:inline" data-testid="user-name">
        {user.name ?? user.email}
      </span>
      <form action={signOutAction}>
        <button type="submit" className="hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              MedMinutes
            </Link>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <Suspense fallback={<span aria-hidden>…</span>}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
