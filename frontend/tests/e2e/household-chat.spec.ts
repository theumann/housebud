import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { clickNav } from "./utils/nav";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function householdWithRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "owner");
  const roommate = await signupFreshUser(request, "roommate");
  const house = await apiPost(request, owner.token, "/households", {
    name: "Chat House",
  });
  await apiPost(request, roommate.token, "/households/join", {
    joinCode: house.joinCode,
  });
  return { owner, roommate, householdId: house.id as string };
}

test("send a message and see a roommate's reply arrive", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  await loginAs(page, owner.token);
  await gotoAuthed(page, `/household/${householdId}`, {
    waitForTestId: "household-view",
  });

  await clickNav(page, "nav-household-chat");
  await expect(page).toHaveURL(new RegExp(`/household/${householdId}/chat$`));
  await expect(page.getByTestId("message-thread-empty")).toBeVisible();

  await page.getByTestId("message-input").fill("Pizza tonight?");
  await page.getByTestId("send-message-button").click();
  const thread = page.getByTestId("message-container");
  await expect(thread).toContainText("Pizza tonight?");
  await expect(page.getByTestId("message-input")).toHaveValue("");

  // Arrives through polling.
  await apiPost(
    request,
    roommate.token,
    `/households/${householdId}/chat/messages`,
    { text: "Yes please" },
  );
  await expect(thread).toContainText("Yes please");
  await expect(thread.getByText("Pizza tonight?")).toHaveCount(1);
});

test("new messages show a badge (one per chat) until you open the chat", async ({
  page,
  request,
}) => {
  const { owner, roommate, householdId } = await householdWithRoommate(request);
  for (const text of ["Rent is due", "Also the plants"]) {
    await apiPost(
      request,
      roommate.token,
      `/households/${householdId}/chat/messages`,
      { text },
    );
  }

  await loginAs(page, owner.token);
  await gotoAuthed(page, "/matches", { waitForTestId: "nav-household" });
  await expect(page.getByTestId("nav-household-badge")).toHaveText("1");

  await page.getByTestId("nav-household").click();
  await expect(page.getByTestId("nav-household-chat-badge")).toHaveText("1");
  // Two messages, one chat: badges count chats. Inside the household section
  // it moves to the Chat link.
  await expect(page.getByTestId("nav-household-badge")).toHaveCount(0);

  await clickNav(page, "nav-household-chat");
  await expect(page.getByTestId("message-container")).toContainText(
    "Also the plants",
  );
  await expect(page.getByTestId("nav-household-chat-badge")).toHaveCount(0);
});
