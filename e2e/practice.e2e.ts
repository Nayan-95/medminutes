import { expect, test, type Page } from "@playwright/test";

/** Reads "+12" / "−3" / "0" (true minus sign) as a number. */
function parseScore(text: string): number {
  const n = Number(text.trim().replace("−", "-").replace("+", ""));
  if (Number.isNaN(n)) throw new Error(`Not a score: ${text}`);
  return n;
}

async function headerTotal(page: Page): Promise<number> {
  return parseScore(await page.getByTestId("total-score").locator("[data-slot=score-value]").innerText());
}

/** Waits for the feedback panel and returns the result and points the server recorded. */
async function feedback(page: Page): Promise<{ result: string; points: number }> {
  const panel = page.getByTestId("feedback");
  await expect(panel).toBeVisible();
  return {
    result: (await panel.getAttribute("data-result"))!,
    points: Number(await panel.getAttribute("data-points")),
  };
}

test("a full 10-question session scores +4 / −1 / 0 and updates totals", async ({ page }) => {
  await page.goto("/");
  const totalBefore = await headerTotal(page);

  await page.getByRole("link", { name: "Start practising" }).first().click();
  // Click the cards, as a user would; the radio inputs inside are visually hidden.
  const anatomy = page.getByRole("radio", { name: /^Anatomy, / });
  await page.locator("label", { has: anatomy }).click();
  await expect(anatomy).toBeChecked();
  const ten = page.locator('input[name="count"][value="10"]');
  await page.locator("label", { has: ten }).click();
  await expect(ten).toBeChecked();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/);

  const results: { result: string; points: number }[] = [];
  const options = page.getByRole("radiogroup", { name: "Options" }).getByRole("radio");

  // Q1: mouse — pick option A and submit.
  const counter = page.getByTestId("question-counter");
  await expect(counter).toHaveText(/Question 1\s*of 10/);
  await options.first().click();
  await page.getByRole("button", { name: "Submit" }).click();
  results.push(await feedback(page));
  await page.getByRole("button", { name: "Next question" }).click();

  // Q2: skip.
  await expect(counter).toHaveText(/Question 2\s*of 10/);
  await page.getByRole("button", { name: "Skip (0)" }).click();
  const skipped = await feedback(page);
  expect(skipped).toEqual({ result: "skipped", points: 0 });
  results.push(skipped);
  await page.getByRole("button", { name: "Next question" }).click();

  // Q3–Q10: keyboard — "2" picks B, Enter submits, Enter moves on.
  for (let q = 3; q <= 10; q++) {
    await expect(counter).toHaveText(new RegExp(`Question ${q}\\s*of 10`));
    await page.keyboard.press("2");
    await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    const r = await feedback(page);
    expect(r.points).toBe(r.result === "correct" ? 4 : -1);
    results.push(r);
    if (q < 10) await page.keyboard.press("Enter");
  }

  // Progress bar shows one coloured segment per answered question.
  await expect(page.getByRole("list", { name: "Progress" }).getByRole("listitem")).toHaveCount(10);

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page).toHaveURL(/\/summary$/);

  const expected = results.reduce((n, r) => n + r.points, 0);
  const correct = results.filter((r) => r.result === "correct").length;
  const wrong = results.filter((r) => r.result === "wrong").length;

  const score = page.getByTestId("summary-score").locator("span").first();
  await expect(score).toBeVisible();
  expect(parseScore(await score.innerText())).toBe(expected);
  await expect(page.getByTestId("count-correct")).toHaveText(String(correct));
  await expect(page.getByTestId("count-wrong")).toHaveText(String(wrong));
  await expect(page.getByTestId("count-skipped")).toHaveText("1");

  // Review lists every question; expanding one shows the options.
  const review = page.getByRole("heading", { name: "Review" }).locator("xpath=following-sibling::ol/li");
  await expect(review).toHaveCount(10);
  await review.first().locator("summary").click();
  await expect(review.first().getByText(/^A\.$/)).toBeVisible();

  // Lifetime total in the header moved by exactly this session's score.
  await expect.poll(() => headerTotal(page)).toBe(totalBefore + expected);

  console.log(
    `session: ${correct} correct, ${wrong} wrong, 1 skipped → ${expected >= 0 ? "+" : ""}${expected}; ` +
      `lifetime ${totalBefore} → ${totalBefore + expected}`,
  );
});
