import type { PrismaClient } from "@prisma/client";
import { ProfileUpdateInput } from "./profile.types";

export async function getMyProfile(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      settings: true,
    },
  });

  if (!user) {
    const err: any = new Error("User not found");
    err.status = 404;
    throw err;
  }

  // Shape the response so we never leak passwordHash
  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    profile: user.profile,
    settings: user.settings,
  };
}

export async function updateMyProfile(prisma: PrismaClient, userId: string, input: ProfileUpdateInput) {
  // Prepare update data
  const data: any = { ...input };

  if (input.birthDate) {
    data.birthDate = new Date(input.birthDate);
  }

  // Ensure profile exists; signup should always create it, but upsert is safer
  return prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      firstName: input.firstName ?? "First",
      lastName: input.lastName ?? "Last",
      displayName: input.displayName ?? null,
      birthDate: input.birthDate ? new Date(input.birthDate) : new Date("2000-01-01"),
      school: input.school ?? "Unknown",
      collegeYear: input.collegeYear ?? "Unknown",
      targetCity: input.targetCity ?? "Unknown",
      targetState: input.targetState ?? "Unknown",
      targetZip: input.targetZip ?? "00000",
      originalCity: input.originalCity ?? null,
      originalState: input.originalState ?? null,
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
    },
  });
}