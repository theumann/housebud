import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { createPrisma } from "../src/config/prisma";
import { countActiveSandboxes } from "../src/modules/demo/demo.service";
import {
  assertDemoTarget,
  readDatabaseComment,
  removeDemoUsers,
  seedDemoUsers,
} from "./demo-users";

// Replaces the demo users on the staging database (removing earlier ones first).
// `--remove` only removes them. Asks first if demo sandboxes are in use, unless
// `--yes`. See CLAUDE.md → Deployment.
const DEMO_USER_COUNT = 50;

async function confirm(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main() {
  const prisma = createPrisma();
  try {
    assertDemoTarget(process.env.NODE_ENV, await readDatabaseComment(prisma));

    const active = await countActiveSandboxes(prisma);
    if (active > 0 && !process.argv.includes("--yes")) {
      const ok = await confirm(
        `${active} demo sandbox${active === 1 ? " is" : "es are"} active (created in the last 24 hours).\n` +
          "Replacing or removing the demo users takes away their housemates, so those visitors' households fall apart.\n" +
          "Continue? [y/N] ",
      );
      if (!ok) {
        console.log("Nothing changed.");
        return;
      }
    }

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
