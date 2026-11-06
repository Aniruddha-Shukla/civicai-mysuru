import { CalendarClock, CalendarX, ChevronDown, CircleQuestionMark, ExternalLink, FileText, Info, MapPin, ShieldCheck } from "lucide-react";
import { VerificationBadge } from "@/components/verification-badge";
import { Card } from "@/components/ui/card";
import { formatDateFor, formatDateTimeFor, formatDayFor, getT, type Lang } from "@/lib/i18n";
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
  id?: string;
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

/** Three first-class treatments for "what happens instead" (paper §6.2). */
const TONE: Record<VerificationStatus, { box: string; icon: string; Icon: typeof CalendarClock }> = {
  VERIFIED: { box: "border-verified/30 bg-verified-soft text-verified-foreground", icon: "bg-verified text-white", Icon: CalendarClock },
  UNVERIFIED: { box: "border-dashed border-unverified/60 bg-unverified-soft text-unverified-foreground", icon: "bg-unverified text-white", Icon: CircleQuestionMark },
  UNAVAILABLE: { box: "border-unavailable/30 bg-unavailable-soft text-unavailable-foreground", icon: "bg-destructive text-white", Icon: CalendarX },
};

export function EventCard(props: EventCardProps) {
  const lang = props.lang ?? "en";
  const t = getT(lang);
  const alt = props.alternative;
  const tone = TONE[alt.status];
  const arrangement = alt.arrangement && alt.status !== "UNAVAILABLE" ? alt.arrangement : null;

  return (
    <Card id={props.id} className={cn("scroll-mt-28 overflow-hidden", props.className)}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm", tone.icon)}>
          <tone.Icon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{props.serviceName}</span>
            <VerificationBadge status={props.verificationStatus} lang={lang} audience="citizen" />
          </div>
          <h3 className="mt-1 text-lg font-bold leading-snug">{t("event.noPickupOn", { date: formatDayFor(lang, props.affectedDate) })}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("event.why")} {props.reason}
          </p>
        </div>
      </div>

      <div className={cn("mx-4 mb-4 rounded-xl border p-4 sm:mx-5", tone.box)}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">{t("event.alternative")}</span>
          <VerificationBadge status={alt.status} lang={lang} audience="citizen" />
        </div>
        {lang === "kn" ? <p className="text-lg font-bold">{statusLineKn(alt.status, alt.arrangement)}</p> : null}
        <p className={cn(lang === "kn" ? "text-xs" : "text-lg font-bold")} lang="en">
          {statusLine(alt.status, alt.arrangement)}
        </p>
        {alt.status === "UNAVAILABLE" ? <p className="mt-1 text-sm">{lang === "kn" ? FALLBACK_INSTRUCTION_KN : FALLBACK_INSTRUCTION}</p> : null}
        {alt.status === "UNVERIFIED" ? <p className="mt-1 text-sm">{t("event.unverifiedNote")}</p> : null}
        {arrangement ? (
          <div className="mt-3 grid gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              {formatDateFor(lang, arrangement.alternativeDate)} · {formatTime12h(arrangement.alternativeTime)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {arrangement.affectedArea}
            </span>
          </div>
        ) : null}
      </div>

      {props.hasConflict ? (
        <p className="mx-4 mb-4 flex gap-2 rounded-md bg-unverified-soft p-2 text-xs text-unverified-foreground sm:mx-5">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("event.conflict")}
        </p>
      ) : null}

      <details className="group border-t bg-muted/30 px-4 py-3 text-sm sm:px-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-primary [&::-webkit-details-marker]:hidden">
          <ShieldCheck className="size-4" aria-hidden />
          {t("event.howDoWeKnow")}
          <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
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
            <dd>{props.lastVerifiedAt ? `${t("event.lastVerified")}: ${formatDateTimeFor(lang, props.lastVerifiedAt)}` : t("event.notYetVerified")}</dd>
          </div>
          {arrangement ? (
            <div className="flex gap-1.5">
              <FileText className="size-3.5 shrink-0" aria-hidden />
              <dd>
                {t("event.alternative")} · {t("event.source")}: {arrangement.source} ·{" "}
                {arrangement.lastVerifiedAt ? `${t("event.lastVerified")} ${formatDateTimeFor(lang, arrangement.lastVerifiedAt)}` : t("event.notYetVerified")}
              </dd>
            </div>
          ) : null}
        </dl>
      </details>
      {props.footer ? <div className="border-t p-4 sm:px-5">{props.footer}</div> : null}
    </Card>
  );
}
