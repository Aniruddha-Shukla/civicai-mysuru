"use client";

import { CalendarClock, CalendarX, Check, Clock, Info, Languages, Lightbulb, LoaderCircle, Quote, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TemplateKey } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";

const KIND: Record<TemplateKey, { Icon: typeof Info; tone: string; dot: string; band: string; meaning: string }> = {
  verified_alternative: {
    Icon: CalendarClock,
    tone: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    band: "from-amber-400 to-orange-500",
    meaning: "border-amber-200 bg-amber-50 text-amber-950",
  },
  no_alternative_published: {
    Icon: CalendarX,
    tone: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    band: "from-rose-500 to-red-600",
    meaning: "border-rose-200 bg-rose-50 text-rose-950",
  },
  retraction: { Icon: Undo2, tone: "bg-slate-200 text-slate-700", dot: "bg-slate-400", band: "from-slate-400 to-slate-500", meaning: "border-slate-200 bg-slate-50 text-slate-900" },
  update: { Icon: Info, tone: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", band: "from-emerald-500 to-teal-500", meaning: "border-emerald-200 bg-emerald-50 text-emerald-950" },
};

export function NotificationCard(props: {
  id: string;
  templateKey: TemplateKey;
  message: string;
  translatedMessage: string | null;
  unread: boolean;
  sentAtLabel: string;
  forDateLabel: string;
  aiAvailable: boolean;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [translation, setTranslation] = useState(props.translatedMessage);
  const [showTranslation, setShowTranslation] = useState(lang === "kn" && Boolean(props.translatedMessage));
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function markRead() {
    startTransition(async () => {
      const res = await fetch(`/api/notifications/${props.id}/read`, { method: "POST" });
      if (!res.ok) toast.error(t("common.requestFailed"));
      router.refresh();
    });
  }

  function translate() {
    startTransition(async () => {
      const res = await fetch(`/api/notifications/${props.id}/translate`, { method: "POST" });
      if (!res.ok) {
        toast.error(t("common.requestFailed"));
        return;
      }
      const body = (await res.json()) as { status: string; text: string };
      if (body.status === "ok") {
        setTranslation(body.text);
        setShowTranslation(true);
        setNotice(null);
      } else if (body.status === "rejected") {
        setNotice(t("notifications.translationRejected"));
      } else {
        setNotice(t("ai.unavailable"));
      }
    });
  }

  const showingTranslation = showTranslation && translation;
  const kind = KIND[props.templateKey] ?? KIND.update;

  return (
    <div className="relative">
      {/* timeline dot */}
      <span
        className={cn("absolute -left-[1.4rem] top-6 size-3 rounded-full ring-4 ring-background", kind.dot, props.unread && "motion-safe:animate-pulse")}
        aria-hidden
      />
      <Card className={cn("overflow-hidden transition-transform duration-300 hover:-translate-y-0.5", props.unread && "ring-2 ring-lime-300/70")}>
        <div className={cn("h-1.5 bg-gradient-to-r", kind.band)} aria-hidden />
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", kind.tone)}>
              <kind.Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold leading-snug">{t(`notifications.kind.${props.templateKey}`)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-secondary-foreground">
                  {t("notifications.forCollectionOn", { date: props.forDateLabel })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                  <Clock className="size-3" aria-hidden />
                  <time>{props.sentAtLabel}</time>
                </span>
              </div>
            </div>
            {props.unread ? (
              <span className="shrink-0 rounded-full bg-lime-300 px-2.5 py-1 text-xs font-bold text-emerald-950 shadow-sm">{t("notifications.new")}</span>
            ) : null}
          </div>

          {/* plain-language meaning first */}
          <div className={cn("flex gap-2.5 rounded-2xl border p-3", kind.meaning)}>
            <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">{t("notifications.meaningTitle")}</p>
              <p className="mt-0.5 font-semibold leading-snug">{t(`notifications.meaning.${props.templateKey}`)}</p>
            </div>
          </div>

          {/* then the official text, word for word */}
          <figure className="rounded-2xl bg-muted/60 p-3">
            <figcaption className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Quote className="size-3.5" aria-hidden />
              {t("notifications.official")}
            </figcaption>
            {showingTranslation ? (
              <div className="space-y-1">
                <p lang="kn" className="leading-relaxed">
                  {translation}
                </p>
                <p className="text-xs text-muted-foreground">{t("notifications.aiTranslated")}</p>
              </div>
            ) : (
              <p lang="en" className="leading-relaxed">
                {props.message}
              </p>
            )}
          </figure>

          {notice ? <p className="rounded-md bg-unavailable-soft p-2 text-xs text-unavailable-foreground">{notice}</p> : null}
          <div className="flex flex-wrap gap-2">
            {translation ? (
              <Button size="sm" variant="ghost" onClick={() => setShowTranslation((v) => !v)}>
                <Languages aria-hidden />
                {showingTranslation ? t("notifications.showOriginal") : t("notifications.showTranslation")}
              </Button>
            ) : lang === "kn" && props.aiAvailable ? (
              <Button size="sm" variant="ghost" onClick={translate} disabled={pending}>
                {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Languages aria-hidden />}
                {t("notifications.translate")}
              </Button>
            ) : null}
            {props.unread ? (
              <Button size="sm" variant="outline" onClick={markRead} disabled={pending}>
                <Check aria-hidden />
                {t("notifications.markRead")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MarkAllReadButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      className="bg-lime-300 text-emerald-950 shadow-lg shadow-lime-300/20 hover:bg-lime-200"
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/notifications/read-all", { method: "POST" });
          router.refresh();
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      {label}
    </Button>
  );
}
