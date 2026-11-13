import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">NEET PG MCQ practice</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Real exam marking on every card: <strong>+4</strong> correct, <strong>−1</strong> wrong,{" "}
        <strong>0</strong> skipped.
      </p>
      <Link
        href="/practice"
        className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
      >
        Start practising
      </Link>
    </div>
  );
}
