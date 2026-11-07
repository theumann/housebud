import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  signupHandler,
  signupOptionsHandler,
  loginHandler,
  changePasswordHandler,
  acceptNoticeHandler,
} from "./auth.controller";

const router = Router();

router.get("/signup-options", signupOptionsHandler);
router.post("/signup", signupHandler);
router.post("/login", loginHandler);
router.post("/password", authMiddleware, changePasswordHandler);
router.post("/notice", authMiddleware, acceptNoticeHandler);
router.post("/logout", (req, res) => {
  return res.json({ message: "Logged out" });
});

export default router;
