import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 360, height: 740 },
});

test("on a phone, pages that don't fit go under More, badges included", async ({
  page,
  request,
}) => {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Narrow House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  await apiPost(
    request,
    owner.token,
    `/households/${house.id}/rules/proposals`,
    {
      kind: "add",
      title: "Quiet hours after 11pm",
    },
  );

  await loginAs(page, roommate.token);
  await gotoAuthed(page, `/household/${house.id}`, {
    waitForTestId: "household-view",
  });

  // Overview, Chat and Chores stay in the row; Shopping, House rules and the
  // upcoming Calendar move under More.
  await expect(page.getByTestId("nav-household-chores")).toBeVisible();
  await expect(page.getByTestId("nav-household-rules")).toBeHidden();
  await expect(page.getByTestId("nav-more-badge")).toHaveText("1");

  await page.getByTestId("nav-more").click();
  await expect(page.getByTestId("nav-household-shopping-more")).toBeVisible();
  await expect(page.getByTestId("nav-household-rules-more-badge")).toHaveText(
    "1",
  );
  await page.getByTestId("nav-household-rules-more").click();

  await expect(page.getByTestId("rule-proposals")).toBeVisible();
  await expect(page.getByTestId("nav-more-items")).toHaveCount(0);

  // Agreeing clears the badge on More.
  await page.getByTestId("proposal-agree").click();
  await expect(page.getByTestId("rules-list")).toContainText(
    "Quiet hours after 11pm",
  );
  await expect(page.getByTestId("nav-more-badge")).toHaveCount(0);
});

test("on a phone, the Find Roommates row fits without More", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "solo");
  await loginAs(page, user.token);
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  await expect(page.getByTestId("nav-chat")).toBeVisible();
  await expect(page.getByTestId("nav-more")).toHaveCount(0);
});
