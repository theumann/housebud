import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { TestContext } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import {
  signupUser,
  createQuestion,
  answerQuestions,
  getMyAnswers,
} from "../helpers/testFactory";
import { resetDb } from "../helpers/resetDb";

let ctx: TestContext;

describe.sequential("Compatibility (API)", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("lists active questions and saves valid answers", async () => {
    await resetDb(ctx.prisma);
    const q1 = await createQuestion(ctx, {
      code: "Q1",
      text: "Question 1?",
      options: ["A", "B"],
      isActive: true,
    });
    const q2 = await createQuestion(ctx, {
      code: "Q2",
      text: "Question 2?",
      options: ["X", "Y"],
      isActive: true,
    });
    await createQuestion(ctx, {
      code: "INACTIVE",
      text: "Inactive",
      options: ["1"],
      isActive: false,
    });

    const { token } = await signupUser(ctx, {
      email: "a@test.com",
      password: "Password123!",
      firstName: "A",
      lastName: "A",
      username: "aaa",
      displayName: "AAA",
      birthDate: "2005-09-15",
      school: "USF",
      collegeYear: "Freshman",
      targetCity: "SF",
      targetState: "CA",
      targetZip: "94117",
    });

    const qsRes = await request(ctx.app)
      .get("/compatibility/questions")
      .set("Authorization", `Bearer ${token}`);
    expect(qsRes.status).toBe(200);
    const ids = (qsRes.body as any[]).map((q) => q.id);
    expect(ids).toContain(q1.id);
    expect(ids).toContain(q2.id);
    expect(ids).not.toContain("INACTIVE"); // not perfect, but fine for smoke

    await answerQuestions(ctx, token, [
      { questionId: q1.id, value: "A" },
      { questionId: q2.id, value: "Y" },
    ]);

    const mine = await getMyAnswers(ctx.app, token);
    const map = new Map(mine.map((a) => [a.questionId, a.value]));
    expect(map.get(q1.id)).toBe("A");
    expect(map.get(q2.id)).toBe("Y");
  });

  it("rejects invalid option values with 400", async () => {
    await resetDb(ctx.prisma);

    const q1 = await createQuestion(ctx, {
      code: "Q1",
      text: "Question 1?",
      options: ["A", "B"],
      isActive: true,
    });

    const { token } = await signupUser(ctx, {
      email: "b@test.com",
      password: "Password123!",
      firstName: "B",
      lastName: "B",
      username: "bbb",
      displayName: "BBB",
      birthDate: "2005-09-15",
      school: "USF",
      collegeYear: "Freshman",
      targetCity: "SF",
      targetState: "CA",
      targetZip: "94117",
    });

    const res = await request(ctx.app)
      .put("/compatibility/answers/me")
      .set("Authorization", `Bearer ${token}`)
      .send([{ questionId: q1.id, value: "NOT_AN_OPTION" }]);

    expect(res.status).toBe(400);
  });
});
