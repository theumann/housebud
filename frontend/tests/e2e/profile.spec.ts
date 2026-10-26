import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { API, loginAs, signupFreshUser } from "./utils/users";

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

test("changing the password: a wrong current one is refused, then the new one logs in", async ({
  page,
  request,
}) => {
  const user = await signupFreshUser(request, "password");
  await loginAs(page, user.token);
  await gotoAuthed(page, "/profile", { waitForTestId: "change-password" });

  const form = page.getByTestId("change-password");
  await form.getByLabel("Current password").fill("not-the-password");
  await form
    .getByLabel("New password", { exact: true })
    .fill("NewPassword456!");
  await form.getByLabel("Repeat new password").fill("NewPassword456!");
  await page.getByTestId("change-password-button").click();
  await expect(form.getByRole("alert")).toHaveText(
    "Current password is incorrect",
  );

  await form.getByLabel("Current password").fill("Password123!");
  await page.getByTestId("change-password-button").click();
  await expect(form.getByRole("status")).toHaveText("Password changed.");
  await expect(form.getByLabel("Current password")).toHaveValue("");

  const login = (password: string) =>
    request.post(`${API}/auth/login`, {
      data: { identifier: user.email, password },
    });
  expect((await login("Password123!")).status()).toBe(401);
  expect((await login("NewPassword456!")).status()).toBe(200);
});
