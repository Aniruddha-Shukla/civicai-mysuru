import { Archive, Bell, BellRing, ClipboardList, Hourglass, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { OperatorTools } from "@/components/operator/operator-tools";
import { PageHeader } from "@/components/page-header";
import { VerificationBadge } from "@/components/verification-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai/client";
import { findConflictGroups, isCurrent } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { formatIstDateShort, formatIstDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Operator overview" };

export default async function OperatorOverviewPage() {
  const now = new Date();
  const [active, withdrawnPending, openComplaints, alerts24h, recentAudit] = await Promise.all([
    prisma.civicEvent.findMany({
      where: { status: "ACTIVE" },
      include: { ward: { select: { name: true } }, service: { select: { name: true } } },
      orderBy: { affectedDate: "asc" },
      take: 300,
    }),
    prisma.civicEvent.count({ where: { status: "WITHDRAWN", version: { gt: prisma.civicEvent.fields.notifiedVersion } } }),
    prisma.complaint.count({ where: { status: { in: ["open", "in_review"] } } }),
    prisma.notification.count({ where: { sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const current = active.filter((e) => isCurrent(e, now));
  const awaiting = current.filter((e) => e.verificationStatus === "UNVERIFIED");
  const conflicts = findConflictGroups(current, now);
  const pastExpiry = active.filter((e) => !isCurrent(e, now));
  const pendingFollowUps = current.filter((e) => e.verificationStatus === "VERIFIED" && e.version > e.notifiedVersion);

  const stats = [
    { label: "Current notices", value: current.length, icon: Bell },
    { label: "Awaiting verification", value: awaiting.length, icon: ShieldAlert },
    { label: "Open complaints", value: openComplaints, icon: ClipboardList },
    { label: "Alerts sent (24 h)", value: alerts24h, icon: BellRing },
  ];

  const row = (e: (typeof active)[number], extra?: React.ReactNode) => (
    <li key={e.id}>
      <Link href={`/operator/events/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm hover:bg-accent">
        <span className="min-w-0">
          <span className="block font-medium">
            {formatIstDateShort(e.affectedDate)} · {e.service.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {e.ward.name} — {e.reason}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {extra}
          <VerificationBadge status={e.verificationStatus} />
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Operator overview" subtitle="Verify disruption notices, publish alternative arrangements and triage complaints." actions={<OperatorTools />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-2xl font-bold leading-none">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI layer:
          {isAiConfigured() ? (
            <Badge variant="verified">Enabled — translation, Q&A, extraction &amp; drafting assist</Badge>
          ) : (
            <Badge variant="unavailable">Template-only (degraded) mode — core alerts unaffected</Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-unverified" aria-hidden /> Awaiting verification
            </CardTitle>
            <CardDescription>Citizens are not notified until an operator verifies the notice against its source.</CardDescription>
          </CardHeader>
          <CardContent>
            {awaiting.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="Nothing to verify" body="New notices you create will appear here." className="py-6" />
            ) : (
              <ul className="space-y-2">{awaiting.map((e) => row(e))}</ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-destructive" aria-hidden /> Conflicts needing review
            </CardTitle>
            <CardDescription>
              Different notices for the same ward, service and day are never merged. Citizens see the most recently verified one until you
              withdraw the incorrect notice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              <EmptyState icon={TriangleAlert} title="No conflicts" className="py-6" />
            ) : (
              <div className="space-y-3">
                {conflicts.map((group) => (
                  <ul key={group[0]!.id} className="space-y-2 rounded-md border border-destructive/30 p-2">
                    {group.map((e) => row(e, e.lastVerifiedAt ? <span className="text-[11px] text-muted-foreground">verified {formatIstDateTime(e.lastVerifiedAt)}</span> : null))}
                  </ul>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hourglass className="size-4 text-primary" aria-hidden /> Pending notification passes
            </CardTitle>
            <CardDescription>
              Verified notices whose latest change has not been fully sent yet (e.g. an alternative published after a “no alternative yet”
              alert). The scheduled sync — or “Run scheduled sync now” — sends the follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingFollowUps.length === 0 && withdrawnPending === 0 ? (
              <EmptyState icon={Hourglass} title="All citizens are up to date" className="py-6" />
            ) : (
              <ul className="space-y-2">
                {pendingFollowUps.map((e) => row(e, <Badge variant="secondary">v{e.notifiedVersion} → v{e.version}</Badge>))}
                {withdrawnPending > 0 ? <li className="text-xs text-muted-foreground">{withdrawnPending} withdrawn notice(s) awaiting retraction delivery.</li> : null}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="size-4 text-unavailable" aria-hidden /> Past expiry
            </CardTitle>
            <CardDescription>Already hidden from citizens; the next sync archives them as EXPIRED.</CardDescription>
          </CardHeader>
          <CardContent>
            {pastExpiry.length === 0 ? (
              <EmptyState icon={Archive} title="Nothing past expiry" className="py-6" />
            ) : (
              <ul className="space-y-2">{pastExpiry.map((e) => row(e, <Badge variant="unavailable">expired {e.expiryDate ? formatIstDateShort(e.expiryDate) : ""}</Badge>))}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent activity</CardTitle>
          <Link href="/operator/audit-log" className="text-sm text-primary hover:underline">
            Full audit log →
          </Link>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No activity yet" className="py-6" />
          ) : (
            <ul className="divide-y text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.entity} · {formatIstDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
