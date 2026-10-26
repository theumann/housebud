import { request } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:4002";

const backendDir = path.resolve(__dirname, "../../../backend");
const storageStatePath = path.resolve(
  __dirname,
  "../../playwright/.auth/storageState.json",
);

function run(cmd: string) {
  execSync(cmd, { cwd: backendDir, stdio: "inherit" });
}

// Logs in through the API and writes the token as Playwright storage state,
// without a browser: each CI job installs only the browsers it tests.
async function loginAndSaveStorage() {
  const api = await request.newContext();
  const res = await api.post(`${API}/auth/login`, {
    data: { identifier: "me1", password: "Password123!" },
  });

  if (res.status() !== 200) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }

  const body = await res.json();
  const token = body?.token;
  if (!token) {
    throw new Error(`Missing token from /auth/login: ${JSON.stringify(body)}`);
  }
  await api.dispose();

  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await writeFile(
    storageStatePath,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [{ name: "bb_token", value: token }],
        },
      ],
    }),
  );
}

export default async function globalSetup() {
  console.log("Global setup: starting migrations, seed, and auth storage.");

  // 1) Reset the e2e schema (drop, re-apply all migrations) so every run starts
  // from the same state, even after a crashed or interrupted run. Only the
  // schema in .env.e2e is touched.
  run(
    process.platform === "win32"
      ? "npx.cmd dotenv -e .env.e2e -- npx.cmd prisma migrate reset --force --schema prisma/schema.prisma"
      : "npx dotenv -e .env.e2e -- prisma migrate reset --force --schema prisma/schema.prisma",
  );

  // 2) Seed e2e data
  run(
    process.platform === "win32" ? "npm.cmd run seed:e2e" : "npm run seed:e2e",
  );

  // 3) Login and cache auth
  await loginAndSaveStorage();

  const st = await stat(storageStatePath);
  console.log(
    `Global setup: saved storage state to ${storageStatePath} (${st.size} bytes).`,
  );
}
