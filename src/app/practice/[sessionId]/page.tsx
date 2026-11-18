import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { getSessionForUser } from "@/lib/practice";
import { getOpenReportIdsForSession } from "@/lib/reports-data";

import { PracticeRunner } from "./practice-runner";

async function Session({ params }: { params: PageProps<"/practice/[sessionId]">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/practice");

  const userId = await requireUserId(`/practice/${sessionId}`);
  const [data, reportedIds] = await Promise.all([
    getSessionForUser(sessionId, userId),
    getOpenReportIdsForSession(userId, sessionId),
  ]);
  // Missing, deleted or not yours: send to a fresh session instead of a dead-end 404.
  if (!data) redirect("/practice");
  if (data.session.kind === "mock") redirect(`/mock/${sessionId}`);
  if (data.session.endedAt) redirect(`/practice/${sessionId}/summary`);

  return (
    <PracticeRunner
      sessionId={sessionId}
      kind={data.session.kind}
      questions={data.questions}
      initialAttempts={data.attempts}
      reportedIds={reportedIds}
    />
  );
}

export default function PracticeSessionPage(props: PageProps<"/practice/[sessionId]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-label="Loading questions">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      }
    >
      <Session params={props.params} />
    </Suspense>
  );
}
