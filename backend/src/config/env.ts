import dotenv from "dotenv";
import path from "path";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  PORT: Number(process.env.PORT || 4000),
  // When set, signup requires this code (handed to invited users). Unset or
  // empty: anyone can sign up, as in local dev and tests.
  SIGNUP_CODE: process.env.SIGNUP_CODE || null,
  // Staging only: "Try the demo" creates a throwaway account in a sample
  // household (POST /demo/sandbox). Never set it in production.
  DEMO_SANDBOX: process.env.DEMO_SANDBOX === "true",
  // Matching (compatibility, matches, chat rooms): "false" unmounts those
  // routes, as in production until matching opens there. Pair it with
  // NEXT_PUBLIC_FEATURE_MATCHING=false on the frontend, which hides the pages.
  FEATURE_MATCHING: process.env.FEATURE_MATCHING !== "false",
};

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}
