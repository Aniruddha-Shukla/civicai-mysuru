/**
 * Time helpers. Every instant is stored in UTC; every calendar decision
 * ("today", "this week", weekday names) is made on the Asia/Kolkata (IST)
 * calendar. India has no daylight-saving time, so IST is a fixed UTC+05:30
 * offset and day boundaries can be computed arithmetically, independent of
 * the server's own timezone.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" of the IST calendar day that contains `instant`. */
export function istDateKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Validates a "YYYY-MM-DD" key, including impossible dates like 2026-02-30. */
export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY_REGEX.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** UTC instant of IST midnight at the start of the given "YYYY-MM-DD" day. */
export function istMidnight(dateKey: string): Date {
  if (!isValidDateKey(dateKey)) throw new RangeError(`Invalid date key: ${dateKey}`);
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

export function startOfIstDay(instant: Date): Date {
  return istMidnight(istDateKey(instant));
}

/** Last millisecond of the IST day that contains `instant`. */
export function endOfIstDay(instant: Date): Date {
  return new Date(startOfIstDay(instant).getTime() + DAY_MS - 1);
}

export function addDaysToKey(dateKey: string, days: number): string {
  return istDateKey(new Date(istMidnight(dateKey).getTime() + days * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday, on the IST calendar. */
export function istWeekday(instant: Date): number {
  return new Date(instant.getTime() + IST_OFFSET_MS).getUTCDay();
}

export function weekdayName(instant: Date): string {
  return WEEKDAY_NAMES[istWeekday(instant)]!;
}

/** Next IST date (as a key) on the given weekday, at least `minDaysAhead` days from `from`. */
export function nextWeekdayKey(from: Date, weekday: number, minDaysAhead = 0): string {
  const todayKey = istDateKey(from);
  for (let i = minDaysAhead; i < minDaysAhead + 7; i++) {
    const key = addDaysToKey(todayKey, i);
    if (istWeekday(istMidnight(key)) === weekday) return key;
  }
  throw new Error("unreachable");
}

function parseTime(time: string): { h: number; m: number } {
  const match = TIME_24H_REGEX.exec(time);
  if (!match) throw new RangeError(`Invalid HH:MM time: ${time}`);
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** "07:00" → "7:00 AM", "19:30" → "7:30 PM". */
export function formatTime12h(time: string): string {
  const { h, m } = parseTime(time);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Compact form used in status lines: "07:00" → "7 AM", "07:30" → "7:30 AM". */
export function formatTimeShort(time: string): string {
  const { h, m } = parseTime(time);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "Monday, 2 November 2026" (IST). */
export function formatIstDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/** "Mon, 2 Nov" (IST). */
export function formatIstDateShort(instant: Date): string {
  return shortDateFormatter.format(instant);
}

/** "2 Nov 2026, 9:15 am IST". */
export function formatIstDateTime(instant: Date): string {
  return `${dateTimeFormatter.format(instant)} IST`;
}
