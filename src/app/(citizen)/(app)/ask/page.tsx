import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AskPanel } from "@/components/citizen/ask-panel";
import { PageHeader } from "@/components/page-header";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { getT, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const t = getT(normalizeLang(profile.language));
  return (
    <div>
      <PageHeader title={t("ask.title")} subtitle={t("ask.subtitle")} />
      <AskPanel aiAvailable={isAiConfigured()} />
    </div>
  );
}
