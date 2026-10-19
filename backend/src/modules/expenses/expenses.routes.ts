import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import * as controller from "./expenses.controller";

// Mounted at /households/:householdId/expenses
const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/", controller.getOverviewHandler);
router.post("/expenses", controller.createExpenseHandler);
router.patch("/expenses/:expenseId", controller.updateExpenseHandler);
router.delete("/expenses/:expenseId", controller.deleteExpenseHandler);
router.post("/settlements", controller.createSettlementHandler);
router.patch("/settlements/:settlementId", controller.updateSettlementHandler);
router.delete("/settlements/:settlementId", controller.deleteSettlementHandler);

export default router;
