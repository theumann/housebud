import { expect, type Page } from "@playwright/test";

type GotoAuthedOptions = {
  waitForTestId?: string;
};

export async function gotoAuthed(
  page: Page,
  path: string,
  options: GotoAuthedOptions = {},
) {
  await page.goto(path);
  await expect(page.getByTestId("nav-logo")).toBeVisible();
  if (options.waitForTestId) {
    await expect(page.getByTestId(options.waitForTestId)).toBeVisible();
  }
}

// Waits for the login page to hydrate before typing: a click before that is a
// plain form submit, which reloads /login (seen on WebKit). The page only asks
// for its signup options once it runs.
export async function gotoLoginForm(page: Page) {
  const ready = page.waitForResponse((res) =>
    res.url().endsWith("/auth/signup-options"),
  );
  await page.goto("/login");
  await ready;
}

export async function loginWithForm(
  page: Page,
  identifier: string,
  password = "Password123!",
) {
  await gotoLoginForm(page);
  await page.getByTestId("login-identifier").fill(identifier);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}
