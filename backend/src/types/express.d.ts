import type { PrismaClient } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
    }
  }
}
export {};
