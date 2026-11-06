import { ArrowRight, BellRing, CalendarCheck, CircleSlash, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DemoSignIn } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { CityScene } from "@/components/city-scene";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo/accounts";
import { getT } from "@/lib/i18n";
import { currentLang } from "@/lib/session-lang";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const lang = await currentLang();
  const t = getT(lang);
  const profile = await getSessionProfile().catch(() => null);
  const home = profile ? (profile.role === "OPERATOR" ? "/operator" : "/dashboard") : null;
  const showDemo = !profile && isSupabaseConfigured() && demoEnabled();

  const steps = [
    { icon: ShieldCheck, tone: "bg-violet-100 text-violet-700", title: t("landing.step1Title"), body: t("landing.step1Body") },
    { icon: BellRing, tone: "bg-indigo-100 text-indigo-700", title: t("landing.step2Title"), body: t("landing.step2Body") },
    { icon: CalendarCheck, tone: "bg-fuchsia-100 text-fuchsia-700", title: t("landing.step3Title"), body: t("landing.step3Body") },
  ];

  return (
    <div className="min-h-dvh">
      <div className="bg-hero relative overflow-hidden rounded-b-[2.5rem] text-white shadow-xl shadow-primary/20">
        <header className="container flex h-16 items-center justify-between gap-2">
          <Brand light />
          <div className="flex items-center gap-1 [&_button]:text-white [&_button:hover]:bg-white/15">
            <LanguageToggle signedIn={Boolean(profile)} />
            {home ? null : (
              <Button asChild variant="ghost" size="sm" className="border border-white/40 text-white hover:bg-white/15 hover:text-white">
                <Link href="/login">{t("auth.signIn")}</Link>
              </Button>
            )}
          </div>
        </header>

        <section className="container grid max-w-5xl items-center gap-4 pb-10 pt-4 md:grid-cols-2 md:gap-10 md:pb-16 md:pt-10">
          <div className="text-center md:order-2">
            <CityScene id="hero-scene" className="mx-auto max-w-[17rem] sm:max-w-sm md:max-w-md" />
          </div>
          <div className="text-center md:order-1 md:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t("landing.headline")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg md:mx-0">{t("landing.body")}</p>

            <div className="mx-auto mt-8 max-w-xl md:mx-0">
              {home ? (
                <Button asChild size="lg" className="h-14 rounded-2xl bg-white px-8 text-base text-primary hover:bg-violet-50">
                  <Link href={home}>
                    {t("landing.getStarted")} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : showDemo ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{t("landing.tryIt")}</p>
                  <DemoSignIn hero />
                  <Link href="/login?mode=signup" className="inline-block pt-1 text-sm font-semibold text-white underline-offset-4 hover:underline">
                    {t("auth.signUpCta")} →
                  </Link>
                </div>
              ) : (
                <Button asChild size="lg" className="h-14 rounded-2xl bg-white px-8 text-base text-primary hover:bg-violet-50">
                  <Link href="/login?mode=signup">
                    {t("landing.getStarted")} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <main className="container max-w-3xl pb-16 pt-10">
        <section aria-labelledby="how-heading" className="space-y-4">
          <h2 id="how-heading" className="text-center text-xl font-bold">
            {t("landing.howTitle")}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="relative rounded-3xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-primary/20">{i + 1}</span>
                <span className={`mb-3 flex size-12 items-center justify-center rounded-2xl ${step.tone}`}>
                  <step.icon className="size-6" aria-hidden />
                </span>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 rounded-3xl border bg-card p-5 text-sm shadow-soft">
          <h2 className="flex items-center gap-2 font-bold">
            <CircleSlash className="size-4 text-rose-600" aria-hidden /> {t("landing.f2Title")}
          </h2>
          <blockquote className="mt-3 rounded-xl border-l-4 border-rose-400 bg-rose-50 p-3 text-rose-900">
            Garbage Collection Alert. Your regular Monday collection is affected by a municipal holiday. No verified alternative
            collection schedule has been published yet. We will notify you when verified information becomes available.
          </blockquote>
          <p className="mt-3 text-xs text-muted-foreground">{t("app.principle")}</p>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CivicAI Mysuru — research prototype. Ward boundaries and notices in this demo are illustrative.
      </footer>
    </div>
  );
}
