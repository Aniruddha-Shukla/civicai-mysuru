import { describe, expect, it } from "vitest";
import { eventDedupKey, findConflictGroups, selectCitizenFacingEvents } from "@/lib/conflicts";
import { istMidnight } from "@/lib/time";

const NOW = new Date("2026-11-01T04:30:00Z");
const base = {
  serviceId: "s1",
  wardId: "w1",
  affectedDate: istMidnight("2026-11-02"),
  status: "ACTIVE" as const,
  verificationStatus: "VERIFIED" as const,
  expiryDate: null,
};

describe("duplicate ingestion", () => {
  it("the same announcement (case/punctuation-insensitive source) has the same dedup key", () => {
    const a = eventDedupKey({ ...base, source: "MCC Circular No. 114/2026" });
    const b = eventDedupKey({ ...base, source: "  mcc circular no 114 2026 " });
    expect(a).toBe(b);
    expect(eventDedupKey({ ...base, source: "MCC Circular No. 115/2026" })).not.toBe(a);
  });
});

describe("conflicting notices", () => {
  const older = { ...base, id: "old", lastVerifiedAt: new Date("2026-11-01T01:00:00Z") };
  const newer = { ...base, id: "new", lastVerifiedAt: new Date("2026-11-01T03:00:00Z") };

  it("are not merged — they are flagged for review", () => {
    expect(findConflictGroups([older, newer], NOW)).toHaveLength(1);
  });

  it("citizens see only the most recently verified one, flagged as conflicting", () => {
    const shown = selectCitizenFacingEvents([older, newer], NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ id: "new", hasConflict: true });
  });

  it("unverified, withdrawn and expired notices are never citizen-facing", () => {
    const shown = selectCitizenFacingEvents(
      [
        { ...base, id: "u", verificationStatus: "UNVERIFIED", lastVerifiedAt: null },
        { ...base, id: "w", status: "WITHDRAWN", lastVerifiedAt: NOW },
        { ...base, id: "e", expiryDate: new Date(NOW.getTime() - 1), lastVerifiedAt: NOW },
      ],
      NOW,
    );
    expect(shown).toEqual([]);
  });
});
