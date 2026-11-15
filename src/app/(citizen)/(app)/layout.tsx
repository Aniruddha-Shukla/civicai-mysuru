import { Leaf, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { CitizenNav } from "@/components/citizen-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { SweepLine } from "@/components/motion/eco";
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

  const wardChip = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-primary/15 bg-card px-3 py-1.5 font-semibold text-secondary-foreground shadow-sm">
        <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{ward.name}</span>
      </span>
      <Link href="/onboarding" className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">
        {t("dashboard.changeWard")}
      </Link>
    </>
  );

  return (
    <div className="min-h-dvh pb-28 md:pb-10 lg:pb-8 lg:pl-[19.5rem]">
      {/* Laptops: a floating sidebar that explains every section in one line */}
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-72 flex-col gap-5 overflow-y-auto rounded-[2rem] border border-white/10 bg-emerald-950 p-4 text-white shadow-2xl shadow-emerald-950/30 lg:flex">
        <div className="bg-hero grain pointer-events-none absolute inset-0 -z-10 rounded-[2rem] opacity-60" aria-hidden />
        <div className="px-1 pt-1">
          <Brand href="/dashboard" light />
        </div>

        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{t("nav.yourWard")}</p>
          <p className="mt-1 flex items-center gap-1.5 font-bold">
            <MapPin className="size-4 shrink-0 text-lime-300" aria-hidden />
            <span className="truncate">{ward.name}</span>
          </p>
          <Link href="/onboarding" className="mt-1 inline-block text-xs font-semibold text-lime-300 underline-offset-2 hover:underline">
            {t("dashboard.changeWard")}
          </Link>
        </div>

        <CitizenNav unread={unread} variant="side" />

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-lime-300/10 p-3 ring-1 ring-lime-300/20">
            <p className="flex items-center gap-1.5 text-xs font-bold text-lime-300">
              <Leaf className="size-3.5" aria-hidden /> {t("nav.tipTitle")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">{t("nav.tip")}</p>
            <SweepLine className="mt-1 text-white" />
          </div>
          <div className="flex items-center justify-between [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
            <LanguageToggle signedIn />
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
      </aside>

      {/* Phones and tablets: floating dark dock at the top */}
      <header className="sticky top-0 z-30 px-3 pt-3 lg:hidden">
        <div className="container flex h-16 items-center justify-between gap-2 rounded-[1.75rem] border border-white/10 bg-emerald-950/90 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
          <Brand href="/dashboard" light />
          <CitizenNav unread={unread} variant="top" />
          <div className="flex items-center [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
            <LanguageToggle signedIn />
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
      </header>
      <div className="container flex max-w-6xl items-center gap-2 pt-4 text-xs lg:hidden">{wardChip}</div>

      <main className="container max-w-6xl py-4 lg:py-6">{children}</main>
      <CitizenNav unread={unread} variant="bottom" />
      <ScrollReset />
    </div>
  );
}
