import { describe, expect, it } from "vitest";
import { checkArrangementVerification, checkEventVerification, checkWithdrawal, deriveAlternativeStatus } from "@/lib/verification";

const base = { actorRole: "OPERATOR" as const, eventStatus: "ACTIVE" as const, source: "MCC Circular 114/2026" };

describe("verification state machine", () => {
  it("only an OPERATOR can verify", () => {
    expect(checkEventVerification({ ...base, actorRole: "CITIZEN", from: "UNVERIFIED", to: "VERIFIED" })).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(checkEventVerification({ ...base, from: "UNVERIFIED", to: "VERIFIED" })).toEqual({ ok: true });
  });

  it("requires a source to verify", () => {
    expect(checkEventVerification({ ...base, source: "  ", from: "UNVERIFIED", to: "VERIFIED" })).toMatchObject({ code: "SOURCE_REQUIRED" });
  });

  it("locks VERIFIED records (corrections go through withdrawal)", () => {
    expect(checkEventVerification({ ...base, from: "VERIFIED", to: "UNVERIFIED" })).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects changes to withdrawn / expired notices", () => {
    expect(checkEventVerification({ ...base, eventStatus: "WITHDRAWN", from: "UNVERIFIED", to: "VERIFIED" })).toMatchObject({ code: "INVALID_STATE" });
    expect(checkWithdrawal({ actorRole: "OPERATOR", eventStatus: "EXPIRED" })).toMatchObject({ ok: false });
    expect(checkWithdrawal({ actorRole: "CITIZEN", eventStatus: "ACTIVE" })).toMatchObject({ code: "NOT_AUTHORIZED" });
  });

  it("an alternative can only be verified for a verified, active notice", () => {
    expect(
      checkArrangementVerification({ ...base, eventVerification: "UNVERIFIED", from: "UNVERIFIED", to: "VERIFIED" }),
    ).toMatchObject({ code: "EVENT_NOT_VERIFIED" });
    expect(checkArrangementVerification({ ...base, eventVerification: "VERIFIED", from: "UNVERIFIED", to: "VERIFIED" })).toEqual({ ok: true });
  });
});

describe("deriveAlternativeStatus (three first-class states)", () => {
  const t0 = new Date("2026-11-01T00:00:00Z");
  const t1 = new Date("2026-11-01T01:00:00Z");
  const arr = (verificationStatus: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE", at: Date) => ({ verificationStatus, lastVerifiedAt: verificationStatus === "VERIFIED" ? at : null, createdAt: at });

  it("UNAVAILABLE when nothing (usable) is published", () => {
    expect(deriveAlternativeStatus([])).toEqual({ status: "UNAVAILABLE", arrangement: null });
    expect(deriveAlternativeStatus([arr("UNAVAILABLE", t0)]).status).toBe("UNAVAILABLE");
  });

  it("UNVERIFIED when only unverified alternatives exist", () => {
    expect(deriveAlternativeStatus([arr("UNVERIFIED", t0)]).status).toBe("UNVERIFIED");
  });

  it("VERIFIED wins, and the most recently verified one is selected", () => {
    const older = arr("VERIFIED", t0);
    const newer = arr("VERIFIED", t1);
    const result = deriveAlternativeStatus([arr("UNVERIFIED", t1), older, newer]);
    expect(result.status).toBe("VERIFIED");
    expect(result.arrangement).toBe(newer);
  });
});
