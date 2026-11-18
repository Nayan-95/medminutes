import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";
import { withDb } from "./db";

test("a student can report a question after answering it", async ({ page }) => {
  // Local runs talk to a remote database (~300 ms per round trip from India).
  test.setTimeout(90_000);
  await page.goto("/practice");
  const anatomy = page.getByRole("radio", { name: /^Anatomy, / });
  await page.locator("label", { has: anatomy }).click();
  const ten = page.locator('input[name="count"][value="10"]');
  await page.locator("label", { has: ten }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);

  // No report button before the answer is revealed.
  await expect(page.getByRole("button", { name: "Report a problem" })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip (0)" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  await page.getByRole("button", { name: "Report a problem" }).click();
  const form = page.getByTestId("report-form");
  const send = form.getByRole("button", { name: "Send report" });
  await expect(send).toBeDisabled(); // no reason yet

  // "Something else" needs a note.
  await form.getByText("Something else").click();
  await expect(send).toBeDisabled();

  // Typing in the form must not trigger the page's shortcuts (Enter = next question, S = skip).
  await form.getByText("Typo or garbled text").click();
  const note = form.getByRole("textbox", { name: /Details/ });
  await note.fill("Option C reads 'hypeension'");
  await note.press("Enter");
  await expect(page.getByTestId("question-counter")).toHaveText(/Question 1\s*of 10/);

  await send.click();
  await expect(page.getByTestId("report-sent")).toBeVisible();

  const rows = await withDb(async (db) => {
    const { rows } = await db.query(
      "select reason, note, status from question_reports where user_id = $1",
      [E2E_USER.id],
    );
    return rows as { reason: string; note: string; status: string }[];
  });
  // The trailing newline from Enter is trimmed on the server.
  expect(rows).toEqual([{ reason: "typo", note: "Option C reads 'hypeension'", status: "open" }]);
});

test("the admin reports page does not exist for non-admins", async ({ page }) => {
  await page.goto("/admin/reports");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Question reports" })).toHaveCount(0);
});
