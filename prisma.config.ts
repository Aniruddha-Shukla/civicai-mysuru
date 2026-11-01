// Prisma CLI configuration. When this file exists Prisma no longer auto-loads
// `.env`, so we load it explicitly for local `migrate` / `seed` commands.
// On Vercel the variables come from the project settings instead.
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
