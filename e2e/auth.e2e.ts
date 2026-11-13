import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("home offers Google sign-in and practice requires it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Continue with Google" }).first()).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.goto("/practice");
    await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fpractice$/);
    await expect(page.getByRole("heading", { name: "Sign in to MedMinutes" })).toBeVisible();
  });

  test("an unknown session id is not reachable without sign-in", async ({ page }) => {
    await page.goto("/practice/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/signin/);
  });
});

test("signed in: account menu shows the user and a sign-out action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("total-score")).toBeVisible();
  await page.getByTestId("user-menu").click();
  await expect(page.getByTestId("user-name")).toHaveText(E2E_USER.name);
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Start practising" }).first()).toBeVisible();
});

test("signed in: a missing or deleted session sends you to practice, not a 404", async ({ page }) => {
  await page.goto("/practice/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: "New practice session" })).toBeVisible();

  await page.goto("/practice/00000000-0000-0000-0000-000000000000/summary");
  await expect(page).toHaveURL(/\/practice$/);
});
