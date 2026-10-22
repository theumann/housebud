import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "./utils/test";
import { gotoAuthed, gotoLoginForm } from "./utils/auth";
import { API, loginAs } from "./utils/users";

// axe checks each page against WCAG 2.1 A and AA: contrast, labels, names,
// landmarks, and so on. The rules don't depend on the browser engine, so this
// runs on one desktop and one phone project: the phone layout differs (the
// nav's "More" menu, stacked forms).
test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !["chromium", "pixel-7"].includes(testInfo.project.name),
    "axe results don't depend on the engine",
  );
});

async function expectNoViolations(page: Page, testInfo: TestInfo) {
  // Buttons fade in when a load finishes (`transition`); axe measuring one
  // halfway through reports contrast that the settled page doesn't have.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== "running" ||
          a.effect?.getComputedTiming().endTime === Infinity,
      ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await testInfo.attach("axe-results", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes.map((n) => `  ${n.target.join(" ")}`).join("\n"),
  );
  expect(summary, `${page.url()}\n${summary.join("\n")}`).toEqual([]);
}

async function loginAsSeedUser(page: Page, username: string) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { identifier: username, password: "Password123!" },
  });
  expect(res.status()).toBe(200);
  await loginAs(page, (await res.json()).token);
}

// Dark mode is the app's own toggle (saved as `theme` in localStorage and
// applied before the page renders), not the browser's color scheme.
for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    });

    test.describe("logged out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("login", async ({ page }, testInfo) => {
        await gotoLoginForm(page);
        await expectNoViolations(page, testInfo);
      });

      test("signup", async ({ page }, testInfo) => {
        await page.goto("/signup");
        await expect(page.getByTestId("signup-page")).toBeVisible();
        await expectNoViolations(page, testInfo);
      });
    });

    // me1 is the default logged-in user; these pages only read.
    test.describe("finding roommates", () => {
      for (const [path, testId] of [
        ["/matches", "matches-page"],
        ["/shortlist", "shortlist-page"],
        ["/compatibility", "compatibility-page"],
        ["/chatrooms", "chatrooms-page"],
        ["/profile", "profile-edit-page"],
      ]) {
        test(path, async ({ page }, testInfo) => {
          await gotoAuthed(page, path, { waitForTestId: testId });
          await expectNoViolations(page, testInfo);
        });
      }
    });

    // me4's seeded household has every module on and data in every state.
    // Read-only, like household-seed.spec.ts.
    test.describe("household", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      for (const [sub, testId] of [
        ["", "household-view"],
        ["/chat", "message-container"],
        ["/chores", "chore-board"],
        ["/shopping", "shopping-open-items"],
        ["/expenses", "expenses-list"],
        ["/rules", "rules-list"],
        ["/calendar", "calendar-agenda"],
      ]) {
        test(`/household/[id]${sub}`, async ({ page }, testInfo) => {
          await loginAsSeedUser(page, "me4");
          await gotoAuthed(page, "/household", {
            waitForTestId: "household-view",
          });
          if (sub) {
            await gotoAuthed(page, `${page.url()}${sub}`, {
              waitForTestId: testId,
            });
          }
          await expectNoViolations(page, testInfo);
        });
      }

      test("/household/[id]/calendar, month view", async ({
        page,
      }, testInfo) => {
        await loginAsSeedUser(page, "me4");
        await gotoAuthed(page, "/household", {
          waitForTestId: "household-view",
        });
        await gotoAuthed(page, `${page.url()}/calendar`, {
          waitForTestId: "calendar-agenda",
        });
        await page.getByTestId("calendar-view-month").click();
        await expect(page.getByTestId("calendar-selected-day")).toBeVisible();
        await expectNoViolations(page, testInfo);
      });
    });
  });
}
