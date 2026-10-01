import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:4002";

// Fresh users per test, so tests that create households, chats or invites
// don't change what other tests see on the shared seed accounts.
export async function signupFreshUser(
  request: APIRequestContext,
  label: string,
) {
  const suffix = `${label}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = await request.post(`${API}/auth/signup`, {
    data: {
      email: `${suffix}@e2e.test`,
      username: suffix,
      password: "Password123!",
      firstName: label,
      lastName: "Tester",
      displayName: suffix.slice(0, 32),
      birthDate: "2005-09-15",
      school: "USF",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94117",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return {
    id: body.user.id as string,
    token: body.token as string,
    email: `${suffix}@e2e.test`,
  };
}

export async function apiPost(
  request: APIRequestContext,
  token: string,
  path: string,
  data: object = {},
) {
  const res = await request.post(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(res.ok()).toBe(true);
  return res.json();
}

export async function loginAs(page: Page, token: string) {
  await page.goto("/login");
  await page.evaluate((t) => localStorage.setItem("bb_token", t), token);
}
