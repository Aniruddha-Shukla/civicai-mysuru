import "server-only";
import { notFound } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth";

/**
 * Defence in depth for operator pages. The operator layout already refuses non-operators,
 * but Next.js layouts are not re-rendered on client-side navigation, so every operator
 * page re-checks the role right next to its data access.
 */
export async function requireOperatorPage(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "OPERATOR") notFound();
  return profile;
}
