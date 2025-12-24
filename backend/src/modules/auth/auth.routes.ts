import { Router } from "express";
import { signupHandler, loginHandler } from "./auth.controller";

const router = Router();

router.post("/signup", signupHandler);
router.post("/login", loginHandler);
router.post("/logout", (req, res) => {
  return res.json({ message: "Logged out" });
});

export default router;
