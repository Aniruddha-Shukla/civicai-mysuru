import { ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ComplaintForm } from "@/components/citizen/complaint-form";
import { ComplaintStatusBadge } from "@/components/complaint-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import type { ComplaintStatus } from "@/lib/constants";
import { loadCitizenWardView } from "@/lib/data/citizen";
import { prisma } from "@/lib/db";
import { formatDateFor, formatDateTimeFor, getT, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage() {
  const profile = await getSessionProfile();
  if (!profile?.wardId) redirect("/onboarding");
  const lang = normalizeLang(profile.language);
  const t = getT(lang);

  const [view, complaints] = await Promise.all([
    loadCitizenWardView(profile.wardId),
    prisma.complaint.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { service: { select: { name: true } } },
    }),
  ]);
  if (!view) redirect("/onboarding");

  return (
    <div className="space-y-8">
      <section>
        <PageHeader title={t("report.title")} subtitle={t("report.subtitle")} />
        <Card>
          <CardContent className="p-4 sm:p-5">
            <ComplaintForm
              services={view.services.map((s) => ({ id: s.id, name: s.name }))}
              notices={view.events.map((e) => ({ id: e.id, serviceId: e.serviceId, label: `${formatDateFor(lang, e.affectedDate)} — ${e.reason}` }))}
              aiAvailable={isAiConfigured()}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="complaints-heading" className="space-y-3">
        <h2 id="complaints-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("report.yourComplaints")}
        </h2>
        {complaints.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("report.noComplaints")} body={t("report.noComplaintsBody")} />
        ) : (
          <ul className="space-y-2">
            {complaints.map((c) => (
              <li key={c.id}>
                <Link href={`/report/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.service.name} · {formatDateTimeFor(lang, c.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <ComplaintStatusBadge status={c.status} label={t(`tracker.steps.${c.status as ComplaintStatus}`)} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
