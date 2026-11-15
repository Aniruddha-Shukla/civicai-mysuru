import { Camera, ChevronRight, ClipboardList, Eye, Footprints, ListChecks, Megaphone, MapPin, Send, ShieldCheck, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ComplaintForm } from "@/components/citizen/complaint-form";
import { ComplaintStatusBadge } from "@/components/complaint-status-badge";
import { EmptyState } from "@/components/empty-state";
import { HeroChip, PageHero } from "@/components/page-hero";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import type { ComplaintStatus } from "@/lib/constants";
import { loadCitizenWardView } from "@/lib/data/citizen";
import { prisma } from "@/lib/db";
import { formatDateFor, formatDateTimeFor, getT, normalizeLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

  const open = complaints.filter((c) => c.status === "open" || c.status === "in_review").length;
  const next = [
    { Icon: Send, title: t("report.next1Title"), body: t("report.next1Body") },
    { Icon: Eye, title: t("report.next2Title"), body: t("report.next2Body") },
    { Icon: CircleCheck, title: t("report.next3Title"), body: t("report.next3Body") },
  ];
  const tips = [
    { Icon: MapPin, text: t("report.tip1") },
    { Icon: Camera, text: t("report.tip2") },
    { Icon: ShieldCheck, text: t("report.tip3") },
  ];
  // how far along each report is, for the mini progress bar
  const PROGRESS: Record<string, { width: string; bar: string }> = {
    open: { width: "33%", bar: "bg-sky-500" },
    in_review: { width: "66%", bar: "bg-amber-500" },
    resolved: { width: "100%", bar: "bg-emerald-500" },
    rejected: { width: "100%", bar: "bg-slate-400" },
  };

  return (
    <div>
      <PageHero icon={Megaphone} kicker={t("nav.report")} title={t("report.title")} subtitle={t("report.subtitle")}>
        <HeroChip icon={Footprints} strong>
          {t("report.chipSteps")}
        </HeroChip>
        <HeroChip icon={Camera}>{t("report.chipPhoto")}</HeroChip>
        <HeroChip icon={ListChecks}>{t("report.chipTrack")}</HeroChip>
        {open > 0 ? <HeroChip icon={ClipboardList}>{t("report.openCount", { count: open })}</HeroChip> : null}
      </PageHero>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <div className="rounded-[2rem] border bg-card p-4 shadow-soft sm:p-6">
            <ComplaintForm
              services={view.services.map((s) => ({ id: s.id, name: s.name }))}
              notices={view.events.map((e) => ({ id: e.id, serviceId: e.serviceId, label: `${formatDateFor(lang, e.affectedDate)} — ${e.reason}` }))}
              aiAvailable={isAiConfigured()}
            />
          </div>
        </section>

        <aside className="min-w-0 space-y-6 lg:col-span-5">
          {/* What happens after you press send */}
          <section aria-labelledby="next-heading" className="rounded-[2rem] border bg-card p-5 shadow-soft">
            <h2 id="next-heading" className="mb-4 text-lg font-extrabold">
              {t("report.nextTitle")}
            </h2>
            <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-amber-400 before:to-emerald-400">
              {next.map((step, i) => (
                <li key={step.title} className="relative flex gap-3">
                  <span className="bg-hero relative flex size-10 shrink-0 items-center justify-center rounded-2xl text-lime-300 shadow-md shadow-primary/30">
                    <step.Icon className="size-5" aria-hidden />
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-lime-300 text-[10px] font-black text-emerald-950">
                      {i + 1}
                    </span>
                  </span>
                  <span className="pt-0.5">
                    <span className="block font-bold">{step.title}</span>
                    <span className="block text-sm text-muted-foreground">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="tips-heading" className="rounded-[2rem] border border-lime-300/60 bg-lime-50 p-5">
            <h2 id="tips-heading" className="mb-3 font-extrabold text-emerald-900">
              {t("report.tipsTitle")}
            </h2>
            <ul className="space-y-2.5">
              {tips.map((tip) => (
                <li key={tip.text} className="flex items-start gap-2.5 text-sm text-emerald-950">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                    <tip.Icon className="size-4" aria-hidden />
                  </span>
                  <span className="pt-1">{tip.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="complaints-heading" className="space-y-3">
            <h2 id="complaints-heading" className="text-lg font-extrabold">
              {t("report.yourComplaints")}
            </h2>
            {complaints.length === 0 ? (
              <EmptyState icon={ClipboardList} title={t("report.noComplaints")} body={t("report.noComplaintsBody")} />
            ) : (
              <ul className="space-y-2.5">
                {complaints.map((c) => {
                  const progress = PROGRESS[c.status] ?? PROGRESS.open!;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/report/${c.id}`}
                        data-spotlight
                        className="spotlight group block rounded-2xl border bg-card p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{c.description}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.service.name} · {formatDateTimeFor(lang, c.createdAt)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <ComplaintStatusBadge status={c.status} label={t(`tracker.steps.${c.status as ComplaintStatus}`)} />
                            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </span>
                        <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className={cn("block h-full rounded-full", progress.bar)} style={{ width: progress.width }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
