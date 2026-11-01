import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { getSessionProfile } from "@/lib/auth";
import { isSupabaseConfigured, safeNextPath } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const profile = await getSessionProfile().catch(() => null);
  if (profile) redirect(profile.role === "OPERATOR" ? "/operator" : profile.wardId ? "/dashboard" : "/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex h-14 items-center justify-between">
        <Brand />
        <LanguageToggle signedIn={false} />
      </header>
      <main className="container flex flex-1 items-start justify-center py-6 sm:items-center">
        <AuthCard defaultTab={mode === "signup" ? "signup" : "signin"} next={safeNextPath(next, "")} configured={isSupabaseConfigured()} />
      </main>
    </div>
  );
}
