import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireOperatorPage } from "@/lib/operator-guard";
import { formatIstDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const FILTERS = [
  { key: "", label: "All" },
  { key: "event.", label: "Notices" },
  { key: "arrangement.", label: "Arrangements" },
  { key: "ai.", label: "AI (incl. firewall rejections)" },
  { key: "notification.", label: "Notifications" },
  { key: "complaint.", label: "Complaints" },
  { key: "cron.", label: "Sync runs" },
];

/** Read-only by design: there is no API to edit or delete audit entries. */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  await requireOperatorPage();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.filter)?.key ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where = filter ? { action: { startsWith: filter } } : {};
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(entries.map((e) => e.actorId).filter((id): id is string => Boolean(id)))];
  const actors = new Map((await prisma.profile.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `?${new URLSearchParams({ ...(filter ? { filter } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" subtitle="Read-only record of verifications, withdrawals, AI-firewall rejections and other actions." />
      <nav className="flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key ? `?filter=${f.key}` : "?"} className={cn("rounded-full border px-3 py-1 text-sm", filter === f.key && "border-primary bg-secondary text-primary")}>
            {f.label}
          </Link>
        ))}
      </nav>
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[200px,1fr]">
                  <div>
                    <p className={cn("font-mono text-xs font-semibold", e.action === "ai.guard_rejected" && "text-destructive")}>{e.action}</p>
                    <p className="text-xs text-muted-foreground">{formatIstDateTime(e.createdAt)}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs">
                      {e.actorId ? actors.get(e.actorId) ?? e.actorId : "system"} · {e.entity}{" "}
                      {e.entity === "CivicEvent" ? (
                        <Link href={`/operator/events/${e.entityId}`} className="font-mono text-primary hover:underline">
                          {e.entityId}
                        </Link>
                      ) : (
                        <span className="font-mono">{e.entityId}</span>
                      )}
                    </p>
                    {e.metadata ? (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">{JSON.stringify(e.metadata, null, 2)}</pre>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href(page - 1)} className="text-primary hover:underline">← Newer</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)} className="text-primary hover:underline">Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
