import { test, expect } from "@playwright/test";
test.use({ storageState: { cookies: [], origins: [] } });

test("User can login with email", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-identifier").fill("me1@bunkbuddy.dev");
  await page.getByTestId("login-password").fill("Password123!");
  await page.getByTestId("login-submit").click();

  const empty = page.locator("text=No matches yet");
  const cards = page.locator("[data-testid^='match-card-header-']");
  await expect(empty.or(cards.first())).toBeVisible();
});

test("User can login with username", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-identifier").fill("me2");
  await page.getByTestId("login-password").fill("Password123!");
  await page.getByTestId("login-submit").click();

  const empty = page.locator("text=No matches yet");
  const cards = page.locator("[data-testid^='match-card-header-']");
  await expect(empty.or(cards.first())).toBeVisible();
});

test("User can not login with Invalid credentials", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=Invalid credentials")).not.toBeVisible();

  await page.getByTestId("login-identifier").fill("me1");
  await page.getByTestId("login-password").fill("Password123");
  await page.getByTestId("login-submit").click();

  await expect(page.locator("text=Invalid credentials")).toBeVisible();
  await expect(page.locator("[data-testid^='match-card-header-']")).toHaveCount(
    0,
  );
});
