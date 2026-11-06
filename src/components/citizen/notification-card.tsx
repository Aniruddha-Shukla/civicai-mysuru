"use client";

import { CalendarClock, CalendarX, Check, Info, Languages, LoaderCircle, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TemplateKey } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";

const KIND: Record<TemplateKey, { Icon: typeof Info; tone: string; edge: string }> = {
  verified_alternative: { Icon: CalendarClock, tone: "bg-emerald-100 text-emerald-700", edge: "border-l-emerald-500" },
  no_alternative_published: { Icon: CalendarX, tone: "bg-rose-100 text-rose-700", edge: "border-l-rose-500" },
  retraction: { Icon: Undo2, tone: "bg-slate-200 text-slate-700", edge: "border-l-slate-400" },
  update: { Icon: Info, tone: "bg-sky-100 text-sky-700", edge: "border-l-sky-500" },
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
    <Card className={cn("border-l-4", (KIND[props.templateKey] ?? KIND.update).edge, props.unread && "shadow-md")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", kind.tone)}>
            <kind.Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-snug">{t(`notifications.kind.${props.templateKey}`)}</p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.forCollectionOn", { date: props.forDateLabel })} · <time>{props.sentAtLabel}</time>
            </p>
          </div>
          {props.unread ? <Badge className="shrink-0">{t("notifications.new")}</Badge> : null}
        </div>
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
  );
}

export function MarkAllReadButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
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
