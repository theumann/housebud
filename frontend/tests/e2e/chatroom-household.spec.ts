import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { apiPost, loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function roomWithAcceptedRoommate(request: APIRequestContext) {
  const owner = await signupFreshUser(request, "roomowner");
  const roommate = await signupFreshUser(request, "roommate");
  const { roomId } = await apiPost(request, owner.token, "/chatrooms", {
    participantIds: [roommate.id],
    name: "Meet and greet",
  });
  await apiPost(request, roommate.token, `/chatrooms/${roomId}/accept`);
  return { owner, roommate, roomId: roomId as string };
}

test("room owner forms a household; the roommate is invited", async ({
  page,
  request,
}) => {
  const { owner, roommate, roomId } = await roomWithAcceptedRoommate(request);

  await loginAs(page, owner.token);
  await gotoAuthed(page, `/chatrooms/${roomId}`, {
    waitForTestId: "chatroom-page",
  });

  page.once("dialog", (dialog) => dialog.accept("Chat House"));
  await page.getByTestId("form-household-button").click();

  await expect(page.getByTestId("room-household-name")).toHaveText(
    "Chat House",
  );
  await expect(page.getByTestId("form-household-button")).toHaveCount(0);

  await loginAs(page, roommate.token);
  await gotoAuthed(page, `/chatrooms/${roomId}`, {
    waitForTestId: "chatroom-page",
  });

  await expect(page.getByTestId("room-household-name")).toHaveText(
    "Chat House",
  );
  await expect(page.getByTestId("form-household-button")).toHaveCount(0);
  await expect(page.getByTestId("nav-household-badge")).toHaveText("1");

  await page.getByRole("link", { name: "Go to Household" }).click();
  await expect(page.getByTestId("household-invites")).toContainText(
    "Chat House",
  );
});

test("a room member who isn't the owner can't form a household", async ({
  page,
  request,
}) => {
  const { roommate, roomId } = await roomWithAcceptedRoommate(request);

  await loginAs(page, roommate.token);
  await gotoAuthed(page, `/chatrooms/${roomId}`, {
    waitForTestId: "chatroom-page",
  });

  await expect(page.getByTestId("form-household-button")).toHaveCount(0);
  await expect(page.getByTestId("room-household-banner")).toHaveCount(0);
});
