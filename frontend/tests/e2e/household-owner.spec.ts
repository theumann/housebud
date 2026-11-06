import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { API, apiGet, apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function householdWithMember(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const member = await signupFreshUser(request, "member");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Owner House",
  });
  await apiPost(request, member.token, "/households/join", {
    joinCode: house.joinCode,
  });
  return { owner, member, house };
}

async function openHousehold(page: Page, token: string) {
  await loginAs(page, token);
  await gotoAuthed(page, "/household", { waitForTestId: "household-view" });
}

test("owner renames the household", async ({ page, request }) => {
  const { owner } = await householdWithMember(request);
  await openHousehold(page, owner.token);

  // Settings are on their own page, behind the gear in the page header.
  await page.getByTestId("household-settings-link").click();
  // Settings isn't in the nav, so Overview stays highlighted.
  await expect(page.getByTestId("nav-household-overview")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByTestId("rename-household-input").fill("Renamed House");
  await page.getByTestId("rename-household-submit").click();
  await expect(page.getByTestId("rename-household-submit")).toBeDisabled();

  await page.getByTestId("household-settings-back").click();
  await expect(page.getByTestId("household-name")).toHaveText("Renamed House");
});

test("owner invites by email and can revoke the invite", async ({
  page,
  request,
}) => {
  const { owner } = await householdWithMember(request);
  const invitee = await signupFreshUser(request, "invitee");
  await openHousehold(page, owner.token);

  // With a housemate in, the invite tools are folded away.
  await page.getByTestId("household-invite-toggle").click();
  await page.getByTestId("invite-email-input").fill(invitee.email);
  await page.getByTestId("invite-email-submit").click();

  const sent = page.getByTestId("household-sent-invites");
  await expect(sent).toContainText(invitee.email);
  await expect(page.getByTestId("household-invite-toggle")).toContainText(
    "1 pending invite",
  );
  expect(
    await apiGet(request, invitee.token, "/households/invites/mine"),
  ).toHaveLength(1);

  await sent.getByRole("button", { name: "Revoke" }).click();
  await expect(sent).toHaveCount(0);
  expect(
    await apiGet(request, invitee.token, "/households/invites/mine"),
  ).toHaveLength(0);
});

test("owner creates a new join code and the old one stops working", async ({
  page,
  request,
}) => {
  const { owner, house } = await householdWithMember(request);
  const outsider = await signupFreshUser(request, "outsider");
  await openHousehold(page, owner.token);

  await page.getByTestId("household-invite-toggle").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("regenerate-join-code").click();

  await expect(page.getByTestId("household-join-code")).not.toHaveText(
    house.joinCode,
  );
  const res = await request.post(`${API}/households/join`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
    data: { joinCode: house.joinCode },
  });
  expect(res.status()).toBe(404);
});

test("the invite tools start open only while the owner is alone", async ({
  page,
  request,
}) => {
  const alone = await signupFreshUser(request, "alone");
  await apiPost(request, alone.token, "/households", { name: "Solo House" });
  await openHousehold(page, alone.token);
  const toggle = page.getByTestId("household-invite-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("invite-email-input")).toBeVisible();

  const { owner } = await householdWithMember(request);
  await openHousehold(page, owner.token);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("invite-email-input")).toHaveCount(0);
  // The code stays in view while folded.
  await expect(page.getByTestId("household-join-code")).toBeVisible();
  await expect(page.getByTestId("copy-join-code")).toBeVisible();
});

test("owner removes a member, and cancelling the confirmation keeps them", async ({
  page,
  request,
}) => {
  const { owner, member } = await householdWithMember(request);
  await openHousehold(page, owner.token);
  const members = page.getByTestId("household-members").locator("li");
  await expect(members).toHaveCount(2);

  // Make owner and Remove are under the member's "⋯" menu.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId(`member-menu-${member.id}`).click();
  await page.getByTestId(`remove-member-${member.id}`).click();
  await expect(members).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`member-menu-${member.id}`).click();
  await page.getByTestId(`remove-member-${member.id}`).click();
  await expect(members).toHaveCount(1);
  expect(await apiGet(request, member.token, "/households")).toEqual([]);
});

test("owner hands over ownership, then can leave", async ({
  page,
  request,
}) => {
  const { owner, member } = await householdWithMember(request);
  await openHousehold(page, owner.token);
  // The owner's own row has no menu: they can't leave before handing over.
  await expect(page.getByTestId(`member-menu-${owner.id}`)).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`member-menu-${member.id}`).click();
  await page.getByTestId(`make-owner-${member.id}`).click();

  await expect(page.getByTestId("household-my-role")).toHaveText("Member");
  await expect(page.getByTestId("household-settings-link")).toHaveCount(0);

  // Leave is in your own row's menu.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`member-menu-${owner.id}`).click();
  await page.getByTestId("leave-household").click();

  await expect(page.getByTestId("create-household")).toBeVisible();
  const [house] = await apiGet(request, member.token, "/households");
  expect(house.myRole).toBe("owner");
  expect(house.members).toHaveLength(1);
});

test("a member sees no owner controls", async ({ page, request }) => {
  const { owner, member } = await householdWithMember(request);
  await openHousehold(page, member.token);

  await expect(page.getByTestId("household-my-role")).toHaveText("Member");
  await expect(page.getByTestId("household-settings-link")).toHaveCount(0);
  await expect(page.getByTestId("regenerate-join-code")).toHaveCount(0);
  await expect(page.getByTestId(`member-menu-${owner.id}`)).toHaveCount(0);
  await expect(page.getByTestId("invite-email-input")).toHaveCount(0);
  await expect(page.getByTestId("household-invite-toggle")).toHaveCount(0);
  await expect(page.getByTestId("household-join-code")).toBeVisible();
  await page.getByTestId(`member-menu-${member.id}`).click();
  await expect(page.getByTestId("leave-household")).toBeVisible();

  // Opening the settings page by its address only says it's the owner's.
  const [house] = await apiGet(request, member.token, "/households");
  await gotoAuthed(page, `/household/${house.id}/settings`, {
    waitForTestId: "household-settings-owner-only",
  });
  await expect(page.getByTestId("household-owner-tools")).toHaveCount(0);
});
