/**
 * Role-based access control. Every mutating API route calls one of the
 * `require*` helpers — UI hiding is never relied upon.
 */
import "server-only";
import { getSessionProfile, type SessionProfile } from "@/lib/auth";
import { Errors } from "@/lib/errors";

export type Role = "CITIZEN" | "OPERATOR";

/** Pure check: 401 when signed out, 403 when the role is not allowed. */
export function assertRole<P extends { role: Role }>(profile: P | null, allowed: readonly Role[]): P {
  if (!profile) throw Errors.unauthenticated();
  if (!allowed.includes(profile.role)) throw Errors.forbidden();
  return profile;
}

export async function requireRole(...allowed: Role[]): Promise<SessionProfile> {
  return assertRole(await getSessionProfile(), allowed);
}

export const requireOperator = () => requireRole("OPERATOR");
export const requireCitizen = () => requireRole("CITIZEN");
export const requireSignedIn = () => requireRole("CITIZEN", "OPERATOR");

/** Citizens must have a ward before any ward-scoped feature runs (no null-ward queries downstream). */
export function requireWard<P extends { wardId: string | null }>(profile: P): P & { wardId: string } {
  if (!profile.wardId) throw Errors.wardRequired();
  return profile as P & { wardId: string };
}
