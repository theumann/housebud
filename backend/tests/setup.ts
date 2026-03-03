import path from "path";
import dotenv from "dotenv";
import { beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import { createTestContext } from "./helpers/testFactory";
import { setTestContext, getTestContext } from "./helpers/testContext";

dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

function withSchema(url: string, schema: string) {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

beforeAll(async () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL is not set for tests");
  if (!process.env.DATABASE_URL?.includes("bunkbuddy_test")) {
    throw new Error(`❌ Tests are not using bunkbuddy_test DB: ${baseUrl}`);
  }

  // Vitest provides a worker id env var in many setups. (Fallback to 0.)
  const workerId =
    process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "0";

  const schema = `test_w${workerId}`;
  const schemaUrl = withSchema(baseUrl, schema);

  // 1) Create schema (admin connection)
  const adminUrl = withSchema(baseUrl, "public");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await admin.$disconnect();

  // 2) Point THIS worker to its schema
  process.env.DATABASE_URL = schemaUrl;

  // 3) Apply migrations (serialized across workers)
  execSync(
    process.platform === "win32"
      ? "npx.cmd prisma db push --force-reset --schema prisma/schema.prisma"
      : "npx prisma db push --force-reset --schema prisma/schema.prisma",
    {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: schemaUrl, // per-worker schema
      },
    },
  );
  const ctx = createTestContext();
  setTestContext(ctx);
});

afterEach(async () => {
  const ctx = getTestContext();
  // Reset tables inside THIS worker schema only
  const { resetDb } = await import("./helpers/resetDb");
  await resetDb(ctx.prisma);
});
