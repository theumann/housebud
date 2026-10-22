import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { loginAs, randomZip, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

test("shortlist add and remove from matches", async ({ page, request }) => {
  const zip = randomZip();
  const candidate = await signupFreshUser(request, "candidate", { zip });
  const user = await signupFreshUser(request, "shortlister", { zip });
  await loginAs(page, user.token);
  await gotoAuthed(page, "/matches", { waitForTestId: "matches-page" });

  await page.getByTestId(`shortlist-add-button-${candidate.id}`).click();

  await page.getByTestId("nav-shortlist").click();
  await expect(page.getByTestId("shortlist-page")).toBeVisible();

  const firstCard = page.locator("[data-testid^='shortlist-card-']").first();
  await expect(firstCard).toBeVisible();

  const firstRemove = page
    .locator("[data-testid^='shortlist-remove-button-']")
    .first();
  await firstRemove.click();

  await expect(page.locator("text=Your shortlist is empty")).toBeVisible();
});
