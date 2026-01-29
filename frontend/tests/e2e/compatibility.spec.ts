import { test, expect } from "@playwright/test";
import { gotoAuthed } from "./utils/auth";

test("save compatibility answers", async ({ page }) => {
  await gotoAuthed(page, "/compatibility", { waitForTestId: "compatibility-page" });

  const firstOption = page.locator("[data-testid^='question-'][data-testid*='-option-']").first();

  await firstOption.check();
  await page.getByTestId("save-answers-button").click();

  await expect(
    page.locator("text=Your compatibility preferences have been saved.")
  ).toBeVisible();
});
