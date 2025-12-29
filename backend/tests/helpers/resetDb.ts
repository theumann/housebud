import { prisma } from "../../src/config/db";

/**
 * Clears test data. Safe ordering to avoid FK constraint errors.
 * Keep this “deleteMany cascade” approach for portability across DBs.
 */
export async function resetDb() {
  await prisma.$transaction([
    prisma.chatMessage.deleteMany(),
    prisma.chatRoomParticipant.deleteMany(),
    prisma.chatRoom.deleteMany(),

    prisma.shortlist.deleteMany(),

    prisma.compatibilityAnswer.deleteMany(),
    prisma.compatibilityQuestion.deleteMany(),

    prisma.passwordResetToken.deleteMany(),
    prisma.userSettings.deleteMany(),
    prisma.userProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
