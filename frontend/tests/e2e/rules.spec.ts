import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { API, apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function householdWithRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Rules House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  return { owner, roommate, householdId: house.id as string };
}

async function openProposalId(
  request: APIRequestContext,
  token: string,
  householdId: string,
) {
  const res = await request.get(`${API}/households/${householdId}/rules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()).proposals[0].id as string;
}

test("propose a starter rule; it's adopted once the roommate agrees", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });

  await page.getByTestId("nav-household-rules").click();
  await expect(page.getByTestId("rules-empty")).toBeVisible();
  await page.getByTestId("rule-starter").first().click();
  await expect(page.getByTestId("rule-title")).toHaveValue(
    "Quiet hours after 11pm",
  );
  await page.getByTestId("rule-title").fill("Quiet hours after midnight");
  await page.getByTestId("rule-submit").click();

  const proposals = page.getByTestId("rule-proposals");
  await expect(proposals).toContainText("Quiet hours after midnight");
  await expect(proposals).toContainText("Waiting for");
  await expect(page.getByTestId("rules-empty")).toBeVisible();

  const id = await openProposalId(request, roommate.token, householdId);
  await apiPost(
    request,
    roommate.token,
    `/households/${householdId}/rules/proposals/${id}/vote`,
    { agree: true },
  );
  await page.reload();

  await expect(page.getByTestId("rules-list")).toContainText(
    "Quiet hours after midnight",
  );
  await expect(page.getByTestId("rule-proposals")).toHaveCount(0);
  await expect(page.getByTestId("rule-history")).toContainText("Added");

  // With a rule in place, the starters move into the form.
  await expect(page.getByTestId("rule-starters")).toHaveCount(0);
  await page.getByTestId("rule-propose").click();
  await page.getByTestId("rule-form-starters").locator("summary").click();
  await page
    .getByTestId("rule-form-starter")
    .filter({ hasText: "Dishes done the same day" })
    .click();
  await expect(page.getByTestId("rule-title")).toHaveValue(
    "Dishes done the same day",
  );
  await expect(page.getByTestId("rule-details")).toHaveValue(
    "Nothing left in the sink overnight.",
  );
  await expect(page.getByTestId("rule-form-starter").first()).toBeHidden();
});

test("a waiting proposal shows a badge, and saying no turns it down", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await apiPost(
    request,
    owner.token,
    `/households/${householdId}/rules/proposals`,
    {
      kind: "add",
      title: "No guests on weeknights",
    },
  );

  await loginAs(page, roommate.token);
  await gotoAuthed(page, "/matches");
  await expect(page.getByTestId("nav-household-badge")).toHaveText("1");

  await gotoAuthed(page, `/household/${householdId}/rules`, {
    waitForTestId: "rule-proposals",
  });
  await expect(page.getByTestId("nav-household-rules-badge")).toHaveText("1");

  await page.getByTestId("proposal-decline").click();
  await page.getByTestId("proposal-decline-reason").fill("My partner visits");
  await page.getByTestId("proposal-decline-confirm").click();

  await expect(page.getByTestId("rule-proposals")).toHaveCount(0);
  await expect(page.getByTestId("rule-history")).toContainText("Turned down");
  await expect(page.getByTestId("rule-history")).toContainText(
    "My partner visits",
  );
  await expect(page.getByTestId("nav-household-rules-badge")).toHaveCount(0);
});
