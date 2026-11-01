import { describe, expect, it } from "vitest";
import { buildNotification } from "@/lib/notifications/engine";
import { FALLBACK_INSTRUCTION, statusLine } from "@/lib/notifications/templates";
import { istMidnight } from "@/lib/time";

// 2 Nov 2026 is a Monday, 4 Nov 2026 a Wednesday (IST).
const event = {
  wardId: "ward-1",
  verificationStatus: "VERIFIED" as const,
  affectedDate: istMidnight("2026-11-02"),
  reason: "a municipal holiday",
  service: { name: "Garbage Collection" },
};
const verifiedAlternative = {
  alternativeDate: istMidnight("2026-11-04"),
  alternativeTime: "07:00",
  verificationStatus: "VERIFIED" as const,
};
const citizen = { id: "citizen-1", wardId: "ward-1" };

const CASE_A =
  "Garbage Collection Update. Your regular Monday collection is affected by a municipal holiday. " +
  "Alternative collection: Wednesday, 7:00 AM. Source: Verified municipal notice. " +
  "Please keep your waste ready according to the updated schedule.";

const CASE_B =
  "Garbage Collection Alert. Your regular Monday collection is affected by a municipal holiday. " +
  "No verified alternative collection schedule has been published yet. " +
  "We will notify you when verified information becomes available.";

describe("buildNotification (§12 algorithm)", () => {
  it("verified event + verified alternative → Case A, word for word", () => {
    expect(buildNotification(citizen, event, verifiedAlternative)).toEqual({
      templateKey: "verified_alternative",
      message: CASE_A,
    });
  });

  it("verified event + no alternative → Case B, word for word", () => {
    expect(buildNotification(citizen, event, null)).toEqual({
      templateKey: "no_alternative_published",
      message: CASE_B,
    });
  });

  it("verified event + only an UNVERIFIED alternative → Case B (never presents an unverified time)", () => {
    const result = buildNotification(citizen, event, { ...verifiedAlternative, verificationStatus: "UNVERIFIED" });
    expect(result?.templateKey).toBe("no_alternative_published");
    expect(result?.message).not.toContain("7:00");
  });

  it("unverified event → null (no official alert)", () => {
    expect(buildNotification(citizen, { ...event, verificationStatus: "UNVERIFIED" }, verifiedAlternative)).toBeNull();
    expect(buildNotification(citizen, { ...event, verificationStatus: "UNAVAILABLE" }, null)).toBeNull();
  });

  it("citizen outside the affected ward → null", () => {
    expect(buildNotification({ id: "c2", wardId: "ward-2" }, event, verifiedAlternative)).toBeNull();
  });

  it("citizen with no ward yet → null (no null-pointer path)", () => {
    expect(buildNotification({ id: "c3", wardId: null }, event, verifiedAlternative)).toBeNull();
  });

  it("tolerates a trailing full stop in the operator-entered reason", () => {
    expect(buildNotification(citizen, { ...event, reason: "a municipal holiday." }, null)?.message).toBe(CASE_B);
  });
});

describe("§6.2 status wording", () => {
  it("renders the paper's exact example lines", () => {
    expect(statusLine("VERIFIED", verifiedAlternative)).toBe("Alternative collection: Wednesday 7 AM.");
    expect(statusLine("UNVERIFIED", verifiedAlternative)).toBe("A possible alternative may be Wednesday.");
    expect(statusLine("UNAVAILABLE", null)).toBe("No alternative arrangement has been officially published.");
  });

  it("§5 fallback instruction sentence", () => {
    expect(FALLBACK_INSTRUCTION).toBe(
      "The normal collection schedule is affected. No verified alternative arrangement is currently available.",
    );
  });
});
