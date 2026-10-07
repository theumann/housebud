import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { API, loginAs } from "./utils/users";

// Smoke test of the seeded "Seeded Test household" (me4 owner, me5 member;
// see seedTestHousehold in backend/scripts/seed-dev.ts). It covers states the
// other specs don't build through the API: a chore someone else started,
// other people's turns, history, checked items. Read-only on purpose: the
// seed data is shared by the whole run and by manual testing.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { identifier: "me4", password: "Password123!" },
  });
  expect(res.status()).toBe(200);
  await loginAs(page, (await res.json()).token);
});

test("the seeded household shows its members", async ({ page }) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });

  await expect(page.getByTestId("household-name")).toHaveText(
    "Seeded Test household",
  );
  await expect(page.getByTestId("household-my-role")).toHaveText("Owner");
  await expect(page.getByTestId("household-members").locator("li")).toHaveCount(
    2,
  );
});

test("the seeded chores show in every state", async ({ page }) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await page.getByTestId("nav-household-chores").click();

  const overdue = page.getByTestId("chores-overdue");
  await expect(overdue).toContainText("Take out trash");
  await expect(overdue).toContainText("'s turn");

  const today = page.getByTestId("chores-today");
  await expect(today).toContainText("Clean bathroom");
  await expect(today).toContainText("Your turn");
  await expect(today).toContainText("started");
  // Started by me5, so me4 gets neither Start nor Stop.
  await expect(today.getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(today.getByRole("button", { name: "Stop" })).toHaveCount(0);

  const upcoming = page.getByTestId("chores-upcoming");
  await expect(upcoming).toContainText("Vacuum living room");
  await expect(upcoming).toContainText("Every 2 weeks");
  await expect(upcoming).toContainText("Pay internet bill");
  await expect(upcoming).toContainText("Every month");
  await expect(upcoming).toContainText("Fix the shelf");
  await expect(upcoming).toContainText("Once");
  await expect(upcoming).toContainText("Anyone");

  const history = page.getByTestId("chores-history");
  await expect(history).toContainText("did Take out trash");
  await expect(history).toContainText("did Vacuum living room");
  await expect(history).toContainText("late");
});

test("the seeded shopping list shows open and checked items", async ({
  page,
}) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await page.getByTestId("nav-household-shopping").click();

  const open = page.getByTestId("shopping-open-items");
  await expect(open.locator("li")).toHaveCount(3);
  await expect(open).toContainText("Milk");
  await expect(open).toContainText("2 L");
  await expect(open).toContainText("Eggs");
  await expect(open).toContainText("Dish soap");

  const done = page.getByTestId("shopping-done-items");
  await expect(done.locator("li")).toHaveCount(2);
  await expect(done).toContainText("Coffee");
  await expect(done).toContainText("Toilet paper");
});
