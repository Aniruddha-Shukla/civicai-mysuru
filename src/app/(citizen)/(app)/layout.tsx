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
    <div className="min-h-dvh pb-28 md:pb-10">
      {/* Floating dark dock */}
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="container flex h-16 items-center justify-between gap-2 rounded-[1.75rem] border border-white/10 bg-emerald-950/90 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
          <Brand href="/dashboard" light />
          <CitizenNav unread={unread} variant="top" />
          <div className="flex items-center [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
            <LanguageToggle signedIn />
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
      </header>
      <div className="container flex max-w-6xl items-center gap-2 pt-4 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-primary/15 bg-card px-3 py-1.5 font-semibold text-secondary-foreground shadow-sm">
          <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{ward.name}</span>
        </span>
        <Link href="/onboarding" className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">
          {t("dashboard.changeWard")}
        </Link>
      </div>
      <main className="container max-w-6xl py-4 lg:py-6">{children}</main>
      <CitizenNav unread={unread} variant="bottom" />
      <ScrollReset />
    </div>
  );
}
