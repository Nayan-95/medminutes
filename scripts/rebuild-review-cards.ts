/**
 * Rebuild every user's FSRS review cards by replaying their attempts in order.
 * `attempts` is the source of truth (docs/adr/0002, 0004); `review_cards` is derived.
 *
 * Use after: introducing spaced repetition (backfill), changing scheduler
 * parameters, or upgrading ts-fsrs.
 *
 *   npm run srs:rebuild -- --dry-run   # report only
 *   npm run srs:rebuild                # replace all cards in one transaction
 */
import { config } from "dotenv";
import { Client } from "pg";

import { withVerifiedSsl } from "../src/db/ssl";
import type { AttemptResult } from "../src/lib/scoring";
import { replay, toRow } from "../src/lib/srs";

config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (run `neon env pull`).");
  const db = new Client({ connectionString: withVerifiedSsl(url) });
  await db.connect();
  try {
    const { rows } = await db.query<{ user_id: string; question_id: number; result: AttemptResult; created_at: Date }>(
      `select user_id, question_id, result, created_at
         from attempts
        order by user_id, question_id, created_at, id`,
    );

    // Group answers per (user, question), preserving order.
    const groups = new Map<string, { userId: string; questionId: number; history: { result: AttemptResult; at: Date }[] }>();
    for (const r of rows) {
      const key = `${r.user_id}:${r.question_id}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { userId: r.user_id, questionId: r.question_id, history: [] }));
      g.history.push({ result: r.result, at: r.created_at });
    }

    const now = new Date();
    const cards = [...groups.values()].map((g) => ({ ...g, row: toRow(replay(g.history)!) }));
    const users = new Set(cards.map((c) => c.userId)).size;
    const dueNow = cards.filter((c) => c.row.due <= now).length;
    console.log(`attempts: ${rows.length} · cards: ${cards.length} · users: ${users} · due now: ${dueNow}`);

    if (dryRun) {
      console.log("Dry run: nothing written.");
    } else {
      await db.query("begin");
      await db.query("delete from review_cards");
      const cols = 13;
      for (let i = 0; i < cards.length; i += 500) {
        const chunk = cards.slice(i, i + 500);
        const values: unknown[] = [];
        const tuples = chunk.map((c, j) => {
          const r = c.row;
          values.push(c.userId, c.questionId, r.due, r.stability, r.difficulty, r.elapsedDays, r.scheduledDays,
            r.learningSteps, r.reps, r.lapses, r.state, r.lastReview, now);
          return `(${Array.from({ length: cols }, (_, k) => `$${j * cols + k + 1}`).join(",")})`;
        });
        await db.query(
          `insert into review_cards (user_id, question_id, due, stability, difficulty, elapsed_days, scheduled_days,
             learning_steps, reps, lapses, state, last_review, updated_at) values ${tuples.join(",")}`,
          values,
        );
      }
      await db.query("commit");
      console.log(`Rebuilt ${cards.length} cards.`);
    }
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
