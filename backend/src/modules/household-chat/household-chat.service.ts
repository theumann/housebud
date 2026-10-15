import type { PrismaClient } from "@prisma/client";
import {
  requireActiveMember,
  requireEnabledModule,
} from "../household/household.service";
import type { SendHouseholdMessageInput } from "./household-chat.types";

const messageInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  },
} as const;

async function requireChatAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);
  await requireEnabledModule(prisma, householdId, "chat");
  return member;
}

// Members only see messages sent since they (last) joined. With `after`,
// returns messages created at or after that time, so a message sharing the
// last one's millisecond isn't missed; clients skip ids they already have.
export async function listMessages(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  after?: Date,
) {
  const member = await requireChatAccess(prisma, householdId, userId);
  const from = after && after > member.joinedAt ? after : member.joinedAt;

  return prisma.householdMessage.findMany({
    where: { householdId, createdAt: { gte: from } },
    include: messageInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function sendMessage(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: SendHouseholdMessageInput,
) {
  await requireChatAccess(prisma, householdId, userId);

  return prisma.householdMessage.create({
    data: { householdId, senderUserId: userId, text: input.text },
    include: messageInclude,
  });
}
