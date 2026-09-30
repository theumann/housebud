import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

const API = "http://localhost:4002";

// Fresh users per run, so households never accumulate on the shared seed account.
test.use({ storageState: { cookies: [], origins: [] } });

async function signupFreshUser(request: APIRequestContext, label: string) {
  const suffix = `${label}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = await request.post(`${API}/auth/signup`, {
    data: {
      email: `${suffix}@e2e.test`,
      username: suffix,
      password: "Password123!",
      firstName: label,
      lastName: "Tester",
      displayName: suffix.slice(0, 32),
      birthDate: "2005-09-15",
      school: "USF",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94117",
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).token as string;
}

async function loginAs(page: Page, token: string) {
  await page.goto("/login");
  await page.evaluate((t) => localStorage.setItem("bb_token", t), token);
}

test("create a household, then a roommate joins with the code", async ({
  page,
  request,
}) => {
  const ownerToken = await signupFreshUser(request, "owner");
  await loginAs(page, ownerToken);
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });

  await page.getByTestId("create-household-input").fill("E2E House");
  await page.getByTestId("create-household-submit").click();

  await expect(page.getByTestId("household-name")).toHaveText("E2E House");
  const joinCode = (
    await page.getByTestId("household-join-code").textContent()
  )?.trim();
  expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);

  const roommateToken = await signupFreshUser(request, "roommate");
  await loginAs(page, roommateToken);
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });

  await page.getByTestId("join-household-input").fill(joinCode!.toLowerCase());
  await page.getByTestId("join-household-submit").click();

  await expect(page.getByTestId("household-name")).toHaveText("E2E House");
  await expect(page.getByTestId("household-members").locator("li")).toHaveCount(
    2,
  );
});

test("an unknown join code shows an error", async ({ page, request }) => {
  await loginAs(page, await signupFreshUser(request, "stray"));
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });

  await page.getByTestId("join-household-input").fill("ZZZZZZ");
  await page.getByTestId("join-household-submit").click();

  await expect(page.getByTestId("join-household")).toContainText(
    "No household found for that code",
  );
});
