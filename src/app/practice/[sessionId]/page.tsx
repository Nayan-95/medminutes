import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireUserId } from "@/lib/current-user";
import { getSessionForUser } from "@/lib/practice";

import { PracticeRunner } from "./practice-runner";

async function Session({ params }: { params: PageProps<"/practice/[sessionId]">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();

  const data = await getSessionForUser(sessionId, await requireUserId(`/practice/${sessionId}`));
  if (!data) notFound();
  if (data.session.endedAt) redirect(`/practice/${sessionId}/summary`);

  return <PracticeRunner sessionId={sessionId} questions={data.questions} initialAttempts={data.attempts} />;
}

export default function PracticeSessionPage(props: PageProps<"/practice/[sessionId]">) {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading questions…</p>}>
      <Session params={props.params} />
    </Suspense>
  );
}
