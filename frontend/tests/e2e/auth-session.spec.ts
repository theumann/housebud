import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

// Regression: AuthContext cleared the token on *any* /profile/me failure,
// including a request cancelled because the user navigated away, which logged
// them out of the page they were going to (and made e2e tests flaky).
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

  expect(await page.evaluate(() => localStorage.getItem("bb_token"))).toBe(
    user.token,
  );
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });
});

test("an invalid token still logs the user out", async ({ page }) => {
  await loginAs(page, "not-a-valid-token");
  await page.goto("/household");

  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bb_token")))
    .toBeNull();
});
