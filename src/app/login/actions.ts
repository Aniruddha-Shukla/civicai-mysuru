"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { DEMO_CITIZEN_EMAIL, DEMO_OPERATOR_EMAIL, demoEnabled, demoPassword } from "@/lib/demo/accounts";
import { isSupabaseConfigured, safeNextPath } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginSchema, SignupSchema } from "@/lib/validation/schemas";

export type AuthResult = { error?: string; needsConfirmation?: boolean };

async function destinationFor(userId: string, next: string | undefined): Promise<string> {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true, wardId: true } });
  if (profile?.role === "OPERATOR") return next?.startsWith("/operator") ? next : "/operator";
  if (!profile?.wardId) return "/onboarding";
  return next && !next.startsWith("/operator") ? next : "/dashboard";
}

export async function signInAction(input: unknown, next?: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { error: "Sign-in is not configured on this deployment." };
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Generic message: never reveal whether the email exists.
  if (error || !data.user) return { error: "Incorrect email or password, or the account is not confirmed yet." };

  // Make sure a profile exists (self-registered users are always CITIZEN).
  await prisma.profile.upsert({
    where: { id: data.user.id },
    update: {},
    create: {
      id: data.user.id,
      role: "CITIZEN",
      name: String((data.user.user_metadata as Record<string, unknown>)?.name ?? data.user.email?.split("@")[0] ?? "Citizen").slice(0, 80),
      email: data.user.email ?? null,
    },
  });
  redirect(await destinationFor(data.user.id, safeNextPath(next, "")));
}

/** One-click sign-in to a demo account. The password stays on the server. */
export async function demoSignInAction(role: unknown): Promise<AuthResult> {
  if (role !== "operator" && role !== "citizen") return { error: "Unknown demo account." };
  if (!demoEnabled()) return { error: "Demo sign-in is turned off on this deployment." };
  return signInAction({ email: role === "operator" ? DEMO_OPERATOR_EMAIL : DEMO_CITIZEN_EMAIL, password: demoPassword(role) });
}

export async function signUpAction(input: unknown): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { error: "Sign-up is not configured on this deployment." };
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name }, emailRedirectTo: origin ? `${origin}/auth/callback?next=/onboarding` : undefined },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create the account. Please try again." };

  await prisma.profile.upsert({
    where: { id: data.user.id },
    update: {},
    create: { id: data.user.id, role: "CITIZEN", name: parsed.data.name, email: parsed.data.email },
  });

  if (!data.session) return { needsConfirmation: true };
  redirect("/onboarding");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
