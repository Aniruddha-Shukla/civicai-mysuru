import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { requireSignedIn } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/events/[id] — operators see everything; citizens only VERIFIED notices (404 otherwise). */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const profile = await requireSignedIn();
  const { id } = await params;
  const isOperator = profile.role === "OPERATOR";
  const event = await prisma.civicEvent.findUnique({
    where: { id },
    include: {
      ward: { select: { id: true, name: true } },
      service: { select: { id: true, name: true, normalTime: true, normalWeekdays: true } },
      arrangements: {
        where: isOperator ? {} : { verificationStatus: { in: ["VERIFIED", "UNVERIFIED"] } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!event || (!isOperator && event.verificationStatus !== "VERIFIED")) throw Errors.notFound("Notice");
  const { dedupKey: _dedupKey, ...rest } = event;
  return json({ event: rest });
});
