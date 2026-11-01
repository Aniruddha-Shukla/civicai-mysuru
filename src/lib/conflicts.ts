/**
 * Conflicting and duplicate notices.
 *
 *  - Duplicate ingestion of the same announcement (same service, IST day, ward and
 *    source) is rejected up-front via `eventDedupKey` (a UNIQUE column in the DB).
 *  - Two different notices for the same ward/service/day are NOT merged. Both stay
 *    ACTIVE and are flagged for operator review; until an operator resolves it,
 *    citizens are shown (and notified about) only the most recently verified one.
 */
import { createHash } from "node:crypto";
import { istDateKey } from "@/lib/time";
import type { EventStatus, VerificationStatus } from "@/lib/verification";

export interface ConflictCandidate {
  id: string;
  serviceId: string;
  wardId: string;
  affectedDate: Date;
  status: EventStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
  expiryDate?: Date | null;
}

export function normalizeSource(source: string): string {
  return source.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function eventDedupKey(input: { serviceId: string; wardId: string; affectedDate: Date; source: string }): string {
  return createHash("sha256")
    .update([input.serviceId, input.wardId, istDateKey(input.affectedDate), normalizeSource(input.source)].join("\u0000"))
    .digest("hex");
}

export function conflictKey(e: Pick<ConflictCandidate, "serviceId" | "wardId" | "affectedDate">): string {
  return `${e.serviceId}|${e.wardId}|${istDateKey(e.affectedDate)}`;
}

/** ACTIVE and not past its expiry — the only events ever shown as "current". */
export function isCurrent(e: Pick<ConflictCandidate, "status" | "expiryDate">, now: Date): boolean {
  return e.status === "ACTIVE" && (!e.expiryDate || e.expiryDate.getTime() > now.getTime());
}

const verifiedAt = (e: ConflictCandidate) => e.lastVerifiedAt?.getTime() ?? 0;

/** Groups of ≥2 current notices targeting the same ward/service/day — for operator review. */
export function findConflictGroups<T extends ConflictCandidate>(events: readonly T[], now: Date): T[][] {
  const groups = new Map<string, T[]>();
  for (const e of events) {
    if (!isCurrent(e, now)) continue;
    const key = conflictKey(e);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * What a citizen sees: current VERIFIED notices, one per ward/service/day —
 * the most recently verified wins, flagged when it has unresolved conflicts.
 */
export function selectCitizenFacingEvents<T extends ConflictCandidate>(
  events: readonly T[],
  now: Date,
): Array<T & { hasConflict: boolean }> {
  const groups = new Map<string, T[]>();
  for (const e of events) {
    if (!isCurrent(e, now) || e.verificationStatus !== "VERIFIED") continue;
    const key = conflictKey(e);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()]
    .map((group) => {
      const winner = [...group].sort((a, b) => verifiedAt(b) - verifiedAt(a))[0]!;
      return { ...winner, hasConflict: group.length > 1 };
    })
    .sort((a, b) => a.affectedDate.getTime() - b.affectedDate.getTime());
}

/** True when another current, VERIFIED notice for the same ward/service/day was verified later. */
export function isSupersededByConflict(event: ConflictCandidate, peers: readonly ConflictCandidate[], now: Date): boolean {
  const key = conflictKey(event);
  return peers.some(
    (p) =>
      p.id !== event.id &&
      conflictKey(p) === key &&
      isCurrent(p, now) &&
      p.verificationStatus === "VERIFIED" &&
      verifiedAt(p) > verifiedAt(event),
  );
}
