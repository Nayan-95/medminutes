"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Disables itself while the form submits, so one click starts exactly one session. */
export function StartButton({ label = "Start session", className }: { label?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(buttonVariants({ size: "xl" }), className)}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden />
          Starting…
        </>
      ) : (
        <>
          {label}
          <ArrowRight data-icon="inline-end" aria-hidden />
        </>
      )}
    </button>
  );
}
