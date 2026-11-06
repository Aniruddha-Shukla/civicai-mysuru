import { ArrowRight, BellRing, CalendarCheck, CircleSlash, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DemoSignIn } from "@/components/auth-card";
import { Brand } from "@/components/brand";
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
    { icon: ShieldCheck, tone: "bg-emerald-100 text-emerald-700", title: t("landing.step1Title"), body: t("landing.step1Body") },
    { icon: BellRing, tone: "bg-sky-100 text-sky-700", title: t("landing.step2Title"), body: t("landing.step2Body") },
    { icon: CalendarCheck, tone: "bg-amber-100 text-amber-700", title: t("landing.step3Title"), body: t("landing.step3Body") },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-secondary via-background to-background">
      <header className="container flex h-16 items-center justify-between gap-2">
        <Brand />
        <div className="flex items-center gap-1">
          <LanguageToggle signedIn={Boolean(profile)} />
          {home ? null : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">{t("auth.signIn")}</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-3xl pb-16">
        <section className="py-8 text-center sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{t("landing.headline")}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">{t("landing.body")}</p>

          <div className="mx-auto mt-8 max-w-xl">
            {home ? (
              <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base">
                <Link href={home}>
                  {t("landing.getStarted")} <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : showDemo ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("landing.tryIt")}</p>
                <DemoSignIn hero />
                <Link href="/login?mode=signup" className="inline-block pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {t("auth.signUpCta")} →
                </Link>
              </div>
            ) : (
              <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base">
                <Link href="/login?mode=signup">
                  {t("landing.getStarted")} <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="space-y-4">
          <h2 id="how-heading" className="text-center text-xl font-bold">
            {t("landing.howTitle")}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-5 shadow-sm">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-muted-foreground/25">{i + 1}</span>
                <span className={`mb-3 flex size-12 items-center justify-center rounded-2xl ${step.tone}`}>
                  <step.icon className="size-6" aria-hidden />
                </span>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 rounded-2xl border bg-card p-5 text-sm shadow-sm">
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
