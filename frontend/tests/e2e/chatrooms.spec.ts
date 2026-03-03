import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

test("open an existing chat room if available", async ({ page }) => {
  await gotoAuthed(page, "/chatrooms", { waitForTestId: "chatrooms-page" });

  const openButtons = page.locator("[data-testid^='open-chat-']");
  if ((await openButtons.count()) === 0) {
    test.skip(true, "No active chat rooms to open.");
  }

  await openButtons.first().click();
  await expect(page.getByTestId("chatroom-page")).toBeVisible();
});
