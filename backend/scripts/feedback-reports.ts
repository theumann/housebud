import type { PrismaClient } from "../src/generated/prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Used by feedback.ts; separate so tests can import it without running the
// script.

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function recentFeedback(prisma: PrismaClient, limit?: number) {
  const reports = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true, email: true } } },
  });
  return reports.reverse();
}

type Report = Awaited<ReturnType<typeof recentFeedback>>[number];

// "2026-10-29-1405-1a2b3c4d.jpg": sorts by date, unique by id.
export function screenshotFileName(report: Report) {
  const stamp = report.createdAt
    .toISOString()
    .slice(0, 16)
    .replace("T", "-")
    .replace(":", "");
  const ext = extensions[report.screenshotType ?? ""] ?? "img";
  return `${stamp}-${report.id.slice(0, 8)}.${ext}`;
}

// Writes the screenshots that aren't in `dir` yet; returns the file for each
// report that has one.
export function saveScreenshots(reports: Report[], dir: string) {
  mkdirSync(dir, { recursive: true });
  const files = new Map<string, string>();
  for (const report of reports) {
    if (!report.screenshot) continue;
    const file = path.join(dir, screenshotFileName(report));
    if (!existsSync(file)) writeFileSync(file, report.screenshot);
    files.set(report.id, file);
  }
  return files;
}
