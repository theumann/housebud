import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { clickNav } from "./utils/nav";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

// A calendar day `offset` days from today, in local time like the app's.
function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test("add a weekly event, skip one, and say you're away", async ({
  page,
  request,
}) => {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Calendar House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });

  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${house.id}`, {
    waitForTestId: "household-view",
  });
  await clickNav(page, "nav-household-calendar");
  await expect(page.getByTestId("calendar-empty")).toBeVisible();

  // A house meeting today at 7pm, every week: four of them in the agenda.
  await page.getByTestId("calendar-add").click();
  await page.getByTestId("calendar-form-title").fill("House meeting");
  await page.getByTestId("calendar-form-timed").check();
  await page.getByTestId("calendar-form-start-time").fill("19:00");
  await page.getByTestId("calendar-form-recurrence").selectOption("every");
  await page.getByTestId("calendar-form-submit").click();

  const agenda = page.getByTestId("calendar-agenda");
  await expect(agenda.getByText("House meeting")).toHaveCount(4);
  await expect(page.getByTestId(`calendar-day-${day(0)}`)).toContainText(
    "Every week",
  );

  // No meeting next week.
  await page
    .getByTestId(`calendar-day-${day(7)}`)
    .getByTestId("calendar-entry-skip")
    .click();
  await expect(page.getByTestId(`calendar-day-${day(7)}`)).toHaveCount(0);
  await expect(agenda.getByText("House meeting")).toHaveCount(3);

  // Away from tomorrow for three days.
  await page.getByTestId("calendar-add").click();
  await page.getByTestId("calendar-form-kind-away").click();
  await page.getByTestId("calendar-form-starts").fill(day(1));
  await page.getByTestId("calendar-form-ends").fill(day(3));
  await page.getByTestId("calendar-form-notes").fill("Back Sunday night");
  await page.getByTestId("calendar-form-submit").click();
  await expect(
    page
      .getByTestId(`calendar-day-${day(2)}`)
      .getByTestId("calendar-entry-away"),
  ).toContainText("You're away");
  // Its buttons and note are only on its first day.
  await expect(
    page
      .getByTestId(`calendar-day-${day(1)}`)
      .getByTestId("calendar-entry-away"),
  ).toContainText("Back Sunday night");
  await expect(
    page
      .getByTestId(`calendar-day-${day(2)}`)
      .getByTestId("calendar-entry-away")
      .getByTestId("calendar-entry-edit"),
  ).toHaveCount(0);

  // The month view marks the days and lists the one picked.
  await page.getByTestId("calendar-view-month").click();
  await page.getByTestId(`calendar-cell-${day(1)}`).click();
  await expect(page.getByTestId("calendar-selected-day")).toContainText(
    "You're away",
  );

  // The roommate sees both on Overview, but can't change them.
  await loginAs(page, roommate.token);
  await gotoAuthed(page, `/household/${house.id}`, {
    waitForTestId: "household-view",
  });
  const comingUp = page.getByTestId("coming-up");
  await expect(comingUp).toContainText("House meeting");
  await expect(comingUp).toContainText("away");
  await clickNav(page, "nav-household-calendar");
  await expect(page.getByTestId("calendar-agenda")).toBeVisible();
  await expect(page.getByTestId("calendar-entry-edit")).toHaveCount(0);
});
