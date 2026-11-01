import { CalendarClock, CalendarX, ExternalLink, FileText, Info, MapPin } from "lucide-react";
import { VerificationBadge } from "@/components/verification-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { EventType } from "@/lib/constants";
import { formatDateFor, formatDateTimeFor, getT, type Lang } from "@/lib/i18n";
import { FALLBACK_INSTRUCTION, FALLBACK_INSTRUCTION_KN, statusLine, statusLineKn } from "@/lib/notifications/templates";
import { formatTime12h } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/verification";

export interface ArrangementView {
  alternativeDate: Date;
  alternativeTime: string;
  affectedArea: string;
  /** Required: source transparency (§14). */
  source: string;
  verificationStatus: VerificationStatus;
  /** Required key; null renders "Not yet verified". */
  lastVerifiedAt: Date | null;
}

export interface EventCardProps {
  serviceName: string;
  eventType: string;
  affectedDate: Date;
  reason: string;
  /** Required: a card cannot render without its source (§14 source transparency). */
  source: string;
  sourceUrl: string | null;
  /** Required: the verification state is always shown. */
  verificationStatus: VerificationStatus;
  /** Required key; null renders "Not yet verified". */
  lastVerifiedAt: Date | null;
  alternative: { status: VerificationStatus; arrangement: ArrangementView | null };
  hasConflict?: boolean;
  lang?: Lang;
  footer?: React.ReactNode;
  className?: string;
}

const ALT_STYLES: Record<VerificationStatus, string> = {
  VERIFIED: "border-verified/30 bg-verified-soft text-verified-foreground",
  UNVERIFIED: "border-dashed border-unverified/50 bg-unverified-soft text-unverified-foreground",
  UNAVAILABLE: "border-unavailable/30 bg-unavailable-soft text-unavailable-foreground",
};

export function EventCard(props: EventCardProps) {
  const lang = props.lang ?? "en";
  const t = getT(lang);
  const alt = props.alternative;
  const officialLine = statusLine(alt.status, alt.arrangement);

  return (
    <Card className={cn("overflow-hidden", props.className)}>
      <div className={cn("h-1.5", props.verificationStatus === "VERIFIED" ? "bg-verified" : props.verificationStatus === "UNVERIFIED" ? "bg-unverified" : "bg-unavailable")} />
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {props.serviceName} · {t(`event.types.${props.eventType as EventType}`) || props.eventType}
          </p>
          <VerificationBadge status={props.verificationStatus} lang={lang} />
        </div>
        <h3 className="flex items-start gap-2 text-lg font-semibold leading-snug">
          <CalendarX className="mt-1 size-5 shrink-0 text-destructive" aria-hidden />
          <span>
            {formatDateFor(lang, props.affectedDate)}
            <span className="block text-sm font-normal text-muted-foreground">
              {t("event.reason")}: {props.reason}
            </span>
          </span>
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.hasConflict ? (
          <p className="flex gap-2 rounded-md bg-unverified-soft p-2 text-xs text-unverified-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("event.conflict")}
          </p>
        ) : null}

        <div className={cn("rounded-md border p-3", ALT_STYLES[alt.status])}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">{t("event.alternative")}</span>
            <VerificationBadge status={alt.status} lang={lang} />
          </div>
          {lang === "kn" ? <p className="text-base font-semibold">{statusLineKn(alt.status, alt.arrangement)}</p> : null}
          <p className={cn(lang === "kn" ? "text-xs" : "text-base font-semibold")} lang="en">
            {officialLine}
          </p>
          {alt.status === "UNAVAILABLE" ? (
            <p className="mt-1 text-sm">{lang === "kn" ? FALLBACK_INSTRUCTION_KN : FALLBACK_INSTRUCTION}</p>
          ) : null}
          {alt.status === "UNVERIFIED" ? <p className="mt-1 text-sm">{t("event.unverifiedNote")}</p> : null}
          {alt.arrangement && alt.status !== "UNAVAILABLE" ? (
            <dl className="mt-2 grid gap-1 text-xs">
              <div className="flex gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                <dd>
                  {formatDateFor(lang, alt.arrangement.alternativeDate)}, {formatTime12h(alt.arrangement.alternativeTime)}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <dd>
                  {t("event.area")}: {alt.arrangement.affectedArea}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                <dd>
                  {t("event.source")}: {alt.arrangement.source} ·{" "}
                  {alt.arrangement.lastVerifiedAt
                    ? `${t("event.lastVerified")} ${formatDateTimeFor(lang, alt.arrangement.lastVerifiedAt)}`
                    : t("event.notYetVerified")}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <dl className="grid gap-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <dd>
              {t("event.source")}: <span className="text-foreground">{props.source}</span>
              {props.sourceUrl ? (
                <a href={props.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline">
                  {t("event.viewSource")}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            <dd>
              {props.lastVerifiedAt ? `${t("event.lastVerified")}: ${formatDateTimeFor(lang, props.lastVerifiedAt)}` : t("event.notYetVerified")}
            </dd>
          </div>
        </dl>
        {props.footer}
      </CardContent>
    </Card>
  );
}
