import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { WardPicker } from "@/components/onboarding/ward-picker";
import { PageHeader } from "@/components/page-header";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEMO_MAP_CENTER } from "@/lib/demo/wards";
import { getT, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Choose your ward" };

export default async function OnboardingPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const lang = normalizeLang(profile.language);
  const t = getT(lang);
  const wards = await prisma.ward.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, zone: true, geojson: true } });

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <Brand href={profile.wardId ? "/dashboard" : "/onboarding"} />
          <LanguageToggle signedIn />
        </div>
      </header>
      <main className="container max-w-2xl py-6">
        <PageHeader title={t("onboarding.title")} subtitle={t("onboarding.subtitle")} />
        <WardPicker
          wards={wards}
          currentWardId={profile.wardId}
          language={lang}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || null}
          center={DEMO_MAP_CENTER}
        />
      </main>
    </div>
  );
}
