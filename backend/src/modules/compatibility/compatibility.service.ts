// src/modules/compatibility/compatibility.service.ts

import type { PrismaClient } from "@prisma/client";
import { CompatibilityAnswersUpdateInput } from "./compatibility.types";

type QuestionWithOptions = {
  id: string;
  options: unknown;
  code: string | null;
};

/**
 * Get all active compatibility questions (for the form).
 */
export async function getActiveQuestions(prisma: PrismaClient) {
  const questions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    orderBy: { orderIndex: "asc" },
  });
  return questions;
}

/**
 * Compute stats: how many active questions, how many answered by this user,
 * and whether they meet the 20% threshold.
 */
export async function getUserCompatibilityStats(
  prisma: PrismaClient,
  userId: string,
) {
  const activeQuestions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const activeQuestionIds = activeQuestions.map((q: { id: string }) => q.id);

  if (activeQuestionIds.length === 0) {
    return {
      totalActiveQuestions: 0,
      answeredCount: 0,
      coverage: 0,
      hasMinCompatData: false,
    };
  }

  const answers = await prisma.compatibilityAnswer.findMany({
    where: {
      userId,
      questionId: { in: activeQuestionIds },
    },
    select: { id: true, value: true, questionId: true },
  });

  const totalActiveQuestions = activeQuestionIds.length;
  const answeredCount = answers.filter((a) => a.value.trim().length > 0).length;
  const coverage = answeredCount / totalActiveQuestions;
  const hasMinCompatData = coverage >= 0.2; // 20%

  return {
    totalActiveQuestions,
    answeredCount,
    coverage,
    hasMinCompatData,
  };
}

/**
 * Get current user's answers + stats.
 */
export async function getMyAnswers(prisma: PrismaClient, userId: string) {
  const questions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      code: true,
      text: true,
      type: true,
      options: true,
      orderIndex: true,
    },
  });

  const answers = await prisma.compatibilityAnswer.findMany({
    where: { userId },
    select: {
      id: true,
      questionId: true,
      value: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const stats = await getUserCompatibilityStats(prisma, userId);

  return {
    questions,
    answers,
    stats,
  };
}
export async function updateMyAnswers(
  prisma: PrismaClient,
  userId: string,
  inputs: CompatibilityAnswersUpdateInput,
) {
  const normalized = inputs.map((i) => ({
    questionId: i.questionId,
    value: (i.value ?? "").trim(),
  }));

  const toDelete = normalized.filter((i) => i.value.length === 0);
  const toUpsert = normalized.filter((i) => i.value.length > 0);

  const questionIds = toUpsert.map((i) => i.questionId);

  const activeQuestions = (await prisma.compatibilityQuestion.findMany({
    where: {
      id: { in: questionIds },
      isActive: true,
    },
    select: { id: true, options: true, code: true },
  })) as QuestionWithOptions[];

  const questionMap = new Map<string, QuestionWithOptions>(
    activeQuestions.map((q) => [q.id, q]),
  );

  // Validate only for upserts
  for (const input of toUpsert) {
    const q = questionMap.get(input.questionId);
    if (!q) {
      const err: any = new Error(
        "One or more questions are invalid or inactive",
      );
      err.status = 400;
      throw err;
    }

    if (q.options && Array.isArray(q.options)) {
      const options = q.options as string[];
      if (!options.includes(input.value)) {
        const err: any = new Error(
          `Invalid value for question ${q.code || q.id}`,
        );
        err.status = 400;
        throw err;
      }
    }
  }

  // Transaction: deletes + upserts
  await prisma.$transaction([
    ...toDelete.map((input) =>
      prisma.compatibilityAnswer.deleteMany({
        where: { userId, questionId: input.questionId },
      }),
    ),
    ...toUpsert.map((input) =>
      prisma.compatibilityAnswer.upsert({
        where: {
          userId_questionId: { userId, questionId: input.questionId },
        },
        update: { value: input.value },
        create: { userId, questionId: input.questionId, value: input.value },
      }),
    ),
  ]);

  return await getMyAnswers(prisma, userId);
}
