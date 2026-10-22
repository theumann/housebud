import { test, expect } from "./utils/test";
import { gotoLoginForm, loginWithForm } from "./utils/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("User can login with email", async ({ page }) => {
  await loginWithForm(page, "me1@housebud.app");

  const empty = page.locator("text=No matches yet");
  const cards = page.locator("[data-testid^='match-card-header-']");
  await expect(empty.or(cards.first())).toBeVisible();
});

test("User can login with username", async ({ page }) => {
  await loginWithForm(page, "me2");

  const empty = page.locator("text=No matches yet");
  const cards = page.locator("[data-testid^='match-card-header-']");
  await expect(empty.or(cards.first())).toBeVisible();
});

test("User can not login with Invalid credentials", async ({ page }) => {
  await gotoLoginForm(page);
  await expect(page.locator("text=Invalid credentials")).not.toBeVisible();

  await page.getByTestId("login-identifier").fill("me1");
  await page.getByTestId("login-password").fill("Password123");
  await page.getByTestId("login-submit").click();

  await expect(page.locator("text=Invalid credentials")).toBeVisible();
  await expect(page.locator("[data-testid^='match-card-header-']")).toHaveCount(
    0,
  );
});

test("Signup shows the invite code field only when needed", async ({
  page,
}) => {
  // The e2e backend has no SIGNUP_CODE, so signup is open.
  await page.goto("/signup");
  await expect(page.getByTestId("signup-page")).toBeVisible();
  await expect(page.getByTestId("signup-code")).toHaveCount(0);

  // A shared invite link fills the code in.
  await page.goto("/signup?code=Maple-Street");
  await expect(page.getByTestId("signup-code")).toHaveValue("Maple-Street");
});

test("Without DEMO_SANDBOX there is no demo", async ({ page }) => {
  // The e2e backend leaves the demo off, as production does.
  await page.goto("/login");
  await expect(page.getByTestId("login-submit")).toBeVisible();
  await expect(page.getByTestId("try-demo-link")).toHaveCount(0);

  await page.goto("/demo");
  await expect(page.getByTestId("demo-error")).toHaveText(
    "The demo isn't available here.",
  );
});
