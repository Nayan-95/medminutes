import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";
import { withDb } from "./db";

/** 3 correct + 1 wrong today → +11 this week and all time. */
async function seed() {
  await withDb(async (db) => {
    await db.query("delete from practice_sessions where user_id = $1", [E2E_USER.id]);
    await db.query("delete from review_cards where user_id = $1", [E2E_USER.id]);
    await db.query("update users set leaderboard_hidden = true where id = $1", [E2E_USER.id]);
    const { rows: qs } = await db.query<{ id: number; correct_option: string; subject_id: number }>(
      `select q.id, q.correct_option, q.subject_id from questions q join subjects s on s.id = q.subject_id
        where s.name = 'Physiology' order by q.id limit 4`,
    );
    const { rows: sess } = await db.query<{ id: string }>(
      `insert into practice_sessions (user_id, subject_id, question_count, question_ids, ended_at)
       values ($1, $2, 4, $3, now()) returning id`,
      [E2E_USER.id, qs[0].subject_id, qs.map((q) => q.id)],
    );
    for (const [i, q] of qs.entries()) {
      const correct = i < 3;
      const wrong = { A: "B", B: "C", C: "D", D: "A" }[q.correct_option]!;
      await db.query(
        `insert into attempts (user_id, session_id, question_id, selected_option, result, points, time_taken_ms)
         values ($1, $2, $3, $4, $5, $6, 12000)`,
        [E2E_USER.id, sess[0].id, q.id, correct ? q.correct_option : wrong, correct ? "correct" : "wrong", correct ? 4 : -1],
      );
    }
  });
}

test("leaderboard shows your rank and score, filters by window and subject, and lets you hide", async ({ page }) => {
  test.setTimeout(90_000);
  await seed();

  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "This week" })).toHaveAttribute("aria-current", "page");

  // Hidden users still see themselves, marked "You", with this week's score.
  const me = page.getByTestId("my-row");
  await expect(me).toContainText("You");
  await expect(me).toContainText(E2E_USER.email);
  await expect(me).toContainText("+11");
  await expect(page.getByTestId("tile-rank").locator("[data-slot=value]")).toHaveText(/^#\d+$/);
  await expect(page.getByTestId("tile-streak").locator("[data-slot=value]")).toHaveText("1 day");

  // All time includes today's answers too.
  await page.getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/window=all/);
  await expect(page.getByTestId("my-row")).toContainText("+11");

  // A subject with no answers from us: not ranked there.
  await page.getByLabel("Subject").selectOption({ label: "Anatomy" });
  await expect(page).toHaveURL(/subject=\d+/);
  await expect(page.getByTestId("not-ranked")).toBeVisible();

  // Show, then hide again (the test account must stay hidden from real users).
  await page.getByLabel("Subject").selectOption({ label: "Physiology" });
  await expect(page.getByTestId("my-row")).toContainText("+11");
  const visibility = page.getByTestId("visibility");
  await expect(visibility).toContainText("You're hidden.");
  await visibility.getByRole("button", { name: "Show me on the leaderboard" }).click();
  await expect(visibility).toContainText(`Others see you as E2E U. with your email`);
  await visibility.getByRole("button", { name: "Hide me from the leaderboard" }).click();
  await expect(visibility).toContainText("You're hidden.");
});
