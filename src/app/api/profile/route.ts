import { after } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { LANGUAGES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { deliverNotifications } from "@/lib/notifications/delivery";
import { notifyCitizenOfCurrentEvents } from "@/lib/notifications/dispatch";
import { requireSignedIn } from "@/lib/rbac";
import { id } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ProfileUpdateSchema = z
  .object({ wardId: id.optional(), language: z.enum(LANGUAGES).optional() })
  .refine((v) => v.wardId !== undefined || v.language !== undefined, "Nothing to update.");

/**
 * PATCH /api/profile — set ward (citizens) and/or language. Changing ward never
 * rewrites past notifications (immutable snapshots); the citizen simply starts
 * receiving the current verified alerts for the new ward.
 */
export const PATCH = route(async (request: Request) => {
  const profile = await requireSignedIn();
  const body = await readJson(request, ProfileUpdateSchema, 2048);

  if (body.wardId !== undefined) {
    if (profile.role !== "CITIZEN") throw new HttpError(403, "FORBIDDEN", "Only citizens register a home ward.");
    const ward = await prisma.ward.findUnique({ where: { id: body.wardId }, select: { id: true } });
    if (!ward) throw new HttpError(400, "VALIDATION_FAILED", "Unknown ward.", [{ path: "wardId", message: "Choose a valid ward." }]);
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { ...(body.wardId !== undefined ? { wardId: body.wardId } : {}), ...(body.language ? { language: body.language } : {}) },
  });

  let newAlerts = 0;
  if (body.wardId !== undefined && body.wardId !== profile.wardId) {
    await audit({ actorId: profile.id, action: "profile.ward_change", entity: "Profile", entityId: profile.id, metadata: { from: profile.wardId, to: body.wardId } });
    const inserted = await notifyCitizenOfCurrentEvents(profile.id, body.wardId);
    newAlerts = inserted.length;
    if (inserted.length > 0) after(() => deliverNotifications(inserted).catch((error) => console.error("[delivery]", error)));
  }
  return json({ profile: { id: updated.id, wardId: updated.wardId, language: updated.language }, newAlerts });
});
