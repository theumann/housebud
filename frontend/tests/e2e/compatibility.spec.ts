import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

test("save compatibility answers", async ({ page, request }) => {
  await loginAs(page, (await signupFreshUser(request, "answers")).token);
  await gotoAuthed(page, "/compatibility", {
    waitForTestId: "compatibility-page",
  });

  const firstOption = page
    .locator("[data-testid^='question-'][data-testid*='-option-']")
    .first();

  await firstOption.check();
  await page.getByTestId("save-answers-button").click();

  await expect(
    page.locator("text=Your compatibility preferences have been saved."),
  ).toBeVisible();
});
