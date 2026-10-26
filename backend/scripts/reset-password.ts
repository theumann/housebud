import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { createPrisma } from "../src/config/prisma";
import { findUser, resetPassword } from "./passwords";

// The app has no password reset and sends no email, so a forgotten password is
// reset by hand: `npm run reset-password -- <email or username>` sets a new
// random password and prints it once, to pass on to the user. Asks first,
// unless `--yes`. Run it against a deployed database like seed:questions
// (CLAUDE.md → Deployment).

async function confirm(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main() {
  const identifier = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!identifier) {
    throw new Error(
      "Usage: npm run reset-password -- <email or username> [--yes]",
    );
  }

  const prisma = createPrisma();
  try {
    const user = await findUser(prisma, identifier);
    if (!user)
      throw new Error(`No user with email or username "${identifier}".`);

    if (!process.argv.includes("--yes")) {
      const ok = await confirm(
        `Reset the password of ${user.username} <${user.email}>? [y/N] `,
      );
      if (!ok) {
        console.log("Nothing changed.");
        return;
      }
    }

    const password = await resetPassword(prisma, user.id);
    console.log(`New password for ${user.username}: ${password}`);
    console.log(
      "Send it to them privately, and ask them to change it on their Profile page.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
