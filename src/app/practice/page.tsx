import { connection } from "next/server";
import { Suspense } from "react";

import { requireUserId } from "@/lib/current-user";
import { listSubjects, QUESTION_COUNTS } from "@/lib/practice";

import { startSession } from "./actions";
import { StartButton } from "./start-button";

async function SetupForm() {
  // Request time, not build time: builds (and CI) need no database, and the
  // subject list reflects the latest import. listSubjects() is still cached.
  await connection();
  await requireUserId("/practice");
  const subjects = await listSubjects();
  const total = subjects.reduce((n, s) => n + s.questionCount, 0);

  return (
    <form action={startSession} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-medium">Subject</span>
        <select
          name="subjectId"
          defaultValue="all"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All subjects ({total.toLocaleString("en-IN")} questions)</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.questionCount.toLocaleString("en-IN")})
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Number of questions</legend>
        <div className="flex gap-3">
          {QUESTION_COUNTS.map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 has-checked:border-emerald-600 has-checked:bg-emerald-50 dark:border-zinc-700 dark:has-checked:bg-emerald-950"
            >
              <input type="radio" name="count" value={n} defaultChecked={n === 10} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <StartButton />
    </form>
  );
}

export default function PracticeSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New practice session</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Marking: +4 correct, −1 wrong, 0 skipped. You see the answer after each question.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading subjects…</p>}>
        <SetupForm />
      </Suspense>
    </div>
  );
}
