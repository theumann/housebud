import { expect, type Page } from "@playwright/test";

type GotoAuthedOptions = {
  waitForTestId?: string;
};

export async function gotoAuthed(
  page: Page,
  path: string,
  options: GotoAuthedOptions = {},
) {
  await page.goto(path);
  await expect(page.getByTestId("nav-logo")).toBeVisible();
  if (options.waitForTestId) {
    await expect(page.getByTestId(options.waitForTestId)).toBeVisible();
  }
}
