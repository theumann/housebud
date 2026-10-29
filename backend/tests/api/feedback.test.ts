import request from "supertest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { signupUser } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { FEEDBACK_HOURLY_CAP } from "../../src/modules/feedback/feedback.service";
import {
  recentFeedback,
  saveScreenshots,
} from "../../scripts/feedback-reports";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// A real 1×1 PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9GtQAAAABJRU5ErkJggg==",
  "base64",
);
const pngDataUrl = `data:image/png;base64,${png.toString("base64")}`;

describe.sequential("POST /feedback", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("needs a login", async () => {
    await request(ctx.app)
      .post("/feedback")
      .send({ message: "Broken", page: "/household" })
      .expect(401);
  });

  it("stores the report with its screenshot and context", async () => {
    const { token, userId } = await signupUser(ctx);

    const res = await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .set("User-Agent", "TestBrowser/1.0")
      .send({
        message: "  The chores page is empty  ",
        page: "/household/abc/chores?x=1",
        viewport: "390x844",
        screenshot: pngDataUrl,
      })
      .expect(201);

    const saved = await ctx.prisma.feedback.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(saved).toMatchObject({
      userId,
      message: "The chores page is empty",
      page: "/household/abc/chores?x=1",
      viewport: "390x844",
      userAgent: "TestBrowser/1.0",
      screenshotType: "image/png",
    });
    expect(Buffer.from(saved.screenshot!).equals(png)).toBe(true);
  });

  it("takes a description without a screenshot, or a screenshot alone", async () => {
    const { token } = await signupUser(ctx);

    await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ message: "Typo on the rules page", page: "/household" })
      .expect(201);
    await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ page: "/household", screenshot: pngDataUrl })
      .expect(201);

    const saved = await ctx.prisma.feedback.findMany({
      orderBy: { message: "desc" },
    });
    expect(saved.map((f) => [f.message, f.screenshot === null])).toEqual([
      ["Typo on the rules page", true],
      ["", false],
    ]);
  });

  it("refuses a report with neither, and anything but an image", async () => {
    const { token } = await signupUser(ctx);

    const empty = await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ message: "   ", page: "/household" })
      .expect(400);
    expect(empty.body.error).toMatch(/Describe the problem/);

    const notImage = await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({
        page: "/household",
        screenshot: "data:text/html;base64,PGgxPkhpPC9oMT4=",
      })
      .expect(400);
    expect(notImage.body.error).toMatch(/^screenshot:/);

    expect(await ctx.prisma.feedback.count()).toBe(0);
  });

  it("accepts a screenshot over the default 100 kB body limit, and refuses one over its own", async () => {
    const { token } = await signupUser(ctx);
    const big = (chars: number) =>
      `data:image/jpeg;base64,${"A".repeat(chars)}`;

    await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ page: "/household", screenshot: big(1_000_000) })
      .expect(201);
    await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ page: "/household", screenshot: big(6_000_000) })
      .expect(413);
  });

  it("limits how many reports someone sends in an hour", async () => {
    const { token, userId } = await signupUser(ctx);
    await ctx.prisma.feedback.createMany({
      data: Array.from({ length: FEEDBACK_HOURLY_CAP }, () => ({
        userId,
        message: "Again",
        page: "/household",
      })),
    });

    await request(ctx.app)
      .post("/feedback")
      .set(auth(token))
      .send({ message: "One more", page: "/household" })
      .expect(429);

    const other = await signupUser(ctx);
    await request(ctx.app)
      .post("/feedback")
      .set(auth(other.token))
      .send({ message: "Mine", page: "/household" })
      .expect(201);
  });

  it("the feedback script lists reports oldest first and saves each screenshot once", async () => {
    const { userId } = await signupUser(ctx, { username: "sam" });
    const report = (
      message: string,
      minute: number,
      screenshot?: typeof png,
    ) => ({
      userId,
      message,
      page: "/household",
      screenshot,
      screenshotType: screenshot && "image/png",
      createdAt: new Date(`2026-10-29T14:0${minute}:00Z`),
    });
    await ctx.prisma.feedback.createMany({
      data: [
        report("Second", 2, png),
        report("First", 1, png),
        report("No picture", 3),
      ],
    });

    const reports = await recentFeedback(ctx.prisma);
    expect(reports.map((r) => r.message)).toEqual([
      "First",
      "Second",
      "No picture",
    ]);
    expect(reports[0].user.username).toBe("sam");
    expect((await recentFeedback(ctx.prisma, 1)).map((r) => r.message)).toEqual(
      ["No picture"],
    );

    const dir = mkdtempSync(path.join(os.tmpdir(), "feedback-"));
    try {
      const files = saveScreenshots(reports, dir);
      expect(files.size).toBe(2);
      expect(readdirSync(dir)).toHaveLength(2);
      const file = files.get(reports[0].id)!;
      expect(path.basename(file)).toBe(
        `2026-10-29-1401-${reports[0].id.slice(0, 8)}.png`,
      );
      expect(readFileSync(file).equals(png)).toBe(true);

      saveScreenshots(reports, dir);
      expect(readdirSync(dir)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
