import jwt from "jsonwebtoken";
import type { User } from "../../generated/prisma/client";
import { env } from "../../config/env";
import { NOTICE_VERSION } from "./auth.types";

export function issueAuthResponse(
  user: User,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d",
) {
  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      // As in /profile/me: the app asks right after login when false.
      noticeAccepted: user.noticeVersion === NOTICE_VERSION,
    },
  };
}
