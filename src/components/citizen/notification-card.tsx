"use client";

import { Check, Languages, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TemplateKey } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";

const TEMPLATE_VARIANT: Record<TemplateKey, "verified" | "unavailable" | "destructive" | "secondary"> = {
  verified_alternative: "verified",
  no_alternative_published: "unavailable",
  retraction: "destructive",
  update: "secondary",
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

  return (
    <Card className={cn(props.unread && "border-primary/40 shadow-md")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={TEMPLATE_VARIANT[props.templateKey] ?? "secondary"}>{t(`notifications.templates.${props.templateKey}`)}</Badge>
            {props.unread ? <Badge>{t("notifications.new")}</Badge> : null}
          </div>
          <time className="text-xs text-muted-foreground">{props.sentAtLabel}</time>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{t("notifications.forCollectionOn", { date: props.forDateLabel })}</p>
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
