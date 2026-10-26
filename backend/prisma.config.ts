import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Not env(), which throws when unset: `prisma generate` needs no database.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
