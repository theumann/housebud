import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function householdWithRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Shopping House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  return { owner, roommate, householdId: house.id as string };
}

test("add, check off, clear and remove shopping items", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });

  await page.getByTestId("nav-household-shopping").click();
  await expect(page).toHaveURL(
    new RegExp(`/household/${householdId}/shopping$`),
  );
  await expect(page.getByTestId("shopping-empty")).toBeVisible();

  await page.getByTestId("shopping-add-name").fill("Milk");
  await page.getByTestId("shopping-add-quantity").fill("2 L");
  await page.getByTestId("shopping-add-submit").click();

  const open = page.getByTestId("shopping-open-items");
  const done = page.getByTestId("shopping-done-items");
  await expect(open).toContainText("Milk");
  await expect(open).toContainText("2 L");
  await expect(page.getByTestId("shopping-add-name")).toHaveValue("");

  await apiPost(
    request,
    roommate.token,
    `/households/${householdId}/shopping/items`,
    { name: "Bread" },
  );
  await page.reload();
  await expect(open.locator("li")).toHaveCount(2);

  // click, not check(): the row moves to "Done", so check() can't confirm
  // the state on the element it clicked.
  await open.locator("li", { hasText: "Milk" }).getByRole("checkbox").click();
  await expect(done).toContainText("Milk");
  await expect(open.locator("li")).toHaveCount(1);

  await page.getByTestId("shopping-clear-checked").click();
  await expect(done).toHaveCount(0);

  await open
    .locator("li", { hasText: "Bread" })
    .getByRole("button", { name: "Remove Bread" })
    .click();
  await expect(page.getByTestId("shopping-empty")).toBeVisible();
});

test("the owner can turn the shopping list off", async ({ page, request }) => {
  const { owner, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });
  await expect(page.getByTestId("nav-household-shopping")).toBeVisible();

  await page.getByTestId("module-toggle-shopping").uncheck();

  await expect(page.getByTestId("nav-household-shopping")).toHaveCount(0);
  await gotoAuthed(page, `/household/${householdId}/shopping`, {
    waitForTestId: "module-off",
  });
});
