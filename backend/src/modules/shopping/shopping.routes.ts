import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./shopping.controller";

// Mounted at /households/:householdId/shopping
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/items", controller.listItemsHandler);
router.post("/items", controller.addItemHandler);
router.post("/clear-checked", controller.clearCheckedHandler);
router.patch("/items/:itemId", controller.updateItemHandler);
router.delete("/items/:itemId", controller.removeItemHandler);

export default router;
