import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { createPrisma } from "../src/config/prisma";
import { recentFeedback, saveScreenshots } from "./feedback-reports";

// Reads "Report a problem" submissions: `npm run feedback` prints the 20 most
// recent (`-- --all` for every one) and saves their screenshots to
// ~/HouseBud-feedback (`-- --out <dir>` for another folder), skipping files
// already there. Screenshots show other people's data: keep that folder
// private. Run it against a deployed database like seed:questions
// (CLAUDE.md → Deployment).

function option(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const dir = option("--out") ?? path.join(os.homedir(), "HouseBud-feedback");
  const limit = process.argv.includes("--all") ? undefined : 20;

  const prisma = createPrisma();
  try {
    const reports = await recentFeedback(prisma, limit);
    if (reports.length === 0) {
      console.log("No feedback yet.");
      return;
    }

    const files = saveScreenshots(reports, dir);
    for (const r of reports) {
      console.log(
        `\n${r.createdAt.toISOString()}  ${r.user.username} <${r.user.email}>`,
      );
      console.log(`  page:     ${r.page}`);
      console.log(`  viewport: ${r.viewport ?? "-"}`);
      console.log(`  browser:  ${r.userAgent ?? "-"}`);
      console.log(`  version:  ${r.appVersion ?? "-"}`);
      console.log(`  image:    ${files.get(r.id) ?? "none"}`);
      console.log(r.message ? `  ${r.message.replace(/\n/g, "\n  ")}` : "");
    }
    console.log(`\n${reports.length} report(s); screenshots in ${dir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
