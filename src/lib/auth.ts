import "server-only";
import type { Profile } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { cache } from "react";
import { LIMITS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = Profile;

function displayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const raw = typeof meta?.name === "string" ? meta.name : user.email?.split("@")[0] ?? "Citizen";
  return raw.replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, LIMITS.name) || "Citizen";
}

/**
 * Self-signed-up users always get the CITIZEN role. The role is NEVER read from
 * Supabase user_metadata (which the user can edit); OPERATOR accounts are created
 * only by the seed script or `scripts/promote-operator.ts`.
 */
async function ensureProfile(user: User): Promise<Profile> {
  const existing = await prisma.profile.findUnique({ where: { id: user.id } });
  if (existing) return existing;
  return prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, role: "CITIZEN", name: displayName(user), email: user.email ?? null },
  });
}

/**
 * The signed-in user's profile, verified with Supabase on every request
 * (`auth.getUser()` validates the JWT with the auth server; cookies alone are not trusted).
 * API clients may also send `Authorization: Bearer <supabase access token>`.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const { data, error } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  if (error || !data.user) return null;
  return ensureProfile(data.user);
});
