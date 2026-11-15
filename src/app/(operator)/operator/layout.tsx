import { Lock, Plus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SweepLine } from "@/components/motion/eco";
import { ScrollReset } from "@/components/motion/scroll-reset";
import { OperatorNav } from "@/components/operator/operator-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Operator console: OPERATOR role only, enforced here on the server (and again in every API route). */
export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/operator");

  if (profile.role !== "OPERATOR") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">Operator access only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This console is restricted to authorized municipal operators. Your account does not have operator access.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
      </main>
    );
  }

  // Live counts for the nav badges. "Awaiting" uses the same rule as the overview (current = active and not past expiry).
  const now = new Date();
  const [awaiting, complaints] = await Promise.all([
    prisma.civicEvent.count({
      where: { status: "ACTIVE", verificationStatus: "UNVERIFIED", OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] },
    }),
    prisma.complaint.count({ where: { status: { in: ["open", "in_review"] } } }),
  ]);
  const counts = { awaiting, complaints };
  const ai = isAiConfigured();

  return (
    <div className="min-h-dvh pb-10 lg:pl-[19.5rem]">
      {/* Laptops: floating sidebar, same as the citizen app */}
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-72 flex-col gap-5 overflow-y-auto rounded-[2rem] border border-white/10 bg-emerald-950 p-4 text-white shadow-2xl shadow-emerald-950/30 lg:flex">
        <div className="bg-hero grain pointer-events-none absolute inset-0 -z-10 rounded-[2rem] opacity-60" aria-hidden />
        <div className="px-1 pt-1">
          <Brand href="/operator" light />
        </div>

        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Operator console</p>
          <p className="mt-1 flex items-center gap-1.5 font-bold">
            <ShieldCheck className="size-4 shrink-0 text-lime-300" aria-hidden />
            <span className="truncate">{profile.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-white/60">Municipal operator</p>
        </div>

        <Button asChild className="h-12 bg-lime-300 text-emerald-950 shadow-lg shadow-lime-300/20 hover:bg-lime-200">
          <Link href="/operator/events/new">
            <Plus aria-hidden /> New notice
          </Link>
        </Button>

        <OperatorNav variant="side" counts={counts} />

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-lime-300/10 p-3 ring-1 ring-lime-300/20">
            <p className="flex items-center gap-1.5 text-xs font-bold text-lime-300">
              <Sparkles className="size-3.5" aria-hidden /> AI layer
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              {ai ? "On: drafting, extraction, translation and Q&A help." : "Template-only mode. Core alerts are unaffected."}
            </p>
            <SweepLine className="mt-1 text-white" />
          </div>
          <div className="flex items-center justify-end [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
            <SignOutButton label="Sign out" />
          </div>
        </div>
      </aside>

      {/* Smaller screens: floating dark dock with the nav row */}
      <header className="sticky top-0 z-30 px-3 pt-3 lg:hidden">
        <div className="container rounded-[1.75rem] border border-white/10 bg-emerald-950/90 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2">
            <Brand href="/operator" subtitle="Operator console" light />
            <div className="flex items-center gap-2 [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
              <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-lime-200 sm:inline">{profile.name}</span>
              <SignOutButton label="Sign out" />
            </div>
          </div>
          <OperatorNav variant="top" counts={counts} />
        </div>
      </header>

      <main className="container max-w-6xl py-6">{children}</main>
      <ScrollReset />
    </div>
  );
}
