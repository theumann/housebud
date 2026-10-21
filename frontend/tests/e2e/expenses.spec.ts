import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { clickNav } from "./utils/nav";
import { API, apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function householdWithRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Expenses House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  const res = await request.patch(`${API}/households/${house.id}/settings`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { expensesEnabled: true },
  });
  expect(res.ok()).toBe(true);
  return { owner, roommate, householdId: house.id as string };
}

test("add an expense, see who owes what, and settle up", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });

  await clickNav(page, "nav-household-expenses");
  await expect(page.getByTestId("expenses-empty")).toBeVisible();

  await page.getByTestId("expense-new").click();
  await page.getByTestId("expense-description").fill("Groceries");
  await page.getByTestId("expense-amount").fill("30");
  await page.getByTestId("expense-submit").click();

  await expect(page.getByTestId("expenses-list")).toContainText("Groceries");
  await expect(
    page.getByTestId(`balance-${roommate.id}`).getByTestId("balance-amount"),
  ).toHaveText("owes $15.00");
  await expect(
    page.getByTestId(`balance-${owner.id}`).getByTestId("balance-amount"),
  ).toHaveText("are owed $15.00");

  await page.getByTestId("transfer-mark-paid").click();

  await expect(page.getByTestId("transfers")).toHaveCount(0);
  await expect(
    page.getByTestId(`balance-${roommate.id}`).getByTestId("balance-amount"),
  ).toHaveText("Settled up");
  await expect(page.getByTestId("payments-list")).toContainText("$15.00");
});

test("checked shopping items become one expense", async ({ page, request }) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}/shopping`, {
    waitForTestId: "shopping-list",
  });

  for (const name of ["Milk", "Bread"]) {
    await page.getByTestId("shopping-add-name").fill(name);
    await page.getByTestId("shopping-add-submit").click();
    await expect(page.getByTestId("shopping-open-items")).toContainText(name);
  }
  // click, not check(): the row moves to "Done", so check() can't confirm
  // the new state on the same element.
  const done = page.getByTestId("shopping-done-items");
  for (const name of ["Milk", "Bread"]) {
    await page
      .getByTestId("shopping-open-items")
      .locator("li", { hasText: name })
      .getByRole("checkbox")
      .click();
    await expect(done).toContainText(name);
  }

  await page.getByTestId("shopping-bought").click();
  await expect(page.getByTestId("expense-description")).toHaveValue(
    /Milk.*Bread|Bread.*Milk/,
  );
  await page.getByTestId("expense-amount").fill("7");
  await page.getByTestId("expense-submit").click();

  await expect(page.getByTestId("shopping-bought")).toHaveCount(0);
  await expect(done).toContainText("on an expense");

  await clickNav(page, "nav-household-expenses");
  await expect(
    page.getByTestId(`balance-${roommate.id}`).getByTestId("balance-amount"),
  ).toHaveText("owes $3.50");
});
