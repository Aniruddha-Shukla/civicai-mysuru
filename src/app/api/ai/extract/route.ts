import { extractAnnouncement } from "@/lib/ai/extract";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireOperator } from "@/lib/rbac";
import { istDateKey } from "@/lib/time";
import { ExtractSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const normalize = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Deterministic text match of the extracted area against ward names ("Ward 3", "Lakshmipuram"). */
function suggestWard(area: string | null, wards: { id: string; name: string }[]): string | null {
  if (!area) return null;
  const text = ` ${normalize(area)} `;
  const hits = wards.filter((ward) => {
    const [number, locality] = ward.name.split(/[–-]/).map((part) => normalize(part));
    return (number && text.includes(` ${number} `)) || (locality && text.includes(` ${locality} `));
  });
  return hits.length === 1 ? hits[0]!.id : null;
}

/**
 * POST /api/ai/extract — OPERATOR only. Returns a DRAFT that pre-fills the event form.
 * It never creates a CivicEvent: the operator reviews, corrects and submits it.
 */
export const POST = route(async (request: Request) => {
  const operator = await requireOperator();
  const body = await readJson(request, ExtractSchema, 32 * 1024);
  await enforceRateLimit(`ai-extract:${operator.id}`, 20, 10 * 60 * 1000);

  const result = await extractAnnouncement({ text: body.text, todayKey: istDateKey(new Date()) });
  await audit({ actorId: operator.id, action: "ai.extract", entity: "Profile", entityId: operator.id, metadata: { status: result.status } });

  if (result.status !== "draft") return json(result);

  const wards = await prisma.ward.findMany({ select: { id: true, name: true, services: { select: { id: true, name: true } } } });
  const wardId = suggestWard(result.draft.area, wards);
  const ward = wards.find((w) => w.id === wardId);
  const service =
    ward?.services.find((s) => result.draft.serviceName && normalize(s.name) === normalize(result.draft.serviceName)) ??
    (ward?.services.length === 1 ? ward.services[0] : undefined);
  return json({ ...result, suggestion: { wardId: wardId ?? null, serviceId: service?.id ?? null } });
});
