import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { CityScene } from "@/components/city-scene";
import { LanguageToggle } from "@/components/language-toggle";
import { EcoFloaters, SweepLine } from "@/components/motion/eco";
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
    <div data-parallax className="bg-hero grain relative flex min-h-dvh items-center justify-center overflow-hidden p-3 sm:p-8">
      {/* drifting colour and floating 3D eco objects */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-lime-300/12 blur-3xl motion-safe:animate-aurora" />
        <div className="absolute -bottom-24 right-0 size-[26rem] rounded-full bg-teal-300/12 blur-3xl motion-safe:animate-aurora [animation-delay:-9s]" />
      </div>
      <EcoFloaters />

      {/* The card swings in from an angle, then tilts toward the mouse; the illustration floats in front of it. */}
      <div className="card-in-3d relative w-full max-w-5xl">
        <div
          data-tilt="5"
          className="relative grid rounded-[2rem] bg-emerald-950/40 shadow-2xl shadow-black/40 ring-1 ring-white/15 [transform-style:preserve-3d] md:grid-cols-[1.1fr_1fr]"
        >
          <span className="glare z-10" aria-hidden />

          {/* Picture side */}
          <aside className="flex flex-col gap-4 p-6 text-white [transform-style:preserve-3d] sm:p-8">
            <div className="flex items-center justify-between gap-2" style={{ transform: "translateZ(30px)" }}>
              <Brand light />
              <div className="md:hidden [&_button:hover]:bg-white/15 [&_button]:text-white">
                <LanguageToggle signedIn={false} />
              </div>
            </div>
            <div className="md:my-auto" style={{ transform: "translateZ(80px)" }}>
              <CityScene id="login-scene" className="mx-auto max-w-[15rem] drop-shadow-2xl sm:max-w-xs md:max-w-md" />
            </div>
            <div className="hidden md:block" style={{ transform: "translateZ(40px)" }}>
              <SweepLine className="text-white" />
              <p className="mt-2 text-center text-sm text-white/85">{t("auth.sidePitch")}</p>
            </div>
          </aside>

          {/* Form side */}
          <main className="rounded-t-[2rem] bg-card p-6 sm:p-10 md:rounded-[2rem]" style={{ transform: "translateZ(20px)" }}>
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
    </div>
  );
}
