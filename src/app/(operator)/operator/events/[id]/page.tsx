import { ArrowLeft, History, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/event-card";
import { ArrangementActions, ArrangementForm, VerifyEventActions, WithdrawEventDialog } from "@/components/operator/event-actions";
import { EventStatusBadge } from "@/components/operator/event-status-badge";
import { VerificationBadge } from "@/components/verification-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrent } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { requireOperatorPage } from "@/lib/operator-guard";
import { buildNotification } from "@/lib/notifications/engine";
import { render, renderVerifiedAlternative } from "@/lib/notifications/templates";
import { endOfIstDay, formatIstDate, formatIstDateTime, formatTime12h, istDateKey } from "@/lib/time";
import { deriveAlternativeStatus, selectVerifiedAlternative } from "@/lib/verification";

export const metadata: Metadata = { title: "Notice" };

export default async function OperatorEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperatorPage();
  const { id } = await params;
  const event = await prisma.civicEvent.findUnique({
    where: { id },
    include: {
      ward: { select: { name: true } },
      service: { select: { name: true } },
      createdBy: { select: { name: true } },
      arrangements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) notFound();

  const now = new Date();
  const [counts, peers, auditEntries] = await Promise.all([
    prisma.notification.groupBy({ by: ["templateKey"], where: { eventId: id }, _count: { _all: true } }),
    prisma.civicEvent.findMany({
      where: {
        id: { not: id },
        serviceId: event.serviceId,
        wardId: event.wardId,
        status: "ACTIVE",
        affectedDate: { gte: event.affectedDate, lte: endOfIstDay(event.affectedDate) },
      },
      select: { id: true, reason: true, source: true, verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "CivicEvent", entityId: id },
          { entity: "AlternativeArrangement", entityId: { in: event.arrangements.map((a) => a.id) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const notifiedCount = counts.reduce((sum, c) => sum + c._count._all, 0);
  const active = event.status === "ACTIVE";
  const current = isCurrent(event, now);
  const verified = event.verificationStatus === "VERIFIED";
  const verifyPreview = buildNotification({ id: "preview", wardId: event.wardId }, { ...event, verificationStatus: "VERIFIED" }, selectVerifiedAlternative(event.arrangements))?.message ?? null;
  const retractionPreview = render("retraction", event).message;
  const todayKey = istDateKey(now);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/operator/events">
          <ArrowLeft aria-hidden /> All notices
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold sm:text-2xl">
          {event.service.name} · {formatIstDate(event.affectedDate)}
        </h1>
        <EventStatusBadge status={event.status} />
        <VerificationBadge status={event.verificationStatus} />
      </div>

      {peers.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>
            <p className="font-medium">Conflicting notice(s) for the same ward, service and day — not merged.</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {peers.map((p) => (
                <li key={p.id}>
                  <Link href={`/operator/events/${p.id}`} className="underline">
                    {p.reason}
                  </Link>{" "}
                  ({p.verificationStatus.toLowerCase()}, {p.source}
                  {p.lastVerifiedAt ? `, verified ${formatIstDateTime(p.lastVerifiedAt)}` : ""})
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Citizens see the most recently verified notice. Withdraw the incorrect one to resolve the conflict.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      {active && !current ? (
        <Alert variant="muted">
          <AlertDescription>This notice is past its expiry. It is hidden from citizens and will be archived (EXPIRED) by the next sync.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr),360px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citizen view</p>
            <EventCard
              serviceName={event.service.name}
              eventType={event.eventType}
              affectedDate={event.affectedDate}
              reason={event.reason}
              source={event.source}
              sourceUrl={event.sourceUrl}
              verificationStatus={event.verificationStatus}
              lastVerifiedAt={event.lastVerifiedAt}
              alternative={deriveAlternativeStatus(event.arrangements)}
              hasConflict={peers.some((p) => p.verificationStatus === "VERIFIED")}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alternative arrangements</CardTitle>
              <CardDescription>
                Only alternatives from a municipal source may be recorded. They stay UNVERIFIED (“a possible alternative may be …”) until verified;
                the most recently verified one is what citizens are told.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.arrangements.length === 0 ? (
                <p className="rounded-md bg-unavailable-soft p-3 text-sm text-unavailable-foreground">
                  No alternative arrangement has been officially published.
                </p>
              ) : (
                event.arrangements.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {formatIstDate(a.alternativeDate)}, {formatTime12h(a.alternativeTime)}
                      </p>
                      <VerificationBadge status={a.verificationStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Area: {a.affectedArea} · Source: {a.source} ·{" "}
                      {a.lastVerifiedAt ? `Last verified ${formatIstDateTime(a.lastVerifiedAt)}` : "Not yet verified"}
                    </p>
                    {active && a.verificationStatus !== "VERIFIED" ? (
                      <ArrangementActions
                        arrangementId={a.id}
                        updatedAt={a.updatedAt.toISOString()}
                        preview={renderVerifiedAlternative(event, a)}
                        eventVerified={verified}
                      />
                    ) : null}
                  </div>
                ))
              )}
              {active && current ? (
                <div className="border-t pt-3">
                  <ArrangementForm eventId={event.id} minDate={todayKey} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {active && event.verificationStatus !== "VERIFIED" ? (
                <VerifyEventActions eventId={event.id} updatedAt={event.updatedAt.toISOString()} preview={verifyPreview} />
              ) : null}
              {active && verified ? (
                <p className="text-xs text-muted-foreground">
                  Verified notices are locked. To correct one, withdraw it (citizens receive a retraction) and issue a new notice.
                </p>
              ) : null}
              {active ? (
                <WithdrawEventDialog eventId={event.id} updatedAt={event.updatedAt.toISOString()} preview={retractionPreview} notifiedCount={notifiedCount} />
              ) : (
                <p className="text-sm text-muted-foreground">This notice is {event.status.toLowerCase()} and can no longer be changed.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Ward</dt>
                <dd>{event.ward.name}</dd>
                <dt className="text-muted-foreground">Created by</dt>
                <dd>{event.createdBy.name}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatIstDateTime(event.createdAt)}</dd>
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{event.expiryDate ? formatIstDateTime(event.expiryDate) : "—"}</dd>
                <dt className="text-muted-foreground">Change version</dt>
                <dd>
                  v{event.version} (notified up to v{event.notifiedVersion})
                </dd>
                {event.withdrawalReason ? (
                  <>
                    <dt className="text-muted-foreground">Withdrawn</dt>
                    <dd>
                      {event.withdrawnAt ? formatIstDateTime(event.withdrawnAt) : ""} — {event.withdrawalReason}
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {counts.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No citizen notifications sent for this notice.</span>
                ) : (
                  counts.map((c) => (
                    <Badge key={c.templateKey} variant="secondary">
                      {c.templateKey}: {c._count._all}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden /> Audit trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries.</p>
              ) : (
                <ol className="space-y-2 text-xs">
                  {auditEntries.map((a) => (
                    <li key={a.id} className="border-l-2 border-primary/30 pl-2">
                      <span className="font-mono">{a.action}</span>
                      <span className="block text-muted-foreground">{formatIstDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
