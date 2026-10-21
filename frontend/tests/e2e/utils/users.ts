import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:4002";

// Matches only shows people whose target ZIP shares the first three digits.
// Fresh users default to a prefix no seed user has, so tests running in
// parallel don't change what the seed users (all in 941xx) see on Matches.
const FRESH_USER_ZIP = "00501";

// A ZIP prefix of its own, for tests that check who appears on Matches.
export function randomZip() {
  return `${200 + Math.floor(Math.random() * 500)}01`;
}

// Fresh users per test, so tests that create households, chats or invites
// don't change what other tests see on the shared seed accounts.
export async function signupFreshUser(
  request: APIRequestContext,
  label: string,
  { zip = FRESH_USER_ZIP }: { zip?: string } = {},
) {
  const suffix = `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
      targetZip: zip,
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

export async function apiGet(
  request: APIRequestContext,
  token: string,
  path: string,
) {
  const res = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
  return res.json();
}

// Sets the token on a static file of the app's origin: on /login, the page's
// own startup could read it and redirect to "/" while the test moves on.
export async function loginAs(page: Page, token: string) {
  await page.goto("/robots.txt");
  await page.evaluate((t) => localStorage.setItem("bb_token", t), token);
}
