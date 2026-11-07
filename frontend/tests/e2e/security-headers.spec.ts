import { test, expect } from "./utils/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("pages send the security headers", async ({ request }) => {
  for (const path of ["/login", "/household"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    const headers = res.headers();
    expect(headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  }
});
