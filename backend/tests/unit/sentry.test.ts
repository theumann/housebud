import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { z } from "zod";
import { isClientError, scrubEvent } from "../../src/instrument";
import { HttpError } from "../../src/errors/http.error";
import { AuthError } from "../../src/errors/auth.error";

describe("scrubEvent", () => {
  it("keeps only the user id, and drops request bodies, headers, cookies and query strings", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "sam@example.com", ip_address: "203.0.113.1" },
      request: {
        url: "https://api.housebud.app/auth/login",
        method: "POST",
        data: { identifier: "sam", password: "hunter22" },
        headers: { authorization: "Bearer abc" },
        cookies: { a: "b" },
        query_string: "code=Maple-Street",
      },
    } as ErrorEvent);

    expect(event.user).toEqual({ id: "u1" });
    expect(event.request).toEqual({
      url: "https://api.housebud.app/auth/login",
      method: "POST",
    });
  });

  it("blanks email addresses out of messages", () => {
    const event = scrubEvent({
      type: undefined,
      message: "Failed for sam.lee+1@example.com",
      exception: {
        values: [
          { type: "Error", value: 'where: { email: "Sam@Example.co.uk" }' },
        ],
      },
      breadcrumbs: [{ message: "login sam@example.com", timestamp: 0 }],
    } as ErrorEvent);

    expect(event.message).toBe("Failed for [email]");
    expect(event.exception?.values?.[0].value).toBe(
      'where: { email: "[email]" }',
    );
    expect(event.breadcrumbs?.[0].message).toBe("login [email]");
  });

  it("leaves an event without a user without one", () => {
    expect(scrubEvent({ type: undefined } as ErrorEvent).user).toBeUndefined();
  });
});

describe("isClientError", () => {
  it("leaves out malformed requests, which have no status of their own", () => {
    const zodError = z.object({ email: z.string() }).safeParse({}).error;
    expect(isClientError(zodError)).toBe(true);
  });

  it("leaves out errors answered with a 4xx", () => {
    expect(isClientError(new HttpError(404, "Not Found"))).toBe(true);
    expect(isClientError(new HttpError(429, "Too many"))).toBe(true);
    expect(isClientError(new AuthError("Invalid credentials"))).toBe(true);
    expect(isClientError(Object.assign(new Error("x"), { status: 400 }))).toBe(
      true,
    );
  });

  it("keeps server errors and crashes", () => {
    expect(isClientError(new HttpError(503, "Down"))).toBe(false);
    expect(isClientError(new Error("boom"))).toBe(false);
    expect(isClientError(new TypeError("x is undefined"))).toBe(false);
    expect(isClientError("a string")).toBe(false);
    expect(isClientError(null)).toBe(false);
    expect(isClientError(undefined)).toBe(false);
  });
});
