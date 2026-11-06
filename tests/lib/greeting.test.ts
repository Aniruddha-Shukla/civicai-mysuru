import { describe, expect, it } from "vitest";
import { greetingKey } from "@/lib/greeting";

describe("greetingKey (IST time of day)", () => {
  it("uses Mysuru time, not UTC", () => {
    // 03:00 UTC = 08:30 IST
    expect(greetingKey(new Date("2026-11-06T03:00:00Z"))).toBe("greeting.morning");
    // 08:00 UTC = 13:30 IST
    expect(greetingKey(new Date("2026-11-06T08:00:00Z"))).toBe("greeting.afternoon");
    // 14:00 UTC = 19:30 IST
    expect(greetingKey(new Date("2026-11-06T14:00:00Z"))).toBe("greeting.evening");
    // 20:00 UTC = 01:30 IST (late night)
    expect(greetingKey(new Date("2026-11-06T20:00:00Z"))).toBe("greeting.evening");
  });
});
