import { connection } from "next/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { getReviewStatus, listSubjects, QUESTION_COUNTS } from "@/lib/practice";
import { ReviewBanner } from "@/components/review-banner";

import { SetupForm } from "./setup-form";

async function Setup() {
  // Request time, not build time: builds (and CI) need no database, and the
  // subject list reflects the latest import. listSubjects() is still cached.
  await connection();
  const userId = await requireUserId("/practice");
  const [subjects, review] = await Promise.all([listSubjects(), getReviewStatus(userId)]);
  const total = subjects.reduce((n, s) => n + s.questionCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <ReviewBanner {...review} now={new Date()} />
      <SetupForm subjects={subjects} total={total} counts={QUESTION_COUNTS} />
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function PracticeSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New practice session</h1>
        <p className="mt-1.5 text-muted-foreground">
          Pick a subject, then how many questions. You&apos;ll see the answer after each one.
        </p>
      </div>
      <Suspense fallback={<SetupSkeleton />}>
        <Setup />
      </Suspense>
    </div>
  );
}
