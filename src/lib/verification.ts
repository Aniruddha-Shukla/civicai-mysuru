/**
 * Verification layer (paper layer 2). Pure and deterministic — there is no AI
 * call anywhere in this module, and it is the only place that decides whether
 * a record may move between verification states.
 *
 * Rules:
 *  - Only an OPERATOR may change verification state.
 *  - VERIFIED requires a non-empty source (source transparency).
 *  - A VERIFIED record is locked: corrections are made by withdrawing the notice
 *    (which sends a retraction) and issuing a new one — never by silent edits.
 *  - An alternative arrangement can be verified only for an ACTIVE, VERIFIED event.
 */

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE";
export type EventStatus = "ACTIVE" | "RESOLVED" | "EXPIRED" | "WITHDRAWN";
export type ActorRole = "CITIZEN" | "OPERATOR";

export type TransitionResult =
  | { ok: true }
  | {
      ok: false;
      code: "NOT_AUTHORIZED" | "INVALID_STATE" | "INVALID_TRANSITION" | "SOURCE_REQUIRED" | "NO_CHANGE" | "EVENT_NOT_VERIFIED";
      message: string;
    };

const ALLOWED_TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  UNVERIFIED: ["VERIFIED", "UNAVAILABLE"],
  UNAVAILABLE: ["UNVERIFIED", "VERIFIED"],
  VERIFIED: [],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function checkEventVerification(input: {
  actorRole: ActorRole;
  eventStatus: EventStatus;
  from: VerificationStatus;
  to: VerificationStatus;
  source: string;
}): TransitionResult {
  if (input.actorRole !== "OPERATOR") {
    return { ok: false, code: "NOT_AUTHORIZED", message: "Only an authorized municipal operator can change verification status." };
  }
  if (input.eventStatus !== "ACTIVE") {
    return { ok: false, code: "INVALID_STATE", message: `This notice is ${input.eventStatus.toLowerCase()} and can no longer be changed.` };
  }
  if (input.from === input.to) {
    return { ok: false, code: "NO_CHANGE", message: `This notice is already ${input.to.toLowerCase()}.` };
  }
  if (!canTransition(input.from, input.to)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "A verified notice is locked. Withdraw it (citizens are sent a retraction) and issue a corrected notice instead.",
    };
  }
  if (input.to === "VERIFIED" && input.source.trim().length === 0) {
    return { ok: false, code: "SOURCE_REQUIRED", message: "A notice cannot be verified without a municipal source." };
  }
  return { ok: true };
}

export function checkArrangementVerification(input: {
  actorRole: ActorRole;
  eventStatus: EventStatus;
  eventVerification: VerificationStatus;
  from: VerificationStatus;
  to: VerificationStatus;
  source: string;
}): TransitionResult {
  if (input.actorRole !== "OPERATOR") {
    return { ok: false, code: "NOT_AUTHORIZED", message: "Only an authorized municipal operator can verify an alternative arrangement." };
  }
  if (input.eventStatus !== "ACTIVE") {
    return { ok: false, code: "INVALID_STATE", message: "Alternatives can only be changed while the notice is active." };
  }
  if (input.to === "VERIFIED" && input.eventVerification !== "VERIFIED") {
    return {
      ok: false,
      code: "EVENT_NOT_VERIFIED",
      message: "Verify the disruption notice itself before verifying an alternative arrangement for it.",
    };
  }
  if (input.from === input.to) {
    return { ok: false, code: "NO_CHANGE", message: `This arrangement is already ${input.to.toLowerCase()}.` };
  }
  if (!canTransition(input.from, input.to)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "A verified arrangement is locked. Publish a new arrangement; the most recently verified one is shown to citizens.",
    };
  }
  if (input.to === "VERIFIED" && input.source.trim().length === 0) {
    return { ok: false, code: "SOURCE_REQUIRED", message: "An arrangement cannot be verified without a municipal source." };
  }
  return { ok: true };
}

export function checkWithdrawal(input: { actorRole: ActorRole; eventStatus: EventStatus }): TransitionResult {
  if (input.actorRole !== "OPERATOR") {
    return { ok: false, code: "NOT_AUTHORIZED", message: "Only an authorized municipal operator can withdraw a notice." };
  }
  if (input.eventStatus !== "ACTIVE") {
    return { ok: false, code: "INVALID_STATE", message: `This notice is already ${input.eventStatus.toLowerCase()}.` };
  }
  return { ok: true };
}

export interface ArrangementLike {
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
  createdAt: Date;
}

const newestFirst = (a: ArrangementLike, b: ArrangementLike) =>
  (b.lastVerifiedAt ?? b.createdAt).getTime() - (a.lastVerifiedAt ?? a.createdAt).getTime();

/** The arrangement citizens are told about: the most recently verified one, or null. */
export function selectVerifiedAlternative<T extends ArrangementLike>(arrangements: readonly T[]): T | null {
  return [...arrangements].filter((a) => a.verificationStatus === "VERIFIED").sort(newestFirst)[0] ?? null;
}

/**
 * Status of "the alternative" for an event, as a first-class three-state value:
 *  VERIFIED    — a verified arrangement exists (it wins over any unverified ones)
 *  UNVERIFIED  — only unverified arrangements exist ("a possible alternative may be …")
 *  UNAVAILABLE — nothing has been officially published
 * Arrangements an operator marked UNAVAILABLE (could not be confirmed) are ignored.
 */
export function deriveAlternativeStatus<T extends ArrangementLike>(
  arrangements: readonly T[],
): { status: VerificationStatus; arrangement: T | null } {
  const verified = selectVerifiedAlternative(arrangements);
  if (verified) return { status: "VERIFIED", arrangement: verified };
  const unverified = [...arrangements].filter((a) => a.verificationStatus === "UNVERIFIED").sort(newestFirst)[0];
  if (unverified) return { status: "UNVERIFIED", arrangement: unverified };
  return { status: "UNAVAILABLE", arrangement: null };
}
