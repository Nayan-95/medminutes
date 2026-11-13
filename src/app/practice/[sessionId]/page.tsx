import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { getSessionForUser } from "@/lib/practice";

import { PracticeRunner } from "./practice-runner";

async function Session({ params }: { params: PageProps<"/practice/[sessionId]">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/practice");

  const data = await getSessionForUser(sessionId, await requireUserId(`/practice/${sessionId}`));
  // Missing, deleted or not yours: send to a fresh session instead of a dead-end 404.
  if (!data) redirect("/practice");
  if (data.session.endedAt) redirect(`/practice/${sessionId}/summary`);

  return <PracticeRunner sessionId={sessionId} questions={data.questions} initialAttempts={data.attempts} />;
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
