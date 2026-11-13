import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";
import { withDb } from "./db";

const OTHER: Record<string, string> = { A: "B", B: "C", C: "D", D: "A" };

/** Gives the test user a known history: 6 Anatomy answers, 4 correct + 2 wrong. */
async function seedHistory() {
  return withDb(async (db) => {
    await db.query("delete from practice_sessions where user_id = $1", [E2E_USER.id]);
    const { rows: qs } = await db.query<{ id: number; correct_option: string; topic_id: number }>(
      `select q.id, q.correct_option, q.topic_id
         from questions q join subjects s on s.id = q.subject_id
        where s.name = 'Anatomy' and q.topic_id is not null
        order by q.id limit 6`,
    );
    const { rows: subj } = await db.query<{ id: number }>("select id from subjects where name = 'Anatomy'");
    const { rows: sess } = await db.query<{ id: string }>(
      `insert into practice_sessions (user_id, subject_id, question_count, question_ids, ended_at)
       values ($1, $2, 6, $3, now()) returning id`,
      [E2E_USER.id, subj[0].id, qs.map((q) => q.id)],
    );
    for (const [i, q] of qs.entries()) {
      const correct = i < 4;
      await db.query(
        `insert into attempts (user_id, session_id, question_id, selected_option, result, points, time_taken_ms)
         values ($1, $2, $3, $4, $5, $6, 15000)`,
        [E2E_USER.id, sess[0].id, q.id, correct ? q.correct_option : OTHER[q.correct_option], correct ? "correct" : "wrong", correct ? 4 : -1],
      );
    }
    return { wrongTopicIds: qs.slice(4).map((q) => q.topic_id) };
  });
}

test("empty progress shows a call to action", async ({ page }) => {
  await withDb((db) => db.query("delete from practice_sessions where user_id = $1", [E2E_USER.id]));
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "No practice yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your first session" })).toBeVisible();
});

test("progress shows totals, subject accuracy, weak topics and trend", async ({ page }) => {
  await seedHistory();
  await page.goto("/progress");

  await expect(page.getByTestId("tile-total").locator("[data-slot=value]")).toHaveText("+14");
  await expect(page.getByTestId("tile-attempted").locator("[data-slot=value]")).toHaveText("6");
  await expect(page.getByTestId("tile-accuracy").locator("[data-slot=value]")).toHaveText("67%");
  await expect(page.getByTestId("tile-streak").locator("[data-slot=value]")).toHaveText("1 day");

  const anatomy = page.getByTestId("subject-Anatomy");
  await expect(anatomy).toContainText("67%");
  await expect(anatomy).toContainText("4/6");

  await expect(page.getByTestId("weak-topics").getByRole("listitem")).not.toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Score per session" })).toBeVisible();
  await expect(page.getByTestId("recent-sessions").getByRole("listitem")).toHaveCount(1);

  // Hover/focus on the trend column shows its details.
  const column = page.getByRole("img", { name: /Anatomy: \+14/ });
  await column.focus();
  await expect(page.getByRole("tooltip")).toContainText("+14");
});

test("'Practise' on a weak topic starts a session on that topic", async ({ page }) => {
  await seedHistory();
  await page.goto("/progress");
  await page.getByTestId("weak-topics").getByRole("button", { name: "Practise" }).first().click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);

  const topicId = await withDb(async (db) => {
    const { rows } = await db.query<{ topic_id: number | null; subject: string }>(
      `select ps.topic_id, s.name as subject from practice_sessions ps join subjects s on s.id = ps.subject_id
        where ps.user_id = $1 order by ps.started_at desc limit 1`,
      [E2E_USER.id],
    );
    return rows[0];
  });
  expect(topicId.topic_id).not.toBeNull();
  expect(topicId.subject).toBe("Anatomy");
  await expect(page.getByTestId("question-counter")).toContainText("Question 1");
});
