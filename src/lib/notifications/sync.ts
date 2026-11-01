/**
 * The notification pass and the scheduled sync job (§8), written against a small
 * storage interface so the exact same logic runs on Prisma in production and on
 * an in-memory store in tests.
 */
import { isCurrent, isSupersededByConflict, type ConflictCandidate } from "@/lib/conflicts";
import { LOOKAHEAD_DAYS, SYNC_EVENT_BUDGET, SYNC_ROW_BUDGET } from "@/lib/constants";
import { DAY_MS, endOfIstDay, startOfIstDay } from "@/lib/time";
import type { NotifiableCitizen } from "./engine";
import { planEventNotifications, type DispatchEvent, type HistoryEntry, type PlannedNotification } from "./plan";

export type StoredEvent = DispatchEvent &
  ConflictCandidate & {
    notifiedVersion: number;
  };

export interface NotificationStore {
  /** Mark ACTIVE events past their expiry as EXPIRED; returns their ids. */
  expireEvents(now: Date, limit: number): Promise<string[]>;
  /** Events whose version is ahead of notifiedVersion: ACTIVE ones affected on/before `until`, and WITHDRAWN ones. */
  listChangedEventIds(now: Date, until: Date, limit: number): Promise<string[]>;
  loadEvent(eventId: string): Promise<StoredEvent | null>;
  listConflictPeers(event: StoredEvent): Promise<ConflictCandidate[]>;
  listCitizensInWard(wardId: string): Promise<NotifiableCitizen[]>;
  loadHistory(eventId: string, profileIds?: string[]): Promise<HistoryEntry[]>;
  /** Insert, silently skipping rows whose contentHash already exists. Returns ids actually inserted. */
  insertNotifications(rows: PlannedNotification[]): Promise<string[]>;
  /** Set notifiedVersion = version, only if the event has not changed again meanwhile. */
  markNotified(eventId: string, version: number): Promise<void>;
}

export interface DispatchOutcome {
  eventId: string;
  planned: number;
  insertedIds: string[];
  complete: boolean;
  superseded: boolean;
}

export async function dispatchWithStore(
  store: NotificationStore,
  eventId: string,
  options: { now: Date; rowBudget: number; onlyProfileId?: string },
): Promise<DispatchOutcome> {
  const empty = { eventId, planned: 0, insertedIds: [], complete: true, superseded: false };
  const event = await store.loadEvent(eventId);
  if (!event) return empty;

  const live = event.status === "ACTIVE" && event.verificationStatus === "VERIFIED" && isCurrent(event, options.now);
  if (event.status === "ACTIVE" && !live) {
    // Nothing to tell anyone (unverified, or already past expiry). Record that this version was handled.
    if (!options.onlyProfileId) await store.markNotified(event.id, event.version);
    return empty;
  }

  const superseded = live ? isSupersededByConflict(event, await store.listConflictPeers(event), options.now) : false;
  let citizens = live ? await store.listCitizensInWard(event.wardId) : [];
  if (options.onlyProfileId) citizens = citizens.filter((c) => c.id === options.onlyProfileId);
  const history = await store.loadHistory(event.id, options.onlyProfileId ? [options.onlyProfileId] : undefined);

  const planned = planEventNotifications({ event, citizensInWard: citizens, history, supersededByConflict: superseded });
  const batch = planned.slice(0, Math.max(0, options.rowBudget));
  const insertedIds = batch.length > 0 ? await store.insertNotifications(batch) : [];
  const complete = batch.length === planned.length;
  if (complete && !options.onlyProfileId) await store.markNotified(event.id, event.version);
  return { eventId: event.id, planned: planned.length, insertedIds, complete, superseded };
}

export interface SyncSummary {
  expiredEventIds: string[];
  examinedEventIds: string[];
  notificationsCreated: number;
  insertedNotificationIds: string[];
  incompleteEventIds: string[];
  budgetExhausted: boolean;
}

/**
 * One idempotent invocation of the scheduled job:
 *  0. archive expired notices first, so nothing past its expiry is ever announced;
 *  1. load changed events affected today or within the lookahead window (or withdrawn);
 *  2–4. for each, resolve affected citizens and build/insert notifications (dedup by contentHash);
 *  5. bump notifiedVersion once an event is fully processed.
 * Bounded by an event budget, a row budget and a wall-clock deadline.
 */
export async function runSync(
  store: NotificationStore,
  options: { now?: Date; rowBudget?: number; eventBudget?: number; deadlineMs?: number } = {},
): Promise<SyncSummary> {
  const now = options.now ?? new Date();
  const started = Date.now();
  const deadline = options.deadlineMs ?? 45_000;
  let budget = options.rowBudget ?? SYNC_ROW_BUDGET;

  const expiredEventIds = await store.expireEvents(now, options.eventBudget ?? SYNC_EVENT_BUDGET);
  const until = endOfIstDay(new Date(startOfIstDay(now).getTime() + LOOKAHEAD_DAYS * DAY_MS));
  const changed = await store.listChangedEventIds(now, until, options.eventBudget ?? SYNC_EVENT_BUDGET);

  const summary: SyncSummary = {
    expiredEventIds,
    examinedEventIds: [],
    notificationsCreated: 0,
    insertedNotificationIds: [],
    incompleteEventIds: [],
    budgetExhausted: false,
  };

  for (const eventId of changed) {
    if (budget <= 0 || Date.now() - started > deadline) {
      summary.budgetExhausted = true;
      break;
    }
    const outcome = await dispatchWithStore(store, eventId, { now, rowBudget: budget });
    summary.examinedEventIds.push(eventId);
    summary.insertedNotificationIds.push(...outcome.insertedIds);
    summary.notificationsCreated += outcome.insertedIds.length;
    budget -= Math.min(outcome.planned, budget);
    if (!outcome.complete) summary.incompleteEventIds.push(eventId);
  }
  return summary;
}
