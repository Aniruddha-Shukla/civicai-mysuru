import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "event.create"
  | "event.verify"
  | "event.mark_unavailable"
  | "event.withdraw"
  | "event.expire"
  | "event.conflict_detected"
  | "arrangement.create"
  | "arrangement.verify"
  | "arrangement.mark_unavailable"
  | "notification.dispatch"
  | "ai.guard_rejected"
  | "ai.extract"
  | "complaint.create"
  | "complaint.status_change"
  | "complaint.location_deleted"
  | "profile.ward_change"
  | "cron.sync"
  | "demo.refresh";

type Db = PrismaClient | Prisma.TransactionClient;

export async function audit(
  entry: { actorId: string | null; action: AuditAction; entity: string; entityId: string; metadata?: Prisma.InputJsonValue },
  db: Db = prisma,
) {
  await db.auditLog.create({ data: entry });
}

/** Log a hallucination-firewall rejection. Never throws (logging must not break the user flow). */
export async function auditAiRejection(
  actorId: string | null,
  entity: string,
  entityId: string,
  rejection: { task: string; violations: string[]; rejectedOutput: string },
) {
  try {
    await audit({
      actorId,
      action: "ai.guard_rejected",
      entity,
      entityId,
      metadata: { task: rejection.task, violations: rejection.violations, rejectedOutput: rejection.rejectedOutput.slice(0, 2000) },
    });
  } catch (error) {
    console.error("[audit] failed to record AI rejection", error);
  }
}
