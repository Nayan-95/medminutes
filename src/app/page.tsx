export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">MedMinutes</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        NEET PG MCQ practice with real exam marking: +4 correct, −1 wrong, 0 skipped.
      </p>
      <p className="text-sm text-zinc-500">Practice mode is coming soon.</p>
    </main>
  );
}
