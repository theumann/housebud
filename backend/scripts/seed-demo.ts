import "dotenv/config";
import { createPrisma } from "../src/config/prisma";
import {
  assertDemoTarget,
  readDatabaseComment,
  removeDemoUsers,
  seedDemoUsers,
} from "./demo-users";

// Replaces the demo users on the staging database (removing earlier ones first).
// `--remove` only removes them. See CLAUDE.md → Deployment.
const DEMO_USER_COUNT = 50;

async function main() {
  const prisma = createPrisma();
  try {
    assertDemoTarget(process.env.NODE_ENV, await readDatabaseComment(prisma));

    const removed = await removeDemoUsers(prisma);
    console.log(`Removed ${removed} demo users.`);

    if (!process.argv.includes("--remove")) {
      await seedDemoUsers(prisma, DEMO_USER_COUNT);
      console.log(`Created ${DEMO_USER_COUNT} demo users.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
