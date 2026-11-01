import type { Prisma } from "@prisma/client";
import { ChevronRight, Inbox, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EventStatusBadge } from "@/components/operator/event-status-badge";
import { PageHeader } from "@/components/page-header";
import { VerificationBadge } from "@/components/verification-badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { formatIstDateShort } from "@/lib/time";
import { deriveAlternativeStatus } from "@/lib/verification";

export const metadata: Metadata = { title: "Notices" };

const PAGE_SIZE = 20;
const STATUSES = ["ACTIVE", "WITHDRAWN", "EXPIRED", "RESOLVED"] as const;
const VERIFICATIONS = ["VERIFIED", "UNVERIFIED", "UNAVAILABLE"] as const;

export default async function OperatorEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; verification?: string; ward?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const verification = VERIFICATIONS.find((v) => v === sp.verification);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const wards = await prisma.ward.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const wardId = wards.find((w) => w.id === sp.ward)?.id;

  const where: Prisma.CivicEventWhereInput = {
    ...(status ? { status } : {}),
    ...(verification ? { verificationStatus: verification } : {}),
    ...(wardId ? { wardId } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.civicEvent.findMany({
      where,
      orderBy: [{ affectedDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        ward: { select: { name: true } },
        service: { select: { name: true } },
        arrangements: { select: { verificationStatus: true, lastVerifiedAt: true, createdAt: true } },
      },
    }),
    prisma.civicEvent.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (verification) params.set("verification", verification);
    if (wardId) params.set("ward", wardId);
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Civic event notices"
        subtitle={`${total} notice(s)`}
        actions={
          <Button asChild>
            <Link href="/operator/events/new">
              <Plus aria-hidden /> New notice
            </Link>
          </Button>
        }
      />

      <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-4" method="get">
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="verification" defaultValue={verification ?? ""} aria-label="Verification">
          <option value="">Any verification</option>
          {VERIFICATIONS.map((v) => (
            <option key={v} value={v}>
              {v.toLowerCase()}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="ward" defaultValue={wardId ?? ""} aria-label="Ward">
          <option value="">All wards</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

      {events.length === 0 ? (
        <EmptyState icon={Inbox} title="No notices match" body="Change the filters or create a new notice." />
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const alt = deriveAlternativeStatus(e.arrangements);
            return (
              <li key={e.id}>
                <Link href={`/operator/events/${e.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-accent">
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold">
                      {formatIstDateShort(e.affectedDate)} · {e.service.name} · {e.ward.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.reason} — {e.source}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <EventStatusBadge status={e.status} />
                      <VerificationBadge status={e.verificationStatus} />
                      <span className="text-[11px] text-muted-foreground">alternative:</span>
                      <VerificationBadge status={alt.status} />
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={qs(page - 1)} className="text-primary hover:underline">← Previous</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)} className="text-primary hover:underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
