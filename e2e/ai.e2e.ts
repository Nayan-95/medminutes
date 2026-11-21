import { expect, test } from "@playwright/test";

import { withDb } from "./db";

const PROMPT_VERSION = 1; // keep in step with src/lib/ai-explain.ts

test("'Why was I wrong?' shows a saved AI explanation after a wrong answer", async ({ page }) => {
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

  // Pick an option we know is wrong.
  const { questionId, correct } = await withDb(async (db) => {
    const { rows } = await db.query(
      `select q.id, q.correct_option from practice_sessions s join questions q on q.id = s.question_ids[1] where s.id = $1`,
      [sessionId],
    );
    return { questionId: rows[0].id as number, correct: rows[0].correct_option as string };
  });
  const letters = ["A", "B", "C", "D"];
  const wrong = letters.find((l) => l !== correct)!;

  // No AI button before answering, or after a skip/correct answer.
  await expect(page.getByRole("button", { name: "Why was I wrong?" })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Options" }).getByRole("radio").nth(letters.indexOf(wrong)).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-result", "wrong");

  // Plant a saved explanation so the test never calls Gemini. Remove only what we added.
  const planted = await withDb(async (db) => {
    const { rows } = await db.query(
      `insert into ai_explanations (question_id, chosen_option, prompt_version, model, content)
       values ($1, $2, $3, 'e2e', $4)
       on conflict (question_id, chosen_option, prompt_version) do nothing
       returning id`,
      [
        questionId,
        wrong,
        PROMPT_VERSION,
        JSON.stringify({ whyWrong: "E2E: the picked option is wrong.", whyRight: "E2E: the key is right.", remember: "E2E: remember this." }),
      ],
    );
    return (rows[0]?.id as number | undefined) ?? null;
  });

  try {
    // Pressing Enter on the button must open the explanation, not jump to the next question.
    await page.getByRole("button", { name: "Why was I wrong?" }).focus();
    await page.keyboard.press("Enter");
    const card = page.getByTestId("ai-explanation");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("question-counter")).toHaveText(/Question 1\s*of 10/);
    await expect(card).toContainText(`Why ${wrong} is wrong`);
    await expect(card).toContainText(`Why ${correct} is right`);
    await expect(card).toContainText("AI · may contain errors");
    if (planted) await expect(card).toContainText("E2E: remember this.");

    // The request was logged as a cached (free) one.
    const usage = await withDb(async (db) => {
      const { rows } = await db.query(
        "select cached from ai_usage where user_id = 'e2e-test-user' and question_id = $1",
        [questionId],
      );
      return rows as { cached: boolean }[];
    });
    expect(usage).toEqual([{ cached: true }]);
  } finally {
    if (planted) await withDb((db) => db.query("delete from ai_explanations where id = $1", [planted]));
  }
});
