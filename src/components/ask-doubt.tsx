"use client";

import { ArrowUp, LoaderCircle, MessagesSquare, Sparkles } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";

import { askADoubt } from "@/app/ai-actions";
import { buttonVariants } from "@/components/ui/button";
import { CHIP_IDS, DOUBT_CHIPS, DOUBT_LIMITS, type DoubtChip } from "@/lib/ai-doubt";
import type { DoubtResponse } from "@/lib/ai-doubt-data";
import { cn } from "@/lib/utils";

interface Turn {
  q: string;
  a: string;
}

/**
 * Ask a doubt (docs/adr/0010): a short AI chat about one question, available after
 * its answer is revealed. Three doubts per question; nothing is saved. The page's
 * keyboard shortcuts are switched off inside it via data-no-shortcuts.
 */
export function AskDoubt({ questionId, className }: { questionId: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [usedChips, setUsedChips] = useState<DoubtChip[]>([]);
  const [remaining, setRemaining] = useState<number>(DOUBT_LIMITS.perQuestion);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}>
        <MessagesSquare aria-hidden />
        Ask a doubt
      </button>
    );
  }

  function send(input: { chip: DoubtChip } | { text: string }) {
    if (pending || remaining === 0) return;
    const label = "chip" in input ? DOUBT_CHIPS[input.chip].label : input.text.trim();
    setError(null);
    setAsking(label);
    startTransition(async () => {
      const res: DoubtResponse = await askADoubt({
        questionId,
        ...("chip" in input ? { chip: input.chip } : { text: input.text }),
        history: turns.slice(-1),
      }).catch(() => ({ ok: false as const, message: "Couldn't answer that. Check your connection and try again." }));
      setAsking(null);
      if (res.remaining !== undefined) setRemaining(res.remaining);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setTurns((t) => [...t, { q: label, a: res.answer }]);
      if ("chip" in input) setUsedChips((c) => [...c, input.chip]);
      else setText("");
      inputRef.current?.focus();
    });
  }

  const chips = CHIP_IDS.filter((c) => !usedChips.includes(c));
  const done = remaining === 0;

  return (
    <section data-no-shortcuts data-testid="ask-doubt" aria-labelledby={`${id}-title`} className={cn("w-full animate-rise rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-brand" aria-hidden />
          Ask a doubt
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">AI · may contain errors</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" data-testid="doubts-left">
          {remaining} of {DOUBT_LIMITS.perQuestion} left
        </span>
      </div>

      {(turns.length > 0 || asking) && (
        <ol className="mt-3 flex flex-col gap-3 text-sm leading-relaxed" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <p className="self-end rounded-xl rounded-br-sm bg-foreground px-3 py-2 text-background">{t.q}</p>
              <p className="max-w-[95%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 whitespace-pre-line" data-testid="doubt-answer">
                {t.a}
              </p>
            </li>
          ))}
          {asking && (
            <li className="flex flex-col gap-1.5">
              <p className="self-end rounded-xl rounded-br-sm bg-foreground px-3 py-2 text-background">{asking}</p>
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Thinking…
              </p>
            </li>
          )}
        </ol>
      )}

      {done ? (
        <p className="mt-3 text-sm text-muted-foreground">That&apos;s all the doubts for this question today.</p>
      ) : (
        <>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick doubts">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => send({ chip: c })}
                  disabled={pending}
                  className="rounded-full border px-3 py-1.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {DOUBT_CHIPS[c].label}
                </button>
              ))}
            </div>
          )}
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim().length >= 3) send({ text });
            }}
          >
            <label htmlFor={`${id}-input`} className="sr-only">
              Your doubt
            </label>
            <input
              ref={inputRef}
              id={`${id}-input`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={DOUBT_LIMITS.doubtChars}
              placeholder="Type your doubt about this question…"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              aria-label="Send doubt"
              disabled={pending || text.trim().length < 3}
              className={buttonVariants({ size: "icon-lg" })}
            >
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
            </button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-muted-foreground" data-testid="doubt-error">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Answers are short to save AI quota. Don&apos;t share personal details. Chats aren&apos;t saved.</p>
    </section>
  );
}
