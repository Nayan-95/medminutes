import { expect, test, type Page } from "@playwright/test";

/** Reads "+12" / "−3" / "0" (true minus sign) as a number. */
function parseScore(text: string): number {
  const t = text.trim().replace("−", "-").replace("+", "");
  const n = Number(t);
  if (Number.isNaN(n)) throw new Error(`Not a score: ${text}`);
  return n;
}

async function headerTotal(page: Page): Promise<number> {
  const strong = page.locator("header").getByTitle(/Lifetime score/).locator("strong");
  return parseScore(await strong.innerText());
}

/** Waits for the feedback panel and returns the points it shows. */
async function feedbackPoints(page: Page): Promise<{ result: string; points: number }> {
  const panel = page.locator("[aria-live=polite] p").first();
  await expect(panel).toHaveText(/^(Correct|Wrong|Skipped) · /);
  const [result, points] = (await panel.innerText()).split(" · ");
  return { result, points: parseScore(points) };
}

test("a full 10-question session scores +4 / −1 / 0 and updates totals", async ({ page }) => {
  await page.goto("/");
  const totalBefore = await headerTotal(page);

  await page.getByRole("link", { name: "Start practising" }).click();
  const subject = page.getByLabel("Subject");
  const anatomy = await subject.locator("option", { hasText: /^Anatomy \(/ }).getAttribute("value");
  await subject.selectOption(anatomy!);
  await page.getByText("10", { exact: true }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);

  const results: { result: string; points: number }[] = [];

  // Q1: mouse — pick option A and submit.
  await expect(page.getByText("Question 1 of 10")).toBeVisible();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Submit" }).click();
  results.push(await feedbackPoints(page));
  await page.getByRole("button", { name: "Next question" }).click();

  // Q2: skip.
  await expect(page.getByText("Question 2 of 10")).toBeVisible();
  await page.getByRole("button", { name: "Skip (0)" }).click();
  const skipped = await feedbackPoints(page);
  expect(skipped).toEqual({ result: "Skipped", points: 0 });
  results.push(skipped);
  await page.getByRole("button", { name: "Next question" }).click();

  // Q3–Q10: keyboard — "2" picks B, Enter submits, Enter moves on.
  for (let q = 3; q <= 10; q++) {
    await expect(page.getByText(`Question ${q} of 10`)).toBeVisible();
    await page.keyboard.press("2");
    await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    const r = await feedbackPoints(page);
    expect(r.result === "Correct" ? r.points === 4 : r.points === -1).toBe(true);
    results.push(r);
    if (q < 10) await page.keyboard.press("Enter");
  }

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByRole("heading", { name: "Session complete" })).toBeVisible();

  const expected = results.reduce((n, r) => n + r.points, 0);
  const correct = results.filter((r) => r.result === "Correct").length;
  const wrong = results.filter((r) => r.result === "Wrong").length;

  const sessionScore = page.getByText("Session score").locator("xpath=following-sibling::p[1]");
  expect(parseScore(await sessionScore.innerText())).toBe(expected);
  await expect(page.locator("dt:text-is('Correct') + dd")).toHaveText(String(correct));
  await expect(page.locator("dt:text-is('Wrong') + dd")).toHaveText(String(wrong));
  await expect(page.locator("dt:text-is('Skipped') + dd")).toHaveText("1");

  // Lifetime total in the header moved by exactly this session's score.
  expect(await headerTotal(page)).toBe(totalBefore + expected);

  console.log(
    `session: ${correct} correct, ${wrong} wrong, 1 skipped → ${expected >= 0 ? "+" : ""}${expected}; ` +
      `lifetime ${totalBefore} → ${totalBefore + expected}`,
  );
});
