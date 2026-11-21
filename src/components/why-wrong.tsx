"use client";

import { CircleCheck, CircleX, Lightbulb, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { whyWasIWrong } from "@/app/ai-actions";
import { buttonVariants } from "@/components/ui/button";
import type { ExplainResult } from "@/lib/ai-data";
import { cn } from "@/lib/utils";

type Done = Extract<ExplainResult, { ok: true }>;

/**
 * "Why was I wrong?" (docs/adr/0009). Shown only after a wrong answer. The page's
 * keyboard shortcuts are switched off inside it via data-no-shortcuts.
 */
export function WhyWrong({ questionId, className }: { questionId: number; className?: string }) {
  const [result, setResult] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    setError(null);
    startTransition(async () => {
      const res = await whyWasIWrong(questionId).catch(
        (): ExplainResult => ({ ok: false, message: "Couldn't get an AI explanation. Check your connection and try again." }),
      );
      if (res.ok) setResult(res);
      else setError(res.message);
    });
  }

  if (result) {
    const { explanation: e, chosenOption, correctOption } = result;
    return (
      <section data-no-shortcuts data-testid="ai-explanation" aria-label="AI explanation" className={cn("w-full animate-rise rounded-xl border bg-card p-4", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-brand" aria-hidden />
          Why you were wrong
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">AI · may contain errors</span>
        </p>
        <dl className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
          <div className="flex gap-2.5">
            <CircleX className="mt-0.5 size-4 shrink-0 text-wrong" aria-hidden />
            <div>
              <dt className="font-medium">Why {chosenOption} is wrong</dt>
              <dd className="text-muted-foreground">{e.whyWrong}</dd>
            </div>
          </div>
          <div className="flex gap-2.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-correct" aria-hidden />
            <div>
              <dt className="font-medium">Why {correctOption} is right</dt>
              <dd className="text-muted-foreground">{e.whyRight}</dd>
            </div>
          </div>
          <div className="flex gap-2.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="font-medium">Remember</dt>
              <dd className="text-muted-foreground">{e.remember}</dd>
            </div>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <div data-no-shortcuts className={cn("flex flex-col items-start gap-2", className)}>
      <button type="button" onClick={ask} disabled={pending} className={buttonVariants({ variant: "outline", size: "lg" })}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : error ? <RotateCcw aria-hidden /> : <Sparkles aria-hidden />}
        {pending ? "Thinking…" : error ? "Try again" : "Why was I wrong?"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-muted-foreground" data-testid="ai-error">
          {error}
        </p>
      )}
    </div>
  );
}
