import { MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { CitizenNav } from "@/components/citizen-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { ScrollReset } from "@/components/motion/scroll-reset";
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
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-card/90 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-2">
          <Brand href="/dashboard" />
          <CitizenNav unread={unread} variant="top" />
          <div className="flex items-center">
            <LanguageToggle signedIn />
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
        <div className="container flex items-center gap-2 pb-2.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{ward.name}</span>
          </span>
          <Link href="/onboarding" className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">
            {t("dashboard.changeWard")}
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl py-5">{children}</main>
      <CitizenNav unread={unread} variant="bottom" />
      <ScrollReset />
    </div>
  );
}
