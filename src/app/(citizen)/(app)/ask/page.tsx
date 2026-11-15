import { Languages, MessageCircleQuestionMark, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AskPanel } from "@/components/citizen/ask-panel";
import { HeroChip, PageHero } from "@/components/page-hero";
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
      <PageHero icon={MessageCircleQuestionMark} kicker={t("nav.ask")} title={t("ask.title")} subtitle={t("ask.subtitle")}>
        <HeroChip icon={ShieldCheck} strong>
          {t("ask.chipVerified")}
        </HeroChip>
        <HeroChip icon={Languages}>{t("ask.chipLang")}</HeroChip>
      </PageHero>
      <AskPanel aiAvailable={isAiConfigured()} />
    </div>
  );
}
