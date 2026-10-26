import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// pg ignores the ?schema= parameter in DATABASE_URL (e2e and the test workers
// rely on it), so it goes to the adapter, which qualifies Prisma's queries, and
// to search_path, which covers raw SQL.
export function createPrisma(url = process.env.DATABASE_URL) {
  const schema = new URL(url!).searchParams.get("schema") ?? "public";
  const adapter = new PrismaPg(
    {
      connectionString: url,
      options: `-c search_path=${schema}`,
      // Prisma 6's defaults; pg's own are no connect timeout and 10s idle.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 300_000,
    },
    { schema },
  );
  return new PrismaClient({ adapter });
}
