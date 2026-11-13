import { formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A signed score in a pill; tone follows the sign but the sign itself carries the meaning. */
export function ScorePill({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums",
        value > 0 && "border-correct/25 bg-correct-soft text-foreground",
        value < 0 && "border-wrong/25 bg-wrong-soft text-foreground",
        value === 0 && "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {label && <span className="text-muted-foreground">{label}</span>}
      <span data-slot="score-value" className="text-[13px] font-semibold text-foreground">{formatScore(value)}</span>
    </span>
  );
}
