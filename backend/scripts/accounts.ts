import type { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

// Used by delete-user.ts; separate so tests can import it without running the
// script.
//
// Deleting a user cascades to everything that's theirs, expenses they paid and
// payments they were in included, which would quietly change what their
// housemates owe each other. So someone with money history shared with a
// household that carries on is anonymized instead: their account and personal
// data go, and those expenses and payments stay under a "deleted-…" name.

export type DeletionPlan = Awaited<ReturnType<typeof planDeletion>>;

export async function planDeletion(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });

  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          members: {
            where: { status: "active", userId: { not: userId } },
            orderBy: { joinedAt: "asc" },
            select: {
              userId: true,
              role: true,
              user: { select: { username: true } },
            },
          },
        },
      },
    },
  });

  // Nobody else active: the household goes with them (people who left already
  // lost access to it).
  const deleteHouseholds = memberships
    .filter((m) => m.household.members.length === 0)
    .map((m) => ({ id: m.household.id, name: m.household.name }));

  // Others carry on. An active sole owner hands over to whoever has been
  // active longest, as when a chat room's owner leaves.
  const keepHouseholds = memberships
    .filter((m) => m.household.members.length > 0)
    .map((m) => {
      const others = m.household.members;
      const needsOwner =
        m.status === "active" &&
        m.role === "owner" &&
        !others.some((o) => o.role === "owner");
      return {
        id: m.household.id,
        name: m.household.name,
        newOwner: needsOwner
          ? { userId: others[0].userId, username: others[0].user.username }
          : null,
      };
    });

  const kept = keepHouseholds.map((h) => h.id);
  const [sharedExpenses, payments] = await Promise.all([
    prisma.expense.count({
      where: {
        householdId: { in: kept },
        OR: [
          {
            paidByUserId: userId,
            shares: { some: { userId: { not: userId } } },
          },
          { paidByUserId: { not: userId }, shares: { some: { userId } } },
        ],
      },
    }),
    prisma.settlement.count({
      where: {
        householdId: { in: kept },
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
    }),
  ]);

  return {
    user,
    mode:
      sharedExpenses + payments > 0
        ? ("anonymize" as const)
        : ("delete" as const),
    deleteHouseholds,
    keepHouseholds,
    sharedExpenses,
    payments,
  };
}

export async function deleteAccount(prisma: PrismaClient, plan: DeletionPlan) {
  const userId = plan.user.id;
  // Hashed outside the transaction: it's slow on purpose.
  const unusablePassword = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    10,
  );

  await prisma.$transaction(async (tx) => {
    await tx.household.deleteMany({
      where: { id: { in: plan.deleteHouseholds.map((h) => h.id) } },
    });
    for (const h of plan.keepHouseholds) {
      if (h.newOwner) {
        await tx.householdMember.update({
          where: {
            householdId_userId: {
              householdId: h.id,
              userId: h.newOwner.userId,
            },
          },
          data: { role: "owner" },
        });
      }
    }
    // Invitations to their address hold it too.
    await tx.householdInvite.deleteMany({ where: { email: plan.user.email } });

    if (plan.mode === "delete") {
      await tx.user.delete({ where: { id: userId } });
      return;
    }

    // Anonymize: the row stays for the expenses and payments that point at
    // it; everything else of theirs goes, as a delete would remove it.
    const byUser = { where: { userId } };
    await tx.userProfile.deleteMany(byUser);
    await tx.userSettings.deleteMany(byUser);
    await tx.compatibilityAnswer.deleteMany(byUser);
    await tx.shortlist.deleteMany({
      where: { OR: [{ ownerUserId: userId }, { targetUserId: userId }] },
    });
    await tx.chatMessage.deleteMany({ where: { senderUserId: userId } });
    await tx.chatRoomParticipant.deleteMany(byUser);
    await tx.householdMessage.deleteMany({ where: { senderUserId: userId } });
    await tx.calendarEvent.deleteMany(byUser);
    await tx.ruleVote.deleteMany(byUser);
    await tx.feedback.deleteMany(byUser);
    await tx.passwordResetToken.deleteMany(byUser);
    await tx.householdMember.updateMany({
      where: { userId, status: "active" },
      data: { status: "left", role: "member" },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        username: `deleted-${userId.slice(0, 8)}`,
        passwordHash: unusablePassword,
        isActive: false,
      },
    });
  });
}
