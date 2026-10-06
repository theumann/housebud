import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import profileRoutes from "./modules/profile/profile.routes";
import compatibilityRoutes from "./modules/compatibility/compatibility.routes";
import matchesRoutes from "./modules/matches/matches.routes";
import chatRoutes from "./modules/chat/chat.routes";
import householdRoutes from "./modules/household/household.routes";
import shoppingRoutes from "./modules/shopping/shopping.routes";
import { errorHandler } from "./middleware/errorHandler";
import { env } from "./config/env";

import type { PrismaClient } from "@prisma/client";

//export const app = express();

export function createApp(prisma: PrismaClient) {
  const app = express();

  app.use(express.json());

  // Make prisma available to routes
  app.use((req, _res, next) => {
    (req as any).prisma = prisma;
    next();
  });

  app.use(cors());
  app.use(express.json());

  app.use("/auth", authRoutes);
  app.use("/profile", profileRoutes);
  app.use("/households/:householdId/shopping", shoppingRoutes);
  app.use("/households", householdRoutes);

  if (env.FEATURE_MATCHING) {
    app.use("/compatibility", compatibilityRoutes);
    app.use("/matches", matchesRoutes);
    app.use("/chatrooms", chatRoutes);
  }

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: "ok" });
    } catch (e: any) {
      res.status(500).json({ ok: false, db: "fail", error: e?.message });
    }
  });

  app.use(errorHandler);

  return app;
}
