import type { PrismaClient } from "../../generated/prisma/client";
import { HttpError } from "../../errors/http.error";
import type { CreateFeedbackInput } from "./feedback.types";

const HOUR = 60 * 60 * 1000;
export const FEEDBACK_HOURLY_CAP = 20;

export async function createFeedback(
  prisma: PrismaClient,
  userId: string,
  input: CreateFeedbackInput,
  context: { userAgent?: string; appVersion?: string },
) {
  const lastHour = await prisma.feedback.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - HOUR) } },
  });
  if (lastHour >= FEEDBACK_HOURLY_CAP) {
    throw new HttpError(
      429,
      "You've sent a lot of reports in the last hour. Please try again later.",
    );
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      message: input.message,
      page: input.page,
      viewport: input.viewport,
      userAgent: context.userAgent?.slice(0, 500),
      appVersion: context.appVersion,
      screenshot: input.screenshot?.data,
      screenshotType: input.screenshot?.type,
    },
    select: { id: true },
  });
  return feedback;
}
