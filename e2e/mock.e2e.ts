import { expect, test, type Page } from "@playwright/test";

import { withDb } from "./db";

function parseScore(text: string): number {
  const n = Number(text.trim().replace("−", "-").replace("+", ""));
  if (Number.isNaN(n)) throw new Error(`Not a score: ${text}`);
  return n;
}

const palette = (page: Page) => page.getByTestId("palette");
const cell = (page: Page, n: number) => palette(page).getByRole("button", { name: new RegExp(`^Question ${n},`) });

/** Rows saved for this mock so far, keyed by question position (1-based). */
async function savedResponses(sessionId: string) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `select array_position(s.question_ids, r.question_id) as n, r.selected_option, r.first_option, r.marked_for_review
         from mock_responses r join practice_sessions s on s.id = r.session_id
        where r.session_id = $1 order by 1`,
      [sessionId],
    );
    return rows as { n: number; selected_option: string | null; first_option: string | null; marked_for_review: boolean }[];
  });
}

test("a mini mock: sections, palette, mark for review, section lock, submit and result", async ({ page }) => {
  test.setTimeout(180_000);
  // The desktop layout shows the palette beside the question.
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/mock");
  const mini = page.getByRole("radio", { name: /^Mini mock/ });
  await page.locator("label", { has: mini }).click();
  await expect(mini).toBeChecked();
  await page.getByRole("button", { name: "Start mock" }).click();
  await expect(page).toHaveURL(/\/mock\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;

  // The draw: 45 questions, mixed subjects, stored as a mini mock.
  const drawn = await withDb(async (db) => {
    const { rows } = await db.query(
      `select s.kind, s.question_count, m.format, m.section_size,
              (select count(distinct q.subject_id) from questions q where q.id = any(s.question_ids))::int as subjects
         from practice_sessions s join mock_exams m on m.session_id = s.id where s.id = $1`,
      [sessionId],
    );
    return rows[0];
  });
  expect(drawn).toMatchObject({ kind: "mock", question_count: 45, format: "mini", section_size: 9 });
  expect(drawn.subjects).toBeGreaterThanOrEqual(10);

  const counter = page.getByTestId("question-counter");
  const options = page.getByRole("radiogroup", { name: "Options" }).getByRole("radio");
  await expect(counter).toHaveText(/Question 1\s*of 45/);
  await expect(page.getByTestId("section-timer")).toHaveText(/1[0-9]:[0-5][0-9]/);
  await expect(palette(page).getByRole("button")).toHaveCount(9);

  // Q1: pick A, then change to B.
  await options.nth(0).click();
  await options.nth(1).click();
  await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Q2: keyboard "3" picks C, "M" marks for review.
  await expect(counter).toHaveText(/Question 2\s*of 45/);
  await page.keyboard.press("3");
  await page.keyboard.press("m");
  await expect(page.getByTestId("marked-chip")).toBeVisible();
  await page.keyboard.press("ArrowRight");

  // Q3: marked without an answer.
  await expect(counter).toHaveText(/Question 3\s*of 45/);
  await page.getByRole("button", { name: "Mark for review" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Q4: answer, then clear.
  await options.nth(3).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(options.nth(3)).toHaveAttribute("aria-checked", "false");

  // Jump to Q9 from the palette: the last question of section 1 can't move on early.
  await cell(page, 9).click();
  await expect(counter).toHaveText(/Question 9\s*of 45/);
  await expect(page.getByTestId("section-end-hint")).toContainText("Section 2 opens in");

  await expect(cell(page, 1)).toHaveAttribute("data-status", "answered");
  await expect(cell(page, 2)).toHaveAttribute("data-status", "answered-marked");
  await expect(cell(page, 3)).toHaveAttribute("data-status", "marked");
  await expect(cell(page, 4)).toHaveAttribute("data-status", "not-answered");
  await expect(cell(page, 5)).toHaveAttribute("data-status", "not-visited");

  // Everything reached the server, including the first pick on Q1.
  await expect
    .poll(async () => (await savedResponses(sessionId)).map((r) => [r.n, r.selected_option, r.first_option, r.marked_for_review]))
    .toEqual([
      [1, "B", "A", false],
      [2, "C", "C", true],
      [3, null, null, true],
      [4, null, "D", false],
      [9, null, null, false],
    ]);

  // Section 1's time runs out (simulated by moving the start back 10.5 minutes).
  await withDb((db) => db.query(`update practice_sessions set started_at = started_at - interval '630 seconds' where id = $1`, [sessionId]));
  await page.reload();
  await expect(counter).toHaveText(/Question 10\s*of 45/);
  await expect(page.getByRole("list", { name: "Sections" }).getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(cell(page, 1)).toHaveCount(0); // section 1 is closed
  await expect(cell(page, 10)).toBeVisible();

  // Q10: answer A, then submit early.
  await options.nth(0).click();
  await expect.poll(async () => (await savedResponses(sessionId)).find((r) => r.n === 10)?.selected_option).toBe("A");

  await page.getByRole("button", { name: "Submit", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Submit the mock?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("submit-summary")).toContainText("Answered3");
  await dialog.getByRole("button", { name: "Submit mock" }).click();
  await expect(page).toHaveURL(/\/mock\/[0-9a-f-]{36}\/result$/);

  // Opened questions became attempts (unanswered = skipped); unopened ones did not.
  const stored = await withDb(async (db) => {
    const { rows } = await db.query(
      `select count(*)::int as n,
              coalesce(sum(points), 0)::int as score,
              count(*) filter (where result = 'skipped')::int as skipped,
              (select count(*)::int from review_cards rc where rc.user_id = 'e2e-test-user' and rc.question_id in (select question_id from attempts where session_id = $1)) as cards,
              (select ended_at is not null from practice_sessions where id = $1) as ended
         from attempts where session_id = $1`,
      [sessionId],
    );
    return rows[0] as { n: number; score: number; skipped: number; cards: number; ended: boolean };
  });
  expect(stored).toMatchObject({ n: 6, skipped: 3, cards: 6, ended: true });

  const score = page.getByTestId("mock-score").locator("span").first();
  expect(parseScore(await score.innerText())).toBe(stored.score);
  await expect(page.getByTestId("mock-count-not-visited").locator("dd")).toHaveText("39");
  await expect(page.getByTestId("mock-count-skipped").locator("dd")).toHaveText("3");
  await expect(page.getByTestId("insight-changes")).toContainText(/Right → wrong|Wrong → right/);
  await expect(page.getByTestId("section-table").locator("tbody tr")).toHaveCount(5);

  // Review filters: two questions were marked.
  await page.getByRole("link", { name: /^Marked 2$/ }).click();
  await expect(page).toHaveURL(/show=marked/);
  await expect(page.getByTestId("review-list").locator("li details")).toHaveCount(2);

  // The mock is listed on /mock, and old practice URLs for it redirect here.
  await page.goto("/mock");
  await expect(page.getByTestId("past-mocks")).toContainText("Mini mock");
  await page.goto(`/practice/${sessionId}/summary`);
  await expect(page).toHaveURL(new RegExp(`/mock/${sessionId}/result$`));
});
