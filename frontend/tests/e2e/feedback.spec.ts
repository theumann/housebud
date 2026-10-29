import type { Page } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed } from "./utils/auth";
import { loginAs, signupFreshUser } from "./utils/users";

// Fresh users, so the reports don't pile up on the seed users.
test.use({ storageState: { cookies: [], origins: [] } });

function feedbackRequest(page: Page) {
  return page.waitForRequest(
    (req) => req.url().endsWith("/feedback") && req.method() === "POST",
  );
}

test("report a problem with a screenshot of the page", async ({
  page,
  request,
}) => {
  await loginAs(page, (await signupFreshUser(request, "reporter")).token);
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });

  await page.getByTestId("feedback-button").click();
  const dialog = page.getByTestId("feedback-dialog");
  await expect(dialog).toBeVisible();
  // Every engine, the phones included: testers on an iPhone need it too.
  await expect(page.getByTestId("feedback-include-screenshot")).toBeChecked();
  await expect(page.getByTestId("feedback-screenshot-preview")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );

  await page.getByTestId("feedback-message").fill("The list doesn't update");
  const sent = feedbackRequest(page);
  await page.getByTestId("feedback-send").click();

  const body = (await sent).postDataJSON();
  expect(body).toMatchObject({
    message: "The list doesn't update",
    page: "/household",
    viewport: expect.stringMatching(/^\d+x\d+$/),
    screenshot: expect.stringMatching(/^data:image\/jpeg;base64,/),
  });
  await expect(page.getByTestId("feedback-sent")).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("unticking the screenshot sends the description only", async ({
  page,
  request,
}) => {
  await loginAs(page, (await signupFreshUser(request, "reporter")).token);
  await gotoAuthed(page, "/household", { waitForTestId: "household-page" });

  await page.getByTestId("feedback-button").click();
  await page.getByTestId("feedback-include-screenshot").uncheck();
  await expect(page.getByTestId("feedback-screenshot-preview")).toBeHidden();
  // With nothing to send, Send waits for a description.
  await expect(page.getByTestId("feedback-send")).toBeDisabled();

  await page.getByTestId("feedback-message").fill("Typo on this page");
  const sent = feedbackRequest(page);
  await page.getByTestId("feedback-send").click();

  const body = (await sent).postDataJSON();
  expect(body.message).toBe("Typo on this page");
  expect(body).not.toHaveProperty("screenshot");
  await expect(page.getByTestId("feedback-sent")).toBeVisible();
});
