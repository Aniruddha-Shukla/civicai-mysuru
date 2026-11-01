import "server-only";
import type { AnswerRecord } from "@/lib/ai/answer";
import { selectCitizenFacingEvents } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { buildNotification } from "@/lib/notifications/engine";
import { renderNoAlternative } from "@/lib/notifications/templates";
import { upcomingCollectionDays } from "@/lib/schedule";
import { formatIstDate, formatIstDateTime, formatTime12h, istDateKey, istMidnight, WEEKDAY_NAMES } from "@/lib/time";
import { deriveAlternativeStatus, selectVerifiedAlternative } from "@/lib/verification";

const FREQUENCY_LABEL = { DAILY: "daily", TWICE_WEEKLY: "twice a week", WEEKLY: "weekly" } as const;

/**
 * Everything a citizen is allowed to see for their ward: the normal schedule and the
 * CURRENT, VERIFIED notices (one per ward/service/day — most recently verified wins).
 * Unverified notices and expired/withdrawn ones are never returned here.
 */
export async function loadCitizenWardView(wardId: string, now = new Date()) {
  const ward = await prisma.ward.findUnique({
    where: { id: wardId },
    select: { id: true, name: true, zone: true, services: { orderBy: { name: "asc" } } },
  });
  if (!ward) return null;

  const events = await prisma.civicEvent.findMany({
    where: {
      wardId,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
    },
    include: {
      service: { select: { id: true, name: true } },
      arrangements: { where: { verificationStatus: { in: ["VERIFIED", "UNVERIFIED"] } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { affectedDate: "asc" },
    take: 50,
  });

  const current = selectCitizenFacingEvents(events, now).map((event) => ({
    ...event,
    alternative: deriveAlternativeStatus(event.arrangements),
  }));
  return { ward, services: ward.services, events: current };
}

export type CitizenWardView = NonNullable<Awaited<ReturnType<typeof loadCitizenWardView>>>;

export function describeService(service: { name: string; frequency: keyof typeof FREQUENCY_LABEL; normalWeekdays: number[]; normalTime: string }) {
  const days = service.normalWeekdays.map((d) => WEEKDAY_NAMES[d]).join(" and ");
  return `${service.name}: ${FREQUENCY_LABEL[service.frequency]}${service.frequency === "DAILY" ? "" : ` on ${days}`} at ${formatTime12h(service.normalTime)}`;
}

/**
 * Q&A grounding: verified rows only (unverified alternatives are excluded), plus a
 * fully deterministic summary used whenever the AI is unavailable or its answer is
 * rejected by the firewall.
 */
export function buildAnswerContext(view: CitizenWardView, citizen: { id: string; wardId: string }, now = new Date()) {
  const records: AnswerRecord[] = [];
  for (const service of view.services) {
    const upcoming = upcomingCollectionDays(now, service.normalWeekdays, 3).map(istMidnight);
    records.push({
      id: service.id,
      kind: "service",
      text:
        `Normal schedule in ${view.ward.name}: ${describeService(service)} (${service.normalTime}). ` +
        `Upcoming regular collection days: ${upcoming.map((d) => `${formatIstDate(d)} (${istDateKey(d)})`).join("; ")}. ` +
        `A verified disruption notice for a day overrides the normal schedule for that day.`,
      fields: [view.ward.name, service.name, service.normalTime, ...upcoming],
    });
  }
  for (const event of view.events) {
    const verifiedAlt = selectVerifiedAlternative(event.arrangements);
    records.push({
      id: event.id,
      kind: "notice",
      text:
        `VERIFIED disruption notice: ${event.service.name} on ${formatIstDate(event.affectedDate)} (${istDateKey(event.affectedDate)}) ` +
        `is affected by ${event.reason}. Source: ${event.source}` +
        (event.lastVerifiedAt ? ` (verified ${formatIstDateTime(event.lastVerifiedAt)}).` : ".") +
        (verifiedAlt ? " A verified alternative arrangement exists (see alternative record)." : ` ${renderNoAlternative(event)}`),
      fields: [event.affectedDate, event.reason, event.source, event.service.name],
    });
    if (verifiedAlt) {
      records.push({
        id: verifiedAlt.id,
        kind: "alternative",
        text:
          `VERIFIED alternative collection for the ${formatIstDate(event.affectedDate)} disruption: ` +
          `${formatIstDate(verifiedAlt.alternativeDate)} (${istDateKey(verifiedAlt.alternativeDate)}) at ${formatTime12h(verifiedAlt.alternativeTime)} ` +
          `(${verifiedAlt.alternativeTime}), area: ${verifiedAlt.affectedArea}. Source: ${verifiedAlt.source}.`,
        fields: [verifiedAlt.alternativeDate, verifiedAlt.alternativeTime, verifiedAlt.affectedArea, verifiedAlt.source, event.affectedDate],
      });
    }
  }

  const lines = [`Here is the verified information on record for ${view.ward.name}:`];
  for (const service of view.services) lines.push(`• Normal schedule — ${describeService(service)}.`);
  if (view.events.length === 0) lines.push("• There are no active disruption notices for your ward.");
  for (const event of view.events) {
    const built = buildNotification(citizen, event, selectVerifiedAlternative(event.arrangements));
    if (built) lines.push(`• ${formatIstDate(event.affectedDate)}: ${built.message}`);
  }
  return { records, deterministicSummary: lines.join("\n"), knownPlaces: [view.ward.name] };
}
