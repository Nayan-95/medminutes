import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { getCurrentUserId } from "@/lib/current-user";
import { formatScore } from "@/lib/format";
import { getTotalScore } from "@/lib/practice";
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

async function TotalScore() {
  await connection();
  const total = await getTotalScore(getCurrentUserId());
  return (
    <span className="tabular-nums" title="Lifetime score: +4 correct, −1 wrong, 0 skipped">
      Total score <strong className="ml-1 text-base">{formatScore(total)}</strong>
    </span>
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
              <Suspense fallback={<span>Total score …</span>}>
                <TotalScore />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
