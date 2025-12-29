import { beforeAll, beforeEach } from "vitest";
import { resetDb } from "./helpers/resetDb";
import { config } from "dotenv";
import { prisma } from "../src/config/db";

config({ path: ".env.test" });
console.log("TEST DATABASE_URL =", process.env.DATABASE_URL);

beforeAll(async () => {
  const db = await prisma.$queryRawUnsafe<{ current_database: string }[]>(
    "select current_database()"
  );
  console.log("TEST DB =", db[0]?.current_database);
});

beforeEach(async () => {
  await resetDb();
});