import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

test("nav links route to core pages", async ({ page }) => {
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  await page.getByTestId("nav-shortlist").click();
  await expect(page.getByTestId("shortlist-page")).toBeVisible();

  await page.getByTestId("nav-compatibility").click();
  await expect(page.getByTestId("compatibility-page")).toBeVisible();

  await page.getByTestId("nav-chat").click();
  await expect(page.getByTestId("chatrooms-page")).toBeVisible();

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("profile-edit-page")).toBeVisible();
});
