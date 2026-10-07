import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./chores.controller";

// Mounted at /households/:householdId/chores
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/", controller.listChoresHandler);
router.post("/", controller.createChoreHandler);
router.get("/completions", controller.listCompletionsHandler);
router.post(
  "/completions/:completionId/undo",
  controller.undoCompletionHandler,
);
router.patch("/:choreId", controller.updateChoreHandler);
router.delete("/:choreId", controller.removeChoreHandler);
router.post("/:choreId/complete", controller.completeChoreHandler);
router.post("/:choreId/start", controller.startChoreHandler);
router.post("/:choreId/stop", controller.stopChoreHandler);

export default router;
