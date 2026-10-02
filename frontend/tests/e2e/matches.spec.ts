import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

// Regression: the page size used to be derived from the number of items on
// the current page, so a short last page showed "Page 5 of 7" and Next led
// to an empty page.
test("pagination stops on the real last page", async ({ page }) => {
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  const label = page.getByTestId("matches-page-label");
  const next = page.getByTestId("next-button");
  await expect(label).toContainText(/Page 1 of \d+/);
  const totalPages = Number(
    (await label.textContent())?.match(/of (\d+)/)?.[1],
  );
  test.skip(totalPages < 2, "Seed data has fewer than 2 pages of matches.");

  for (let p = 2; p <= totalPages; p++) {
    await next.click();
    await expect(label).toContainText(`Page ${p} of ${totalPages}`);
  }

  await expect(next).toBeDisabled();
  await expect(page.locator("text=No matches yet")).toHaveCount(0);
  await expect(
    page.locator("[data-testid^='match-card-header-']").first(),
  ).toBeVisible();
});

test.describe("inviting a match to your room", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the button reflects the invite instead of an alert, and keeps it after a reload", async ({
    page,
    request,
  }) => {
    const owner = await signupFreshUser(request, "inviter");
    const alreadyInvited = await signupFreshUser(request, "pendingone");
    const target = await signupFreshUser(request, "target");
    await apiPost(request, owner.token, "/chatrooms", {
      participantIds: [alreadyInvited.id],
      name: "Invite Test Room",
    });

    // The old flow used alert(); no dialog should appear anymore.
    page.on("dialog", (dialog) => {
      throw new Error(`Unexpected dialog: ${dialog.message()}`);
    });

    await loginAs(page, owner.token);
    await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

    const targetButton = page.getByTestId(`invite-to-room-button-${target.id}`);
    await expect(targetButton).toHaveText("Invite to Invite Test Room");
    await expect(
      page.getByTestId(`invite-to-room-button-${alreadyInvited.id}`),
    ).toHaveText("Invited");

    await targetButton.click();
    await expect(targetButton).toHaveText("Invited");
    await expect(targetButton).toBeDisabled();

    await page.reload();
    await expect(targetButton).toHaveText("Invited");
    await expect(targetButton).toBeDisabled();
  });

  test("a member who doesn't own the room gets 'Chat in' for people in it", async ({
    page,
    request,
  }) => {
    const owner = await signupFreshUser(request, "roomowner");
    const member = await signupFreshUser(request, "member");
    const { roomId } = await apiPost(request, owner.token, "/chatrooms", {
      participantIds: [member.id],
      name: "Shared Room",
    });
    await apiPost(request, member.token, `/chatrooms/${roomId}/accept`);

    await loginAs(page, member.token);
    await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

    const chatButton = page.getByTestId(`chat-in-room-button-${owner.id}`);
    await expect(chatButton).toHaveText("Chat in Shared Room");
    await expect(
      page.getByTestId(`invite-to-room-button-${owner.id}`),
    ).toHaveCount(0);

    await chatButton.click();
    await expect(page).toHaveURL(new RegExp(`/chatrooms/${roomId}$`));
    await expect(page.getByTestId("chatroom-page")).toBeVisible();
  });
});
