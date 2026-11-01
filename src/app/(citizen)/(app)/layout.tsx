import { MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { CitizenNav } from "@/components/citizen-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT, normalizeLang } from "@/lib/i18n";

/** Every page below requires a ward: citizens without one are sent to onboarding first. */
export default async function CitizenAppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.wardId) redirect("/onboarding");

  const t = getT(normalizeLang(profile.language));
  const [ward, unread] = await Promise.all([
    prisma.ward.findUnique({ where: { id: profile.wardId }, select: { name: true } }),
    prisma.notification.count({ where: { profileId: profile.id, status: "sent" } }),
  ]);
  if (!ward) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2">
          <Brand href="/dashboard" />
          <CitizenNav unread={unread} variant="top" />
          <div className="flex items-center">
            <LanguageToggle signedIn />
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
        <div className="container flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          <span className="truncate">{ward.name}</span>
          <Link href="/onboarding" className="ml-1 shrink-0 text-primary underline-offset-2 hover:underline">
            {t("dashboard.changeWard")}
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl py-5">{children}</main>
      <CitizenNav unread={unread} variant="bottom" />
    </div>
  );
}
