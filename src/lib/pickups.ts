/**
 * Turns the normal schedule plus current verified notices into a simple list of pickup
 * days for the citizen's calendar strip. Pure: no I/O, IST calendar throughout.
 */
import { addDaysToKey, istDateKey, istMidnight, istWeekday } from "@/lib/time";
import type { VerificationStatus } from "@/lib/verification";

export type PickupStatus = "normal" | "moved" | "cancelled" | "maybe" | "replacement";

export interface PickupDay {
  dateKey: string;
  date: Date;
  serviceId: string;
  serviceName: string;
  time: string;
  status: PickupStatus;
  eventId?: string;
  /** For moved/maybe: where the pickup goes. For replacement: the original day it replaces. */
  alternative?: { date: Date; time: string };
  originalDate?: Date;
}

interface ServiceInput {
  id: string;
  name: string;
  normalWeekdays: number[];
  normalTime: string;
}

interface EventInput {
  id: string;
  serviceId: string;
  affectedDate: Date;
  alternative: {
    status: VerificationStatus;
    arrangement: { alternativeDate: Date; alternativeTime: string } | null;
  };
}

const STATUS_FOR: Record<VerificationStatus, PickupStatus> = { VERIFIED: "moved", UNVERIFIED: "maybe", UNAVAILABLE: "cancelled" };

export function buildPickupDays(services: ServiceInput[], events: EventInput[], now: Date, days = 14): PickupDay[] {
  const today = istDateKey(now);
  const last = addDaysToKey(today, days - 1);
  const byServiceDay = new Map(events.map((e) => [`${e.serviceId}|${istDateKey(e.affectedDate)}`, e]));
  const result: PickupDay[] = [];

  for (const service of services) {
    for (let i = 0; i < days; i++) {
      const key = addDaysToKey(today, i);
      if (!service.normalWeekdays.includes(istWeekday(istMidnight(key)))) continue;
      const event = byServiceDay.get(`${service.id}|${key}`);
      const arrangement = event?.alternative.arrangement;
      result.push({
        dateKey: key,
        date: istMidnight(key),
        serviceId: service.id,
        serviceName: service.name,
        time: service.normalTime,
        status: event ? STATUS_FOR[event.alternative.status] : "normal",
        eventId: event?.id,
        alternative: event && arrangement ? { date: arrangement.alternativeDate, time: arrangement.alternativeTime } : undefined,
      });
    }
  }

  // Confirmed replacement pickups appear on their own day too.
  for (const event of events) {
    const arrangement = event.alternative.arrangement;
    if (event.alternative.status !== "VERIFIED" || !arrangement) continue;
    const key = istDateKey(arrangement.alternativeDate);
    if (key < today || key > last) continue;
    const service = services.find((s) => s.id === event.serviceId);
    if (!service) continue;
    result.push({
      dateKey: key,
      date: istMidnight(key),
      serviceId: service.id,
      serviceName: service.name,
      time: arrangement.alternativeTime,
      status: "replacement",
      eventId: event.id,
      originalDate: event.affectedDate,
    });
  }

  return result.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time));
}
