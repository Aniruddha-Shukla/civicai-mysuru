import { Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ScrollReset } from "@/components/motion/scroll-reset";
import { OperatorNav } from "@/components/operator/operator-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/auth";

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

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="container rounded-[1.75rem] border border-white/10 bg-emerald-950/90 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2">
            <Brand href="/operator" subtitle="Operator console" light />
            <div className="flex items-center gap-2 [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-white/80">
              <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-lime-200 sm:inline">{profile.name}</span>
              <SignOutButton label="Sign out" />
            </div>
          </div>
          <OperatorNav />
        </div>
      </header>
      <main className="container py-6">{children}</main>
      <ScrollReset />
    </div>
  );
}
