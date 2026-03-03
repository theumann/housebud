import { PrismaClient } from "@prisma/client";

export function createPrisma() {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}
