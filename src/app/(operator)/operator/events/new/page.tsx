import type { Metadata } from "next";
import { EventForm } from "@/components/operator/event-form";
import { PageHeader } from "@/components/page-header";
import { isAiConfigured } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "New notice" };

export default async function NewEventPage() {
  const wards = await prisma.ward.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, services: { orderBy: { name: "asc" }, select: { id: true, name: true, normalWeekdays: true } } },
  });
  return (
    <div>
      <PageHeader title="New disruption notice" subtitle="Enter an official municipal notice, or paste its text for AI-assisted drafting." />
      <EventForm wards={wards} aiAvailable={isAiConfigured()} todayKey={istDateKey(new Date())} />
    </div>
  );
}
