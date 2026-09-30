import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../errors/http.error";
import type {
  CreateHouseholdInput,
  HouseholdModule,
  InviteInput,
  UpdateHouseholdInput,
  UpdateSettingsInput,
} from "./household.types";
import { MODULE_SETTING_KEY } from "./household.types";

const INVITE_TTL_DAYS = 14;

// Ambiguous characters (0/O, 1/I) are excluded so codes can be read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

async function generateUniqueJoinCode(prisma: PrismaClient) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const existing = await prisma.household.findUnique({ where: { joinCode } });
    if (!existing) return joinCode;
  }
  throw new Error("Could not generate a unique join code");
}

const householdInclude = {
  settings: true,
  members: {
    where: { status: "active" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
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
    },
  },
} as const;

export async function requireActiveMember(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!member || member.status !== "active") {
    throw notFound("Household not found");
  }
  return member;
}

export async function requireOwner(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);
  if (member.role !== "owner") {
    throw forbidden("Only the household owner can do that");
  }
  return member;
}

export async function requireEnabledModule(
  prisma: PrismaClient,
  householdId: string,
  moduleName: HouseholdModule,
) {
  const settings = await prisma.householdSettings.findUnique({
    where: { householdId },
  });
  if (!settings || !settings[MODULE_SETTING_KEY[moduleName]]) {
    throw notFound("Not Found");
  }
  return settings;
}

export async function createHousehold(
  prisma: PrismaClient,
  userId: string,
  input: CreateHouseholdInput,
) {
  const joinCode = await generateUniqueJoinCode(prisma);

  return prisma.household.create({
    data: {
      name: input.name,
      joinCode,
      createdByUserId: userId,
      settings: { create: {} },
      members: { create: { userId, role: "owner", status: "active" } },
    },
    include: householdInclude,
  });
}

export async function listMyHouseholds(prisma: PrismaClient, userId: string) {
  const memberships = await prisma.householdMember.findMany({
    where: { userId, status: "active", household: { isActive: true } },
    include: { household: { include: householdInclude } },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({ ...m.household, myRole: m.role }));
}

export async function getHousehold(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: householdInclude,
  });
  if (!household) throw notFound("Household not found");

  return { ...household, myRole: member.role };
}

export async function updateHousehold(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: UpdateHouseholdInput,
) {
  await requireOwner(prisma, householdId, userId);

  return prisma.household.update({
    where: { id: householdId },
    data: { name: input.name },
    include: householdInclude,
  });
}

export async function updateSettings(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: UpdateSettingsInput,
) {
  await requireOwner(prisma, householdId, userId);

  return prisma.householdSettings.update({
    where: { householdId },
    data: input,
  });
}

export async function regenerateJoinCode(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireOwner(prisma, householdId, userId);

  const joinCode = await generateUniqueJoinCode(prisma);
  return prisma.household.update({
    where: { id: householdId },
    data: { joinCode },
    select: { id: true, joinCode: true },
  });
}

export async function inviteByEmail(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: InviteInput,
) {
  await requireOwner(prisma, householdId, userId);

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: existingUser.id } },
    });
    if (member?.status === "active") {
      throw conflict("That person is already in this household");
    }
  }

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  return prisma.householdInvite.create({
    data: {
      householdId,
      email: input.email,
      token: crypto.randomBytes(32).toString("hex"),
      invitedByUserId: userId,
      expiresAt,
    },
  });
}

export async function listInvites(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireOwner(prisma, householdId, userId);

  return prisma.householdInvite.findMany({
    where: { householdId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, expiresAt: true, createdAt: true },
  });
}

export async function revokeInvite(
  prisma: PrismaClient,
  householdId: string,
  inviteId: string,
  userId: string,
) {
  await requireOwner(prisma, householdId, userId);

  const invite = await prisma.householdInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.householdId !== householdId) {
    throw notFound("Invite not found");
  }

  await prisma.householdInvite.delete({ where: { id: inviteId } });
  return { ok: true };
}

async function addMember(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  // Someone who previously left or was removed rejoins as a plain member.
  return prisma.householdMember.upsert({
    where: { householdId_userId: { householdId, userId } },
    create: { householdId, userId, role: "member", status: "active" },
    update: { status: "active" },
  });
}

export async function acceptInvite(
  prisma: PrismaClient,
  userId: string,
  token: string,
) {
  const invite = await prisma.householdInvite.findUnique({
    where: { token },
    include: { household: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw badRequest("This invite is no longer valid");
  }
  if (!invite.household.isActive) {
    throw badRequest("This household is no longer active");
  }

  await prisma.$transaction([
    prisma.householdMember.upsert({
      where: {
        householdId_userId: { householdId: invite.householdId, userId },
      },
      create: {
        householdId: invite.householdId,
        userId,
        role: "member",
        status: "active",
      },
      update: { status: "active" },
    }),
    prisma.householdInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return getHousehold(prisma, invite.householdId, userId);
}

export async function joinByCode(
  prisma: PrismaClient,
  userId: string,
  joinCode: string,
) {
  const household = await prisma.household.findUnique({ where: { joinCode } });
  if (!household || !household.isActive) {
    throw notFound("No household found for that code");
  }

  await addMember(prisma, household.id, userId);
  return getHousehold(prisma, household.id, userId);
}

export async function leaveHousehold(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);

  if (member.role === "owner") {
    const otherOwners = await prisma.householdMember.count({
      where: {
        householdId,
        status: "active",
        role: "owner",
        userId: { not: userId },
      },
    });
    if (otherOwners === 0) {
      throw badRequest(
        "Transfer ownership to another member before leaving this household",
      );
    }
  }

  await prisma.householdMember.update({
    where: { householdId_userId: { householdId, userId } },
    data: { status: "left" },
  });

  return { ok: true };
}

export async function removeMember(
  prisma: PrismaClient,
  householdId: string,
  actingUserId: string,
  targetUserId: string,
) {
  await requireOwner(prisma, householdId, actingUserId);

  if (actingUserId === targetUserId) {
    throw badRequest("Use leave to remove yourself");
  }

  await requireActiveMember(prisma, householdId, targetUserId);

  await prisma.householdMember.update({
    where: { householdId_userId: { householdId, userId: targetUserId } },
    data: { status: "removed" },
  });

  return { ok: true };
}

export async function transferOwnership(
  prisma: PrismaClient,
  householdId: string,
  actingUserId: string,
  targetUserId: string,
) {
  await requireOwner(prisma, householdId, actingUserId);

  if (actingUserId === targetUserId) {
    throw badRequest("You already own this household");
  }

  await requireActiveMember(prisma, householdId, targetUserId);

  await prisma.$transaction([
    prisma.householdMember.update({
      where: { householdId_userId: { householdId, userId: targetUserId } },
      data: { role: "owner" },
    }),
    prisma.householdMember.update({
      where: { householdId_userId: { householdId, userId: actingUserId } },
      data: { role: "member" },
    }),
  ]);

  return getHousehold(prisma, householdId, actingUserId);
}
