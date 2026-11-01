/**
 * Citizen Notification Layer (paper layer 4) — the decision of WHETHER and
 * WHAT to tell a citizen. Implements the §12 algorithm exactly; messages come
 * only from the deterministic templates.
 */
import { citizenInWard } from "@/lib/geo";
import type { VerificationStatus } from "@/lib/verification";
import { render, type RenderableArrangement, type RenderableEvent, type TemplateKey } from "./templates";

export interface NotifiableCitizen {
  id: string;
  wardId: string | null;
}

export interface NotifiableEvent extends RenderableEvent {
  wardId: string;
  verificationStatus: VerificationStatus;
}

export interface NotifiableArrangement extends RenderableArrangement {
  verificationStatus: VerificationStatus;
}

export function buildNotification(
  citizen: NotifiableCitizen,
  event: NotifiableEvent,
  alternative: NotifiableArrangement | null,
): { templateKey: TemplateKey; message: string } | null {
  const verified = event.verificationStatus === "VERIFIED";
  const inArea = citizenInWard(citizen, event.wardId); // ward resolved via turf.js point-in-polygon at onboarding

  if (!verified || !inArea) return null; // do not send an official alert

  if (alternative && alternative.verificationStatus === "VERIFIED") {
    return render("verified_alternative", event, alternative);
  }
  return render("no_alternative_published", event);
}
