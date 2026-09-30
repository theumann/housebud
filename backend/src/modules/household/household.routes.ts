import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./household.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", controller.createHouseholdHandler);
router.get("/", controller.listMyHouseholdsHandler);

router.post("/join", controller.joinByCodeHandler);
router.post("/invites/accept", controller.acceptInviteHandler);

router.get("/:householdId", controller.getHouseholdHandler);
router.patch("/:householdId", controller.updateHouseholdHandler);
router.patch("/:householdId/settings", controller.updateSettingsHandler);
router.post("/:householdId/join-code", controller.regenerateJoinCodeHandler);

router.get("/:householdId/invites", controller.listInvitesHandler);
router.post("/:householdId/invites", controller.inviteHandler);
router.delete(
  "/:householdId/invites/:inviteId",
  controller.revokeInviteHandler,
);

router.post("/:householdId/leave", controller.leaveHouseholdHandler);
router.delete("/:householdId/members/:userId", controller.removeMemberHandler);
router.post(
  "/:householdId/members/:userId/owner",
  controller.transferOwnershipHandler,
);

export default router;
