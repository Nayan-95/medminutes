/** NEET PG users are in India; day boundaries for streaks follow IST. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** YYYY-MM-DD for an instant, in the app time zone. */
export function dayKey(date: Date, timeZone = APP_TIME_ZONE): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive practice days.
 * - `current`: run ending today, or ending yesterday (still alive until today ends).
 * - `best`: longest run ever.
 * `days` are YYYY-MM-DD keys in any order; duplicates are ignored.
 */
export function computeStreak(days: readonly string[], today: string): { current: number; best: number; practisedToday: boolean } {
  const set = new Set(days);
  const sorted = [...set].sort();

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  const practisedToday = set.has(today);
  let cursor = practisedToday ? today : shiftDay(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }
  return { current, best, practisedToday };
}
