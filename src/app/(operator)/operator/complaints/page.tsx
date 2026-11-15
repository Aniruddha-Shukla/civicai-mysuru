import { CircleCheck, ClipboardList, Clock, ImageIcon, MapPin, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComplaintStatusBadge } from "@/components/complaint-status-badge";
import { EmptyState } from "@/components/empty-state";
import { ComplaintTriage } from "@/components/operator/complaint-triage";
import { HeroChip, PageHero } from "@/components/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { COMPLAINT_STATUSES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireOperatorPage } from "@/lib/operator-guard";
import { formatIstDateShort, formatIstDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaints" };

const LABELS = { open: "Open", in_review: "In review", resolved: "Resolved", rejected: "Closed" } as const;

export default async function OperatorComplaintsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireOperatorPage();
  const sp = await searchParams;
  const status = COMPLAINT_STATUSES.find((s) => s === sp.status);
  const [complaints, grouped] = await Promise.all([
    prisma.complaint.findMany({
      where: status ? { status } : { status: { in: ["open", "in_review"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        profile: { select: { name: true } },
        service: { select: { name: true, ward: { select: { name: true } } } },
        event: { select: { id: true, affectedDate: true, reason: true } },
      },
    }),
    prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;

  return (
    <div className="space-y-4">
      <PageHero
        icon={ClipboardList}
        kicker="Complaints"
        title="Complaint triage"
        subtitle="Oldest first. Notes you add are shown to the citizen on their tracker."
      >
        <HeroChip icon={ClipboardList} strong={count("open") + count("in_review") > 0}>
          {count("open") + count("in_review")} need action
        </HeroChip>
        <HeroChip icon={Clock}>{count("in_review")} in review</HeroChip>
        <HeroChip icon={CircleCheck}>{count("resolved")} resolved</HeroChip>
      </PageHero>
      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        <Link
          href="/operator/complaints"
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
            !status ? "border-transparent bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card hover:bg-accent",
          )}
        >
          Needs action ({count("open") + count("in_review")})
        </Link>
        {COMPLAINT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/operator/complaints?status=${s}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              status === s ? "border-transparent bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card hover:bg-accent",
            )}
          >
            {LABELS[s]} ({count(s)})
          </Link>
        ))}
      </nav>
      {complaints.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No complaints here" body="Complaints submitted by citizens will appear in this queue." />
      ) : (
        <ul className="space-y-3">
          {complaints.map((c) => (
            <li key={c.id}>
              <Card className="overflow-hidden">
                <div
                  className={cn(
                    "h-1.5",
                    c.status === "open" ? "bg-sky-500" : c.status === "in_review" ? "bg-amber-500" : c.status === "resolved" ? "bg-emerald-500" : "bg-slate-400",
                  )}
                  aria-hidden
                />
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">
                      {c.service.name} · {c.service.ward.name}
                    </p>
                    <ComplaintStatusBadge status={c.status} label={LABELS[c.status as keyof typeof LABELS] ?? c.status} />
                  </div>
                  <p className="whitespace-pre-line rounded-2xl bg-muted/60 p-3 text-sm">{c.description}</p>
                  <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" aria-hidden />
                      {c.profile.name} · {formatIstDateTime(c.createdAt)}
                    </span>
                    {c.photoUrl ? (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="size-3.5" aria-hidden /> photo attached
                      </span>
                    ) : null}
                    {c.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden /> location shared
                      </span>
                    ) : null}
                    {c.event ? (
                      <Link href={`/operator/events/${c.event.id}`} className="text-primary hover:underline">
                        re: {formatIstDateShort(c.event.affectedDate)} — {c.event.reason}
                      </Link>
                    ) : null}
                  </p>
                  <ComplaintTriage id={c.id} status={c.status} note={c.operatorNote} updatedAt={c.updatedAt.toISOString()} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
