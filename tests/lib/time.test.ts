import { describe, expect, it } from "vitest";
import { defaultExpiry, upcomingCollectionDays } from "@/lib/schedule";
import { endOfIstDay, istDateKey, istMidnight, isValidDateKey, startOfIstDay, weekdayName } from "@/lib/time";

describe("IST day boundaries (independent of the server's timezone)", () => {
  it("18:29:59Z is still the previous IST day; 18:30:00Z is the next", () => {
    expect(istDateKey(new Date("2026-11-01T18:29:59.999Z"))).toBe("2026-11-01");
    expect(istDateKey(new Date("2026-11-01T18:30:00.000Z"))).toBe("2026-11-02");
  });

  it("IST midnight is 18:30 UTC of the previous day", () => {
    expect(istMidnight("2026-11-02").toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(startOfIstDay(new Date("2026-11-02T03:00:00Z")).toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(endOfIstDay(new Date("2026-11-02T03:00:00Z")).toISOString()).toBe("2026-11-02T18:29:59.999Z");
  });

  it("weekday names follow the IST calendar", () => {
    expect(weekdayName(istMidnight("2026-11-02"))).toBe("Monday");
    // 20:00 UTC on Sunday is already Monday in India.
    expect(weekdayName(new Date("2026-11-01T20:00:00Z"))).toBe("Monday");
  });

  it("rejects impossible dates", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-11-02")).toBe(true);
  });
});

describe("schedule helpers", () => {
  it("default expiry is the night before the next regular collection day", () => {
    // Weekly Monday service, disruption on Monday 2 Nov → expires end of Sunday 8 Nov (IST).
    expect(istDateKey(defaultExpiry(istMidnight("2026-11-02"), [1]))).toBe("2026-11-08");
    // Daily service → end of the affected day.
    expect(istDateKey(defaultExpiry(istMidnight("2026-11-02"), [0, 1, 2, 3, 4, 5, 6]))).toBe("2026-11-02");
  });

  it("lists upcoming collection days on the IST calendar", () => {
    expect(upcomingCollectionDays(new Date("2026-11-01T04:30:00Z"), [1], 2)).toEqual(["2026-11-02", "2026-11-09"]);
  });
});
