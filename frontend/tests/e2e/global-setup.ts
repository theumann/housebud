import { chromium, type FullConfig } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
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

async function loginAndSaveStorage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Programmatic login via API
  const res = await page.request.post(`${API}/auth/login`, {
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

  // Put token in localStorage under bb_token
  await page.goto("http://localhost:3000/login");
  await page.evaluate((t) => localStorage.setItem("bb_token", t), token);

  // Save storage state
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await rm(storageStatePath, { force: true });
  await page.context().storageState({ path: storageStatePath });

  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  console.log("Global setup: starting migrations, seed, and auth storage.");

  // 1) Apply migrations to the e2e schema (same env file as seed:e2e)
  run(
    process.platform === "win32"
      ? "npx.cmd dotenv -e .env.e2e -- npx.cmd prisma migrate deploy --schema prisma/schema.prisma"
      : "npx dotenv -e .env.e2e -- prisma migrate deploy --schema prisma/schema.prisma",
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
