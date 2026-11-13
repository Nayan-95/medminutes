import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";
import { withDb } from "./db";

test("spaced repetition: answered questions come back when due", async ({ page }) => {
  // Long flows; local runs talk to a remote database (~300 ms per round trip from India).
  test.setTimeout(120_000);
  await withDb(async (db) => {
    await db.query("delete from practice_sessions where user_id = $1", [E2E_USER.id]);
    await db.query("delete from review_cards where user_id = $1", [E2E_USER.id]);
  });

  // 1. Practise: skip Q1 (→ Again), answer Q2. Each shows when it comes back.
  await page.goto("/practice");
  await expect(page.getByTestId("review-banner")).toHaveCount(0); // no cards yet
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Skip (0)" }).click();
  await expect(page.getByTestId("next-review")).toHaveText(/see this again tomorrow/);
  await page.getByRole("button", { name: "Next question" }).click();

  await page.getByRole("radiogroup", { name: "Options" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("next-review")).toHaveText(/see this again (tomorrow|in \d+ days)/);

  const cards = await withDb(async (db) => {
    const { rows } = await db.query<{ question_id: number; reps: number }>(
      "select question_id, reps from review_cards where user_id = $1",
      [E2E_USER.id],
    );
    return rows;
  });
  expect(cards).toHaveLength(2);
  expect(cards.every((c) => c.reps === 1)).toBe(true);

  // 2. Time passes: make both cards due.
  await withDb((db) =>
    db.query("update review_cards set due = now() - interval '1 minute' where user_id = $1", [E2E_USER.id]),
  );

  // 3. The practice page offers a review of exactly those two.
  await page.goto("/practice");
  const banner = page.getByTestId("review-banner");
  await expect(banner).toHaveAttribute("data-due", "2");
  await expect(banner).toContainText("2 questions due for review");
  await banner.getByRole("button", { name: "Start review" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("review-chip")).toBeVisible();
  await expect(page.getByTestId("question-counter")).toHaveText(/Question 1\s*of 2/);

  // 4. Review both, then finish.
  for (let q = 1; q <= 2; q++) {
    await page.getByRole("radiogroup", { name: "Options" }).getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByTestId("next-review")).toBeVisible();
    if (q < 2) await page.getByRole("button", { name: "Next question" }).click();
  }
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByText("Review", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Next review (tomorrow|in \d+)/).first()).toBeVisible();

  // Each card was reviewed a second time and pushed into the future.
  const after = await withDb(async (db) => {
    const { rows } = await db.query<{ reps: number; future: boolean }>(
      "select reps, due > now() as future from review_cards where user_id = $1",
      [E2E_USER.id],
    );
    return rows;
  });
  expect(after.every((c) => c.reps === 2 && c.future)).toBe(true);

  // 5. Nothing left to review.
  await page.goto("/practice");
  await expect(page.getByTestId("review-banner")).toHaveAttribute("data-due", "0");
  await expect(page.getByTestId("review-banner")).toContainText("Nothing due for review");
});
