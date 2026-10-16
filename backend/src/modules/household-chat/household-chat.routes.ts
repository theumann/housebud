import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./household-chat.controller";

// Mounted at /households/:householdId/chat
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/messages", controller.listMessagesHandler);
router.post("/messages", controller.sendMessageHandler);

export default router;
