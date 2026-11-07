import type { Page } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed, loginWithForm } from "./utils/auth";
import { API, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

// Waits for the signup page to hydrate, as the login form does.
async function gotoSignup(page: Page) {
  const ready = page.waitForResponse((res) =>
    res.url().endsWith("/auth/signup-options"),
  );
  await page.goto("/signup");
  await ready;
}

async function fillSignup(page: Page, birthDate: string) {
  const suffix = `notice${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.locator("#signup-email").fill(`${suffix}@e2e.test`);
  await page.locator("#signup-password").fill("Password123!");
  await page.locator("#signup-firstName").fill("Nora");
  await page.locator("#signup-lastName").fill("Tester");
  await page.locator("#signup-username").fill(suffix);
  await page.locator("#signup-birthDate").fill(birthDate);
  await page.locator("#signup-collegeYear").selectOption("Freshman");
  await page.locator("#signup-school").fill("USF");
  await page.locator("#signup-targetCity").fill("San Francisco");
  await page.locator("#signup-targetState").fill("CA");
  await page.locator("#signup-targetZip").fill("00501");
}

test("signup needs the tester notice accepted, and can open it", async ({
  page,
}) => {
  await gotoSignup(page);
  await fillSignup(page, "2005-09-15");

  // The browser holds the form back while the box is unticked.
  let signupSent = false;
  page.on("request", (req) => {
    if (req.url() === `${API}/auth/signup`) signupSent = true;
  });
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByTestId("signup-accept-notice")).not.toBeChecked();
  expect(signupSent).toBe(false);

  await page.getByTestId("signup-notice-link").click();
  const dialog = page.getByTestId("signup-notice-dialog");
  await expect(dialog.getByTestId("tester-notice")).toContainText(
    "What the app stores about you",
  );
  await dialog.getByTestId("signup-notice-accept").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("signup-accept-notice")).toBeChecked();

  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/(matches|household)$/);
  await expect(page.getByTestId("nav-logo")).toBeVisible();
  // Accepted at signup: not asked again.
  await expect(page.getByTestId("notice-gate")).toHaveCount(0);
});

test("signup refuses anyone under 18", async ({ page }) => {
  await gotoSignup(page);
  const sixteen = new Date();
  sixteen.setFullYear(sixteen.getFullYear() - 16);
  await fillSignup(page, sixteen.toISOString().slice(0, 10));
  await page.getByTestId("signup-accept-notice").check();
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByTestId("signup-error")).toHaveText(
    "You must be 18 or older to sign up for HouseBud.",
  );
  await expect(page).toHaveURL(/\/signup/);
});

test("an account that hasn't accepted the current notice is asked once, and stays asked until it agrees", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "gate");
  // Accounts from before the notice, or after it changes, read as not
  // accepted; a fresh one has accepted at signup, so its profile says otherwise.
  const notAccepted = async (route: import("@playwright/test").Route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ...(await res.json()), noticeAccepted: false },
    });
  };
  await page.route(`${API}/profile/me`, notAccepted);
  await loginAs(page, user.token);
  await gotoAuthed(page, "/household");

  const gate = page.getByTestId("notice-gate");
  await expect(gate).toBeVisible();
  await expect(gate.getByTestId("tester-notice")).toContainText("Who sees it");
  // It can't be dismissed.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(gate).toBeVisible();

  await page.unroute(`${API}/profile/me`, notAccepted);
  const accepted = page.waitForResponse(
    (res) => res.url() === `${API}/auth/notice` && res.status() === 204,
  );
  await gate.getByTestId("notice-accept").click();
  await accepted;
  await expect(gate).toHaveCount(0);
});

test("logging in through the form asks right away, without a reload", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "gatelogin");
  // The login answer says whether to ask; this account accepted at signup,
  // so the answer stands in for one that hasn't.
  await page.route(`${API}/auth/login`, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({
      response: res,
      json: { ...body, user: { ...body.user, noticeAccepted: false } },
    });
  });
  await loginWithForm(page, user.email);

  await expect(page.getByTestId("notice-gate")).toBeVisible();
  await page.getByTestId("notice-accept").click();
  await expect(page.getByTestId("notice-gate")).toHaveCount(0);
});

test("About is readable logged out, and from the account menu", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByTestId("about-link").click();
  await expect(page.getByTestId("about-page")).toBeVisible();
  await expect(page.getByTestId("tester-notice")).toContainText(
    "You must be 18 or older",
  );

  const user = await signupFreshUser(request, "about");
  await loginAs(page, user.token);
  await gotoAuthed(page, "/household");
  await page.getByTestId("account-menu").click();
  await page.getByTestId("nav-about").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("tester-notice")).toBeVisible();
});
