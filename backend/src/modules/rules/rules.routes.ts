import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./rules.controller";

// Mounted at /households/:householdId/rules
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/", controller.getOverviewHandler);
router.post("/proposals", controller.proposeHandler);
router.post("/proposals/:proposalId/vote", controller.voteHandler);
router.post("/proposals/:proposalId/withdraw", controller.withdrawHandler);
router.post("/agree", controller.agreeHandler);

export default router;
