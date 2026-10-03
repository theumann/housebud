import type { Page } from "@playwright/test";
import { test, expect } from "./utils/test";
import { apiPost, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function loginWithForm(page: Page, email: string) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill("Password123!");
  await page.getByTestId("login-submit").click();
}

test("a household member lands on their household after login", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "member");
  await apiPost(request, user.token, "/households", { name: "Landing House" });

  await loginWithForm(page, user.email);

  await expect(page).toHaveURL(/\/household$/);
  await expect(page.getByTestId("household-name")).toHaveText("Landing House");
});

test("someone without a household lands on Matches after login", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "loner");

  await loginWithForm(page, user.email);

  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByTestId("matches-page")).toBeVisible();
});

test("the nav logo takes a household member to their household", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "logo");
  await apiPost(request, user.token, "/households", { name: "Logo House" });
  await loginWithForm(page, user.email);
  await expect(page).toHaveURL(/\/household$/);

  await page.getByTestId("nav-matches").click();
  await expect(page).toHaveURL(/\/matches$/);

  await page.getByTestId("nav-logo").click();
  await expect(page).toHaveURL(/\/household$/);
});
