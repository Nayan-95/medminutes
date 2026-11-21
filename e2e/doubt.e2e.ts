import { expect, test } from "@playwright/test";

import { withDb } from "./db";

const DOUBT_PROMPT_VERSION = 1; // keep in step with src/lib/ai-doubt.ts

test("Ask a doubt: a quick doubt shows a saved answer and counts down", async ({ page }) => {
  // Local runs talk to a remote database (~300 ms per round trip from India).
  test.setTimeout(90_000);
  await page.goto("/practice");
  const anatomy = page.getByRole("radio", { name: /^Anatomy, / });
  await page.locator("label", { has: anatomy }).click();
  const ten = page.locator('input[name="count"][value="10"]');
  await page.locator("label", { has: ten }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;
  const questionId = await withDb(async (db) => {
    const { rows } = await db.query("select question_ids[1] as id from practice_sessions where id = $1", [sessionId]);
    return rows[0].id as number;
  });

  // Not available before the answer is revealed.
  await expect(page.getByRole("button", { name: "Ask a doubt" })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip (0)" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  // Plant a saved answer so the test never calls Gemini. Remove only what we added.
  const planted = await withDb(async (db) => {
    const { rows } = await db.query(
      `insert into ai_doubt_cache (question_id, chip, prompt_version, model, answer)
       values ($1, 'simple', $2, 'e2e', 'E2E: a simple explanation.')
       on conflict (question_id, chip, prompt_version) do nothing
       returning id`,
      [questionId, DOUBT_PROMPT_VERSION],
    );
    return (rows[0]?.id as number | undefined) ?? null;
  });

  try {
    await page.getByRole("button", { name: "Ask a doubt" }).click();
    const panel = page.getByTestId("ask-doubt");
    await expect(panel.getByTestId("doubts-left")).toHaveText("3 of 3 left");
    await expect(panel.getByRole("button", { name: "Send doubt" })).toBeDisabled();

    await panel.getByRole("button", { name: "Explain simply" }).click();
    await expect(panel.getByTestId("doubt-answer")).toHaveCount(1);
    if (planted) await expect(panel.getByTestId("doubt-answer")).toHaveText("E2E: a simple explanation.");
    await expect(panel.getByTestId("doubts-left")).toHaveText("2 of 3 left");
    // A used quick doubt disappears; the others stay.
    await expect(panel.getByRole("button", { name: "Explain simply" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Memory trick" })).toBeVisible();

    // Typing in the doubt box must not trigger the page's shortcuts (S = skip, Enter = next).
    await panel.getByRole("textbox", { name: "Your doubt" }).fill("s");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("question-counter")).toHaveText(/Question 1\s*of 10/);

    const usage = await withDb(async (db) => {
      const { rows } = await db.query(
        "select kind, cached from ai_usage where user_id = 'e2e-test-user' and question_id = $1",
        [questionId],
      );
      return rows as { kind: string; cached: boolean }[];
    });
    expect(usage).toEqual([{ kind: "doubt", cached: true }]);
  } finally {
    if (planted) await withDb((db) => db.query("delete from ai_doubt_cache where id = $1", [planted]));
  }
});
