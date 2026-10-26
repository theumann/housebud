import type { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

// Used by reset-password.ts; separate so tests can import it without running
// the script.

export async function findUser(prisma: PrismaClient, identifier: string) {
  const id = identifier.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
    select: { id: true, email: true, username: true },
  });
}

export async function resetPassword(prisma: PrismaClient, userId: string) {
  const password = randomBytes(9).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return password;
}
