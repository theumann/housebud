import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";
import { env } from "../../config/env";

export function issueAuthResponse(user: User) {
  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  };
}
