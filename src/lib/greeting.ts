import { IST_TIMEZONE } from "@/lib/time";

export type GreetingKey = "greeting.morning" | "greeting.afternoon" | "greeting.evening";

/** "Good morning / afternoon / evening" by the time of day in Mysuru (IST), not the server's clock. */
export function greetingKey(now: Date): GreetingKey {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: IST_TIMEZONE }).format(now));
  if (hour >= 4 && hour < 12) return "greeting.morning";
  if (hour >= 12 && hour < 17) return "greeting.afternoon";
  return "greeting.evening";
}
