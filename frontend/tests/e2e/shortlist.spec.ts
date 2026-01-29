import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

test("shortlist add and remove from matches", async ({ page }) => {
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  const firstAdd = page.locator("[data-testid^='shortlist-add-button-']").first();

  await firstAdd.click();

  await page.getByTestId("nav-shortlist").click();
  await expect(page.getByTestId("shortlist-page")).toBeVisible();

  const firstCard = page.locator("[data-testid^='shortlist-card-']").first();
  await expect(firstCard).toBeVisible();

  const firstRemove = page.locator("[data-testid^='shortlist-remove-button-']").first();
  await firstRemove.click();

  await expect(page.locator("text=Your shortlist is empty")).toBeVisible();
});