import { test, expect } from "./utils/test";
import { loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

// Regression: AuthContext cleared the token on *any* /profile/me failure,
// including a request cancelled because the user navigated away, which logged
// them out of the page they were going to (and made e2e tests flaky). Then,
// with the token kept, the page still sent them to /login because the profile
// never loaded (found on Firefox); now AuthContext retries it.
test("a cancelled profile request doesn't log the user out", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "session");
  await loginAs(page, user.token);

  let cancelled = false;
  await page.route("**/profile/me", async (route) => {
    if (!cancelled) {
      cancelled = true;
      await route.abort("aborted");
    } else {
      await route.continue();
    }
  });

  const failed = page.waitForEvent("requestfailed", (req) =>
    req.url().endsWith("/profile/me"),
  );
  await page.goto("/matches");
  await failed;

  // The nav and account menu only show once the profile has loaded.
  await expect(page.getByTestId("account-menu")).toBeVisible();
  await expect(page.getByTestId("matches-page")).toBeVisible();
  await expect(page).toHaveURL(/\/matches$/);
  expect(await page.evaluate(() => localStorage.getItem("bb_token"))).toBe(
    user.token,
  );
});

test("an invalid token still logs the user out", async ({ page }) => {
  await loginAs(page, "not-a-valid-token");
  await page.goto("/household");

  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bb_token")))
    .toBeNull();
});
