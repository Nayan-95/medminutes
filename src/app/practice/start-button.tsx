"use client";

import { useFormStatus } from "react-dom";

/** Disables itself while the form submits, so one click starts exactly one session. */
export function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="self-start rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? "Starting…" : "Start session"}
    </button>
  );
}
