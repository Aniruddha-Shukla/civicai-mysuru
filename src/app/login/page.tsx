import { BadgeCheck, Languages, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { CityScene } from "@/components/city-scene";
import { LanguageToggle } from "@/components/language-toggle";
import { EcoFloaters, SweepLine } from "@/components/motion/eco";
import { HeroChip } from "@/components/page-hero";
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
    <div className="min-h-dvh pb-8">
      {/* Floating dark dock, the same as inside the app */}
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="container flex h-16 items-center justify-between gap-2 rounded-[1.75rem] border border-white/10 bg-emerald-950/90 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
          <Brand light />
          <div className="[&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
            <LanguageToggle signedIn={false} />
          </div>
        </div>
      </header>

      <main className="container grid max-w-6xl gap-5 pt-5 md:grid-cols-[1.1fr_1fr] md:items-stretch md:gap-6 md:pt-8">
        {/* Picture panel: swings in, tilts toward the mouse. On phones it sits under the form, so signing in comes first. */}
        <section className="card-in-3d order-2 md:order-1">
          <div
            data-tilt="5"
            data-parallax
            className="bg-hero grain relative flex h-full flex-col gap-4 overflow-hidden rounded-[2rem] p-6 text-white shadow-xl shadow-primary/20 sm:p-8"
          >
            <span className="glare z-10" aria-hidden />
            <div className="pointer-events-none absolute -left-24 top-0 size-80 rounded-full bg-lime-300/10 blur-3xl" aria-hidden />
            <EcoFloaters className="opacity-40" />

            <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-300">{t("app.name")}</p>
            <h2 className="relative max-w-md text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{t("landing.headline")}</h2>

            <div className="relative md:my-auto">
              <CityScene id="login-scene" className="mx-auto max-w-[14rem] drop-shadow-2xl sm:max-w-xs md:max-w-sm" />
            </div>

            <div className="relative hidden md:block">
              <SweepLine className="text-white" />
            </div>
            <div className="relative flex flex-wrap gap-2">
              <HeroChip icon={BadgeCheck} strong>
                {t("landing.m1")}
              </HeroChip>
              <HeroChip icon={Languages}>{t("landing.m2")}</HeroChip>
              <HeroChip icon={Megaphone}>{t("landing.m5")}</HeroChip>
            </div>
          </div>
        </section>

        {/* Form card */}
        <section className="card-in-3d order-1 [animation-delay:150ms] md:order-2">
          <div className="h-full rounded-[2rem] border bg-card p-6 shadow-soft sm:p-10">
            <p className="text-2xl font-semibold text-primary">{t("greeting.hello")}</p>
            <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t(greetingKey(new Date()))}</h1>
            <AuthCard
              defaultTab={mode === "signup" ? "signup" : "signin"}
              next={safeNextPath(next, "")}
              configured={isSupabaseConfigured()}
              demoLogin={isSupabaseConfigured() && demoEnabled()}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
