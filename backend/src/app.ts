import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import profileRoutes from "./modules/profile/profile.routes";
import compatibilityRoutes from "./modules/compatibility/compatibility.routes";
import matchesRoutes from "./modules/matches/matches.routes";
import chatRoutes from "./modules/chat/chat.routes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/compatibility", compatibilityRoutes);
app.use("/matches", matchesRoutes);
app.use("/chatrooms", chatRoutes);

app.use(errorHandler);
