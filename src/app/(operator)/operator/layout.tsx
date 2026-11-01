import { Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
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
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-2">
          <Brand href="/operator" subtitle="Operator console" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{profile.name}</span>
            <SignOutButton label="Sign out" />
          </div>
        </div>
        <div className="container">
          <OperatorNav />
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
