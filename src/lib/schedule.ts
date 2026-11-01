import { addDaysToKey, endOfIstDay, istDateKey, istMidnight, istWeekday } from "@/lib/time";

/**
 * Default expiry for a disruption notice: it stays relevant until the next regular
 * collection day (end of the IST day before it). For a weekly Monday service that is
 * the following Sunday night; for a daily service, the end of the affected day.
 * Operators may set an explicit expiry instead; a later verified alternative extends it.
 */
export function defaultExpiry(affectedDate: Date, normalWeekdays: readonly number[]): Date {
  const key = istDateKey(affectedDate);
  for (let i = 1; i <= 7; i++) {
    const candidate = addDaysToKey(key, i);
    if (normalWeekdays.includes(istWeekday(istMidnight(candidate)))) {
      return endOfIstDay(istMidnight(addDaysToKey(candidate, -1)));
    }
  }
  return endOfIstDay(affectedDate);
}

/** The next `count` regular collection days (IST date keys) from `from`, today included. */
export function upcomingCollectionDays(from: Date, normalWeekdays: readonly number[], count = 3): string[] {
  const days: string[] = [];
  const todayKey = istDateKey(from);
  for (let i = 0; days.length < count && i < 60; i++) {
    const key = addDaysToKey(todayKey, i);
    if (normalWeekdays.includes(istWeekday(istMidnight(key)))) days.push(key);
  }
  return days;
}
