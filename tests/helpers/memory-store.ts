import type { ConflictCandidate } from "@/lib/conflicts";
import type { NotifiableCitizen } from "@/lib/notifications/engine";
import type { HistoryEntry, PlannedNotification } from "@/lib/notifications/plan";
import type { NotificationStore, StoredEvent } from "@/lib/notifications/sync";

export interface MemoryNotification extends PlannedNotification {
  id: string;
  sentAt: Date;
}

/** In-memory NotificationStore that enforces the same UNIQUE(contentHash) rule as Postgres. */
export class MemoryStore implements NotificationStore {
  events = new Map<string, StoredEvent & { expiryDate: Date | null }>();
  citizens: NotifiableCitizen[] = [];
  notifications: MemoryNotification[] = [];
  private seq = 0;
  private clock = 0;

  async expireEvents(now: Date, limit: number) {
    const due = [...this.events.values()].filter((e) => e.status === "ACTIVE" && e.expiryDate && e.expiryDate < now).slice(0, limit);
    for (const e of due) e.status = "EXPIRED";
    return due.map((e) => e.id);
  }

  async listChangedEventIds(now: Date, until: Date, limit: number) {
    return [...this.events.values()]
      .filter(
        (e) =>
          e.version > e.notifiedVersion &&
          ((e.status === "ACTIVE" && e.affectedDate <= until && (!e.expiryDate || e.expiryDate > now)) || e.status === "WITHDRAWN"),
      )
      .slice(0, limit)
      .map((e) => e.id);
  }

  async loadEvent(eventId: string) {
    const e = this.events.get(eventId);
    return e ? structuredClone(e) : null;
  }

  async listConflictPeers(event: StoredEvent): Promise<ConflictCandidate[]> {
    return [...this.events.values()].filter((e) => e.id !== event.id && e.serviceId === event.serviceId && e.wardId === event.wardId);
  }

  async listCitizensInWard(wardId: string) {
    return this.citizens.filter((c) => c.wardId === wardId);
  }

  async loadHistory(eventId: string, profileIds?: string[]): Promise<HistoryEntry[]> {
    return this.notifications.filter((n) => n.eventId === eventId && (!profileIds || profileIds.includes(n.profileId)));
  }

  async insertNotifications(rows: PlannedNotification[]) {
    const ids: string[] = [];
    for (const row of rows) {
      if (this.notifications.some((n) => n.contentHash === row.contentHash)) continue; // UNIQUE + skipDuplicates
      const id = `n${++this.seq}`;
      this.notifications.push({ ...row, id, sentAt: new Date(Date.UTC(2026, 10, 1) + ++this.clock) });
      ids.push(id);
    }
    return ids;
  }

  async markNotified(eventId: string, version: number) {
    const e = this.events.get(eventId);
    if (e && e.version === version) e.notifiedVersion = version;
  }
}
