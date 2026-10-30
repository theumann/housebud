import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { createPrisma } from "../src/config/prisma";
import { findUser } from "./passwords";
import { deleteAccount, planDeletion, type DeletionPlan } from "./accounts";

// The app can't delete an account itself yet, so a deletion request is done
// by hand: `npm run delete-user -- <email or username>` shows what will go and
// asks first, unless `--yes`. Run it against a deployed database like
// seed:questions (CLAUDE.md → Deployment), after a backup.

async function confirm(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

function describe(plan: DeletionPlan) {
  const lines = [`${plan.user.username} <${plan.user.email}>`];
  for (const h of plan.deleteHouseholds) {
    lines.push(
      `  Household "${h.name}": deleted with everything in it (nobody else is active).`,
    );
  }
  for (const h of plan.keepHouseholds) {
    lines.push(
      `  Household "${h.name}": they leave it` +
        (h.newOwner ? `; ${h.newOwner.username} becomes the owner.` : "."),
    );
  }
  if (plan.mode === "delete") {
    lines.push("  The account and everything of theirs is deleted.");
  } else {
    lines.push(
      `  They share ${plan.sharedExpenses} expense(s) and ${plan.payments} payment(s) with housemates, so the account is anonymized instead of deleted:`,
      "  profile, answers, messages, calendar entries, votes and problem reports are deleted; login is disabled;",
      `  those expenses and payments stay, under the name "deleted-${plan.user.id.slice(0, 8)}", so balances don't change.`,
    );
  }
  return lines.join("\n");
}

async function main() {
  const identifier = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!identifier) {
    throw new Error(
      "Usage: npm run delete-user -- <email or username> [--yes]",
    );
  }

  const prisma = createPrisma();
  try {
    const user = await findUser(prisma, identifier);
    if (!user)
      throw new Error(`No user with email or username "${identifier}".`);

    const plan = await planDeletion(prisma, user.id);
    console.log(describe(plan));

    if (!process.argv.includes("--yes")) {
      if (!(await confirm("Go ahead? This can't be undone. [y/N] "))) {
        console.log("Nothing changed.");
        return;
      }
    }

    await deleteAccount(prisma, plan);
    console.log(
      plan.mode === "delete" ? "Deleted." : "Anonymized.",
      "Their current session can still make requests until it expires (up to 7 days), but finds nothing of theirs.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
