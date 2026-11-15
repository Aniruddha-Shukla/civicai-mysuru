import { FilePlus, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { EventForm } from "@/components/operator/event-form";
import { HeroChip, PageHero } from "@/components/page-hero";
import { isAiConfigured } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { requireOperatorPage } from "@/lib/operator-guard";
import { istDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "New notice" };

export default async function NewEventPage() {
  await requireOperatorPage();
  const wards = await prisma.ward.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, services: { orderBy: { name: "asc" }, select: { id: true, name: true, normalWeekdays: true } } },
  });
  return (
    <div>
      <PageHero
        icon={FilePlus}
        kicker="New notice"
        title="New disruption notice"
        subtitle="Enter an official municipal notice, or paste its text for AI-assisted drafting."
      >
        <HeroChip icon={ShieldCheck} strong>
          Citizens are alerted only after you verify it
        </HeroChip>
        <HeroChip icon={Sparkles}>{isAiConfigured() ? "AI drafting available" : "Manual entry (AI off)"}</HeroChip>
      </PageHero>
      <div className="rounded-[2rem] border bg-card p-4 shadow-soft sm:p-6">
      <EventForm wards={wards} aiAvailable={isAiConfigured()} todayKey={istDateKey(new Date())} />
      </div>
    </div>
  );
}
