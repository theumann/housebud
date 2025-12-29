import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function resetDb() {
  // Order matters due to FKs
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoomParticipant.deleteMany();
  await prisma.chatRoom.deleteMany();

  await prisma.compatibilityAnswer.deleteMany();
  await prisma.compatibilityQuestion.deleteMany();

  await prisma.shortlist.deleteMany();

  await prisma.userSettings.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
}
