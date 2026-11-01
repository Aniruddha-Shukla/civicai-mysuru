import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client per server instance. In production on Vercel this connects
 * through Supabase's pooled connection string (DATABASE_URL, port 6543,
 * ?pgbouncer=true) so serverless instances cannot exhaust Postgres connections.
 * Prisma requires the Node.js runtime — every route that imports this module
 * declares `export const runtime = "nodejs"`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
