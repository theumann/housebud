import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

function localDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function householdWithRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Chores House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  return { owner, roommate, householdId: house.id as string };
}

test("add a weekly chore and pass the turn by marking it done", async ({
  page,
  request,
}) => {
  const { owner, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });

  await page.getByTestId("nav-household-chores").click();
  await expect(page.getByTestId("chores-empty")).toBeVisible();

  await page.getByTestId("chore-add").click();
  await page.getByTestId("chore-form-name").fill("Trash");
  await page.getByTestId("chore-form-recurrence").selectOption("every");
  await page.getByTestId("chore-form-every").fill("1");
  await page.getByTestId("chore-form-unit").selectOption("week");
  await page.getByTestId("chore-form-submit").click();

  const today = page.getByTestId("chores-today");
  await expect(today).toContainText("Trash");
  await expect(today).toContainText("Every week");
  await expect(today).toContainText("Your turn");

  await today.getByRole("button", { name: "Done" }).click();

  const upcoming = page.getByTestId("chores-upcoming");
  await expect(upcoming).toContainText("Trash");
  await expect(upcoming).toContainText("'s turn");
  await expect(upcoming).toContainText("then");
  await expect(page.getByTestId("chores-today")).toHaveCount(0);
  await expect(page.getByTestId("chores-history")).toContainText("did Trash");
});

test("an overdue chore can be edited and deleted", async ({
  page,
  request,
}) => {
  const { owner, householdId } = await householdWithRoommate(request);
  await apiPost(request, owner.token, `/households/${householdId}/chores`, {
    name: "Bathroom",
    repeat: { every: 1, unit: "week" },
    dueDate: localDay(-2),
    rotation: [owner.id],
  });
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}/chores`, {
    waitForTestId: "chore-board",
  });

  const overdue = page.getByTestId("chores-overdue");
  await expect(overdue).toContainText("Bathroom");
  await expect(overdue).toContainText("Overdue");

  await overdue.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("chore-form-name").fill("Bathroom deep clean");
  await page.getByTestId("chore-form-submit").click();
  await expect(overdue).toContainText("Bathroom deep clean");

  page.once("dialog", (dialog) => dialog.accept());
  await overdue.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("chores-empty")).toBeVisible();
});

test("start a chore, mark it done, then undo it", async ({ page, request }) => {
  const { owner, householdId } = await householdWithRoommate(request);
  await apiPost(request, owner.token, `/households/${householdId}/chores`, {
    name: "Vacuum",
    repeat: { every: 2, unit: "week" },
    dueDate: localDay(0),
    rotation: [owner.id],
  });
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}/chores`, {
    waitForTestId: "chore-board",
  });

  const today = page.getByTestId("chores-today");
  await expect(today).toContainText("Every 2 weeks");

  await today.getByRole("button", { name: "Start" }).click();
  await expect(today).toContainText("You started");
  await today.getByRole("button", { name: "Stop" }).click();
  await expect(today).not.toContainText("started");

  await today.getByRole("button", { name: "Start" }).click();
  await today.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("chores-upcoming")).toContainText("Vacuum");
  await expect(page.getByTestId("chores-upcoming")).not.toContainText(
    "started",
  );

  const history = page.getByTestId("chores-history");
  await expect(history).toContainText("did Vacuum");
  await history.getByRole("button", { name: "Undo" }).click();

  await expect(page.getByTestId("chores-today")).toContainText("Vacuum");
  await expect(page.getByTestId("chores-history")).toHaveCount(0);
});
