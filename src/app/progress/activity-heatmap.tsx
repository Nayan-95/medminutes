import { buildCalendar, LEVELS, type Cell } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

const HEAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;
const WEEKS = 53;
/** Phones show the most recent half-year so cells stay tappable without a horizontal scroll. */
const WEEKS_ON_PHONE = 22;

const dayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function describe(c: Cell) {
  const when = dayLabel.format(new Date(`${c.day}T00:00:00Z`));
  return `${c.count === 0 ? "No questions" : `${c.count} ${c.count === 1 ? "question" : "questions"}`} on ${when}`;
}

/**
 * GitHub-style practice calendar (IST days). Hover a square for the day's
 * count; screen readers get a one-line summary instead of 371 cells.
 */
export function ActivityHeatmap({
  activity,
  today,
  streak,
}: {
  activity: ReadonlyMap<string, number>;
  today: string;
  streak: { current: number; best: number };
}) {
  const cal = buildCalendar(activity, today, WEEKS);
  const firstPhoneColumn = WEEKS - WEEKS_ON_PHONE;

  return (
    <section className="rounded-2xl border bg-card shadow-card" data-testid="activity-heatmap">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-tight">Practice activity</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{cal.total.toLocaleString("en-IN")}</span> questions on{" "}
            <span className="font-medium text-foreground tabular-nums">{cal.activeDays}</span> {cal.activeDays === 1 ? "day" : "days"} in the last year
          </p>
        </div>
        <dl className="flex gap-5 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Current streak</dt>
            <dd className="font-semibold tabular-nums">
              {streak.current} {streak.current === 1 ? "day" : "days"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Longest streak</dt>
            <dd className="font-semibold tabular-nums">
              {streak.best} {streak.best === 1 ? "day" : "days"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <p className="sr-only">
          Calendar of daily practice for the last year: {cal.total} questions on {cal.activeDays} days. Current streak {streak.current} days,
          longest {streak.best} days.
        </p>
        <div className="flex gap-2" aria-hidden>
          {/* Weekday labels (Mon, Wed, Fri) */}
          <div className="mt-5 grid grid-rows-7 gap-[3px] text-[10px] leading-none text-muted-foreground">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
              <span key={i} className="flex h-[11px] items-center sm:h-3">
                {d}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 justify-end gap-[3px] overflow-hidden">
            {cal.columns.map((col, w) => {
              const month = cal.months.find((m) => m.column === w);
              return (
                <div key={col[0].day} className={cn("flex flex-col gap-[3px]", w < firstPhoneColumn && "hidden md:flex")}>
                  <span className="relative h-[14px]">
                    {/* Positioned so a label never widens its column. */}
                    {month && <span className="absolute left-0 text-[10px] leading-none whitespace-nowrap text-muted-foreground">{month.label}</span>}
                  </span>
                  {col.map((c) => (
                    <span
                      key={c.day}
                      title={c.future ? undefined : describe(c)}
                      data-level={c.future ? undefined : c.level}
                      className={cn("size-[11px] rounded-[3px] sm:size-3", c.future ? "bg-transparent" : HEAT[c.level])}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span>Less</span>
          {HEAT.map((h, i) => (
            <span key={h} className={cn("size-[11px] rounded-[3px] sm:size-3", h)} title={i === 0 ? "No questions" : `${LEVELS[i - 1].label} questions`} />
          ))}
          <span>More</span>
          <span className="ml-2 hidden sm:inline">(questions per day: {LEVELS.map((l) => l.label).join(" · ")})</span>
        </div>
      </div>
    </section>
  );
}
