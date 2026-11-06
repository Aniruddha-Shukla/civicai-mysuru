import { describe, expect, it } from "vitest";
import { buildPickupDays } from "@/lib/pickups";
import { istMidnight } from "@/lib/time";

const NOW = new Date("2026-11-06T06:00:00Z"); // Friday 6 Nov 2026, IST
const services = [
  { id: "gc", name: "Garbage Collection", normalWeekdays: [1], normalTime: "07:00" },
  { id: "dry", name: "Dry Waste Collection", normalWeekdays: [4], normalTime: "08:00" },
];

describe("buildPickupDays", () => {
  it("lists the regular pickup days in the next two weeks, in date order", () => {
    const days = buildPickupDays(services, [], NOW);
    expect(days.map((d) => `${d.dateKey} ${d.serviceId} ${d.status}`)).toEqual([
      "2026-11-09 gc normal",
      "2026-11-12 dry normal",
      "2026-11-16 gc normal",
      "2026-11-19 dry normal",
    ]);
  });

  it("marks moved, cancelled and unconfirmed days, and adds the confirmed replacement day", () => {
    const events = [
      {
        id: "a",
        serviceId: "gc",
        affectedDate: istMidnight("2026-11-09"),
        alternative: { status: "VERIFIED" as const, arrangement: { alternativeDate: istMidnight("2026-11-11"), alternativeTime: "07:00" } },
      },
      { id: "b", serviceId: "gc", affectedDate: istMidnight("2026-11-16"), alternative: { status: "UNAVAILABLE" as const, arrangement: null } },
      {
        id: "c",
        serviceId: "dry",
        affectedDate: istMidnight("2026-11-12"),
        alternative: { status: "UNVERIFIED" as const, arrangement: { alternativeDate: istMidnight("2026-11-14"), alternativeTime: "08:00" } },
      },
    ];
    const days = buildPickupDays(services, events, NOW);
    expect(days.map((d) => `${d.dateKey} ${d.status}`)).toEqual([
      "2026-11-09 moved",
      "2026-11-11 replacement",
      "2026-11-12 maybe",
      "2026-11-16 cancelled",
      "2026-11-19 normal",
    ]);
    expect(days.find((d) => d.status === "replacement")?.originalDate).toEqual(istMidnight("2026-11-09"));
  });
});
