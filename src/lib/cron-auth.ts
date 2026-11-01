import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Accepts the secret as `x-cron-secret: <CRON_SECRET>` (manual / external triggers) or
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends automatically when the
 * CRON_SECRET env var is set). Constant-time comparison. Fails closed when CRON_SECRET
 * is unset or shorter than 16 characters.
 */
export function isAuthorizedCronRequest(request: Request, secret = process.env.CRON_SECRET?.trim()): boolean {
  if (!secret || secret.length < 16) return false;
  const provided =
    request.headers.get("x-cron-secret")?.trim() ?? request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(secret));
}
