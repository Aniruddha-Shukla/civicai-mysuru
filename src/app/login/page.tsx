import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { CityScene } from "@/components/city-scene";
import { LanguageToggle } from "@/components/language-toggle";
import { getSessionProfile } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo/accounts";
import { greetingKey } from "@/lib/greeting";
import { getT } from "@/lib/i18n";
import { currentLang } from "@/lib/session-lang";
import { isSupabaseConfigured, safeNextPath } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const profile = await getSessionProfile().catch(() => null);
  if (profile) redirect(profile.role === "OPERATOR" ? "/operator" : profile.wardId ? "/dashboard" : "/onboarding");
  const t = getT(await currentLang());

  return (
    <div className="bg-hero grain relative flex min-h-dvh items-center justify-center p-3 sm:p-8">
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] animate-in fade-in-0 zoom-in-95 duration-700 bg-white/10 shadow-2xl shadow-black/30 ring-1 ring-white/15 backdrop-blur md:grid-cols-[1.1fr_1fr]">
        {/* Picture side */}
        <aside className="flex flex-col gap-4 p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <Brand light />
            <div className="md:hidden [&_button]:text-white [&_button:hover]:bg-white/15">
              <LanguageToggle signedIn={false} />
            </div>
          </div>
          <div data-parallax className="md:my-auto">
            <CityScene id="login-scene" className="mx-auto max-w-[15rem] sm:max-w-xs md:max-w-md" />
          </div>
          <p className="hidden text-center text-sm text-white/85 md:block">{t("auth.sidePitch")}</p>
        </aside>

        {/* Form side */}
        <main className="rounded-t-[2rem] bg-card p-6 sm:p-10 md:rounded-l-[2rem] md:rounded-tr-none">
          <div className="mb-6 hidden justify-end md:flex">
            <LanguageToggle signedIn={false} />
          </div>
          <p className="text-2xl font-semibold text-primary">{t("greeting.hello")}</p>
          <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t(greetingKey(new Date()))}</h1>
          <AuthCard
            defaultTab={mode === "signup" ? "signup" : "signin"}
            next={safeNextPath(next, "")}
            configured={isSupabaseConfigured()}
            demoLogin={isSupabaseConfigured() && demoEnabled()}
          />
        </main>
      </div>
    </div>
  );
}
