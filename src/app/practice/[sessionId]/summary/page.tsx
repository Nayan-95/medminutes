import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireUserId } from "@/lib/current-user";
import { formatDuration, formatPercent, formatScore } from "@/lib/format";
import { getSessionForUser } from "@/lib/practice";
import { summarise } from "@/lib/scoring";

async function Summary({ params }: { params: PageProps<"/practice/[sessionId]/summary">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/practice");

  const data = await getSessionForUser(sessionId, await requireUserId(`/practice/${sessionId}/summary`));
  // Missing, deleted or not yours: send to a fresh session instead of a dead-end 404.
  if (!data) redirect("/practice");

  const s = summarise(data.attempts.map((a) => a.result));
  const unanswered = data.questions.length - data.attempts.length;
  const elapsed = (data.session.endedAt ?? new Date()).getTime() - data.session.startedAt.getTime();

  const stats = [
    { label: "Correct", value: s.correct, note: `+${s.correct * 4}` },
    { label: "Wrong", value: s.wrong, note: s.wrong ? `−${s.wrong}` : "0" },
    { label: "Skipped", value: s.skipped, note: "0" },
    { label: "Accuracy", value: formatPercent(s.accuracy), note: "of attempted" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Session complete</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {data.questions.length} questions · {formatDuration(elapsed)}
          {unanswered > 0 && ` · ${unanswered} not answered`}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Session score</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums">{formatScore(s.total)}</p>
        <p className="mt-1 text-sm text-zinc-500">out of +{data.questions.length * 4}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">{st.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{st.value}</dd>
            <dd className="text-xs text-zinc-500">{st.note}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/practice"
        className="self-start rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
      >
        Practise again
      </Link>
    </div>
  );
}

export default function SummaryPage(props: PageProps<"/practice/[sessionId]/summary">) {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading summary…</p>}>
      <Summary params={props.params} />
    </Suspense>
  );
}
