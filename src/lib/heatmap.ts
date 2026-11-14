/**
 * GitHub-style practice calendar: one column per week (Monday first), one cell
 * per day, shaded by how many questions were answered that day (IST days).
 */

/** Questions answered → shade 0–4. Fixed thresholds so a level means the same thing every month. */
export const LEVELS = [
  { min: 1, label: "1–9" },
  { min: 10, label: "10–24" },
  { min: 25, label: "25–49" },
  { min: 50, label: "50+" },
] as const;

export function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  let level = 0;
  LEVELS.forEach((l, i) => {
    if (count >= l.min) level = i + 1;
  });
  return level as 0 | 1 | 2 | 3 | 4;
}

export interface Cell {
  /** YYYY-MM-DD */
  day: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** After today: drawn as an empty slot. */
  future: boolean;
}

function shift(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `weeks` columns ending with the week that contains `today`.
 * Month labels sit on the first column whose Monday falls in a new month.
 */
export function buildCalendar(counts: ReadonlyMap<string, number>, today: string, weeks = 53) {
  const t = new Date(`${today}T00:00:00Z`);
  const mondayThisWeek = shift(today, -((t.getUTCDay() + 6) % 7));
  const first = shift(mondayThisWeek, -7 * (weeks - 1));

  const columns: Cell[][] = [];
  const months: { column: number; label: string }[] = [];
  let lastMonth = -1;
  let total = 0;
  let activeDays = 0;

  for (let w = 0; w < weeks; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = shift(first, w * 7 + d);
      const future = day > today;
      const count = future ? 0 : (counts.get(day) ?? 0);
      if (count > 0) {
        total += count;
        activeDays += 1;
      }
      col.push({ day, count, level: levelFor(count), future });
    }
    const month = Number(col[0].day.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      months.push({ column: w, label: MONTHS[month] });
      lastMonth = month;
    }
    columns.push(col);
  }
  return { columns, months, total, activeDays };
}
