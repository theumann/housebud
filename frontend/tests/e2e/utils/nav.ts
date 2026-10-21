import type { Page } from "@playwright/test";

// Below the `sm` breakpoint, a nav row of more than 4 links keeps the first 3
// and hides the rest, which are under "More" instead (AppNav.tsx).
export async function clickNav(page: Page, testId: string) {
  const link = page.getByTestId(testId);
  await link.waitFor({ state: "attached" });
  if (await link.isVisible()) {
    await link.click();
    return;
  }
  await page.getByTestId("nav-more").click();
  await page.getByTestId(`${testId}-more`).click();
}
