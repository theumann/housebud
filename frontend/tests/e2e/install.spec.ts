import { test, expect } from "./utils/test";

// Installing can't be automated; this checks what the browser needs to offer it.
test.use({ storageState: { cookies: [], origins: [] } });

test("the app is installable: manifest, icons and theme color", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: "HouseBud",
    start_url: "/",
    display: "standalone",
  });
  expect(manifest.icons).toContainEqual(
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  );
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  }

  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect((await request.get(appleIcon!)).status()).toBe(200);
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", /^#/);
});
