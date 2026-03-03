import { PrismaClient } from "@prisma/client";

export async function logCurrentSchema() {
  const prisma = new PrismaClient();
  const result = await prisma.$queryRawUnsafe<{ current_schema: string }[]>(
    `SELECT current_schema()`,
  );
  await prisma.$disconnect();
  return result[0].current_schema;
}
