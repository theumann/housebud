import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { loginAs, signupFreshUser } from "./utils/users";

test.use({ storageState: { cookies: [], origins: [] } });

test("saving the profile updates the account menu without a reload", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "profile");
  await loginAs(page, user.token);
  await gotoAuthed(page, "/profile", { waitForTestId: "profile-edit-page" });

  const displayName = page.getByTestId("profile-display-name");
  await expect(displayName).not.toHaveValue("");
  await displayName.fill("Renamed Rita");
  await page.getByTestId("save-profile-button").click();
  await expect(page.getByText("Profile saved successfully.")).toBeVisible();

  await expect(page.getByTestId("account-menu")).toHaveText("R");
  await page.getByTestId("account-menu").click();
  await expect(page.getByTestId("account-menu-items")).toContainText(
    "Renamed Rita",
  );
});
