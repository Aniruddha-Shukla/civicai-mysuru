/**
 * Deterministic notification templates — wording taken verbatim from the
 * research paper (§5, §6.2, §8, §12).
 *
 * Every string here is assembled ONLY from fields already present on a
 * verified CivicEvent / AlternativeArrangement record. No LLM is ever called
 * to produce these messages; the AI layer may only translate/rephrase an
 * already-rendered string, behind the hallucination firewall (lib/ai/guard.ts).
 */
import { formatTime12h, formatTimeShort, istWeekday, weekdayName } from "@/lib/time";

export const TEMPLATE_KEYS = [
  "verified_alternative",
  "no_alternative_published",
  "retraction",
  "update",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** §5 — used wherever the UI must state the "no alternative" condition outside a push message. */
export const FALLBACK_INSTRUCTION =
  "The normal collection schedule is affected. No verified alternative arrangement is currently available.";

export interface RenderableEvent {
  affectedDate: Date;
  reason: string;
  service: { name: string };
}

export interface RenderableArrangement {
  alternativeDate: Date;
  alternativeTime: string;
}

/** Reasons are written to complete "affected by …"; tolerate a trailing full stop. */
function cleanReason(reason: string): string {
  return reason.trim().replace(/[.\s]+$/, "");
}

/** Case A (§12): a verified alternative exists. */
export function renderVerifiedAlternative(
  event: RenderableEvent,
  alternative: RenderableArrangement,
): string {
  return (
    `${event.service.name} Update. ` +
    `Your regular ${weekdayName(event.affectedDate)} collection is affected by ${cleanReason(event.reason)}. ` +
    `Alternative collection: ${weekdayName(alternative.alternativeDate)}, ${formatTime12h(alternative.alternativeTime)}. ` +
    `Source: Verified municipal notice. ` +
    `Please keep your waste ready according to the updated schedule.`
  );
}

/** Case B (§12): no alternative has been published. */
export function renderNoAlternative(event: RenderableEvent): string {
  return (
    `${event.service.name} Alert. ` +
    `Your regular ${weekdayName(event.affectedDate)} collection is affected by ${cleanReason(event.reason)}. ` +
    `No verified alternative collection schedule has been published yet. ` +
    `We will notify you when verified information becomes available.`
  );
}

/**
 * Retraction — sent to every citizen who already received an alert for a notice
 * that an operator has since withdrawn. It asserts nothing new about the schedule.
 */
export function renderRetraction(event: RenderableEvent): string {
  return (
    `${event.service.name} Notice Withdrawn. ` +
    `The earlier alert about your regular ${weekdayName(event.affectedDate)} collection (${cleanReason(event.reason)}) ` +
    `has been withdrawn by the municipal operator. Please disregard that alert. ` +
    `Your normal schedule is shown in the app, and we will notify you if new verified information is published.`
  );
}

export function render(
  key: "verified_alternative",
  event: RenderableEvent,
  alternative: RenderableArrangement,
): { templateKey: TemplateKey; message: string };
export function render(
  key: "no_alternative_published" | "retraction",
  event: RenderableEvent,
): { templateKey: TemplateKey; message: string };
export function render(
  key: "verified_alternative" | "no_alternative_published" | "retraction",
  event: RenderableEvent,
  alternative?: RenderableArrangement,
): { templateKey: TemplateKey; message: string } {
  switch (key) {
    case "verified_alternative":
      if (!alternative) throw new Error("verified_alternative requires an arrangement");
      return { templateKey: key, message: renderVerifiedAlternative(event, alternative) };
    case "no_alternative_published":
      return { templateKey: key, message: renderNoAlternative(event) };
    case "retraction":
      return { templateKey: key, message: renderRetraction(event) };
  }
}

/**
 * §6.2 verification-status example wording, rendered literally on every
 * event/arrangement card:
 *   VERIFIED    → "Alternative collection: Wednesday 7 AM."
 *   UNVERIFIED  → "A possible alternative may be Wednesday."
 *   UNAVAILABLE → "No alternative arrangement has been officially published."
 */
export function statusLine(
  status: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE",
  alternative: RenderableArrangement | null,
): string {
  if (status === "VERIFIED" && alternative) {
    return `Alternative collection: ${weekdayName(alternative.alternativeDate)} ${formatTimeShort(alternative.alternativeTime)}.`;
  }
  if (status === "UNVERIFIED" && alternative) {
    return `A possible alternative may be ${weekdayName(alternative.alternativeDate)}.`;
  }
  return "No alternative arrangement has been officially published.";
}

const KN_WEEKDAYS = ["ಭಾನುವಾರ", "ಸೋಮವಾರ", "ಮಂಗಳವಾರ", "ಬುಧವಾರ", "ಗುರುವಾರ", "ಶುಕ್ರವಾರ", "ಶನಿವಾರ"] as const;

function knTime(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const period = h < 12 ? "ಬೆಳಿಗ್ಗೆ" : h < 16 ? "ಮಧ್ಯಾಹ್ನ" : h < 19 ? "ಸಂಜೆ" : "ರಾತ್ರಿ";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}`;
}

/**
 * Deterministic Kannada rendering of the §6.2 status line (a fixed template with
 * Kannada weekday names — no AI involved). The English line remains the official text.
 */
export function statusLineKn(
  status: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE",
  alternative: RenderableArrangement | null,
): string {
  const day = (d: Date) => KN_WEEKDAYS[istWeekday(d)]!;
  if (status === "VERIFIED" && alternative) {
    return `ಪರ್ಯಾಯ ಸಂಗ್ರಹಣೆ: ${day(alternative.alternativeDate)} ${knTime(alternative.alternativeTime)}.`;
  }
  if (status === "UNVERIFIED" && alternative) {
    return `ಸಂಭಾವ್ಯ ಪರ್ಯಾಯ ${day(alternative.alternativeDate)} ಆಗಿರಬಹುದು.`;
  }
  return "ಯಾವುದೇ ಪರ್ಯಾಯ ವ್ಯವಸ್ಥೆಯನ್ನು ಅಧಿಕೃತವಾಗಿ ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ.";
}

/** Kannada version of the §5 fallback instruction (fixed text). */
export const FALLBACK_INSTRUCTION_KN =
  "ಸಾಮಾನ್ಯ ಸಂಗ್ರಹಣೆ ವೇಳಾಪಟ್ಟಿಗೆ ತೊಂದರೆಯಾಗಿದೆ. ಸದ್ಯಕ್ಕೆ ಯಾವುದೇ ಪರಿಶೀಲಿತ ಪರ್ಯಾಯ ವ್ಯವಸ್ಥೆ ಲಭ್ಯವಿಲ್ಲ.";
