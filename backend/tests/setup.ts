import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true
});

import { beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

import type { TestContext } from "./helpers/testFactory";
import { createTestContext } from "./helpers/testFactory";
let ctx: TestContext;


function withSchema(url: string, schema: string) {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

beforeAll(async () => {
  ctx = createTestContext();
  const result = dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
  console.log("dotenv loaded:", result.parsed);
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL is not set for tests");
  console.log("Using DATABASE_URL:", baseUrl);
  if (!process.env.DATABASE_URL?.includes("bunkbuddy_test")) {
    throw new Error(`❌ Tests are not using bunkbuddy_test DB: ${process.env.DATABASE_URL}`);
  }

  // Vitest provides a worker id env var in many setups. (Fallback to 0.)
  const workerId =
    process.env.VITEST_WORKER_ID ??
    process.env.VITEST_POOL_ID ??
    "0";

  const schema = `test_w${workerId}`;
  const schemaUrl = withSchema(baseUrl, schema);

  // 1) Create the schema using a client pointed at public
  const adminUrl = withSchema(baseUrl, "public");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });

  await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await admin.$disconnect();

  // 2) Point THIS worker at its schema
  process.env.DATABASE_URL = schemaUrl;

  // 3) Apply migrations into that schema
  // Use migrate deploy for repeatable CI-ish behavior
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: schemaUrl },
  });
});

afterEach(async () => {
  // Reset tables inside THIS worker schema only
  const { resetDb } = await import("./helpers/resetDb");
  await resetDb(ctx.prisma);
});