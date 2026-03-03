import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

test("logged-in user can open matches page", async ({ page }) => {
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  // sanity: at least one card or empty state
  const empty = page.locator("text=No matches yet");
  const cards = page.locator("[data-testid^='match-card-header-']");
  await expect(empty.or(cards.first())).toBeVisible();
});
