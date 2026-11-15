import { Archive, Bell, BellRing, CalendarDays, ChevronRight, ClipboardList, Hourglass, LayoutDashboard, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { OperatorTools } from "@/components/operator/operator-tools";
import { HeroChip, PageHero } from "@/components/page-hero";
import { VerificationBadge } from "@/components/verification-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai/client";
import { findConflictGroups, isCurrent } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { requireOperatorPage } from "@/lib/operator-guard";
import { greetingKey } from "@/lib/greeting";
import { getT } from "@/lib/i18n";
import { formatIstDate, formatIstDateShort, formatIstDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Operator overview" };

export default async function OperatorOverviewPage() {
  const operator = await requireOperatorPage();
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
    { label: "Current notices", hint: "Live for citizens or awaiting checks", value: current.length, icon: Bell, tone: "bg-emerald-100 text-emerald-700", href: "/operator/events?status=ACTIVE" },
    { label: "Awaiting verification", hint: "Citizens are not alerted yet", value: awaiting.length, icon: ShieldAlert, tone: "bg-amber-100 text-amber-700", href: "/operator/events?status=ACTIVE&verification=UNVERIFIED" },
    { label: "Open complaints", hint: "Oldest first in the queue", value: openComplaints, icon: ClipboardList, tone: "bg-rose-100 text-rose-700", href: "/operator/complaints" },
    { label: "Alerts sent (24 h)", hint: "Delivered to citizens", value: alerts24h, icon: BellRing, tone: "bg-teal-100 text-teal-700", href: "/operator/audit-log?filter=notification." },
  ];
  const t = getT("en");

  const row = (e: (typeof active)[number], extra?: React.ReactNode) => (
    <li key={e.id}>
      <Link
        href={`/operator/events/${e.id}`}
        className="group flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-background p-3 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      >
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
      <PageHero
        icon={LayoutDashboard}
        kicker="Operator console"
        title={`${t(greetingKey(now))}, ${operator.name.split(" ")[0] ?? operator.name}`}
        subtitle="Verify disruption notices, publish alternative arrangements and triage complaints."
        aside={<OperatorTools onDark />}
      >
        <HeroChip icon={CalendarDays}>{formatIstDate(now)}</HeroChip>
        {awaiting.length > 0 ? (
          <HeroChip icon={ShieldAlert} strong>
            {awaiting.length} to verify
          </HeroChip>
        ) : null}
        {conflicts.length > 0 ? <HeroChip icon={TriangleAlert}>{conflicts.length} conflict(s)</HeroChip> : null}
        <HeroChip icon={Sparkles}>{isAiConfigured() ? "AI layer on" : "Template-only mode"}</HeroChip>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            data-spotlight
            style={{ animationDelay: `${i * 80}ms` }}
            className="spotlight group rounded-3xl border bg-card p-4 shadow-soft transition-transform duration-300 animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-700 hover:-translate-y-1"
          >
            <span className="flex items-start justify-between">
              <span className={cn("flex size-11 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110", s.tone)}>
                <s.icon className="size-5" aria-hidden />
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="mt-3 block text-3xl font-extrabold leading-none tracking-tight">{s.value}</span>
            <span className="mt-1 block text-sm font-semibold">{s.label}</span>
            <span className="block text-xs text-muted-foreground">{s.hint}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
