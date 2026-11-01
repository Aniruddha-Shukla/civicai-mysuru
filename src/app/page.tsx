import { ArrowRight, BellRing, CircleSlash, FileText, Languages, Landmark, MessageCircleQuestionMark, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { currentLang } from "@/lib/session-lang";

export const dynamic = "force-dynamic";

const FLOW = [
  { icon: Landmark, label: "Normal schedule + disruption" },
  { icon: FileText, label: "Municipal decision" },
  { icon: ShieldCheck, label: "Operator verification" },
  { icon: BellRing, label: "Citizen notification" },
];

export default async function LandingPage() {
  const lang = await currentLang();
  const t = getT(lang);
  const profile = await getSessionProfile().catch(() => null);
  const home = profile ? (profile.role === "OPERATOR" ? "/operator" : "/dashboard") : null;

  const features = [
    { icon: ShieldCheck, title: t("landing.f1Title"), body: t("landing.f1Body") },
    { icon: CircleSlash, title: t("landing.f2Title"), body: t("landing.f2Body") },
    { icon: Languages, title: t("landing.f3Title"), body: t("landing.f3Body") },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-secondary/70 via-background to-background">
      <header className="container flex h-14 items-center justify-between gap-2">
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

      <main className="container pb-16">
        <section className="mx-auto max-w-3xl py-10 text-center sm:py-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Smartphone className="size-3.5" aria-hidden /> Mysuru City Corporation · citizen communication layer
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t("landing.headline")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("landing.body")}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={home ?? "/login?mode=signup"}>
                {t("landing.getStarted")} <ArrowRight aria-hidden />
              </Link>
            </Button>
            {home ? null : (
              <Button asChild size="lg" variant="outline">
                <Link href="/login?next=/operator">{t("landing.operatorLogin")}</Link>
              </Button>
            )}
          </div>
        </section>

        <Card className="mx-auto max-w-3xl border-primary/20 bg-card/80">
          <CardContent className="p-5 sm:p-6">
            <p className="text-center text-sm font-medium text-primary">{t("app.principle")}</p>
            <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FLOW.map((step, i) => (
                <li key={step.label} className="flex flex-col items-center gap-2 rounded-md bg-secondary/60 p-3 text-center text-xs">
                  <step.icon className="size-5 text-primary" aria-hidden />
                  <span>
                    <span className="font-semibold">{i + 1}.</span> {step.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-center text-xs text-muted-foreground">{t("landing.loop")}</p>
          </CardContent>
        </Card>

        <section className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-5">
                <f.icon className="mb-3 size-6 text-primary" aria-hidden />
                <h2 className="font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-3xl rounded-lg border bg-card p-5 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageCircleQuestionMark className="size-4 text-primary" aria-hidden /> What a citizen sees when nothing is published
          </h2>
          <blockquote className="mt-3 rounded-md border-l-4 border-unavailable bg-unavailable-soft p-3 text-unavailable-foreground">
            Garbage Collection Alert. Your regular Monday collection is affected by a municipal holiday. No verified alternative
            collection schedule has been published yet. We will notify you when verified information becomes available.
          </blockquote>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CivicAI Mysuru — research prototype. Ward boundaries and notices in this demo are illustrative.
      </footer>
    </div>
  );
}
