import "dotenv/config";
import { createApp } from "./app";
import { createPrisma } from "./config/prisma";
import { env } from "./config/env";

const prisma = createPrisma();
const app = createApp(prisma);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});