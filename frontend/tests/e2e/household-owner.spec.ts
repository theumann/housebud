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

  await page.getByTestId("rename-household-input").fill("Renamed House");
  await page.getByTestId("rename-household-submit").click();

  await expect(page.getByTestId("household-name")).toHaveText("Renamed House");
});

test("owner invites by email and can revoke the invite", async ({
  page,
  request,
}) => {
  const { owner } = await householdWithMember(request);
  const invitee = await signupFreshUser(request, "invitee");
  await openHousehold(page, owner.token);

  await page.getByTestId("invite-email-input").fill(invitee.email);
  await page.getByTestId("invite-email-submit").click();

  const sent = page.getByTestId("household-sent-invites");
  await expect(sent).toContainText(invitee.email);
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

test("owner removes a member, and cancelling the confirmation keeps them", async ({
  page,
  request,
}) => {
  const { owner, member } = await householdWithMember(request);
  await openHousehold(page, owner.token);
  const members = page.getByTestId("household-members").locator("li");
  await expect(members).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId(`remove-member-${member.id}`).click();
  await expect(members).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
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
  await expect(page.getByTestId("leave-household")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`make-owner-${member.id}`).click();

  await expect(page.getByTestId("household-my-role")).toHaveText("Member");
  await expect(page.getByTestId("household-owner-tools")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
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
  await expect(page.getByTestId("household-owner-tools")).toHaveCount(0);
  await expect(page.getByTestId("regenerate-join-code")).toHaveCount(0);
  await expect(page.getByTestId(`remove-member-${owner.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`make-owner-${owner.id}`)).toHaveCount(0);
  await expect(page.getByTestId("leave-household")).toBeVisible();
});
