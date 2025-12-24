import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export const env = {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
};
