/**
 * Pure planning step of the notification pass: given an event, the citizens in
 * its ward and what each citizen has already been sent for it, decide which
 * notification rows to insert. No I/O — the cron job and the immediate
 * "on verify / on withdraw" pass both call this, and tests exercise it directly.
 */
import { createHash } from "node:crypto";
import { selectVerifiedAlternative, type EventStatus, type VerificationStatus } from "@/lib/verification";
import { buildNotification, type NotifiableCitizen } from "./engine";
import { render, type TemplateKey } from "./templates";

export interface DispatchArrangement {
  alternativeDate: Date;
  alternativeTime: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
  createdAt: Date;
}

export interface DispatchEvent {
  id: string;
  wardId: string;
  serviceId: string;
  status: EventStatus;
  verificationStatus: VerificationStatus;
  affectedDate: Date;
  reason: string;
  version: number;
  service: { name: string };
  arrangements: DispatchArrangement[];
}

export interface HistoryEntry {
  profileId: string;
  message: string;
  templateKey: string;
  contentHash: string;
  sentAt: Date;
}

export interface PlannedNotification {
  profileId: string;
  eventId: string;
  templateKey: TemplateKey;
  message: string;
  contentHash: string;
}

/** Dedup guard: sha256 of (citizenId + eventId + message). */
export function contentHash(citizenId: string, eventId: string, message: string, salt?: string): string {
  const hash = createHash("sha256");
  hash.update(`${citizenId}\u0000${eventId}\u0000${message}`);
  if (salt) hash.update(`\u0000${salt}`);
  return hash.digest("hex");
}

function groupHistory(history: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const byCitizen = new Map<string, HistoryEntry[]>();
  for (const entry of [...history].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())) {
    const list = byCitizen.get(entry.profileId) ?? [];
    list.push(entry);
    byCitizen.set(entry.profileId, list);
  }
  return byCitizen;
}

/**
 * Hash for a new row. Normally sha256(citizen, event, message). In the rare case
 * where the exact same message was sent earlier but has since been superseded
 * (e.g. alternative A → corrected to B → corrected back to A), the version is
 * mixed in so the citizen still receives the now-current information.
 */
function hashFor(citizenId: string, event: DispatchEvent, message: string, prior: HistoryEntry[]): string {
  const base = contentHash(citizenId, event.id, message);
  return prior.some((p) => p.contentHash === base) ? contentHash(citizenId, event.id, message, `v${event.version}`) : base;
}

export function planEventNotifications(input: {
  event: DispatchEvent;
  citizensInWard: NotifiableCitizen[];
  history: HistoryEntry[];
  /** True when a more recently verified conflicting notice exists for the same ward/service/date. */
  supersededByConflict?: boolean;
}): PlannedNotification[] {
  const { event } = input;
  const byCitizen = groupHistory(input.history);
  const planned: PlannedNotification[] = [];

  if (event.status === "WITHDRAWN") {
    // Retract to everyone who was told anything about this notice — even if they have
    // since moved ward — and never twice.
    const { message } = render("retraction", event);
    for (const [profileId, prior] of byCitizen) {
      if (prior.some((p) => p.templateKey === "retraction")) continue;
      planned.push({ profileId, eventId: event.id, templateKey: "retraction", message, contentHash: hashFor(profileId, event, message, prior) });
    }
    return planned;
  }

  if (event.status !== "ACTIVE" || input.supersededByConflict) return planned;

  const alternative = selectVerifiedAlternative(event.arrangements);
  for (const citizen of input.citizensInWard) {
    const built = buildNotification(citizen, event, alternative);
    if (!built) continue;
    const prior = byCitizen.get(citizen.id) ?? [];
    const latest = prior.at(-1);
    if (latest && latest.message === built.message) continue; // nothing new to tell this citizen
    planned.push({
      profileId: citizen.id,
      eventId: event.id,
      // A changed message for a citizen who already heard about this event is a follow-up update
      // (e.g. "no alternative yet" → verified alternative published). The wording stays verbatim.
      templateKey: latest ? "update" : built.templateKey,
      message: built.message,
      contentHash: hashFor(citizen.id, event, built.message, prior),
    });
  }
  return planned;
}
