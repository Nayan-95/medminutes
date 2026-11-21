import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { MainNav } from "@/components/main-nav";
import { ScorePill } from "@/components/score-pill";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/reports";
import { getTotalScore } from "@/lib/practice";

import { signInWithGoogle } from "./auth-actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Editorial serif for page titles (minimalist-ui). Body text stays Geist. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "MedMinutes — NEET PG MCQ practice",
  description: "Practise NEET PG MCQs with real exam marking: +4 correct, −1 wrong, 0 skipped.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

/** Reads the session (a cookie), so it streams in behind a Suspense boundary. */
async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value="/practice" />
        <button type="submit" className={buttonVariants({ variant: "default", size: "lg" })}>
          Sign in
        </button>
      </form>
    );
  }

  const total = await getTotalScore(user.id);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <MainNav />
      <span title="Lifetime score: +4 correct, −1 wrong, 0 skipped" data-testid="total-score">
        <ScorePill value={total} label="Total" />
      </span>
      <UserMenu name={user.name} email={user.email} image={user.image} isAdmin={isAdminEmail(user.email)} />
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" aria-label="MedMinutes home" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Logo />
            </Link>
            <Suspense fallback={<Skeleton className="h-8 w-40 rounded-full" />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">{children}</main>
        <footer className="mt-10 border-t">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="flex items-center gap-2">
              <span className="font-medium text-foreground">MedMinutes</span>
              <span aria-hidden>·</span>
              NEET PG practice with real exam marking
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Questions from the MedMCQA dataset</span>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
