import { Router } from "express";
import { createSandboxHandler } from "./demo.controller";

const router = Router();

// Public on purpose: it's how a visitor gets in. Off unless DEMO_SANDBOX=true.
router.post("/sandbox", createSandboxHandler);

export default router;
