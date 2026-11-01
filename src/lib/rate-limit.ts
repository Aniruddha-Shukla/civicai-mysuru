import "server-only";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";

/**
 * DB-backed sliding-window rate limit (per user + action). In-memory counters would
 * reset on every serverless cold start, so they cannot protect the AI budget.
 */
export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const recent = await prisma.rateLimitEvent.count({ where: { key, createdAt: { gte: since } } });
  if (recent >= limit) {
    throw new HttpError(429, "RATE_LIMITED", "Too many requests. Please wait a minute and try again.");
  }
  await prisma.rateLimitEvent.create({ data: { key } });
  if (Math.random() < 0.05) {
    await prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
}
