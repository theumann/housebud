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

test("the seeded chat shows both members' messages", async ({ page }) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await page.getByTestId("nav-household-chat").click();

  const thread = page.getByTestId("message-container");
  await expect(thread).toContainText("Who's home this weekend?");
  await expect(thread).toContainText("Me, I'll do the bathroom.");
});

test("the seeded expenses show what me5 owes", async ({ page }) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await page.getByTestId("nav-household-expenses").click();

  const list = page.getByTestId("expenses-list");
  await expect(list).toContainText("Groceries");
  await expect(list).toContainText("Internet");
  await expect(list).toContainText("Coffee");
  await expect(page.getByTestId("payments-list")).toContainText("$5.00");
  await expect(page.getByTestId("transfer")).toHaveCount(1);
  await expect(page.getByTestId("transfer")).toContainText("$13.00");
});

test("the seeded house rules show with a proposal waiting for me5", async ({
  page,
}) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await page.getByTestId("nav-household-rules").click();

  const rules = page.getByTestId("rules-list");
  await expect(rules).toContainText("Quiet hours after 11pm");
  await expect(rules).toContainText("Dishes done the same day");
  const proposals = page.getByTestId("rule-proposals");
  await expect(proposals).toContainText("Label your food in the fridge");
  await expect(proposals).toContainText("Waiting for Me5");
  // me4 proposed it, so there's nothing for me4 to answer.
  await expect(page.getByTestId("proposal-agree")).toHaveCount(0);
  await expect(page.getByTestId("rule-history")).toContainText(
    "My partner visits on Tuesdays.",
  );
});

test("the seeded calendar shows events, away and guests", async ({ page }) => {
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
  await expect(page.getByTestId("coming-up")).toBeVisible();
  // Overdue chores are one line ("Take out trash").
  await expect(page.getByTestId("coming-up-overdue")).toHaveText(
    "1 overdue chore",
  );
  await page.getByTestId("nav-household-calendar").click();

  const agenda = page.getByTestId("calendar-agenda");
  await expect(agenda).toContainText("House meeting");
  await expect(agenda).toContainText("Landlord inspection");
  await expect(agenda).toContainText("Me5 away");
  await expect(agenda).toContainText("Your guest: My cousin");
  // Seeded chores show too.
  await expect(
    agenda.getByTestId("calendar-entry-chore").first(),
  ).toBeVisible();
});
