import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import profileRoutes from "./modules/profile/profile.routes";
import compatibilityRoutes from "./modules/compatibility/compatibility.routes";
import matchesRoutes from "./modules/matches/matches.routes";
import chatRoutes from "./modules/chat/chat.routes";
import { errorHandler } from "./middleware/errorHandler";

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
    app.use("/compatibility", compatibilityRoutes);
    app.use("/matches", matchesRoutes);
    app.use("/chatrooms", chatRoutes);

    app.use(errorHandler);

    return app;
}