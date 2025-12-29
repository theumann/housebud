import { env } from "./env"; // MUST be first / before prisma usage
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
});
