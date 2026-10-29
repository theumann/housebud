import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./feedback.controller";

// Mounted at /feedback, with its own body limit for the screenshot (app.ts).
const router = Router();

router.use(authMiddleware);

router.post("/", controller.createFeedbackHandler);

export default router;
