import { test as base, expect } from "@playwright/test";

// Drop-in replacement for Playwright's `test` that records what the page did
// (failed API calls, console errors, navigations) and attaches it to the report
// when a test fails. Playwright only captures the page itself, which wasn't
// enough to explain intermittent logouts.
export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const events: string[] = [];
      const log = (line: string) =>
        events.push(`${new Date().toISOString()} ${line}`);

      page.on("response", (res) => {
        if (res.status() >= 400) {
          log(`HTTP ${res.status()} ${res.request().method()} ${res.url()}`);
        }
      });
      page.on("requestfailed", (req) =>
        log(
          `REQUEST FAILED ${req.method()} ${req.url()}: ${req.failure()?.errorText}`,
        ),
      );
      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") {
          log(`console.${msg.type()}: ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => log(`page error: ${err.message}`));
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) log(`navigated to ${frame.url()}`);
      });

      await use();

      if (testInfo.status !== testInfo.expectedStatus) {
        const token = await page
          .evaluate(() => localStorage.getItem("bb_token"))
          .catch(() => "unavailable");
        log(`bb_token at failure: ${token ? "present" : "missing"}`);
        await testInfo.attach("diagnostics", {
          body: events.join("\n") || "(no events recorded)",
          contentType: "text/plain",
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
