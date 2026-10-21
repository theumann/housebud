import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./calendar.controller";

// Mounted at /households/:householdId/calendar
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/", controller.listOccurrencesHandler);
router.post("/events", controller.createEventHandler);
router.put("/events/:eventId", controller.updateEventHandler);
router.delete("/events/:eventId", controller.deleteEventHandler);
router.post("/events/:eventId/skip", controller.skipOccurrenceHandler);

export default router;
