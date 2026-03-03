import type { PrismaClient } from "@prisma/client";

export async function resetDb(prisma: PrismaClient) {
  const url = process.env.DATABASE_URL;

  if (!url || !url.includes("schema=test_")) {
    throw new Error("❌ resetDb called with non-test DATABASE_URL: ${url}");
  }

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
