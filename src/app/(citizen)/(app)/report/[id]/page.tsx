import { ArrowLeft, Check, CircleX, MapPin, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteLocationButton } from "@/components/citizen/delete-location-button";
import { ComplaintStatusBadge } from "@/components/complaint-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth";
import type { ComplaintStatus } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDateFor, formatDateTimeFor, getT, normalizeLang } from "@/lib/i18n";
import { COMPLAINT_PHOTO_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaint status" };

const ORDER: ComplaintStatus[] = ["open", "in_review", "resolved"];

export default async function ComplaintTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const { id } = await params;
  const lang = normalizeLang(profile.language);
  const t = getT(lang);

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { service: { select: { name: true } }, event: { select: { affectedDate: true, reason: true } } },
  });
  // Same 404 whether it does not exist or belongs to someone else — no information leak.
  if (!complaint || complaint.profileId !== profile.id) notFound();

  let photoUrl: string | null = null;
  if (complaint.photoUrl) {
    const signed = await getSupabaseAdmin()?.storage.from(COMPLAINT_PHOTO_BUCKET).createSignedUrl(complaint.photoUrl, 600);
    photoUrl = signed?.data?.signedUrl ?? null;
  }

  const status = complaint.status as ComplaintStatus;
  const steps: ComplaintStatus[] = status === "rejected" ? ["open", "in_review", "rejected"] : ORDER;
  const reached = status === "rejected" ? 2 : ORDER.indexOf(status);
  const location = complaint.location as { lat: number; lng: number } | null;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/report">
          <ArrowLeft aria-hidden />
          {t("tracker.back")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("tracker.title")}</CardTitle>
            <ComplaintStatusBadge status={status} label={t(`tracker.steps.${status}`)} />
          </div>
          <p className="text-xs text-muted-foreground">
            {complaint.service.name} · {t("tracker.submittedOn", { date: formatDateTimeFor(lang, complaint.createdAt) })}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="grid grid-cols-3 gap-2" aria-label={t("tracker.title")}>
            {steps.map((step, i) => {
              const done = i <= reached;
              const failed = step === "rejected";
              return (
                <li key={step} className="flex flex-col items-center gap-1 text-center text-xs">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2",
                      done ? (failed ? "border-unavailable bg-unavailable text-white" : "border-primary bg-primary text-primary-foreground") : "border-muted bg-muted text-muted-foreground",
                    )}
                  >
                    {failed && done ? <CircleX className="size-4" aria-hidden /> : done ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={done ? "font-medium" : "text-muted-foreground"}>{t(`tracker.steps.${step}`)}</span>
                </li>
              );
            })}
          </ol>

          <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">{complaint.description}</p>
          {complaint.event ? (
            <p className="text-xs text-muted-foreground">
              {t("report.linkNotice")}: {formatDateFor(lang, complaint.event.affectedDate)} — {complaint.event.reason}
            </p>
          ) : null}

          {complaint.operatorNote ? (
            <div className="rounded-md border border-primary/30 bg-secondary p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <MessageSquareText className="size-3.5" aria-hidden />
                {t("tracker.operatorNote")}
              </p>
              {complaint.operatorNote}
            </div>
          ) : null}

          {photoUrl ? (
            <figure className="space-y-1">
              <figcaption className="text-xs font-medium text-muted-foreground">{t("tracker.photo")}</figcaption>
              {/* Short-lived signed URL from a private bucket; next/image is not used for expiring URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={t("tracker.photo")} className="max-h-72 rounded-md border object-contain" />
            </figure>
          ) : null}

          <div className="space-y-2 rounded-md border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {t("tracker.location")}
            </p>
            {location ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {location.lat}, {location.lng}
                </span>
                <DeleteLocationButton complaintId={complaint.id} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("tracker.noLocation")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
