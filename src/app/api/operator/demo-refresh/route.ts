import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DEMO_CITIZEN_EMAIL } from "@/lib/demo/accounts";
import { refreshDemoScenarios, upsertDemoWardsAndServices } from "@/lib/demo/scenarios";
import { json, route } from "@/lib/http";
import { requireOperator } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST /api/operator/demo-refresh — OPERATOR only. Re-dates the demo scenarios relative to today. */
export const POST = route(async () => {
  const operator = await requireOperator();
  const citizen = await prisma.profile.findFirst({ where: { email: DEMO_CITIZEN_EMAIL, role: "CITIZEN" }, select: { id: true } });
  await upsertDemoWardsAndServices(prisma);
  const dates = await refreshDemoScenarios(prisma, { operatorId: operator.id, citizenId: citizen?.id ?? null });
  await audit({ actorId: operator.id, action: "demo.refresh", entity: "System", entityId: "demo", metadata: dates });
  return json({ ok: true, ...dates });
});
