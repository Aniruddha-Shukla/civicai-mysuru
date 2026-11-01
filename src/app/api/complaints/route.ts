import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import { COMPLAINT_STATUSES, LIMITS, PHOTO_MIME_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { json, parseWith, route, searchParamsObject } from "@/lib/http";
import { EXTENSION_FOR, sniffImageType } from "@/lib/image";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCitizen, requireSignedIn, requireWard } from "@/lib/rbac";
import { COMPLAINT_PHOTO_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { ComplaintFieldsSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListQuery = z.object({
  status: z.enum(COMPLAINT_STATUSES).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/complaints — citizens get their own complaints; operators get the triage queue. */
export const GET = route(async (request: Request) => {
  const profile = await requireSignedIn();
  const q = parseWith(ListQuery, searchParamsObject(request));
  const rows = await prisma.complaint.findMany({
    where: { ...(profile.role === "CITIZEN" ? { profileId: profile.id } : {}), ...(q.status ? { status: q.status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: {
      id: true, status: true, description: true, createdAt: true, updatedAt: true, operatorNote: true,
      service: { select: { name: true, ward: { select: { name: true } } } },
    },
  });
  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  return json({ items, nextCursor: hasMore ? items.at(-1)!.id : null });
});

function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * POST /api/complaints — CITIZEN only. multipart/form-data (optional `photo`) or JSON.
 * Text is length-capped and stored as plain text (React escapes it on render).
 * Photos: JPEG/PNG/WebP only, verified by magic bytes, ≤ 4 MB (Vercel's request limit is 4.5 MB).
 */
export const POST = route(async (request: Request) => {
  const citizen = requireWard(await requireCitizen());
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > LIMITS.photoBytes + 256 * 1024) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The photo is too large. The maximum size is 4 MB.");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let raw: Record<string, unknown>;
  let photo: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "INVALID_FORM", "The form data could not be read.");
    }
    raw = {
      serviceId: field(form, "serviceId"),
      eventId: field(form, "eventId"),
      description: field(form, "description"),
      lat: field(form, "lat"),
      lng: field(form, "lng"),
    };
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) photo = file;
  } else if (contentType.includes("application/json")) {
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
    }
  } else {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send multipart/form-data or application/json.");
  }

  const body = parseWith(ComplaintFieldsSchema, raw);

  const service = await prisma.service.findUnique({ where: { id: body.serviceId }, select: { id: true, wardId: true } });
  if (!service || service.wardId !== citizen.wardId) {
    throw new HttpError(400, "VALIDATION_FAILED", "Choose a service in your ward.", [{ path: "serviceId", message: "Choose a service in your ward." }]);
  }
  if (body.eventId) {
    const event = await prisma.civicEvent.findUnique({ where: { id: body.eventId }, select: { serviceId: true, verificationStatus: true } });
    if (!event || event.serviceId !== service.id || event.verificationStatus !== "VERIFIED") {
      throw new HttpError(400, "VALIDATION_FAILED", "The linked notice is not valid for this service.", [
        { path: "eventId", message: "The linked notice is not valid for this service." },
      ]);
    }
  }

  let photoPath: string | null = null;
  let photoBytes: Uint8Array | null = null;
  let photoMime: (typeof PHOTO_MIME_TYPES)[number] | null = null;
  if (photo) {
    if (photo.size > LIMITS.photoBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The photo is too large. The maximum size is 4 MB.");
    if (!(PHOTO_MIME_TYPES as readonly string[]).includes(photo.type)) {
      throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG or WebP photos are accepted.");
    }
    photoBytes = new Uint8Array(await photo.arrayBuffer());
    photoMime = sniffImageType(photoBytes);
    if (!photoMime || photoMime !== photo.type) {
      throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "The file is not a valid JPEG, PNG or WebP image.");
    }
  }

  await enforceRateLimit(`complaint:${citizen.id}`, 10, 60 * 60 * 1000);

  const storage = getSupabaseAdmin()?.storage.from(COMPLAINT_PHOTO_BUCKET);
  if (photoBytes && photoMime) {
    if (!storage) throw new HttpError(503, "STORAGE_UNAVAILABLE", "Photo upload is not available right now. Please submit without a photo.");
    photoPath = `${citizen.id}/${randomUUID()}.${EXTENSION_FOR[photoMime]}`;
    const { error } = await storage.upload(photoPath, photoBytes, { contentType: photoMime, upsert: false });
    if (error) {
      console.error("[complaints] photo upload failed", error);
      throw new HttpError(502, "STORAGE_FAILED", "The photo could not be uploaded. Please try again or submit without a photo.");
    }
  }

  try {
    const complaint = await prisma.$transaction(async (tx) => {
      const created = await tx.complaint.create({
        data: {
          profileId: citizen.id,
          serviceId: service.id,
          eventId: body.eventId ?? null,
          description: body.description,
          photoUrl: photoPath,
          ...(body.lat !== undefined && body.lng !== undefined ? { location: { lat: body.lat, lng: body.lng } } : {}),
        },
      });
      await audit({ actorId: citizen.id, action: "complaint.create", entity: "Complaint", entityId: created.id }, tx);
      return created;
    });
    return json({ complaint }, { status: 201 });
  } catch (error) {
    if (photoPath && storage) await storage.remove([photoPath]).catch(() => undefined);
    throw error;
  }
});
