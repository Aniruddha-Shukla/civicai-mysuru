import { ArrowDown, ArrowRight, BellRing, CalendarCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DemoSignIn } from "@/components/auth-card";
import { Brand } from "@/components/brand";
import { CityScene } from "@/components/city-scene";
import { AlertPreview, type PreviewState } from "@/components/landing/alert-preview";
import { LanguageToggle } from "@/components/language-toggle";
import { Marquee } from "@/components/motion/marquee";
import { SplitWords } from "@/components/motion/split-words";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo/accounts";
import { formatDayFor, getT, type Lang, type TFunction } from "@/lib/i18n";
import { renderNoAlternative, renderVerifiedAlternative } from "@/lib/notifications/templates";
import { currentLang } from "@/lib/session-lang";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { addDaysToKey, formatTime12h, istDateKey, istMidnight, istWeekday } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Example situations for the phone preview. Alert text comes from the real templates, word for word. */
function previewStates(lang: Lang, t: TFunction, now: Date): PreviewState[] {
  const today = istDateKey(now);
  const toMonday = (1 - istWeekday(now) + 7) % 7 || 7;
  const monday = istMidnight(addDaysToKey(today, toMonday));
  const wednesday = istMidnight(addDaysToKey(today, toMonday + 2));
  const event = { affectedDate: monday, reason: "a municipal holiday", service: { name: "Garbage Collection" } };
  const time = formatTime12h("07:00");

  return [
    { key: "normal", label: t("landing.previewNormal"), pill: t("home.onSchedule"), title: formatDayFor(lang, monday), sub: `${time} · ${t("home.keepReady", { time })}` },
    {
      key: "moved",
      label: t("landing.previewMoved"),
      pill: t("home.pickupMoved"),
      struck: formatDayFor(lang, monday),
      title: formatDayFor(lang, wednesday),
      sub: `${time} · ${t("event.trust.VERIFIED")}`,
      message: renderVerifiedAlternative(event, { alternativeDate: wednesday, alternativeTime: "07:00" }),
    },
    {
      key: "none",
      label: t("landing.previewNone"),
      pill: t("home.noPickup"),
      struck: formatDayFor(lang, monday),
      title: t("home.noPickup"),
      sub: t("home.noNewDate"),
      message: renderNoAlternative(event),
    },
  ];
}

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

  const primaryCta = (href: string) => (
    <Button
      asChild
      size="lg"
      data-magnetic
      className="group h-14 rounded-2xl bg-white px-8 text-base text-primary shadow-lg shadow-black/10 hover:bg-violet-50"
    >
      <Link href={href}>
        {t("landing.getStarted")} <ArrowRight className="transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </Button>
  );

  return (
    <div className="min-h-dvh">
      <div className="bg-hero grain relative overflow-hidden rounded-b-[2.5rem] text-white shadow-xl shadow-primary/20">
        {/* slow drifting colour blobs behind the hero */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-24 top-10 size-80 rounded-full bg-fuchsia-400/30 blur-3xl motion-safe:animate-aurora" />
          <div className="absolute -right-20 bottom-0 size-96 rounded-full bg-indigo-300/25 blur-3xl motion-safe:animate-aurora [animation-delay:-9s]" />
        </div>

        <header className="container relative flex h-16 items-center justify-between gap-2">
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

        <section className="container relative grid max-w-5xl items-center gap-4 pb-10 pt-4 md:grid-cols-2 md:gap-10 md:pb-14 md:pt-10">
          <div className="text-center md:order-2" data-parallax>
            <CityScene id="hero-scene" className="mx-auto max-w-[17rem] sm:max-w-sm md:max-w-md" />
          </div>
          <div className="text-center md:order-1 md:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              <SplitWords text={t("landing.headline")} />
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/85 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both delay-500 duration-700 sm:text-lg md:mx-0">
              {t("landing.body")}
            </p>

            <div className="mx-auto mt-8 max-w-xl animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both delay-700 duration-700 md:mx-0">
              {home ? (
                primaryCta(home)
              ) : showDemo ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{t("landing.tryIt")}</p>
                  <DemoSignIn hero />
                  <Link
                    href="/login?mode=signup"
                    className="group inline-flex items-center gap-1 pt-1 text-sm font-semibold text-white underline-offset-4 hover:underline"
                  >
                    {t("auth.signUpCta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </div>
              ) : (
                primaryCta("/login?mode=signup")
              )}
            </div>
          </div>
        </section>

        <a
          href="#how-heading"
          className="relative mx-auto mb-6 hidden w-fit items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 md:flex"
        >
          {t("landing.scroll")} <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden />
        </a>
      </div>

      <div className="mt-8">
        <Marquee items={[t("landing.m1"), t("landing.m2"), t("landing.m3"), t("landing.m4"), t("landing.m5")]} />
      </div>

      <main className="container max-w-4xl space-y-16 pb-16 pt-12">
        <section aria-labelledby="how-heading" className="space-y-6">
          <h2 id="how-heading" data-reveal className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("landing.howTitle")}
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                data-spotlight
                style={{ "--i": i } as React.CSSProperties}
                className="spotlight group relative rounded-3xl border bg-card p-6 shadow-soft"
              >
                <span className="absolute right-5 top-4 text-4xl font-extrabold text-primary/15 transition-colors group-hover:text-primary/30">
                  {i + 1}
                </span>
                <span
                  className={`mb-4 flex size-12 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 ${step.tone}`}
                >
                  <step.icon className="size-6" aria-hidden />
                </span>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="preview-heading" className="space-y-6">
          <div data-reveal className="text-center">
            <h2 id="preview-heading" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("landing.previewTitle")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("landing.previewBody")}</p>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <AlertPreview states={previewStates(lang, t, new Date())} example={t("landing.previewExample")} appName={t("app.name")} />
          </div>
          <p data-reveal className="text-center text-xs text-muted-foreground">
            {t("app.principle")}
          </p>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CivicAI Mysuru — research prototype. Ward boundaries and notices in this demo are illustrative.
      </footer>
    </div>
  );
}
